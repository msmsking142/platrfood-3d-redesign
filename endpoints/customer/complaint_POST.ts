import superjson from "superjson";
import { foodComplaints } from "../../helpers/foodComplaints";
import { requireRole } from "../../helpers/requireRole";
import { schema, type OutputType } from "./complaint_POST.schema";

export async function handle(request: Request) {
  try {
    const user = await requireRole(request, ["user", "admin"]);
    const input = schema.parse(superjson.parse(await request.text()));
    const result = await foodComplaints.submit({
      userId: user.id,
      ...input,
    });
    return requireRole.json(result satisfies OutputType);
  } catch (error) {
    return requireRole.errorResponse(error);
  }
}