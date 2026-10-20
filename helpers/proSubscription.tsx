import type { Transaction } from "kysely";
import { db } from "./db";
import type { DB } from "./schema";
import { sendZiptoEmail } from "./sendZiptoEmail";
import { HttpError } from "./requireRole";
import { getProTrialEligibility } from "./proTrialEligibility";
import { ziptoConfig } from "./ziptoConfig";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const SUBSCRIPTION_URL =
  "https://www.platrfood.co.in/partner?section=subscription";

type ActivatedPayment = {
  paymentId: number;
  restaurantId: number;
  restaurantName: string;
  ownerEmail: string;
  ownerName: string;
  periodStart: Date;
  periodEnd: Date;
  activationEmailSentAt: Date | null;
};

async function activatePayment(
  transaction: Transaction<DB>,
  paymentId: number,
  restaurantId: number,
  billingStartedAt: Date,
  now: Date,
): Promise<{ periodStart: Date; periodEnd: Date }> {
  const restaurant = await transaction
    .selectFrom("restaurants")
    .select(["id", "proPaidUntil"])
    .where("id", "=", restaurantId)
    .forUpdate()
    .executeTakeFirstOrThrow();

  const periodStart = new Date(
    Math.max(
      now.getTime(),
      billingStartedAt.getTime(),
      restaurant.proPaidUntil?.getTime() ?? 0,
    ),
  );
  const periodEnd = new Date(periodStart.getTime() + THIRTY_DAYS_MS);

  await transaction
    .updateTable("subscriptionPayments")
    .set({ periodStart, periodEnd })
    .where("id", "=", paymentId)
    .where("periodStart", "is", null)
    .executeTakeFirstOrThrow();

  await transaction
    .updateTable("restaurants")
    .set({ plan: "pro", proPaidUntil: periodEnd })
    .where("id", "=", restaurantId)
    .executeTakeFirstOrThrow();

  return { periodStart, periodEnd };
}

function activationMessage(payment: ActivatedPayment) {
  const formatter = new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  });
  const start = formatter.format(payment.periodStart);
  const end = formatter.format(payment.periodEnd);

  return {
    subject: "Your platr™ Pro plan is now active",
    text: `platr™ Pro ab active hai! Aapka plan ${start} se ${end} tak active hai. Is dauraan orders par 8% commission applies. Pro continue rakhne ke liye expiry se pehle renew karein: ${SUBSCRIPTION_URL}\n\nHelp chahiye? ${ziptoConfig.supportUrl} par Contact Support form bharein.`,
    html: `<p>platr™ Pro ab active hai!</p><p>Aapka plan <strong>${start}</strong> se <strong>${end}</strong> tak active hai. Is dauraan orders par <strong>8% commission</strong> applies.</p><p>Pro continue rakhne ke liye expiry se pehle <a href="${SUBSCRIPTION_URL}">renew karein</a>.</p><p>Help chahiye? <a href="${ziptoConfig.supportUrl}">Contact Support form</a> bharein.</p>`,
  };
}

