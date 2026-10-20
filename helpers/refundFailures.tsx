// BACKEND ONLY.
import { publish } from "@floot/realtime";
import { db } from "./db";
import { financialLedger } from "./financialLedger";
import { orderEmails } from "./orderEmails";
import { channels } from "./realtimeChannels";
import {
  refundEventDecision,
  type RefundEvent,
} from "./refundEventDecision";
import { sendZiptoEmail } from "./sendZiptoEmail";
import { ziptoConfig } from "./ziptoConfig";

type RefundEntity = {
  id: string;
  payment_id: string;
  amount: number;
  error_description?: string | null;
};

type RefundReference = {
  refundId: string;
  paymentId: string;
  amountPaise: number;
  orderId: number | null;
  reason: string;
};

const currency = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
});

async function notifyAdmins(
  reference: RefundReference,
  mismatch: boolean,
): Promise<void> {
  // Notifications must not roll back a persisted financial correction.
  try {
    const admins = await db
      .selectFrom("users")
      .select(["id", "email"])
      .where("role", "=", "admin")
      .execute();

    await Promise.all(
      admins.map(async (admin) => {
        try {
          const context =
            reference.orderId === null
              ? `payment ${reference.paymentId}`
              : `order #${reference.orderId} / payment ${reference.paymentId}`;

          const content = orderEmails.renderZiptoEmail({
            heading: mismatch
              ? "Refund event needs investigation"
              : "Refund failed – action needed",
            intro: mismatch
              ? "Razorpay sent a refund event that does not match platr™'s recorded refund state. No financial record was changed."
              : "Razorpay reported a failed refund. The money has not been refunded; review the payment in Admin → Finance.",
            rows: [
              { label: "Reference", value: context },
              {
                label: "Amount",
                value: currency.format(reference.amountPaise / 100),
              },
              { label: "Razorpay refund ID", value: reference.refundId },
              { label: "Payment ID", value: reference.paymentId },
              { label: "Reason", value: reference.reason },
            ],
            ctaLabel: mismatch
              ? "Open Admin → Finance to investigate"
              : "Open Admin → Finance to retry",
            ctaUrl: `${ziptoConfig.siteUrl}/admin`,
          });

          const sent = await sendZiptoEmail({
            to: admin.email,
            subject: mismatch
              ? `Refund event needs review (${context})`
              : `Refund failed – action needed (${context})`,
            ...content,
            dedupeKey: `${mismatch ? "refund_mismatch" : "refund_failed"}:${reference.refundId}:admin:${admin.id}`,
            kind: "refund_failed_admin",
            ...(reference.orderId === null
              ? {}
              : { orderId: reference.orderId }),
          });

          if (!sent) {
            console.error(
              `Could not email admin ${admin.id} about refund ${reference.refundId}`,
            );
          }
        } catch (error) {
          console.error(
            `Admin notification failed for refund ${reference.refundId}:`,
            error,
          );
        }
      }),
    );
  } catch (error) {
    console.error(
      `Could not load admins for refund ${reference.refundId}:`,
      error,
    );
  }
}

async function publishFinanceChange(): Promise<void> {
  try {
    await publish(channels.admin(), { type: "finance" });
  } catch (error) {
    console.error("Could not publish refund finance update:", error);
  }
}

