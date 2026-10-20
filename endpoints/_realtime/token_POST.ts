import { createToken } from "@floot/realtime";
import superjson from "superjson";
import { getServerUserSession } from "../../helpers/getServerUserSession";
import { db } from "../../helpers/db";
import { channels as ch } from "../../helpers/realtimeChannels";
import { schema } from "./token_POST.schema";

// Mints a realtime token for the current connection. Who the user is and which
// channels they may access are both yours to set.
//
// Identity (userId — what presence reports as online). Pick a source:
//  - logged-in: read your session, e.g.
//      const userId = (await getServerSession(request))?.user.id;
//  - anonymous: an id you generate (crypto.randomUUID()). To keep it stable across
//      reconnects, persist it — e.g. set + read a cookie here, or have the client
//      store it and send it (see the next option).
//  - from the client: add fields to the schema (token_POST.schema), read them off
//      the request body here, and pass them where RealtimeClient calls
//      postRealtimeToken().
const json = (data: unknown, status = 200) =>
  new Response(superjson.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });

export async function handle(request: Request) {
  let user;
  try {
    ({ user } = await getServerUserSession(request));
  } catch {
    return json({ error: "Not authenticated" }, 401);
  }
  try {
    schema.parse(superjson.parse(await request.text()));
  } catch {
    return json({ error: "Invalid realtime token request" }, 400);
  }
  const userId = String(user.id);

  // Scope grants to the user's own role/ids.
  const channels: string[] = [ch.customer(user.id), ch.callInbox(user.id)];
  const activeOrders = await db
    .selectFrom("orders")
    .select("id")
    .where("customerUserId", "=", user.id)
    .where("status", "in", ["accepted", "preparing", "ready", "picked_up"])
    .orderBy("createdAt", "desc")
    .limit(20)
    .execute();
  channels.push(...activeOrders.map((order) => ch.orderLive(order.id)));

  if (user.role === "admin") {
    channels.push(ch.admin(), "rest:*", "restlive:*", "rider:*", "town:*", "orderlive:*");
  } else if (user.role === "restaurant") {
    const r = await db
      .selectFrom("restaurants")
      .select("id")
      .where("ownerUserId", "=", user.id)
      .executeTakeFirst();
    if (r) channels.push(ch.restaurant(r.id), ch.restaurantLive(r.id));
  } else if (user.role === "rider") {
    const r = await db
      .selectFrom("riders")
      .select(["id", "town", "status"])
      .where("userId", "=", user.id)
      .executeTakeFirst();
    if (r) {
      channels.push(ch.rider(r.id));
      if (r.status === "approved") channels.push(ch.ridersTown(r.town));
    }
  }
  if (channels.length === 0) {
    return json({ error: "Realtime: set channel grants in _realtime/token" }, 500);
  }

  const result = await createToken({ userId, channels, ttlSeconds: 3600 });
  if (!result.ok) {
    return json({ error: result.error.message }, 500);
  }
  return json({ token: result.token, wssEndpoint: result.wssEndpoint, userId });
}
