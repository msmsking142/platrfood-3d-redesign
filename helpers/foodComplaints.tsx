// BACKEND ONLY.
import { z } from "zod";
import { publish } from "@floot/realtime";
import { db } from "./db";
import { financialLedger } from "./financialLedger";
import { orderEmails } from "./orderEmails";
import { channels } from "./realtimeChannels";
import { getRazorpayCredentials, razorpayRequest } from "./razorpayProPayment";
import { HttpError } from "./requireRole";
import { sendZiptoEmail } from "./sendZiptoEmail";
import { ziptoConfig } from "./ziptoConfig";
import { ziptoWallet } from "./ziptoWallet";

const refundEntitySchema = z.object({
  id: z.string().min(1),
  payment_id: z.string().min(1),
  amount: z.number().int().positive(),
  status: z.string(),
  notes: z.object({
    complaintId: z.string().optional(),
    orderId: z.string().optional(),
  }).nullish(),
  error_description: z.string().nullish(),
});

const refundListSchema = z.object({
  count: z.number().int().nonnegative(),
  items: z.array(refundEntitySchema),
});

type RefundEntity = z.infer<typeof refundEntitySchema>;
type SubmitStatus = "pending" | "feedback_only";

function settingsFromRow(row: {
  foodComplaintRefundLimit: number;
  foodComplaintRefundBps: number;
  foodComplaintWindowHours: number;
}) {
  return {
    limit: row.foodComplaintRefundLimit,
    refundBps: row.foodComplaintRefundBps,
    windowHours: row.foodComplaintWindowHours,
  };
}

async function loadSettings() {
  const row = await db.selectFrom("appSettings")
    .select([
      "foodComplaintRefundLimit",
      "foodComplaintRefundBps",
      "foodComplaintWindowHours",
    ])
    .where("id", "=", 1)
    .executeTakeFirst();
  if (!row) throw new Error("Food complaint settings are missing");
  return settingsFromRow(row);
}

function countValue(value: number | string | bigint): number {
  const count = Number(value);
  if (!Number.isSafeInteger(count) || count < 0) {
    throw new Error("Invalid complaint count");
  }
  return count;
}

async function sendNotice(
  to: string,
  subject: string,
  text: string,
  orderId: number,
  dedupeKey?: string,
): Promise<boolean> {
  try {
    const content = orderEmails.renderZiptoEmail({
      heading: subject,
      intro: text,
      ctaLabel: "Contact platr™ Support",
      ctaUrl: ziptoConfig.supportUrl,
    });
    const sent = await sendZiptoEmail({
      to,
      subject,
      ...content,
      dedupeKey,
      kind: "food_complaint",
      orderId,
    });
    if (!sent) console.error("Food complaint email was not sent:", subject);
    return sent;
  } catch (error) {
    console.error("Food complaint email failed:", error);
    return false;
  }
}

async function publishUpdates(
  customerId: number,
  restaurantId: number,
): Promise<void> {
  await Promise.all([
    publish(channels.customer(customerId), { type: "food_complaint" }),
    publish(channels.restaurant(restaurantId), { type: "food_complaint" }),
    publish(channels.admin(), { type: "food_complaint" }),
  ].map((task) => task.catch((error: unknown) => {
    console.error("Could not publish food complaint update:", error);
  })));
}

async function emailRecipients(complaintId: number) {
  const row = await db.selectFrom("foodComplaints")
    .innerJoin("users as customer", "customer.id", "foodComplaints.customerUserId")
    .innerJoin("restaurants", "restaurants.id", "foodComplaints.restaurantId")
    .innerJoin("users as owner", "owner.id", "restaurants.ownerUserId")
    .select([
      "foodComplaints.id",
      "foodComplaints.orderId",
      "foodComplaints.reason",
      "foodComplaints.status",
      "foodComplaints.description",
      "foodComplaints.refundAmount",
      "foodComplaints.refundMethod",
      "foodComplaints.refundStatus",
      "foodComplaints.adminNote",
      "foodComplaints.customerEmailSentAt",
      "foodComplaints.restaurantEmailSentAt",
      "customer.email as customerEmail",
      "owner.email as restaurantEmail",
    ])
    .where("foodComplaints.id", "=", complaintId)
    .executeTakeFirstOrThrow();
  return row;
}