export const proSubscription = {
  effectivePlan(
    plan: "basic" | "pro",
    proPaidUntil: Date | null,
    now = new Date(),
  ): "basic" | "pro" {
    return plan === "pro" && proPaidUntil !== null && proPaidUntil > now
      ? "pro"
      : "basic";
  },

  async trialState(restaurantId: number) {
    const restaurant = await db.selectFrom("restaurants")
      .select("status")
      .where("id", "=", restaurantId)
      .executeTakeFirst();

    const state = await getProTrialEligibility(
      db,
      restaurantId,
      restaurant?.status ?? null,
    );
    return {
      eligible: state.eligible,
      ineligibleReason: state.ineligibleReason,
      days: state.days,
      trial: state.trial,
    };
  },

  async startTrial(restaurantId: number) {
    let started: {
      startedAt: Date;
      endsAt: Date;
      ownerEmail: string;
    };
    try {
      started = await db.transaction().execute(async (transaction) => {
        const restaurant = await transaction.selectFrom("restaurants")
          .select(["id", "status", "ownerUserId"])
          .where("id", "=", restaurantId)
          .forUpdate()
          .executeTakeFirst();
        if (!restaurant) throw new HttpError(409, "Complete your restaurant profile first");

        const eligibility = await getProTrialEligibility(
          transaction,
          restaurantId,
          restaurant.status,
        );
        if (!eligibility.eligible) {
          throw new HttpError(409, eligibility.ineligibleReason!);
        }

        const now = new Date();
        const endsAt = new Date(now.getTime() + eligibility.days * 24 * 60 * 60 * 1000);
        await transaction.insertInto("proTrials")
          .values({
            restaurantId,
            startedAt: now,
            endsAt,
            consentedAt: now,
          })
          .execute();
        await transaction.updateTable("restaurants")
          .set({ plan: "pro", proPaidUntil: endsAt })
          .where("id", "=", restaurantId)
          .executeTakeFirstOrThrow();
        const owner = await transaction.selectFrom("users")
          .select("email")
          .where("id", "=", restaurant.ownerUserId)
          .executeTakeFirstOrThrow();
        return { startedAt: now, endsAt, ownerEmail: owner.email };
      });
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "23505") {
        throw new HttpError(409, "Free trial already used");
      }
      throw error;
    }

    const formatter = new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    });
    const start = formatter.format(started.startedAt);
    const end = formatter.format(started.endsAt);
    try {
      const emailed = await sendZiptoEmail({
        to: started.ownerEmail,
        subject: "Your platr™ Pro free trial has started",
        text: `Your platr™ Pro free trial runs from ${start} to ${end}. 8% commission plus GST on commission applies during the trial. No auto-charge. After ${end} your account moves to Basic (15% commission) unless you choose to pay ₹2,499 + GST to continue Pro. Manage your plan: ${SUBSCRIPTION_URL}`,
        html: `<p>Your platr™ Pro free trial runs from ${start} to ${end}. 8% commission plus GST on commission applies during the trial.</p><p>No auto-charge. After ${end} your account moves to Basic (15% commission) unless you choose to pay ₹2,499 + GST to continue Pro.</p><p><a href="${SUBSCRIPTION_URL}">Manage your plan</a></p>`,
      });
      if (!emailed) console.error(`Could not email Pro trial start for restaurant ${restaurantId}`);
    } catch (error) {
      console.error(`Could not email Pro trial start for restaurant ${restaurantId}:`, error);
    }
    return { startedAt: started.startedAt, endsAt: started.endsAt };
  },

  async cancelTrial(restaurantId: number) {
    await db.transaction().execute(async (transaction) => {
      const restaurant = await transaction.selectFrom("restaurants")
        .select("id")
        .where("id", "=", restaurantId)
        .forUpdate()
        .executeTakeFirst();
      if (!restaurant) throw new HttpError(409, "Complete your restaurant profile first");

      const trial = await transaction.selectFrom("proTrials")
        .select(["id", "endsAt", "cancelledAt"])
        .where("restaurantId", "=", restaurantId)
        .forUpdate()
        .executeTakeFirst();
      const now = new Date();
      if (!trial || trial.cancelledAt !== null || trial.endsAt <= now) {
        throw new HttpError(409, "There is no active Pro trial to cancel");
      }

      const paidPeriod = await transaction.selectFrom("subscriptionPayments")
        .select("id")
        .where("restaurantId", "=", restaurantId)
        .where("status", "=", "paid")
        .where("periodEnd", ">", trial.endsAt)
        .executeTakeFirst();
      if (paidPeriod) {
        throw new HttpError(
          409,
          "You have a paid Pro period booked after the trial – switching to Basic is done from Switch to Basic",
        );
      }

      await transaction.updateTable("proTrials")
        .set({ cancelledAt: now })
        .where("id", "=", trial.id)
        .executeTakeFirstOrThrow();
      await transaction.updateTable("restaurants")
        .set({ plan: "basic", proPaidUntil: now })
        .where("id", "=", restaurantId)
        .executeTakeFirstOrThrow();
    });
  },

  async recordPaidPayment({
    restaurantId,
    razorpayOrderId,
    razorpayPaymentId,
  }: {
    restaurantId: number;
    razorpayOrderId: string;
    razorpayPaymentId: string;
  }): Promise<{
    state: "active" | "awaiting_activation";
    proPaidUntil: Date | null;
  }> {
    try {
      return await db.transaction().execute(async (transaction) => {
        const payment = await transaction
          .selectFrom("subscriptionPayments")
          .select(["id", "status", "periodStart"])
          .where("restaurantId", "=", restaurantId)
          .where("razorpayOrderId", "=", razorpayOrderId)
          .forUpdate()
          .executeTakeFirstOrThrow();

        if (payment.status === "paid") {
          if (payment.periodStart === null) {
            return { state: "awaiting_activation", proPaidUntil: null };
          }

          const restaurant = await transaction
            .selectFrom("restaurants")
            .select("proPaidUntil")
            .where("id", "=", restaurantId)
            .executeTakeFirstOrThrow();

          return {
            state: "active",
            proPaidUntil: restaurant.proPaidUntil,
          };
        }

        const now = new Date();
        await transaction
          .updateTable("subscriptionPayments")
          .set({
            status: "paid",
            razorpayPaymentId,
            paidAt: now,
          })
          .where("id", "=", payment.id)
          .executeTakeFirstOrThrow();

        const settings = await transaction
          .selectFrom("appSettings")
          .select(["launchMode", "proBillingStartedAt"])
          .where("id", "=", 1)
          .executeTakeFirstOrThrow();

        if (settings.launchMode || settings.proBillingStartedAt === null) {
          return { state: "awaiting_activation", proPaidUntil: null };
        }

        const { periodEnd } = await activatePayment(
          transaction,
          payment.id,
          restaurantId,
          settings.proBillingStartedAt,
          now,
        );

        return { state: "active", proPaidUntil: periodEnd };
      });
    } catch (error) {
      console.error("Could not record paid platr™ Pro payment:", error);
      throw error;
    }
  },

  async activateAllPending(): Promise<{
    activated: {
      restaurantId: number;
      restaurantName: string;
      ownerEmail: string;
      ownerName: string;
      periodStart: Date;
      periodEnd: Date;
      emailed: boolean;
    }[];
  }> {
    try {
      const payments = await db.transaction().execute(async (transaction) => {
        const pending = await transaction
          .selectFrom("subscriptionPayments")
          .select(["id", "restaurantId", "activationEmailSentAt"])
          .where("status", "=", "paid")
          .where("periodStart", "is", null)
          .orderBy("paidAt", "asc")
          .orderBy("id", "asc")
          .forUpdate()
          .execute();

        const now = new Date();
        const settings = await transaction
          .selectFrom("appSettings")
          .select("proBillingStartedAt")
          .where("id", "=", 1)
          .forUpdate()
          .executeTakeFirstOrThrow();

        const billingStartedAt = settings.proBillingStartedAt ?? now;
        if (settings.proBillingStartedAt === null) {
          await transaction
            .updateTable("appSettings")
            .set({ proBillingStartedAt: billingStartedAt })
            .where("id", "=", 1)
            .executeTakeFirstOrThrow();
        }

        const activated: ActivatedPayment[] = [];
        for (const payment of pending) {
          const { periodStart, periodEnd } = await activatePayment(
            transaction,
            payment.id,
            payment.restaurantId,
            billingStartedAt,
            now,
          );

          const owner = await transaction
            .selectFrom("restaurants")
            .innerJoin("users", "users.id", "restaurants.ownerUserId")
            .select([
              "restaurants.name as restaurantName",
              "users.email as ownerEmail",
              "users.displayName as ownerName",
            ])
            .where("restaurants.id", "=", payment.restaurantId)
            .executeTakeFirstOrThrow();

          activated.push({
            paymentId: payment.id,
            restaurantId: payment.restaurantId,
            ...owner,
            periodStart,
            periodEnd,
            activationEmailSentAt: payment.activationEmailSentAt,
          });
        }

        return activated;
      });

      const activated = [];
      for (const payment of payments) {
        let emailed = payment.activationEmailSentAt !== null;
        if (!emailed) {
          emailed = await sendZiptoEmail({
            to: payment.ownerEmail,
            ...activationMessage(payment),
          });

          if (emailed) {
            await db
              .updateTable("subscriptionPayments")
              .set({ activationEmailSentAt: new Date() })
              .where("id", "=", payment.paymentId)
              .where("activationEmailSentAt", "is", null)
              .execute();
          }
        }

        activated.push({
          restaurantId: payment.restaurantId,
          restaurantName: payment.restaurantName,
          ownerEmail: payment.ownerEmail,
          ownerName: payment.ownerName,
          periodStart: payment.periodStart,
          periodEnd: payment.periodEnd,
          emailed,
        });
      }

      return { activated };
    } catch (error) {
      console.error("Could not activate pending platr™ Pro payments:", error);
      throw error;
    }
  },

  async pendingActivations(): Promise<
    {
      paymentId: number;
      restaurantId: number;
      restaurantName: string;
      ownerName: string;
      ownerEmail: string;
      amount: number;
      paidAt: Date;
    }[]
  > {
    try {
      const payments = await db
        .selectFrom("subscriptionPayments")
        .innerJoin(
          "restaurants",
          "restaurants.id",
          "subscriptionPayments.restaurantId",
        )
        .innerJoin("users", "users.id", "restaurants.ownerUserId")
        .select([
          "subscriptionPayments.id as paymentId",
          "subscriptionPayments.restaurantId",
          "restaurants.name as restaurantName",
          "users.displayName as ownerName",
          "users.email as ownerEmail",
          "subscriptionPayments.amount",
          "subscriptionPayments.paidAt",
        ])
        .where("subscriptionPayments.status", "=", "paid")
        .where("subscriptionPayments.periodStart", "is", null)
        .where("subscriptionPayments.paidAt", "is not", null)
        .orderBy("subscriptionPayments.paidAt", "asc")
        .execute();

      return payments.map((payment) => {
        if (payment.paidAt === null) {
          throw new Error(`Paid payment ${payment.paymentId} has no paidAt`);
        }
        return { ...payment, paidAt: payment.paidAt };
      });
    } catch (error) {
      console.error("Could not load pending platr™ Pro activations:", error);
      throw error;
    }
  },

  async restaurantState(restaurantId: number): Promise<{
    awaitingActivation: boolean;
    awaitingPaidAt: Date | null;
  }> {
    try {
      const payment = await db
        .selectFrom("subscriptionPayments")
        .select("paidAt")
        .where("restaurantId", "=", restaurantId)
        .where("status", "=", "paid")
        .where("periodStart", "is", null)
        .orderBy("paidAt", "asc")
        .executeTakeFirst();

      return {
        awaitingActivation: payment !== undefined,
        awaitingPaidAt: payment?.paidAt ?? null,
      };
    } catch (error) {
      console.error("Could not load restaurant Pro state:", error);
      throw error;
    }
  },
};