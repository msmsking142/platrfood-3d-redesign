import { z } from "zod";
import superjson from "superjson";
import type { Selectable } from "kysely";
import type { CustomerAddresses } from "../../helpers/schema";

export const schema = z.object({});

export type CustomerAddress = Pick<
  Selectable<CustomerAddresses>,
  | "id"
  | "label"
  | "address"
  | "landmark"
  | "town"
  | "lat"
  | "lng"
  | "phone"
  | "isDefault"
>;

export type OutputType = { addresses: CustomerAddress[] };

export async function getCustomerAddresses(
  init?: RequestInit,
): Promise<OutputType> {
  const result = await fetch("/_api/customer/addresses", {
    ...init,
    method: "GET",
  });

  if (!result.ok) {
    const error = superjson.parse<{ error: string }>(await result.text());
    throw new Error(error.error);
  }

  return superjson.parse<OutputType>(await result.text());
}