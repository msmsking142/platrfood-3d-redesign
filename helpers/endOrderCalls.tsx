import { publish } from "@floot/realtime";
import { db } from "./db";
import { channels } from "./realtimeChannels";

export async function endOrderCalls(orderId: number): Promise<void> {
  try {
    const endedAt = new Date();

    const affectedCalls = await db.transaction().execute(async (transaction) => {
      const missedCalls = await transaction
        .updateTable("calls")
        .set({ status: "missed", endedAt })
        .where("orderId", "=", orderId)
        .where("status", "=", "ringing")
        .returning(["id", "callerUserId", "calleeUserId"])
        .execute();

      const endedCalls = await transaction
        .updateTable("calls")
        .set({ status: "ended", endedAt })
        .where("orderId", "=", orderId)
        .where("status", "=", "active")
        .returning(["id", "callerUserId", "calleeUserId"])
        .execute();

      return [...missedCalls, ...endedCalls];
    });

    const notifications = affectedCalls.flatMap((call) => {
      const signal = {
        type: "signal",
        callId: call.id,
        kind: "hangup",
      };

      return [
        publish(channels.callInbox(call.callerUserId), signal),
        publish(channels.callInbox(call.calleeUserId), signal),
      ];
    });

    const results = await Promise.allSettled(notifications);
    for (const result of results) {
      if (result.status === "rejected") {
        console.error(`Failed to publish order ${orderId} call hangup`, result.reason);
      }
    }
  } catch (error) {
    console.error(`Failed to end calls for order ${orderId}`, error);
  }
}