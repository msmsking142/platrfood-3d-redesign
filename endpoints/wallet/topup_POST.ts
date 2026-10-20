import superjson from "superjson";
import { z } from "zod";
import { db } from "../../helpers/db";
import {
  getRazorpayCredentials,
  razorpayRequest,
} from "../../helpers/razorpayProPayment";
import { HttpError, requireRole } from "../../helpers/requireRole";
import { WALLET_LIMITS } from "./summary_GET.schema";
import { schema, type OutputType } from "./topup_POST.schema";

const razorpayOrderSchema = z.object({
  id: z.string().min(1),
  amount: z.number().int().positive(),
  currency: z.literal("INR"),
});

export async function handle(request: Request) {
  try {
    const user = await requireRole(request, ["user", "admin"]);
    const { amount } = schema.parse(superjson.parse<unknown>(await request.text()));

    const walletUser = await db
      .selectFrom("users")
      .select("walletBalance")
      .where("id", "=", user.id)
      .executeTakeFirstOrThrow();

    if (walletUser.walletBalance + amount > WALLET_LIMITS.maxBalance) {
      throw new HttpError(400, "Wallet balance can be at most ₹10,000");
    }

    const pending = await db
      .insertInto("walletTransactions")
      .values({
        userId: user.id,
        type: "topup",
        status: "pending",
        amount,
        note: "Wallet top-up",
      })
      .returning("id")
      .executeTakeFirstOrThrow();

    try {
      const credentials = getRazorpayCredentials();
      const response = await razorpayRequest("/orders", credentials, "POST", {
        amount: amount * 100,
        currency: "INR",
        receipt: `zipto-wallet-${pending.id}`,
        notes: {
          purpose: "zipto_wallet_topup",
          walletTxnId: String(pending.id),
          userId: String(user.id),
        },
      });

      const razorpayOrder = razorpayOrderSchema.safeParse(response);
      if (!razorpayOrder.success || razorpayOrder.data.amount !== amount * 100) {
        throw new HttpError(502, "Razorpay returned an invalid wallet payment order");
      }

      const saved = await db
        .updateTable("walletTransactions")
        .set({ razorpayOrderId: razorpayOrder.data.id })
        .where("id", "=", pending.id)
        .where("status", "=", "pending")
        .returning("id")
        .executeTakeFirst();

      if (!saved) throw new HttpError(500, "Could not record the wallet payment order");

      return requireRole.json({
        walletTxnId: pending.id,
        payment: {
          razorpayOrderId: razorpayOrder.data.id,
          amount: razorpayOrder.data.amount,
          currency: "INR",
          keyId: credentials.keyId,
          prefill: { name: user.displayName, email: user.email, contact: "" },
        },
      } satisfies OutputType);
    } catch (error) {
      console.error(`Could not start wallet top-up ${pending.id}:`, error);
      await db
        .updateTable("walletTransactions")
        .set({ status: "failed", completedAt: new Date() })
        .where("id", "=", pending.id)
        .where("status", "=", "pending")
        .execute();

      throw new HttpError(502, "Wallet top-up could not be started. Please try again.");
    }
  } catch (error) {
    if (!(error instanceof HttpError) && !(error instanceof z.ZodError)) {
      console.error("Wallet top-up request failed:", error);
    }
    return requireRole.errorResponse(
      error instanceof HttpError
        ? error
        : error instanceof z.ZodError
          ? new HttpError(400, "Invalid wallet top-up amount")
          : new HttpError(500, "Could not start wallet top-up"),
    );
  }
}