async function sendSubmissionEmails(complaintId: number): Promise<void> {
  try {
    const row = await emailRecipients(complaintId);
    if (!row.restaurantEmailSentAt) {
      const sent = await sendNotice(
        row.restaurantEmail,
        `Food feedback for platr™ order #${row.orderId}`,
        `Order #${row.orderId}\nReason: ${row.reason}\nFeedback: ${row.description}\nPlease review this food feedback.`,
        row.orderId,
        `complaint:${complaintId}:restaurant:submitted`,
      );
      if (sent) {
        await db.updateTable("foodComplaints")
          .set({ restaurantEmailSentAt: new Date() })
          .where("id", "=", complaintId)
          .where("restaurantEmailSentAt", "is", null)
          .execute();
      }
    }
    if (!row.customerEmailSentAt) {
      const isFeedbackOnly = row.status === "feedback_only";
      const sent = await sendNotice(
        row.customerEmail,
        isFeedbackOnly
          ? `We've received your platr™ feedback for order #${row.orderId}`
          : `We've received your report for order #${row.orderId}`,
        isFeedbackOnly
          ? `Thanks for letting us know about order #${row.orderId}. We have shared your food feedback with the restaurant.`
          : `Thanks for reporting the food issue with order #${row.orderId}. platr™ is reviewing your report, and we'll email you with the decision.`,
        row.orderId,
        `complaint:${complaintId}:customer:submitted`,
      );
      if (sent) {
        await db.updateTable("foodComplaints")
          .set({ customerEmailSentAt: new Date() })
          .where("id", "=", complaintId)
          .where("customerEmailSentAt", "is", null)
          .execute();
      }
    }
  } catch (error) {
    console.error(`Could not send submission emails for complaint ${complaintId}:`, error);
  }
}

async function sendReviewEmails(
  complaintId: number,
  decision: "approved" | "rejected" | "refund_processed" | "refund_failed",
): Promise<void> {
  try {
    const row = await emailRecipients(complaintId);
    if (decision === "rejected") {
      await sendNotice(
        row.customerEmail,
        `Update on platr™ order #${row.orderId}`,
        `We reviewed your food complaint for order #${row.orderId}. We cannot approve a refund. ${row.adminNote ?? ""}\nFor help, use ${ziptoConfig.supportUrl}.`,
        row.orderId,
        `complaint:${complaintId}:customer:rejected`,
      );
      return;
    }

    const amount = ziptoConfig.rupees(row.refundAmount);
    if (decision === "refund_processed" || decision === "refund_failed") {
      await sendNotice(
        row.customerEmail,
        decision === "refund_processed"
          ? `Your refund of ${amount} for order #${row.orderId} is complete`
          : `Refund for order #${row.orderId} needs another try – our team is on it`,
        decision === "refund_processed"
          ? `Your refund of ${amount} for order #${row.orderId} is complete and has been sent to your original payment method. Bank processing times may vary.`
          : `The refund for order #${row.orderId} needs another try. Our team is working on it, and we'll update you when it's complete.`,
        row.orderId,
        `complaint:${complaintId}:customer:${decision}`,
      );
      return;
    }

    await Promise.all([
      sendNotice(
        row.customerEmail,
        `Food refund update for platr™ order #${row.orderId}`,
        `Your food complaint for order #${row.orderId} was approved for ${amount}. ${row.refundMethod === "wallet"
          ? "The refund has been credited to your platr™ Wallet."
          : row.refundStatus === "failed"
            ? "The online refund needs another attempt from our team. Please contact support if you need help."
            : "The refund is being sent to your original online payment method; bank processing times may vary."}`,
        row.orderId,
        `complaint:${complaintId}:customer:approved`,
      ),
      sendNotice(
        row.restaurantEmail,
        `Food complaint adjustment for order #${row.orderId}`,
        `Order #${row.orderId}\nReason: ${row.reason}\nA ${amount} food complaint deduction will be adjusted in your next weekly Friday payout.`,
        row.orderId,
        `complaint:${complaintId}:restaurant:approved`,
      ),
    ]);
  } catch (error) {
    console.error(`Could not send review emails for complaint ${complaintId}:`, error);
  }
}

