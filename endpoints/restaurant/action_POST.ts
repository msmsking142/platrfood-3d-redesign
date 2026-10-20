import superjson from "superjson";
import { publish } from "@floot/realtime";
import { db } from "../../helpers/db";
import { schema, OutputType } from "./action_POST.schema";
import { requireRole, HttpError } from "../../helpers/requireRole";
import { notifyZipto } from "../../helpers/notifyZipto";
import { channels } from "../../helpers/realtimeChannels";
import { orderPayments } from "../../helpers/orderPayments";
import { deliveryProtection } from "../../helpers/deliveryProtection";
import { proSubscription } from "../../helpers/proSubscription";
import type { OrderStatus } from "../../helpers/schema";

const allowedFrom: Record<string, OrderStatus[]> = {
  accepted: ["placed"],
  rejected: ["placed"],
  preparing: ["accepted"],
  ready: ["accepted", "preparing"],
};

export async function handle(request: Request) {
  try {
    const user = await requireRole(request, ["restaurant"]);
    const input = schema.parse(superjson.parse(await request.text()));
    const restaurant = await db
      .selectFrom("restaurants")
      .select(["id", "status", "proPaidUntil"])
      .where("ownerUserId", "=", user.id)
      .executeTakeFirst();
    if (!restaurant) throw new HttpError(400, "Complete your restaurant profile first");
    const rid = restaurant.id;

    switch (input.action) {
      case "mark_admin_note_read":
        await db.updateTable("adminPartnerNotes").set({ readAt: new Date() })
          .where("recipientRole", "=", "restaurant").where("recipientId", "=", rid).where("readAt", "is", null).execute();
        break;
      case "reply_admin_note": {
        const updated = await db.updateTable("adminPartnerNotes")
          .set({ partnerReply: input.reply.trim(), partnerRepliedAt: new Date(), readAt: new Date() } as any)
          .where("recipientRole", "=", "restaurant").where("recipientId", "=", rid)
          .returning("id").executeTakeFirst();
        if (!updated) throw new HttpError(404, "There is no admin note to reply to");
        await publish(channels.admin(), { type: "admin" }).catch(() => {});
        break;
      }
      case "set_open":
        if (input.isOpen && restaurant.status !== "approved")
          throw new HttpError(400, "Your restaurant is waiting for platr™ approval");
        await db.updateTable("restaurants").set({ isOpen: input.isOpen }).where("id", "=", rid).execute();
        break;
      case "start_pro_trial":
        await proSubscription.startTrial(rid);
        break;
      case "cancel_pro_trial":
        await proSubscription.cancelTrial(rid);
        break;
      case "set_plan":
        if (input.plan === "pro" && (!restaurant.proPaidUntil || restaurant.proPaidUntil <= new Date()))
          throw new HttpError(402, "Please pay for the Pro plan to activate it");
        await db.updateTable("restaurants").set({ plan: input.plan }).where("id", "=", rid).execute();
        break;
      case "update_fssai": {
        const expiry = new Date(`${input.fssaiExpiryDate}T23:59:59.999Z`);
        if (!Number.isFinite(expiry.getTime()) || expiry <= new Date()) throw new HttpError(400, "FSSAI licence must be valid and not expired");
        await db.updateTable("restaurants").set({ fssaiDocumentUrl: input.fssaiDocumentUrl, fssaiLicenseNumber: input.fssaiLicenseNumber, fssaiExpiryDate: expiry, fssaiVerificationStatus: "not_checked", fssaiVerificationCheckedAt: null, fssaiVerificationNote: null, status: "pending", isOpen: false }).where("id", "=", rid).execute();
        break;
      }
      case "update_payout_details": {
        if (
          !(input.accountNumber && input.ifsc) &&
          !input.upiId
        ) {
          throw new HttpError(400, "Add bank account and IFSC, or a UPI ID");
        }
        if (Boolean(input.accountNumber) !== Boolean(input.ifsc)) {
          throw new HttpError(400, "Bank account and IFSC must be provided together");
        }
        await db.updateTable("restaurants")
          .set({
            ...(input.pan ? { pan: input.pan } : {}),
            payoutAccountHolder: input.accountHolder,
            payoutAccountNumber: input.accountNumber || null,
            payoutIfsc: input.ifsc || null,
            payoutUpiId: input.upiId || null,
            payoutDetailsUpdatedAt: new Date(),
          })
          .where("id", "=", rid).execute();
        await db.updateTable("restaurantPayouts")
          .set({ status: "pending", note: null })
          .where("restaurantId", "=", rid)
          .where("status", "=", "on_hold")
          .where("note", "like", "Add bank%")
          .execute();
        break;
      }
      case "set_prep":
        await db.updateTable("restaurants").set({ avgPrepMinutes: input.avgPrepMinutes }).where("id", "=", rid).execute();
        break;
      case "set_location":
        await db.updateTable("restaurants").set({ lat: input.lat, lng: input.lng }).where("id", "=", rid).execute();
        break;
      case "update_outlet":
        await db.updateTable("restaurants")
          .set({
            description: input.description || null,
            cuisine: input.cuisine || null,
            address: input.address,
            phone: input.phone,
          })
          .where("id", "=", rid).execute();
        break;
      case "submit_profile_image":
        await db.updateTable("restaurants")
          .set({ pendingProfileImageUrl: input.imageUrl, profileImageReview: "pending", profileImageRejectReason: null })
          .where("id", "=", rid).execute();
        await publish(channels.admin(), { type: "admin" }).catch(() => {});
        break;
      case "cancel_profile_image": {
        const current = await db.selectFrom("restaurants").select("profileImageUrl")
          .where("id", "=", rid).executeTakeFirstOrThrow();
        await db.updateTable("restaurants")
          .set({
            pendingProfileImageUrl: null,
            profileImageReview: current.profileImageUrl ? "approved" : "none",
            profileImageRejectReason: null,
          })
          .where("id", "=", rid).execute();
        await publish(channels.admin(), { type: "admin" }).catch(() => {});
        break;
      }
      case "save_item": {
        const values = {
          name: input.name,
          description: input.description || null,
          category: input.category,
          price: input.price,
          isVeg: input.isVeg,
          isAvailable: input.isAvailable,
        };
        const submittedUrl = input.imageUrl || null;
        let photoSubmitted = false;

        if (input.id !== undefined) {
          photoSubmitted = await db.transaction().execute(async (transaction) => {
            const current = await transaction.selectFrom("menuItems")
              .select(["imageUrl", "pendingImageUrl"])
              .where("id", "=", input.id!)
              .where("restaurantId", "=", rid)
              .forUpdate()
              .executeTakeFirst();
            if (!current) throw new HttpError(404, "Item not found");

            const newPhoto = submittedUrl !== null &&
              submittedUrl !== current.imageUrl &&
              submittedUrl !== current.pendingImageUrl;
            await transaction.updateTable("menuItems")
              .set({
                ...values,
                ...(!submittedUrl
                  ? {
                      imageUrl: null,
                      pendingImageUrl: null,
                      imageReview: "none" as const,
                      imageRejectReason: null,
                    }
                  : newPhoto
                    ? {
                        pendingImageUrl: submittedUrl,
                        imageReview: "pending" as const,
                        imageRejectReason: null,
                      }
                    : {}),
              })
              .where("id", "=", input.id!)
              .where("restaurantId", "=", rid)
              .execute();
            return newPhoto;
          });
        } else {
          await db.insertInto("menuItems").values({
            ...values,
            restaurantId: rid,
            imageUrl: null,
            pendingImageUrl: submittedUrl,
            imageReview: submittedUrl ? "pending" : "none",
            imageRejectReason: null,
          }).execute();
          photoSubmitted = submittedUrl !== null;
        }
        if (photoSubmitted) {
          await publish(channels.admin(), { type: "admin" }).catch(() => {});
        }
        break;
      }
      case "delete_item":
        await db.deleteFrom("menuItems").where("id", "=", input.id).where("restaurantId", "=", rid).execute();
        break;
      case "toggle_item":
        await db.updateTable("menuItems").set({ isAvailable: input.isAvailable })
          .where("id", "=", input.id).where("restaurantId", "=", rid).execute();
        break;
      case "dispute_compensation": {
        const now = new Date();
        const disputed = await db.updateTable("restaurantCompensations")
          .set({
            status: "disputed",
            disputeNote: input.note,
            disputedAt: now,
            updatedAt: now,
          })
          .where("orderId", "=", input.orderId)
          .where("restaurantId", "=", rid)
          .where("status", "in", ["not_eligible", "rejected"])
          .where("disputedAt", "is", null)
          .returning("id")
          .executeTakeFirst();
        if (!disputed) {
          throw new HttpError(409, "This compensation can't be disputed (already disputed or approved)");
        }
        await deliveryProtection.logEvent(
          db, input.orderId, "compensation_disputed", "compensation_disputed",
          { note: input.note },
        );
        await publish(channels.admin(), { type: "admin" })
          .catch((error: unknown) => console.error("Could not publish compensation dispute:", error));
        break;
      }
      case "order": {
        const order = await db.selectFrom("orders").select(["id", "status", "paymentMethod", "paymentStatus"])
          .where("id", "=", input.orderId).where("restaurantId", "=", rid).executeTakeFirst();
        if (!order) throw new HttpError(404, "Order not found");
        if (order.paymentMethod === "upi" && order.paymentStatus === "pending")
          throw new HttpError(400, "Waiting for customer's online payment");
        if (!allowedFrom[input.to].includes(order.status))
          throw new HttpError(400, `Order is already ${order.status.replace("_", " ")}`);
        const now = new Date();
        const updated = await db.updateTable("orders")
          .set({
            status: input.to,
            cancelReason: input.to === "rejected" ? input.reason || "Restaurant could not take this order" : null,
            updatedAt: now,
            ...(input.to === "accepted" ? { restaurantAcceptedAt: now } : {}),
            ...(input.to === "preparing" ? { preparingAt: now } : {}),
            ...(input.to === "ready" ? { readyAt: now } : {}),
          })
          .where("id", "=", order.id)
          .where("status", "in", allowedFrom[input.to])
          .returning(["id", "riderId"])
          .executeTakeFirst();
        if (!updated) throw new HttpError(409, "Order status changed. Please refresh and try again");
        if (input.to === "rejected") {
          try {
            await orderPayments.refundIfPaid(
              order.id,
              input.reason || "Restaurant could not take this order",
            );
          } catch (error) {
            console.error(`Refund failed after rejecting order ${order.id}:`, error);
            throw new HttpError(
              502,
              "Order rejected. Refund could not be started automatically – platr™ support will refund the customer.",
            );
          }
        }
        await notifyZipto(order.id);
        try {
          if (input.to === "accepted" && updated.riderId === null) {
            await deliveryProtection.onRestaurantAccepted(order.id);
          } else if (input.to === "preparing") {
            await deliveryProtection.onPreparing(order.id);
          } else if (input.to === "ready") {
            await deliveryProtection.onReady(order.id);
          }
        } catch (error) {
          console.error(`Delivery protection failed after order ${order.id} moved to ${input.to}:`, error);
        }
        break;
      }
    }
    return requireRole.json({ ok: true } satisfies OutputType);
  } catch (e) {
    return requireRole.errorResponse(e);
  }
}