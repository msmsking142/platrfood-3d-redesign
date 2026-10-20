import superjson from "superjson";
import { publish } from "@floot/realtime";
import { db } from "../helpers/db";
import { schema, OutputType } from "./onboarding_POST.schema";
import { requireRole, HttpError } from "../helpers/requireRole";
import { ziptoConfig } from "../helpers/ziptoConfig";
import { channels } from "../helpers/realtimeChannels";

export async function handle(request: Request) {
  try {
    const input = schema.parse(superjson.parse(await request.text()));
    const user = await requireRole(request, [input.kind]);
    if (!(ziptoConfig.towns as readonly string[]).includes(input.town))
      throw new HttpError(400, "We are not in this town yet");

    if (input.kind === "restaurant") {
      const expiry = new Date(`${input.fssaiExpiryDate}T23:59:59.999Z`);
      if (!Number.isFinite(expiry.getTime()) || expiry <= new Date())
        throw new HttpError(400, "Your FSSAI licence must be valid and not expired");
      const values = {
        name: input.name,
        description: input.description || null,
        cuisine: input.cuisine || null,
        town: input.town,
        address: input.address,
        phone: input.phone,
        plan: input.plan,
        fssaiDocumentUrl: input.fssaiDocumentUrl,
        fssaiLicenseNumber: input.fssaiLicenseNumber,
        fssaiExpiryDate: input.fssaiExpiryDate,
        fssaiVerificationStatus: "not_checked",
        fssaiVerificationCheckedAt: null,
        fssaiVerificationNote: null,
        status: "pending" as const,
        isOpen: false,
      };
      await db
        .insertInto("restaurants")
        .values({ ...values, ownerUserId: user.id })
        .onConflict((oc) => oc.column("ownerUserId").doUpdateSet(values))
        .execute();
    } else {
      const values = {
        town: input.town,
        phone: input.phone,
        vehicleType: input.vehicleType,
        vehicleNumber: input.vehicleNumber || null,
      };
      await db
        .insertInto("riders")
        .values({ ...values, userId: user.id })
        .onConflict((oc) => oc.column("userId").doUpdateSet(values))
        .execute();
    }
    await publish(channels.admin(), { type: "partner" }).catch(() => {});
    return requireRole.json({ ok: true } satisfies OutputType);
  } catch (e) {
    return requireRole.errorResponse(e);
  }
}