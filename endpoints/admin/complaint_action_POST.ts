import superjson from "superjson";
import { foodComplaints } from "../../helpers/foodComplaints";
import { requireRole } from "../../helpers/requireRole";
import { schema, type OutputType } from "./complaint_action_POST.schema";

export async function handle(request: Request) {
  try {
    const admin = await requireRole(request, ["admin"]);
    const input = schema.parse(superjson.parse(await request.text()));
    let message: string;

    switch (input.action) {
      case "approve": {
        const status = await foodComplaints.approve({
          complaintId: input.complaintId,
          adminUserId: admin.id,
          note: input.note,
        });
        message = status === "failed"
          ? "Complaint approved, but the online refund failed. Review and retry it."
          : status === "processing"
            ? "Complaint approved. Razorpay is processing the refund."
            : "Complaint approved and refund processed.";
        break;
      }
      case "reject":
        await foodComplaints.reject({
          complaintId: input.complaintId,
          adminUserId: admin.id,
          note: input.note,
        });
        message = "Complaint rejected.";
        break;
      case "retry_refund": {
        const status = await foodComplaints.retryRefund({
          complaintId: input.complaintId,
        });
        message = status === "failed"
          ? "Refund retry failed. Check the recorded error before retrying."
          : status === "processing"
            ? "Razorpay is processing the refund."
            : "Refund processed.";
        break;
      }
      case "settings":
        await foodComplaints.updateSettings(input);
        message = "Food complaint settings updated.";
        break;
    }

    return requireRole.json({ ok: true, message } satisfies OutputType);
  } catch (error) {
    return requireRole.errorResponse(error);
  }
}