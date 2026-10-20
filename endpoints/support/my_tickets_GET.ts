import { requireRole } from "../../helpers/requireRole";
import { db } from "../../helpers/db";
import { supportTickets } from "../../helpers/supportTickets";
import type { OutputType } from "./my_tickets_GET.schema";

export async function handle(request: Request): Promise<Response> {
  try {
    const user = await requireRole(request, ["user", "restaurant", "rider", "admin"]);

    let orders = db
      .selectFrom("orders")
      .innerJoin("restaurants", "restaurants.id", "orders.restaurantId")
      .select([
        "orders.id",
        "orders.createdAt",
        "orders.status",
        "orders.total",
        "restaurants.name as restaurantName",
      ]);

    if (user.role === "restaurant") {
      orders = orders.where(
        "orders.restaurantId",
        "in",
        db.selectFrom("restaurants")
          .select("id")
          .where("ownerUserId", "=", user.id),
      );
    } else if (user.role === "rider") {
      orders = orders.where(
        "orders.riderId",
        "in",
        db.selectFrom("riders").select("id").where("userId", "=", user.id),
      );
    } else {
      orders = orders.where("orders.customerUserId", "=", user.id);
    }

    const [tickets, recentOrders] = await Promise.all([
      supportTickets.listForUser(user.id),
      orders.orderBy("orders.createdAt", "desc").limit(10).execute(),
    ]);

    return requireRole.json({ tickets, recentOrders } satisfies OutputType);
  } catch (error) {
    return requireRole.errorResponse(error);
  }
}