export const refundFailures = {
  async handleRefundEvent(
    event: RefundEvent,
    entity: RefundEntity,
  ): Promise<boolean> {
    try {
      const refund = {
        id: entity.id,
        paymentId: entity.payment_id,
        amountPaise: entity.amount,
      };
      const [reconciliation, order] = await Promise.all([
        db
          .selectFrom("paymentReconciliations")
          .select([
            "id",
            "kind",
            "recordId",
            "status",
            "razorpayPaymentId",
            "razorpayRefundId",
            "amountPaise",
          ])
          .where("razorpayRefundId", "=", entity.id)
          .executeTakeFirst(),
        db
          .selectFrom("orders")
          .select([
            "id",
            "total",
            "paymentStatus",
            "razorpayPaymentId",
            "razorpayRefundId",
            "failedRazorpayRefundId",
          ])
          .where("razorpayPaymentId", "=", entity.payment_id)
          .executeTakeFirst(),
      ]);

      const decision = refundEventDecision({
        event,
        refund,
        order: order ?? null,
        reconciliation: reconciliation ?? null,
      });

      if (decision.target === "none") return false;
      if (
        decision.target === "order" &&
        decision.action === "existing_processed"
      ) {
        return false;
      }
      if (decision.target === "order" && decision.action === "ignore") {
        return true;
      }
      if (decision.action === "already") return true;

      const reason =
        entity.error_description?.trim() ||
        "Razorpay reported a failed refund";
      const reference: RefundReference = {
        refundId: entity.id,
        paymentId: entity.payment_id,
        amountPaise: entity.amount,
        orderId:
          decision.target === "reconciliation"
            ? reconciliation?.kind === "food_order"
              ? reconciliation.recordId
              : null
            : order?.id ?? null,
        reason,
      };

      // A mismatched or late processed event needs human investigation, but
      // returning success prevents an unresolvable event from retrying forever.
      if (
        decision.action === "mismatch" ||
        (decision.target === "reconciliation" &&
          reconciliation?.razorpayPaymentId !== entity.payment_id)
      ) {
        console.error("Razorpay refund event does not match recorded state:", {
          event,
          refundId: entity.id,
          paymentId: entity.payment_id,
          reconciliationId: reconciliation?.id,
          orderId: order?.id,
        });
        await notifyAdmins(
          {
            ...reference,
            reason: "Refund event identity, amount, or recorded state mismatch",
          },
          true,
        );
        return true;
      }

      if (decision.target === "reconciliation") {
        if (!reconciliation) {
          throw new Error(`Reconciliation disappeared for refund ${entity.id}`);
        }

        if (decision.action === "mark_failed") {
          const updated = await db
            .updateTable("paymentReconciliations")
            .set({
              status: "refund_failed",
              refundFailedAt: new Date(),
              error: reason,
              updatedAt: new Date(),
            })
            .where("id", "=", reconciliation.id)
            .where("status", "=", "done")
            .where("razorpayRefundId", "=", entity.id)
            .returning("id")
            .executeTakeFirst();

          if (!updated) {
            throw new Error(
              `Reconciliation changed while recording failed refund ${entity.id}`,
            );
          }

          await notifyAdmins(reference, false);
          await publishFinanceChange();
        } else if (decision.action === "mark_processed") {
          await db
            .updateTable("paymentReconciliations")
            .set({
              refundProcessedAt: new Date(),
              updatedAt: new Date(),
            })
            .where("id", "=", reconciliation.id)
            .where("status", "=", "done")
            .where("razorpayRefundId", "=", entity.id)
            .where("refundProcessedAt", "is", null)
            .execute();
        }

        return true;
      }

      if (!order) {
        throw new Error(`Order disappeared for refund ${entity.id}`);
      }

      const lockedAction = await db.transaction().execute(async (transaction) => {
        const locked = await transaction
          .selectFrom("orders")
          .selectAll()
          .where("id", "=", order.id)
          .forUpdate()
          .executeTakeFirstOrThrow();

        const current = refundEventDecision({
          event,
          refund,
          order: locked,
          reconciliation: null,
        });

        if (current.target !== "order") {
          throw new Error(`Order association changed for refund ${entity.id}`);
        }
        if (current.action !== "mark_failed") return current.action;

        await transaction
          .updateTable("orders")
          .set({
            paymentStatus: "paid",
            razorpayRefundId: null,
            refundedAt: null,
            refundFailedAt: new Date(),
            refundFailureReason: reason,
            failedRazorpayRefundId: entity.id,
            updatedAt: new Date(),
          })
          .where("id", "=", locked.id)
          .executeTakeFirstOrThrow();

        await financialLedger.record(transaction, {
          key: `order:${locked.id}:customer_refund_failed:${entity.id}`,
          entryType: "customer_refund",
          amount: locked.total,
          orderId: locked.id,
          note: `Refund failed: ${entity.id}`,
        });

        return current.action;
      });

      if (lockedAction === "mark_failed") {
        await notifyAdmins(reference, false);
        await publishFinanceChange();
      } else if (lockedAction === "mismatch") {
        console.error(
          `Order state changed to a refund mismatch for ${entity.id}`,
        );
        await notifyAdmins(
          { ...reference, reason: "Recorded order refund state mismatch" },
          true,
        );
      }

      return true;
    } catch (error) {
      console.error(
        `Could not handle Razorpay ${event} event for ${entity.id}:`,
        error,
      );
      throw error;
    }
  },
};