import { publish } from "@floot/realtime";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { activeCallStatuses } from "../../helpers/callActiveStatuses";
import { channels } from "../../helpers/realtimeChannels";
import { HttpError, requireRole } from "../../helpers/requireRole";
import { schema, type OutputType } from "./signal_POST.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    const user = await requireRole(request, [
      "user",
      "restaurant",
      "rider",
      "admin",
    ]);
    const input = schema.parse(superjson.parse(await request.text()));

    const outcome = await db.transaction().execute(async (transaction) => {
      const call = await transaction
        .selectFrom("calls")
        .innerJoin("orders", "orders.id", "calls.orderId")
        .select([
          "calls.orderId",
          "calls.callerUserId",
          "calls.calleeUserId",
          "calls.status",
          "orders.status as orderStatus",
        ])
                .where("calls.id", "=", input.callId)
        .forUpdate("calls")
        .executeTakeFirst();

      if (!call) throw new HttpError(404, "Call not found");

      const isCaller = call.callerUserId === user.id;
      const isCallee = call.calleeUserId === user.id;
      if (!isCaller && !isCallee) {
        throw new HttpError(403, "You don't have access to this call");
      }

      if (
        ["accept", "offer", "answer", "ice"].includes(input.kind) &&
        !activeCallStatuses.includes(call.orderStatus)
      ) {
        await transaction
          .updateTable("calls")
          .set({ status: "ended", endedAt: new Date() })
          .where("id", "=", input.callId)
          .execute();

        return {
          endedForInactiveOrder: true as const,
          callerUserId: call.callerUserId,
          calleeUserId: call.calleeUserId,
          orderId: call.orderId,
        };
      }

      const recipientId = isCaller ? call.calleeUserId : call.callerUserId;
      const isTerminal = ["ended", "declined", "missed"].includes(call.status);

      if (
        isTerminal &&
        ["offer", "answer", "ice", "accept"].includes(input.kind)
      ) {
        throw new HttpError(409, "Call has ended");
      }

      if (input.kind === "accept") {
        if (!isCallee || call.status !== "ringing") {
          throw new HttpError(409, "Only the recipient can accept a ringing call");
        }
        await transaction
          .updateTable("calls")
          .set({ status: "active", answeredAt: new Date() })
          .where("id", "=", input.callId)
          .execute();
      } else if (input.kind === "decline") {
        if (!isCallee || call.status !== "ringing") {
          throw new HttpError(409, "Only the recipient can decline a ringing call");
        }
        await transaction
          .updateTable("calls")
          .set({ status: "declined", endedAt: new Date() })
          .where("id", "=", input.callId)
          .execute();
      } else if (input.kind === "missed") {
        if (!isCaller || call.status !== "ringing") {
          throw new HttpError(409, "Only the caller can mark a ringing call missed");
        }
        await transaction
          .updateTable("calls")
          .set({ status: "missed", endedAt: new Date() })
          .where("id", "=", input.callId)
          .execute();
      } else if (input.kind === "hangup") {
        if (isTerminal) throw new HttpError(409, "Call has ended");
        await transaction
          .updateTable("calls")
          .set({
            status: call.status === "ringing" && isCaller ? "missed" : "ended",
            endedAt: new Date(),
          })
          .where("id", "=", input.callId)
          .execute();
      } else if (call.status !== "ringing" && call.status !== "active") {
        throw new HttpError(409, "Call has ended");
      }

      return { endedForInactiveOrder: false as const, otherUserId: recipientId };
    });

    if (outcome.endedForInactiveOrder) {
      const hangup = { type: "signal", callId: input.callId, kind: "hangup" };
      const results = await Promise.allSettled([
        publish(channels.callInbox(outcome.callerUserId), hangup),
        publish(channels.callInbox(outcome.calleeUserId), hangup),
      ]);
      for (const result of results) {
        if (result.status === "rejected") {
          console.error(
            `Failed to publish inactive order ${outcome.orderId} call hangup`,
            result.reason
          );
        }
      }
      return requireRole.errorResponse(
        new HttpError(
          409,
          "This order is no longer active, so the call has ended"
        )
      );
    }

    await publish(channels.callInbox(outcome.otherUserId), {
      type: "signal",
      callId: input.callId,
      kind: input.kind,
      payload: input.payload,
      from: user.id,
    });

    return requireRole.json({ ok: true } satisfies OutputType);
  } catch (error) {
    console.error("Call signal failed", error);
    return requireRole.errorResponse(error);
  }
}