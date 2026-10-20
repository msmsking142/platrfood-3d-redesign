import superjson from "superjson";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { NotAuthenticatedError } from "../../helpers/getSetServerSession";
import { requireRole, HttpError } from "../../helpers/requireRole";
import { supportCategories, accountTypeForRole } from "../../helpers/supportCategories";
import { supportTickets } from "../../helpers/supportTickets";
import { schema, type OutputType } from "./ticket_POST.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    const input = schema.parse(superjson.parse(await request.text()));

    let user: Awaited<ReturnType<typeof getServerUserSession>>["user"] | null = null;
    try {
      user = (await getServerUserSession(request)).user;
    } catch (error) {
      if (!(error instanceof NotAuthenticatedError)) throw error;
    }

    const accountType = accountTypeForRole(user?.role);
    const permitted: readonly string[] = supportCategories[accountType];
    if (!permitted.includes(input.category)) {
      throw new HttpError(400, "Choose a valid support category");
    }

    const ticketId = await supportTickets.create({
      userId: user?.id ?? null,
      accountType,
      name: input.name,
      email: user?.email ?? input.email,
      category: input.category,
      orderId: input.orderId ?? null,
      subject: input.subject,
      message: input.message,
      source: "form",
    });

    if (ticketId === null) throw new Error("Support ticket was not created");
    return requireRole.json({ ticketId } satisfies OutputType);
  } catch (error) {
    return requireRole.errorResponse(error);
  }
}