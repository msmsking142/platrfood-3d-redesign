import { db } from "../../helpers/db";
import { HttpError, requireRole } from "../../helpers/requireRole";
import { schema, WALLET_LIMITS, type OutputType } from "./summary_GET.schema";

export async function handle(request: Request) {
  try {
    schema.parse({});
    const user = await requireRole(request, ["user", "admin"]);

    const [walletUser, transactions] = await Promise.all([
      db
        .selectFrom("users")
        .select("walletBalance")
        .where("id", "=", user.id)
        .executeTakeFirstOrThrow(),
      db
        .selectFrom("walletTransactions")
        .select([
          "id",
          "type",
          "status",
          "amount",
          "orderId",
          "note",
          "createdAt",
          "completedAt",
        ])
        .where("userId", "=", user.id)
        .orderBy("createdAt", "desc")
        .orderBy("id", "desc")
        .limit(50)
        .execute(),
    ]);

    return requireRole.json({
      balance: walletUser.walletBalance,
      limits: WALLET_LIMITS,
      transactions,
    } satisfies OutputType);
  } catch (error) {
    if (!(error instanceof HttpError)) {
      console.error("Could not load wallet summary:", error);
    }
    return requireRole.errorResponse(
      error instanceof HttpError
        ? error
        : new HttpError(500, "Could not load wallet summary"),
    );
  }
}