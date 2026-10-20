import superjson from "superjson";
import { accountDeletion } from "../../helpers/accountDeletion";
import { clearServerSession } from "../../helpers/getSetServerSession";
import { requireRole } from "../../helpers/requireRole";
import { schema, type OutputType } from "./delete_POST.schema";

export async function handle(request: Request) {
  try {
    const user = await requireRole(request, [
      "user",
      "admin",
      "restaurant",
      "rider",
    ]);
    const input = schema.parse(superjson.parse(await request.text()));

    const { retained } = await accountDeletion.deleteCustomerAccount(
      user.id,
      input.password,
    );

    const response = requireRole.json({
      success: true,
      retained,
    } satisfies OutputType);
    response.headers.set("Cache-Control", "no-store");
    clearServerSession(response);
    return response;
  } catch (error) {
    return requireRole.errorResponse(error);
  }
}