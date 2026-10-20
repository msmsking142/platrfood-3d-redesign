import superjson from "superjson";
import { db } from "../../helpers/db";
import { requireRole, HttpError } from "../../helpers/requireRole";
import { customerEndpointErrorResponse } from "../../helpers/customerEndpointErrorResponse";
import {
  schema,
  type OutputType,
} from "./address_action_POST.schema";
import type { CustomerAddress } from "./addresses_GET.schema";

const addressColumns = [
  "id",
  "label",
  "address",
  "landmark",
  "town",
  "lat",
  "lng",
  "phone",
  "isDefault",
] as const;

export async function handle(request: Request) {
  try {
    const user = await requireRole(request, ["user", "admin"]);
    const input = schema.parse(superjson.parse<unknown>(await request.text()));

    const result = await db.transaction().execute(async (trx) => {
      // Serializing actions per user prevents concurrent creates from exceeding
      // the limit and keeps default-address changes consistent.
      await trx
        .selectFrom("users")
        .select("id")
        .where("id", "=", user.id)
        .forUpdate()
        .executeTakeFirstOrThrow();

      if (input.action === "create") {
        const existing = await trx
          .selectFrom("customerAddresses")
          .select("id")
          .where("userId", "=", user.id)
          .execute();

        if (existing.length >= 10) {
          throw new HttpError(400, "You can save up to 10 addresses.");
        }

        const makeDefault = existing.length === 0 || input.isDefault === true;
        if (makeDefault) {
          await trx
            .updateTable("customerAddresses")
            .set({ isDefault: false })
            .where("userId", "=", user.id)
            .where("isDefault", "=", true)
            .execute();
        }

        const address = await trx
          .insertInto("customerAddresses")
          .values({
            userId: user.id,
            label: input.label,
            address: input.address,
            landmark: input.landmark || null,
            town: input.town,
            lat: input.lat ?? null,
            lng: input.lng ?? null,
            phone: input.phone,
            isDefault: makeDefault,
          })
          .returning(addressColumns)
          .executeTakeFirstOrThrow();

        return { ok: true, address } satisfies OutputType;
      }

      const current = await trx
        .selectFrom("customerAddresses")
        .select(["id", "isDefault"])
        .where("id", "=", input.id)
        .where("userId", "=", user.id)
        .executeTakeFirst();

      if (!current) throw new HttpError(404, "Address not found.");

      if (input.action === "delete") {
        await trx
          .deleteFrom("customerAddresses")
          .where("id", "=", input.id)
          .where("userId", "=", user.id)
          .execute();

        if (current.isDefault) {
          const newest = await trx
            .selectFrom("customerAddresses")
            .select("id")
            .where("userId", "=", user.id)
            .orderBy("createdAt", "desc")
            .orderBy("id", "desc")
            .executeTakeFirst();

          if (newest) {
            await trx
              .updateTable("customerAddresses")
              .set({ isDefault: true })
              .where("id", "=", newest.id)
              .where("userId", "=", user.id)
              .execute();
          }
        }

        return { ok: true } satisfies OutputType;
      }

      if (input.action === "set_default") {
        await trx
          .updateTable("customerAddresses")
          .set({ isDefault: false })
          .where("userId", "=", user.id)
          .where("id", "!=", input.id)
          .where("isDefault", "=", true)
          .execute();

        const address = await trx
          .updateTable("customerAddresses")
          .set({ isDefault: true })
          .where("id", "=", input.id)
          .where("userId", "=", user.id)
          .returning(addressColumns)
          .executeTakeFirstOrThrow();

        return { ok: true, address } satisfies OutputType;
      }

      if (input.isDefault === true) {
        await trx
          .updateTable("customerAddresses")
          .set({ isDefault: false })
          .where("userId", "=", user.id)
          .where("id", "!=", input.id)
          .where("isDefault", "=", true)
          .execute();
      }

      let makeDefault = current.isDefault || input.isDefault === true;

      if (input.isDefault === false && current.isDefault) {
        const replacement = await trx
          .selectFrom("customerAddresses")
          .select("id")
          .where("userId", "=", user.id)
          .where("id", "!=", input.id)
          .orderBy("createdAt", "desc")
          .orderBy("id", "desc")
          .executeTakeFirst();

        if (replacement) {
          await trx
            .updateTable("customerAddresses")
            .set({ isDefault: false })
            .where("id", "=", input.id)
            .where("userId", "=", user.id)
            .execute();

          await trx
            .updateTable("customerAddresses")
            .set({ isDefault: true })
            .where("id", "=", replacement.id)
            .where("userId", "=", user.id)
            .execute();

          makeDefault = false;
        }
        // A sole address remains the default.
      }

      const address: CustomerAddress = await trx
        .updateTable("customerAddresses")
        .set({
          label: input.label,
          address: input.address,
          landmark: input.landmark || null,
          town: input.town,
          lat: input.lat ?? null,
          lng: input.lng ?? null,
          phone: input.phone,
          isDefault: makeDefault,
        })
        .where("id", "=", input.id)
        .where("userId", "=", user.id)
        .returning(addressColumns)
        .executeTakeFirstOrThrow();

      return { ok: true, address } satisfies OutputType;
    });

    return new Response(superjson.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return customerEndpointErrorResponse(error);
  }
}