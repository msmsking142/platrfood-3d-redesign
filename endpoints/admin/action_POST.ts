import superjson from "superjson";
import { publish } from "@floot/realtime";
import { db } from "../../helpers/db";
import { schema, OutputType } from "./action_POST.schema";
import { requireRole, HttpError } from "../../helpers/requireRole";
import { notifyZipto } from "../../helpers/notifyZipto";
import { channels } from "../../helpers/realtimeChannels";
import { proSubscription } from "../../helpers/proSubscription";
import { orderPayments } from "../../helpers/orderPayments";
import { createWeeklyPayouts } from "../../helpers/createWeeklyPayouts";
import { financialLedger } from "../../helpers/financialLedger";
import { payoutWorkflow } from "../../helpers/payoutWorkflow";
import { adminPricingActions } from "../../helpers/adminPricingActions";
import { ziptoWallet } from "../../helpers/ziptoWallet";

export async function handle(request: Request) {
  try {
    const admin = await requireRole(request, ["admin"]);
    const input = schema.parse(superjson.parse(await request.text()));
    switch (input.action) {
      case "restaurant_status":
        if (input.status === "approved") {
          const licence = await db.selectFrom("restaurants").select(["fssaiDocumentUrl", "fssaiExpiryDate", "fssaiLicenseNumber", "fssaiVerificationStatus"]).where("id", "=", input.id).executeTakeFirst();
          if (!licence?.fssaiDocumentUrl || !licence.fssaiLicenseNumber || !licence.fssaiExpiryDate || new Date(licence.fssaiExpiryDate) <= new Date())
            throw new HttpError(400, "Cannot approve this restaurant until it has an FSSAI number and valid, unexpired licence uploaded.");
          if (licence.fssaiVerificationStatus !== "verified")
            throw new HttpError(400, "Check the FSSAI licence against official records and mark it verified before approving this restaurant.");
        }
        await db.updateTable("restaurants")
          .set({ status: input.status, ...(input.status !== "approved" ? { isOpen: false } : {}) })
          .where("id", "=", input.id).execute();
        await publish(channels.restaurant(input.id), { type: "status" }).catch(() => {});
        break;
      case "fssai_verification": {
        const restaurant = await db.selectFrom("restaurants").select(["fssaiLicenseNumber", "fssaiDocumentUrl", "fssaiExpiryDate"]).where("id", "=", input.id).executeTakeFirst();
        if (!restaurant?.fssaiLicenseNumber || !restaurant.fssaiDocumentUrl || !restaurant.fssaiExpiryDate) throw new HttpError(400, "FSSAI number, document and expiry date are required before review");
        if (new Date(restaurant.fssaiExpiryDate) < new Date()) throw new HttpError(400, "This FSSAI licence is expired");
        if (input.status === "verified" && !input.note?.trim()) throw new HttpError(400, "Add a note confirming how the licence was checked against official records");
        await db.updateTable("restaurants").set({ fssaiVerificationStatus: input.status, fssaiVerificationCheckedAt: new Date(), fssaiVerificationNote: input.note?.trim() || null }).where("id", "=", input.id).execute();
        break;
      }
      case "rider_manual_verification": {
        const rider = await db.selectFrom("riders").select(["licenceFile", "selfieFile", "reviewNote"]).where("id", "=", input.id).executeTakeFirst();
        if (!rider) throw new HttpError(404, "Rider was not found");
        if (input.check === "identity" && !rider.selfieFile) throw new HttpError(400, "Rider selfie is required before identity review");
        if (input.check === "licence" && !rider.licenceFile) throw new HttpError(400, "Driving licence document is required before review");
        const now = new Date();
        const reviewLine = `${input.check === "identity" ? "Identity" : "Driving licence"}: ${input.note.trim()}`;
        const nextReviewNote = [reviewLine, ...(rider.reviewNote || "").split("\n").filter((line) => line && !line.startsWith("Vehicle RC "))].join("\n").slice(0, 300);
        await db.updateTable("riders").set({
          ...(input.check === "identity" ? { identityVerificationStatus: input.status } : {}),
          ...(input.check === "licence" ? { licenceVerificationStatus: input.status, licenceVerificationCheckedAt: now } : {}),
          reviewNote: nextReviewNote,
          ...(input.status !== "verified" ? { status: "pending" as const, isOnline: false } : {}),
        }).where("id", "=", input.id).execute();
        break;
      }
      case "profile_image_review": {
        const restaurant = await db.selectFrom("restaurants")
          .select("pendingProfileImageUrl")
          .where("id", "=", input.id)
          .where("profileImageReview", "=", "pending")
          .executeTakeFirst();
        if (!restaurant?.pendingProfileImageUrl) throw new HttpError(400, "No photo awaiting review");
        const result = await db.updateTable("restaurants")
          .set(input.decision === "approve"
            ? {
                profileImageUrl: restaurant.pendingProfileImageUrl,
                pendingProfileImageUrl: null,
                profileImageReview: "approved",
                profileImageRejectReason: null,
              }
            : {
                pendingProfileImageUrl: null,
                profileImageReview: "rejected",
                profileImageRejectReason: input.reason?.trim() || "Photo did not meet platr™ guidelines",
              })
          .where("id", "=", input.id)
          .where("profileImageReview", "=", "pending")
          .where("pendingProfileImageUrl", "=", restaurant.pendingProfileImageUrl)
          .executeTakeFirst();
        if (!Number(result.numUpdatedRows)) throw new HttpError(409, "Photo review changed. Refresh and try again.");
        await publish(channels.restaurant(input.id), { type: "status" }).catch(() => {});
        break;
      }
      case "dish_image_review": {
        const item = await db.selectFrom("menuItems")
          .select(["pendingImageUrl", "restaurantId"])
          .where("id", "=", input.id)
          .where("imageReview", "=", "pending")
          .executeTakeFirst();
        if (!item?.pendingImageUrl) throw new HttpError(400, "No dish photo awaiting review");
        const result = await db.updateTable("menuItems")
          .set(input.decision === "approve"
            ? {
                imageUrl: item.pendingImageUrl,
                pendingImageUrl: null,
                imageReview: "approved",
                imageRejectReason: null,
              }
            : {
                pendingImageUrl: null,
                imageReview: "rejected",
                imageRejectReason: input.reason?.trim() || "Photo did not meet platr™ guidelines",
              })
          .where("id", "=", input.id)
          .where("imageReview", "=", "pending")
          .where("pendingImageUrl", "=", item.pendingImageUrl)
          .returning("restaurantId")
          .executeTakeFirst();
        if (!result) throw new HttpError(409, "Dish photo review changed. Refresh and try again.");
        await publish(channels.restaurant(result.restaurantId), { type: "status" }).catch(() => {});
        break;
      }
      case "rider_status": {
        if (input.status === "approved") {
        const rider = await db.selectFrom("riders")
            .select(["licenceFile", "selfieFile", "identityVerificationStatus", "licenceVerificationStatus", "alternatePhone", "licenceExpiryDate", "vehicleType", "vehicleNumber", "payoutAccountHolder", "payoutAccountNumber", "payoutIfsc"])
            .where("id", "=", input.id)
            .executeTakeFirst();
          if (!rider?.licenceFile || !rider.selfieFile)
            throw new HttpError(400, "Rider has not uploaded licence and selfie yet");
          if (rider.identityVerificationStatus !== "verified" || rider.licenceVerificationStatus !== "verified")
            throw new HttpError(400, "Manually verify the rider identity and driving licence before approval.");
          if (!(rider.vehicleType === "Ebike" || rider.vehicleType === "Normal bike") || !rider.vehicleNumber || !rider.alternatePhone || !rider.licenceExpiryDate || new Date(rider.licenceExpiryDate) < new Date() || !rider.payoutAccountHolder || !rider.payoutAccountNumber || !rider.payoutIfsc)
            throw new HttpError(400, "Rider must provide a valid vehicle type, vehicle number, alternate phone, valid driving licence expiry date, and bank details before approval.");
        }
        const result = await db.updateTable("riders")
          .set({
            status: input.status,
            ...(input.status !== "approved" ? { isOnline: false } : {}),
            ...(input.status === "rejected"
              ? { reviewNote: input.reason?.trim() || "Documents were unclear. Please upload again." }
              : input.status === "approved" ? { reviewNote: null } : {}),
          })
          .where("id", "=", input.id)
          .executeTakeFirst();
        if (!Number(result.numUpdatedRows))
          throw new HttpError(409, "Rider or documents changed. Refresh and try again.");
        await publish(channels.rider(input.id), { type: "status" }).catch(() => {});
        break;
      }
      case "rider_onboarding_note": {
        const updated = await db.updateTable("riders")
          .set({ reviewNote: input.note.trim() || null })
          .where("id", "=", input.id)
          .returning("id")
          .executeTakeFirst();
        if (!updated) throw new HttpError(404, "Rider was not found");
        await publish(channels.rider(input.id), { type: "status" }).catch(() => {});
        break;
      }
      case "admin_partner_note": {
        if (input.recipientRole === "rider") {
          const exists = await db.selectFrom("riders").select("id").where("id", "=", input.recipientId).executeTakeFirst();
          if (!exists) throw new HttpError(404, "Rider was not found");
        } else {
          const exists = await db.selectFrom("restaurants").select("id").where("id", "=", input.recipientId).executeTakeFirst();
          if (!exists) throw new HttpError(404, "Merchant was not found");
        }
        const note = input.note.trim();
        if (!note) {
          await db.deleteFrom("adminPartnerNotes")
            .where("recipientRole", "=", input.recipientRole)
            .where("recipientId", "=", input.recipientId)
            .execute();
        } else {
          await db.insertInto("adminPartnerNotes")
            .values({ recipientRole: input.recipientRole, recipientId: input.recipientId, note, updatedByUserId: admin.id, updatedAt: new Date(), readAt: null, partnerReply: null, partnerRepliedAt: null } as any)
            .onConflict((oc) => oc.columns(["recipientRole", "recipientId"]).doUpdateSet({ note, updatedByUserId: admin.id, updatedAt: new Date(), readAt: null, partnerReply: null, partnerRepliedAt: null } as any))
            .execute();
        }
        if (input.recipientRole === "rider") await publish(channels.rider(input.recipientId), { type: "status" }).catch(() => {});
        else await publish(channels.restaurant(input.recipientId), { type: "status" }).catch(() => {});
        break;
      }
      case "set_site_paused": {
        const updated = await db.updateTable("appSettings")
          .set({ sitePaused: input.sitePaused, updatedAt: new Date() })
          .where("id", "=", 1)
          .returning("id")
          .executeTakeFirst();
        if (!updated) throw new HttpError(404, "Website settings were not found");
        break;
      }
      case "set_registration_permission": {
        const column = input.role === "user"
          ? "allowCustomerRegistration"
          : input.role === "rider"
            ? "allowRiderRegistration"
            : "allowMerchantRegistration";
        const updated = await db.updateTable("appSettings")
          .set({ [column]: input.enabled, updatedAt: new Date() })
          .where("id", "=", 1)
          .returning("id")
          .executeTakeFirst();
        if (!updated) throw new HttpError(404, "Website settings were not found");
        break;
      }
      case "set_launch_mode":
        await db.updateTable("appSettings")
          .set({ launchMode: input.launchMode, updatedAt: new Date() })
          .where("id", "=", 1).execute();
        if (!input.launchMode) await proSubscription.activateAllPending();
        break;
      case "mark_payout_paid":
        await payoutWorkflow.transition({
          kind: "restaurant",
          payoutId: input.payoutId,
          to: "paid",
          utrReference: input.utrReference,
          adminUserId: admin.id,
        });
        break;
      case "set_payout_hold":
        await payoutWorkflow.transition({
          kind: "restaurant",
          payoutId: input.payoutId,
          to: input.onHold ? "on_hold" : "pending",
          reason: input.note,
          adminUserId: admin.id,
        });
        break;
      case "payout_transition":
        await payoutWorkflow.transition({
          kind: input.kind,
          payoutId: input.payoutId,
          to: input.to,
          utrReference: input.utrReference,
          reason: input.reason,
          adminUserId: admin.id,
        });
        break;
      case "rider_adjustment":
        await financialLedger.addRiderAdjustment({
          riderId: input.riderId,
          amount: input.amount,
          note: input.note,
          adminUserId: admin.id,
        });
        break;
      case "retry_order_refund": {
        const order = await db.selectFrom("orders")
          .select(["paymentMethod", "paymentStatus", "razorpayRefundId", "refundFailedAt"])
          .where("id", "=", input.orderId)
          .executeTakeFirst();

        if (
          !order ||
          order.paymentMethod !== "upi" ||
          order.paymentStatus !== "paid" ||
          order.razorpayRefundId !== null ||
          order.refundFailedAt === null
        ) {
          throw new HttpError(409, "This order has no failed refund to retry");
        }

        try {
          await orderPayments.refundIfPaid(input.orderId, "Retry after failed refund");
        } catch (error) {
          console.error(`Razorpay refund retry failed for order ${input.orderId}:`, error);
          throw new HttpError(
            502,
            "Razorpay refund retry failed. Try again or refund from the Razorpay dashboard.",
          );
        }
        break;
      }
      case "review_economics": {
        const reviewed = await db.updateTable("orders")
          .set({ economicsReviewedAt: new Date(), economicsReviewedBy: admin.id })
          .where("id", "=", input.orderId)
          .where("economicsFlag", "is not", null)
          .returning("id")
          .executeTakeFirst();
        if (!reviewed) throw new HttpError(409, "Order has no economics flag to review");
        break;
      }
      case "ca_answer": {
        const answer = input.answer.trim();
        const updatedAt = new Date();
        await db.insertInto("caAnswers")
          .values({ questionNo: input.questionNo, answer, updatedAt })
          .onConflict((oc) => oc.column("questionNo").doUpdateSet({ answer, updatedAt }))
          .execute();
        break;
      }
      case "pricing_settings":
        await adminPricingActions.updateSettings(input);
        break;
      case "service_area_upsert":
        await adminPricingActions.upsertServiceArea(input);
        break;
      case "service_area_delete":
        await adminPricingActions.deleteServiceArea(input.id);
        break;
      case "run_payouts":
        await createWeeklyPayouts();
        break;
      case "wallet_adjust": {
        const user = await db.selectFrom("users")
          .select("id")
          .where("email", "=", input.userEmail.toLowerCase())
          .executeTakeFirst();
        if (!user) throw new HttpError(404, "No customer found with that email address");
        await ziptoWallet.adminAdjust({
          userId: user.id,
          amount: input.amount,
          note: input.note,
          adminUserId: admin.id,
        });
        break;
      }
      case "mark_paid": {
        const paidOrder = await db.updateTable("orders")
          .set({ paymentStatus: "paid", updatedAt: new Date() })
          .where("id", "=", input.orderId)
          .returning(["id", "paymentMethod"])
          .executeTakeFirst();
        if (!paidOrder) throw new HttpError(404, "Order was not found");
        if (paidOrder.paymentMethod === "upi") {
          try {
            await financialLedger.onPaymentCaptured(input.orderId, {});
          } catch (error) {
            console.error(`Could not record manual payment for order ${input.orderId}:`, error);
          }
        }
        await notifyZipto(input.orderId);
        break;
      }
      case "cancel_order": {
        const previous = await db.transaction().execute(async (transaction) => {
          const order = await transaction.selectFrom("orders")
            .select(["status", "riderId", "paymentMethod"])
            .where("id", "=", input.orderId)
            .forUpdate()
            .executeTakeFirst();
          if (!order || ["delivered", "cancelled", "rejected"].includes(order.status))
            throw new HttpError(400, "Order is already finished");
          await transaction.updateTable("orders")
            .set({ status: "cancelled", cancelReason: input.reason || "Cancelled by platr™ support", updatedAt: new Date() })
            .where("id", "=", input.orderId)
            .execute();
          return order;
        });
        try {
          await financialLedger.onOrderClosed(input.orderId, previous.status);
        } catch (error) {
          console.error(`Could not record cancellation pay for order ${input.orderId} (rider ${previous.riderId ?? "none"}):`, error);
        }
        await notifyZipto(input.orderId);
        try {
          await orderPayments.refundIfPaid(
            input.orderId,
            input.reason || "Cancelled by platr™ support",
          );
        } catch (error) {
          console.error(`Refund failed after cancelling order ${input.orderId}:`, error);
          throw new HttpError(
            502,
            previous.paymentMethod === "wallet"
              ? "Order cancelled, but the wallet refund failed – retry."
              : "Order cancelled, but the Razorpay refund failed. Please refund manually from the Razorpay dashboard.",
          );
        }
        break;
      }
      case "settings": {
        const wasLive = await db.selectFrom("appSettings")
          .select("launchMode")
          .where("id", "=", 1)
          .executeTakeFirstOrThrow();
        const { action, launchMode, ...s } = input;
        await db.updateTable("appSettings")
          .set({
            ...s,
            ...(s.deliveryFee !== undefined ? { deliveryFee: s.deliveryFee } : {}),
            ...(s.platformFee !== undefined ? { platformFee: s.platformFee } : {}),
            upiId: s.upiId || null,
            ...(launchMode !== undefined ? { launchMode } : {}),
            updatedAt: new Date(),
          })
          .where("id", "=", 1).execute();
        if (wasLive.launchMode && launchMode === false)
          await proSubscription.activateAllPending();
        break;
      }
    }
    await publish(channels.admin(), { type: "admin" }).catch(() => {});
    return requireRole.json({ ok: true } satisfies OutputType);
  } catch (e) {
    return requireRole.errorResponse(e);
  }
}