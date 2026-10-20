import superjson from "superjson";
import { requireRole } from "../../helpers/requireRole";
import { supportTickets } from "../../helpers/supportTickets";
import { schema, type OutputType } from "./support_action_POST.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    const admin = await requireRole(request, ["admin"]);
    const input = schema.parse(superjson.parse(await request.text()));

    if (input.action === "reply") {
      await supportTickets.reply({
        ticketId: input.ticketId,
        adminUserId: admin.id,
        message: input.message,
        closeAfter: input.close ?? false,
      });
    } else {
      await supportTickets.setStatus(input.ticketId, input.status);
    }

    return requireRole.json({ success: true } satisfies OutputType);
  } catch (error) {
    return requireRole.errorResponse(error);
  }
}