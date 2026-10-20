import { publish } from "@floot/realtime";
import superjson from "superjson";
import { db } from "../../helpers/db";
import { channels } from "../../helpers/realtimeChannels";
import { resolveCallStartParticipants } from "../../helpers/callStartParticipants";
import { HttpError, requireRole } from "../../helpers/requireRole";
import { schema, type OutputType } from "./start_POST.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    const user = await requireRole(request, ["restaurant", "user", "rider"]);
    const input = schema.parse(superjson.parse(await request.text()));
    const participants = await resolveCallStartParticipants(user, input);

    const expiredBefore = new Date(Date.now() - 45_000);
    await db
      .updateTable("calls")
      .set({ status: "missed", endedAt: new Date() })
      .where("callerUserId", "=", user.id)
      .where("status", "=", "ringing")
      .where("createdAt", "<", expiredBefore)
      .execute();

    const callId = crypto.randomUUID();
    await db
      .insertInto("calls")
      .values({
        id: callId,
        orderId: input.orderId,
        callerUserId: user.id,
        calleeUserId: participants.calleeUserId,
        calleeRole: input.target,
        status: "ringing",
      })
      .execute();

    await publish(channels.callInbox(participants.calleeUserId), {
      type: "incoming",
      callId,
      orderId: input.orderId,
      callerName: participants.callerName,
      callerRole: participants.callerRole,
    });

    return requireRole.json({
      callId,
      calleeName: participants.calleeName,
    } satisfies OutputType);
  } catch (error) {
    if (!(error instanceof HttpError)) {
      console.error("Call start failed", error);
    }
    return requireRole.errorResponse(error);
  }
}