async function findExistingRefund(
  paymentId: string,
  complaintId: number,
): Promise<RefundEntity | null> {
  // Razorpay paginates payment refunds. Search every page so a retry cannot
  // create another partial refund when older refunds fill the first page.
  for (let skip = 0; ; skip += 100) {
    const response = await razorpayRequest(
      `/payments/${encodeURIComponent(paymentId)}/refunds?count=100&skip=${skip}`,
      getRazorpayCredentials(),
      "GET",
    );
    const page = refundListSchema.parse(response);
    const match = page.items.find(
      (item) => item.notes?.complaintId === String(complaintId),
    );
    if (match) return match;
    if (page.items.length < 100) return null;
  }
}

export const foodComplaints = {
  refundAmountFor(itemsTotal: number, bps: number): number {
    if (!Number.isSafeInteger(itemsTotal) || itemsTotal < 0 ||
        !Number.isSafeInteger(bps) || bps < 0 || bps > 10000) {
      throw new Error("Invalid food refund calculation");
    }
    return Math.round(itemsTotal * bps / 10000);
  },

  async submit({
    userId,
    orderId,
    reason,
    description,
    imageFiles,
  }: {
    userId: number;
    orderId: number;
    reason: string;
    description: string;
    imageFiles: string[];
  }): Promise<{ status: SubmitStatus; message: string }> {
    if (imageFiles.length < 1 || imageFiles.length > 3 ||
        imageFiles.some((file) =>
          !file.startsWith(`food-complaints/${userId}/`) ||
          file.length > 500 ||
          !/^food-complaints\/\d+\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(file)
        ) ||
        new Set(imageFiles).size !== imageFiles.length) {
      throw new HttpError(400, "Upload 1–3 distinct food complaint photos first");
    }

    const result = await db.transaction().execute(async (trx) => {
      const order = await trx.selectFrom("orders")
        .select([
          "id", "customerUserId", "restaurantId", "status", "paymentMethod",
          "paymentStatus", "deliveredAt", "itemsTotal", "total",
        ])
        .where("id", "=", orderId)
        .forUpdate()
        .executeTakeFirst();

      if (!order || order.customerUserId !== userId) {
        throw new HttpError(404, "Order not found");
      }
      if (order.status !== "delivered" ||
          !["upi", "wallet"].includes(order.paymentMethod) ||
          order.paymentStatus !== "paid" || !order.deliveredAt) {
        throw new HttpError(409, "Only delivered, paid online or wallet orders can be reported");
      }

      const existing = await trx.selectFrom("foodComplaints")
        .select("id").where("orderId", "=", orderId).executeTakeFirst();
      if (existing) {
        throw new HttpError(409, "You have already reported this order");
      }

      const settingsRow = await trx.selectFrom("appSettings")
        .select([
          "foodComplaintRefundLimit", "foodComplaintRefundBps",
          "foodComplaintWindowHours",
        ])
        .where("id", "=", 1)
        .executeTakeFirstOrThrow();

      const deliveredAt = new Date(order.deliveredAt).getTime();
      if (deliveredAt > Date.now() ||
          Date.now() - deliveredAt > settingsRow.foodComplaintWindowHours * 3600000) {
        throw new HttpError(409, "The food complaint window for this order has closed");
      }

      const count = await trx.selectFrom("foodComplaints")
        .select(trx.fn.count<number>("id").as("count"))
        .where("customerUserId", "=", userId)
        .where("status", "in", ["pending", "approved"])
        .executeTakeFirstOrThrow();
      const status: SubmitStatus =
        countValue(count.count) >= settingsRow.foodComplaintRefundLimit
          ? "feedback_only" : "pending";
      const refundAmount = status === "pending"
        ? Math.min(
            order.total,
            foodComplaints.refundAmountFor(
              order.itemsTotal,
              settingsRow.foodComplaintRefundBps,
            ),
          )
        : 0;

      const complaint = await trx.insertInto("foodComplaints")
        .values({
          customerUserId: userId,
          orderId,
          restaurantId: order.restaurantId,
          reason,
          description,
          imageFiles,
          status,
          refundAmount,
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      return { id: complaint.id, restaurantId: order.restaurantId, status };
    });

    await publishUpdates(userId, result.restaurantId);
    await sendSubmissionEmails(result.id);
    if (result.status === "feedback_only") {
      return {
        status: "feedback_only",
        message: "We have received your feedback and will inform the restaurant.",
      };
    }
    return {
      status: "pending",
      message: "Complaint sent to platr™ for review. We'll update you soon.",
    };
  },

  async approve({
    complaintId,
    adminUserId,
    note,
  }: {
    complaintId: number;
    adminUserId: number;
    note?: string;
  }): Promise<"processed" | "processing" | "failed"> {
    const approved = await db.transaction().execute(async (trx) => {
      const complaint = await trx.selectFrom("foodComplaints")
        .selectAll().where("id", "=", complaintId)
        .forUpdate().executeTakeFirst();
      if (!complaint) throw new HttpError(404, "Complaint not found");
      if (complaint.status !== "pending") {
        throw new HttpError(409, "Only pending complaints can be approved");
      }

      const order = await trx.selectFrom("orders")
        .select(["id", "itemsTotal", "total", "paymentMethod", "paymentStatus"])
        .where("id", "=", complaint.orderId)
        .forUpdate().executeTakeFirstOrThrow();
      if (order.paymentStatus !== "paid" ||
          (order.paymentMethod !== "upi" && order.paymentMethod !== "wallet")) {
        throw new HttpError(409, "The order is no longer eligible for a food refund");
      }

      const settings = await trx.selectFrom("appSettings")
        .select("foodComplaintRefundBps")
        .where("id", "=", 1)
        .executeTakeFirstOrThrow();
      const refund = Math.min(
        order.total,
        foodComplaints.refundAmountFor(
          order.itemsTotal,
          settings.foodComplaintRefundBps,
        ),
      );
      if (refund <= 0) {
        throw new HttpError(409, "The current food refund amount is zero; update settings before approving");
      }

      let walletTxnId: number | null = null;
      if (order.paymentMethod === "wallet") {
        walletTxnId = await ziptoWallet.creditComplaintRefund(trx, {
          userId: complaint.customerUserId,
          orderId: order.id,
          complaintId,
          amount: refund,
        });
      }

      await trx.updateTable("foodComplaints")
        .set({
          status: "approved",
          reviewedByUserId: adminUserId,
          reviewedAt: new Date(),
          adminNote: note?.trim() || null,
          refundAmount: refund,
          refundMethod: order.paymentMethod,
          refundStatus: walletTxnId === null ? "processing" : "processed",
          walletTxnId,
          refundedAt: walletTxnId === null ? null : new Date(),
          refundError: null,
        })
        .where("id", "=", complaintId)
        .executeTakeFirstOrThrow();

      await trx.insertInto("restaurantAdjustments")
        .values({
          restaurantId: complaint.restaurantId,
          orderId: order.id,
          foodComplaintId: complaintId,
          amount: -refund,
          reason: `Food complaint #${complaintId} – 50% food refund for order #${order.id}`,
          createdByUserId: adminUserId,
        })
        .execute();

      await financialLedger.record(trx, {
        key: `food_complaint:${complaintId}:restaurant_deduction`,
        entryType: "adjustment",
        amount: -refund,
        restaurantId: complaint.restaurantId,
        orderId: order.id,
        note: `Food complaint #${complaintId}`,
      });

      if (walletTxnId !== null) {
        await financialLedger.record(trx, {
          key: `food_complaint:${complaintId}:customer_refund`,
          entryType: "customer_refund",
          amount: -refund,
          orderId: order.id,
          note: `Wallet transaction #${walletTxnId}`,
        });
      }

      return {
        userId: complaint.customerUserId,
        restaurantId: complaint.restaurantId,
        method: order.paymentMethod,
      };
    });

    if (approved.method === "wallet") {
      await ziptoWallet.publishWallet(approved.userId);
    }
    const refundStatus = approved.method === "upi"
      ? await foodComplaints.executeRazorpayRefund(complaintId)
      : "processed" as const;
    await sendReviewEmails(complaintId, "approved");
    await publishUpdates(approved.userId, approved.restaurantId);
    return refundStatus;
  },

  async executeRazorpayRefund(
    complaintId: number,
  ): Promise<"processed" | "processing" | "failed"> {
    try {
      const result = await db.transaction().execute(async (trx) => {
        const complaint = await trx.selectFrom("foodComplaints")
          .selectAll().where("id", "=", complaintId)
          .forUpdate().executeTakeFirst();
        if (!complaint) throw new HttpError(404, "Complaint not found");
        if (complaint.status !== "approved" ||
            complaint.refundMethod !== "upi" ||
            !["processing", "failed"].includes(complaint.refundStatus) ||
            complaint.razorpayRefundId !== null) {
          throw new HttpError(409, "This complaint has no retryable online refund");
        }

        const order = await trx.selectFrom("orders")
          .select(["razorpayPaymentId", "id"])
          .where("id", "=", complaint.orderId)
          .executeTakeFirstOrThrow();
        if (!order.razorpayPaymentId) {
          throw new Error("The order has no recorded Razorpay payment");
        }

        const existing = await findExistingRefund(
          order.razorpayPaymentId,
          complaintId,
        );
        const raw = existing ?? await razorpayRequest(
          `/payments/${encodeURIComponent(order.razorpayPaymentId)}/refund`,
          getRazorpayCredentials(),
          "POST",
          {
            amount: complaint.refundAmount * 100,
            speed: "optimum",
            receipt: `zipto-complaint-${complaintId}`,
            notes: {
              purpose: "zipto_food_complaint",
              complaintId: String(complaintId),
              orderId: String(order.id),
            },
          },
        );
        const refund = refundEntitySchema.parse(raw);
        if (refund.payment_id !== order.razorpayPaymentId ||
            refund.amount !== complaint.refundAmount * 100 ||
            refund.notes?.complaintId !== String(complaintId)) {
          throw new Error(`Razorpay returned a mismatched refund for complaint ${complaintId}`);
        }

        const status = refund.status === "processed"
          ? "processed" as const
          : refund.status === "failed"
            ? "failed" as const
            : "processing" as const;
        await trx.updateTable("foodComplaints")
          .set({
            razorpayRefundId: refund.id,
            refundStatus: status,
            refundedAt: status === "processed" ? new Date() : null,
            refundError: status === "failed"
              ? refund.error_description ?? "Razorpay reported a failed refund"
              : null,
          })
          .where("id", "=", complaintId)
          .executeTakeFirstOrThrow();

        await financialLedger.record(trx, {
          key: `food_complaint:${complaintId}:customer_refund`,
          entryType: "customer_refund",
          amount: -complaint.refundAmount,
          orderId: order.id,
          note: refund.id,
        });
        return {
          status,
          userId: complaint.customerUserId,
          restaurantId: complaint.restaurantId,
        };
      });
      if (result.status === "processed") {
        await sendReviewEmails(complaintId, "refund_processed");
      }
      await publishUpdates(result.userId, result.restaurantId);
      return result.status;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      console.error(`Razorpay food complaint refund ${complaintId} failed:`, error);
      const message = error instanceof Error ? error.message : "Unknown Razorpay refund error";
      const failed = await db.updateTable("foodComplaints")
        .set({ refundStatus: "failed", refundError: message.slice(0, 1000) })
        .where("id", "=", complaintId)
        .where("status", "=", "approved")
        .where("refundMethod", "=", "upi")
        .where("razorpayRefundId", "is", null)
        .returning(["customerUserId", "restaurantId"])
        .executeTakeFirst();
      if (failed) await publishUpdates(failed.customerUserId, failed.restaurantId);
      return "failed";
    }
  },

  async onRazorpayRefundEvent(
    event: "refund.processed" | "refund.failed",
    refundEntity: unknown,
  ): Promise<boolean> {
    const refund = refundEntitySchema.parse(refundEntity);
    const notesId = refund.notes?.complaintId;
    const complaintId = notesId && /^[1-9]\d*$/.test(notesId)
      ? Number(notesId) : null;
    const complaint = await db.selectFrom("foodComplaints")
      .select([
        "id", "customerUserId", "restaurantId", "orderId",
        "refundAmount", "razorpayRefundId", "refundStatus", "status", "refundMethod",
      ])
      .where((expression) => complaintId !== null && Number.isSafeInteger(complaintId)
        ? expression.or([
            expression("razorpayRefundId", "=", refund.id),
            expression("id", "=", complaintId),
          ])
        : expression("razorpayRefundId", "=", refund.id))
      .executeTakeFirst();

    if (!complaint) return false;
    const order = await db.selectFrom("orders")
      .select("razorpayPaymentId")
      .where("id", "=", complaint.orderId)
      .executeTakeFirstOrThrow();
    if (complaint.status !== "approved" ||
        complaint.refundMethod !== "upi" ||
        (complaint.razorpayRefundId !== null &&
          complaint.razorpayRefundId !== refund.id) ||
        order.razorpayPaymentId !== refund.payment_id ||
        complaint.refundAmount * 100 !== refund.amount) {
      throw new Error(`Refund event does not match food complaint ${complaint.id}`);
    }

    const nextStatus = event === "refund.processed" ? "processed" : "failed";
    await db.updateTable("foodComplaints")
      .set({
        razorpayRefundId: refund.id,
        refundStatus: nextStatus,
        refundedAt: event === "refund.processed" ? new Date() : null,
        refundError: event === "refund.failed"
          ? refund.error_description ?? "Razorpay reported a failed refund"
          : null,
      })
      .where("id", "=", complaint.id)
      .execute();
    if (complaint.refundStatus !== nextStatus) {
      await sendReviewEmails(
        complaint.id,
        nextStatus === "processed" ? "refund_processed" : "refund_failed",
      );
    }
    await publishUpdates(complaint.customerUserId, complaint.restaurantId);
    return true;
  },

  async reject({
    complaintId,
    adminUserId,
    note,
  }: {
    complaintId: number;
    adminUserId: number;
    note: string;
  }): Promise<void> {
    const complaint = await db.updateTable("foodComplaints")
      .set({
        status: "rejected",
        adminNote: note.trim(),
        reviewedByUserId: adminUserId,
        reviewedAt: new Date(),
      })
      .where("id", "=", complaintId)
      .where("status", "=", "pending")
      .returning(["customerUserId", "restaurantId"])
      .executeTakeFirst();
    if (!complaint) {
      const exists = await db.selectFrom("foodComplaints")
        .select("id").where("id", "=", complaintId).executeTakeFirst();
      throw new HttpError(exists ? 409 : 404, exists
        ? "Only pending complaints can be rejected" : "Complaint not found");
    }
    await sendReviewEmails(complaintId, "rejected");
    await publishUpdates(complaint.customerUserId, complaint.restaurantId);
  },

  async retryRefund({
    complaintId,
  }: {
    complaintId: number;
  }): Promise<"processed" | "processing" | "failed"> {
    return foodComplaints.executeRazorpayRefund(complaintId);
  },

  async updateSettings({
    limit,
    refundBps,
    windowHours,
  }: {
    limit: number;
    refundBps: number;
    windowHours: number;
  }): Promise<void> {
    const updated = await db.updateTable("appSettings")
      .set({
        foodComplaintRefundLimit: limit,
        foodComplaintRefundBps: refundBps,
        foodComplaintWindowHours: windowHours,
        updatedAt: new Date(),
      })
      .where("id", "=", 1)
      .returning("id")
      .executeTakeFirst();
    if (!updated) throw new HttpError(404, "Food complaint settings not found");
  },

  async customerSummary(
    userId: number,
  ): Promise<{ limit: number; used: number; remaining: number }> {
    const [settings, row] = await Promise.all([
      loadSettings(),
      db.selectFrom("foodComplaints")
        .select(db.fn.count<number>("id").as("count"))
        .where("customerUserId", "=", userId)
        .where("status", "in", ["pending", "approved"])
        .executeTakeFirstOrThrow(),
    ]);
    const used = countValue(row.count);
    return {
      limit: settings.limit,
      used,
      remaining: Math.max(0, settings.limit - used),
    };
  },
};