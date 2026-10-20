import superjson from "superjson";
import { db } from "../../helpers/db";
import { schema, OutputType } from "./action_POST.schema";
import { requireRole, HttpError } from "../../helpers/requireRole";
import { notifyZipto } from "../../helpers/notifyZipto";
import { publish } from "@floot/realtime";
import { channels } from "../../helpers/realtimeChannels";
import { financialLedger } from "../../helpers/financialLedger";
import { ziptoConfig } from "../../helpers/ziptoConfig";
import { deliveryProtection } from "../../helpers/deliveryProtection";
import { riderSearchDecision } from "../../helpers/riderSearchDecision";

export async function handle(request: Request) {
  try {
    const user = await requireRole(request, ["rider"]);
    const input = schema.parse(superjson.parse(await request.text()));
    const rider = await db
      .selectFrom("riders")
      .select(["id", "status", "town", "isOnline", "licenceFile", "selfieFile", "lastLat", "lastLng", "onboardingFeePaidAt"])
      .where("userId", "=", user.id)
      .executeTakeFirst();
    if (!rider) throw new HttpError(400, "Complete your rider profile first");
    if (input.action === "mark_admin_note_read") {
      await db.updateTable("adminPartnerNotes").set({ readAt: new Date() })
        .where("recipientRole", "=", "rider").where("recipientId", "=", rider.id).where("readAt", "is", null).execute();
      return requireRole.json({ ok: true } satisfies OutputType);
    }
    if (input.action === "reply_admin_note") {
      const updated = await db.updateTable("adminPartnerNotes")
        .set({ partnerReply: input.reply.trim(), partnerRepliedAt: new Date(), readAt: new Date() } as any)
        .where("recipientRole", "=", "rider").where("recipientId", "=", rider.id)
        .returning("id").executeTakeFirst();
      if (!updated) throw new HttpError(404, "There is no admin note to reply to");
      await publish(channels.admin(), { type: "admin" }).catch(() => {});
      return requireRole.json({ ok: true } satisfies OutputType);
    }
    if (!rider.onboardingFeePaidAt) {
      throw new HttpError(402, "Pay the mandatory one-time onboarding fee to unlock the rest of your rider account");
    }
    if (input.action === "submit_documents") {
      if (rider.status === "approved") throw new HttpError(400, "Your account is already verified");
      if (!rider.onboardingFeePaidAt)
        throw new HttpError(402, "Pay the one-time onboarding fee before sending documents for review");
      if (rider.status === "suspended")
        throw new HttpError(400, `Your account is suspended. Please contact platr™ Support at ${ziptoConfig.supportUrl}`);
      if (
        !input.licenceFile.startsWith(`rider-kyc/${user.id}/licence-`) ||
        !input.selfieFile.startsWith(`rider-kyc/${user.id}/selfie-`)
      ) {
        throw new HttpError(400, "Documents must be uploaded to your own rider KYC folder");
      }
      await db.updateTable("riders")
        .set({
          licenceFile: input.licenceFile,
          selfieFile: input.selfieFile,
          vehicleType: input.vehicleType,
          vehicleNumber: input.vehicleNumber.trim().toUpperCase(),
          ...(input.alternatePhone ? { alternatePhone: input.alternatePhone } : {}),
          ...(input.licenceExpiryDate ? { licenceExpiryDate: new Date(`${input.licenceExpiryDate}T00:00:00.000Z`) } : {}),
          payoutAccountHolder: input.accountHolder.trim(),
          payoutAccountNumber: input.accountNumber,
          payoutIfsc: input.ifsc.trim().toUpperCase(),
          payoutUpiId: null,
          payoutDetailsUpdatedAt: new Date(),
          documentsSubmittedAt: new Date(),
          status: "pending",
          reviewNote: null,
        })
        .where("id", "=", rider.id)
        .where("status", "in", ["pending", "rejected"])
        .executeTakeFirstOrThrow();
      await publish(channels.admin(), { type: "partner" })
        .catch((error: unknown) => console.error("Failed to publish rider KYC submission:", error));
      return requireRole.json({ ok: true } satisfies OutputType);
    }

    if (input.action === "update_profile") {
      await db.updateTable("riders")
        .set({
          vehicleType: input.vehicleType,
          vehicleNumber: input.vehicleNumber ?? null,
          phone: input.phone,
          alternatePhone: input.alternatePhone,
          licenceExpiryDate: new Date(`${input.licenceExpiryDate}T00:00:00.000Z`),
        })
        .where("id", "=", rider.id)
        .execute();
      return requireRole.json({ ok: true } satisfies OutputType);
    }

    if (input.action === "update_payout_details") {
      if (!(input.accountNumber && input.ifsc) && !input.upiId) {
        throw new HttpError(400, "Add bank account and IFSC, or a UPI ID");
      }
      if (Boolean(input.accountNumber) !== Boolean(input.ifsc)) {
        throw new HttpError(400, "Bank account and IFSC must be provided together");
      }
      await db.transaction().execute(async (transaction) => {
        await transaction.updateTable("riders")
          .set({
            payoutAccountHolder: input.accountHolder,
            payoutAccountNumber: input.accountNumber || null,
            payoutIfsc: input.ifsc || null,
            payoutUpiId: input.upiId || null,
            payoutDetailsUpdatedAt: new Date(),
          })
          .where("id", "=", rider.id).execute();
        await transaction.updateTable("riderPayouts")
          .set({ status: "pending", note: null })
          .where("riderId", "=", rider.id)
          .where("status", "=", "on_hold")
          .where("note", "like", "Add UPI%")
          .execute();
      });
      return requireRole.json({ ok: true } satisfies OutputType);
    }

    if (rider.status !== "approved")
      throw new HttpError(400, "Your rider account is waiting for platr™ approval");

    if (input.action === "set_online") {
      await db.updateTable("riders").set({ isOnline: input.isOnline }).where("id", "=", rider.id).execute();
      return requireRole.json({ ok: true } satisfies OutputType);
    }

    if (input.action === "accept") {
      if (!rider.isOnline) throw new HttpError(400, "Go online to accept orders");
      const active = await db.selectFrom("orders").select("id")
        .where("riderId", "=", rider.id).where("status", "in", ["accepted", "preparing", "ready", "picked_up"])
        .execute();
      if (active.length >= 2) throw new HttpError(400, "Finish your current deliveries first (max 2 at a time)");
      const candidate = await db.selectFrom("orders")
        .select(["riderId", "status"])
        .where("id", "=", input.orderId)
        .executeTakeFirst();
      if (!candidate) throw new HttpError(404, "Order not found");
      // Advance the deadline before assignment so an overdue search cannot be accepted.
      if (candidate.riderId === null && ["accepted", "preparing", "ready"].includes(candidate.status)) {
        if ((await deliveryProtection.tick(input.orderId)).cancelled) {
          throw new HttpError(409, "This order was cancelled because no delivery partner was available");
        }
      }
      const pickup = await db.selectFrom("orders")
        .innerJoin("restaurants", "restaurants.id", "orders.restaurantId")
        .select([
          "orders.restaurantId", "orders.riderSearchRadiusM",
          "restaurants.lat as restaurantLat", "restaurants.lng as restaurantLng",
        ])
        .where("orders.id", "=", input.orderId)
        .executeTakeFirstOrThrow();
      if (!riderSearchDecision.withinRadius(
        rider.lastLat, rider.lastLng,
        pickup.restaurantLat, pickup.restaurantLng,
        pickup.riderSearchRadiusM,
      )) {
        throw new HttpError(409, "This order is outside your current pickup radius");
      }
      // Atomic: first rider to accept wins. Reject an assignment if its checked radius changed.
      const r = await db.updateTable("orders")
        .set({ riderId: rider.id, updatedAt: new Date() })
        .where("id", "=", input.orderId)
        .where("riderId", "is", null)
        .where("town", "=", rider.town)
        .where("status", "in", ["accepted", "preparing", "ready"])
        .where((eb) => pickup.riderSearchRadiusM === null
          ? eb("riderSearchRadiusM", "is", null)
          : eb("riderSearchRadiusM", "=", pickup.riderSearchRadiusM))
        .executeTakeFirst();
      if (!Number(r.numUpdatedRows)) throw new HttpError(409, "Another rider already took this order");
      try {
        await deliveryProtection.onRiderAssigned(input.orderId, rider.id);
      } catch (error) {
        console.error(`Could not record rider assignment for order ${input.orderId}:`, error);
      }
      await notifyZipto(input.orderId);
      return requireRole.json({ ok: true } satisfies OutputType);
    }

    const order = await db.selectFrom("orders").select(["id", "status", "paymentMethod"])
      .where("id", "=", input.orderId).where("riderId", "=", rider.id).executeTakeFirst();
    if (!order) throw new HttpError(404, "Order not found");

    if (input.action === "picked_up") {
      if (order.status !== "ready") throw new HttpError(400, "Wait until the restaurant marks the order ready");
      await db.updateTable("orders").set({ status: "picked_up", updatedAt: new Date() })
        .where("id", "=", order.id).execute();
    } else {
      if (order.status !== "picked_up") throw new HttpError(400, "Pick up the order first");
      const updated = await db.updateTable("orders")
        .set({
          status: "delivered",
          deliveredAt: new Date(),
          updatedAt: new Date(),
          // Cash collected at the door
          ...(order.paymentMethod === "cod" ? { paymentStatus: "paid" as const } : {}),
        })
        .where("id", "=", order.id)
        .where("status", "=", "picked_up")
        .executeTakeFirst();
      if (!Number(updated.numUpdatedRows)) {
        throw new HttpError(409, "Order has already been delivered or its status has changed");
      }
      try {
        await financialLedger.onOrderDelivered(order.id);
      } catch (error) {
        console.error(`Failed to record delivery finances for order ${order.id}:`, error);
      }
    }
    await notifyZipto(order.id);
    return requireRole.json({ ok: true } satisfies OutputType);
  } catch (e) {
    return requireRole.errorResponse(e);
  }
}