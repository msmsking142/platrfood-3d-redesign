import { onEmailReceived } from "@floot/email";
import { requireRole } from "../../helpers/requireRole";
import { supportTickets } from "../../helpers/supportTickets";
import { schema, type OutputType } from "./support_tickets_GET.schema";

// Floot's backend scanner registers the named inbound handler from this call.
onEmailReceived("handleInboundEmail");

export async function handle(request: Request): Promise<Response> {
  try {
    await requireRole(request, ["admin"]);
    const { status } = schema.parse({
      status: new URL(request.url).searchParams.get("status") ?? undefined,
    });
    const result = await supportTickets.listForAdmin({ status });
    return requireRole.json(result satisfies OutputType);
  } catch (error) {
    return requireRole.errorResponse(error);
  }
}