// BACKEND ONLY.
import { publish } from "@floot/realtime";
import type { Transaction } from "kysely";
import { WALLET_LIMITS } from "../endpoints/wallet/summary_GET.schema";
import { db } from "./db";
import { channels } from "./realtimeChannels";
import { HttpError } from "./requireRole";
import type { DB } from "./schema";

export const ziptoWallet = {
  async publishWallet(userId: number): Promise<void> {
    try {
      await publish(channels.customer(userId), { type: "wallet" });
    } catch (error) {
      console.error(`Could not publish wallet update for user ${userId}:`, error);
    }
  },

  async creditTopup({
    walletTxnId,
    razorpayOrderId,
    razorpayPaymentId,
  }: {
    walletTxnId: number;
    razorpayOrderId: string;
    razorpayPaymentId: string;
  }): Promise<{ changed: boolean }> {
    try {
      const result = await db.transaction().execute(async (trx) => {
        const credited = await trx
          .updateTable("walletTransactions")
          .set({
            status: "success",
            razorpayPaymentId,
            completedAt: new Date(),
          })
          .where("id", "=", walletTxnId)
          .where("type", "=", "topup")
          .where("razorpayOrderId", "=", razorpayOrderId)
          .where("status", "=", "pending")
          .returning(["userId", "amount"])
          .executeTakeFirst();

        if (!credited) {
          const existing = await trx
            .selectFrom("walletTransactions")
            .select(["status", "razorpayPaymentId"])
            .where("id", "=", walletTxnId)
            .where("type", "=", "topup")
            .where("razorpayOrderId", "=", razorpayOrderId)
            .executeTakeFirst();

          if (
            existing?.status === "success" &&
            existing.razorpayPaymentId !== razorpayPaymentId
          ) {
            throw new HttpError(409, "This top-up has a different recorded payment");
          }
          return { changed: false as const, userId: null };
        }

        const user = await trx
          .selectFrom("users")
          .select("walletBalance")
          .where("id", "=", credited.userId)
          .forUpdate()
          .executeTakeFirstOrThrow();

        // Payment has already been captured. Always honour the credit, even if
        // other top-ups raised the balance beyond the initiation-time limit.
        await trx
          .updateTable("users")
          .set({ walletBalance: user.walletBalance + credited.amount })
          .where("id", "=", credited.userId)
          .executeTakeFirstOrThrow();

        return { changed: true as const, userId: credited.userId };
      });

      if (result.changed && result.userId !== null) {
        await ziptoWallet.publishWallet(result.userId);
      }
      return { changed: result.changed };
    } catch (error) {
      console.error(`Could not credit wallet top-up ${walletTxnId}:`, error);
      throw error;
    }
  },

  async payOrder(
    trx: Transaction<DB>,
    {
      userId,
      orderId,
      amount,
    }: { userId: number; orderId: number; amount: number },
  ): Promise<void> {
    try {
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new HttpError(400, "Invalid wallet payment amount");
      }

      const user = await trx
        .selectFrom("users")
        .select("walletBalance")
        .where("id", "=", userId)
        .forUpdate()
        .executeTakeFirstOrThrow();

      if (user.walletBalance < amount) {
        throw new HttpError(400, "Wallet balance is too low. Please add money.");
      }

      await trx
        .updateTable("users")
        .set({ walletBalance: user.walletBalance - amount })
        .where("id", "=", userId)
        .executeTakeFirstOrThrow();

      await trx
        .insertInto("walletTransactions")
        .values({
          userId,
          type: "order_payment",
          status: "success",
          amount: -amount,
          orderId,
          completedAt: new Date(),
        })
        .execute();
    } catch (error) {
      console.error(`Wallet payment failed for order ${orderId}:`, error);
      throw error;
    }
  },

  async refundOrder(orderId: number, reason: string): Promise<string | null> {
    try {
      const result = await db.transaction().execute(async (trx) => {
        const order = await trx
          .selectFrom("orders")
          .select(["customerUserId", "total", "paymentMethod", "paymentStatus"])
          .where("id", "=", orderId)
          .forUpdate()
          .executeTakeFirstOrThrow();

        if (order.paymentMethod !== "wallet" || order.paymentStatus !== "paid") {
          return null;
        }

        const refund = await trx
          .insertInto("walletTransactions")
          .values({
            userId: order.customerUserId,
            type: "order_refund",
            status: "success",
            amount: order.total,
            orderId,
            note: reason,
            completedAt: new Date(),
          })
          .onConflict((oc) =>
            oc
              .columns(["orderId", "type"])
              .where("type", "in", ["order_payment", "order_refund"])
              .doNothing(),
          )
          .returning("id")
          .executeTakeFirst();

        if (!refund) return null;

        const user = await trx
          .selectFrom("users")
          .select("walletBalance")
          .where("id", "=", order.customerUserId)
          .forUpdate()
          .executeTakeFirstOrThrow();

        await trx
          .updateTable("users")
          .set({ walletBalance: user.walletBalance + order.total })
          .where("id", "=", order.customerUserId)
          .executeTakeFirstOrThrow();

        const refundId = `wallet-refund-${refund.id}`;
        await trx
          .updateTable("orders")
          .set({
            paymentStatus: "refunded",
            refundedAt: new Date(),
            razorpayRefundId: refundId,
            updatedAt: new Date(),
          })
          .where("id", "=", orderId)
          .executeTakeFirstOrThrow();

        return { refundId, userId: order.customerUserId };
      });

      if (!result) return null;
      await ziptoWallet.publishWallet(result.userId);
      return result.refundId;
    } catch (error) {
      console.error(`Wallet refund failed for order ${orderId}:`, error);
      throw error;
    }
  },

  async adminAdjust({
    userId,
    amount,
    note,
    adminUserId,
  }: {
    userId: number;
    amount: number;
    note: string;
    adminUserId: number;
  }): Promise<void> {
    try {
      if (!Number.isSafeInteger(amount) || amount === 0 || !note.trim()) {
        throw new HttpError(400, "A non-zero whole-rupee amount and note are required");
      }

      await db.transaction().execute(async (trx) => {
        const user = await trx
          .selectFrom("users")
          .select("walletBalance")
          .where("id", "=", userId)
          .forUpdate()
          .executeTakeFirstOrThrow();

        const nextBalance = user.walletBalance + amount;
        if (nextBalance < 0 || nextBalance > WALLET_LIMITS.maxBalance) {
          throw new HttpError(400, "Adjustment would put the wallet balance outside its limits");
        }

        await trx
          .updateTable("users")
          .set({ walletBalance: nextBalance })
          .where("id", "=", userId)
          .executeTakeFirstOrThrow();

        await trx
          .insertInto("walletTransactions")
          .values({
            userId,
            type: "admin_adjustment",
            status: "success",
            amount,
            note: note.trim(),
            createdByUserId: adminUserId,
            completedAt: new Date(),
          })
          .execute();
      });

      await ziptoWallet.publishWallet(userId);
    } catch (error) {
      console.error(`Wallet adjustment failed for user ${userId}:`, error);
      throw error;
    }
  },

  async creditComplaintRefund(
    trx: Transaction<DB>,
    {
      userId,
      orderId,
      complaintId,
      amount,
    }: {
      userId: number;
      orderId: number;
      complaintId: number;
      amount: number;
    },
  ): Promise<number> {
    try {
      if (!Number.isSafeInteger(amount) || amount <= 0) {
        throw new HttpError(400, "Invalid food complaint refund amount");
      }

      const user = await trx.selectFrom("users")
        .select("walletBalance")
        .where("id", "=", userId)
        .forUpdate()
        .executeTakeFirstOrThrow();

      // Refunds restore customer funds and may exceed the top-up balance cap.
      await trx.updateTable("users")
        .set({ walletBalance: user.walletBalance + amount })
        .where("id", "=", userId)
        .executeTakeFirstOrThrow();

      const transaction = await trx.insertInto("walletTransactions")
        .values({
          userId,
          orderId,
          type: "complaint_refund",
          status: "success",
          amount,
          note: `Food complaint #${complaintId} refund`,
          completedAt: new Date(),
        })
        .returning("id")
        .executeTakeFirstOrThrow();

      return transaction.id;
    } catch (error) {
      console.error(`Wallet complaint refund failed for complaint ${complaintId}:`, error);
      throw error;
    }
  },

  async totalLiability(): Promise<number> {
    try {
      const result = await db
        .selectFrom("users")
        .select(db.fn.sum<string>("walletBalance").as("total"))
        .executeTakeFirstOrThrow();

      const total = Number(result.total ?? 0);
      if (!Number.isSafeInteger(total) || total < 0) {
        throw new Error("Wallet liability exceeds a safe whole-rupee amount");
      }
      return total;
    } catch (error) {
      console.error("Could not calculate wallet liability:", error);
      throw error;
    }
  },
};