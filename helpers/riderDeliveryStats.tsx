import { db } from "./db";

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export async function riderDeliveryStats(riderId: number) {
  const now = Date.now();
  const todayLabel = new Date(now + IST_OFFSET_MS).toISOString().slice(0, 10);
  const todayStart = Date.parse(`${todayLabel}T00:00:00.000Z`) - IST_OFFSET_MS;
  const dailyStart = new Date(todayStart - 13 * DAY_MS);
  const monthStart = new Date(
    Date.parse(`${todayLabel.slice(0, 7)}-01T00:00:00.000Z`) - IST_OFFSET_MS
  );

  const [totals, month, recent] = await Promise.all([
    db.selectFrom("orders")
      .select((eb) => [
        eb.fn.count<number>("id").as("deliveries"),
        eb.fn.sum<number>("riderPayout").as("earnings"),
        eb.fn.sum<number>("riderBonus").as("bonus"),
      ])
      .where("riderId", "=", riderId)
      .where("status", "=", "delivered")
      .executeTakeFirstOrThrow(),
    db.selectFrom("orders")
      .select((eb) => eb.fn.sum<number>("riderPayout").as("earnings"))
      .where("riderId", "=", riderId)
      .where("status", "=", "delivered")
      .where("deliveredAt", ">=", monthStart)
      .executeTakeFirstOrThrow(),
    db.selectFrom("orders")
      .select(["deliveredAt", "paymentMethod", "total", "riderPayout"])
      .where("riderId", "=", riderId)
      .where("status", "=", "delivered")
      .where("deliveredAt", ">=", dailyStart)
      .execute(),
  ]);

  const daily = Array.from({ length: 14 }, (_, index) => ({
    date: new Date(todayStart + (index - 13) * DAY_MS + IST_OFFSET_MS)
      .toISOString().slice(0, 10),
    deliveries: 0,
    earnings: 0,
    cod: 0,
  }));
  let todayDeliveries = 0;
  let todayEarnings = 0;
  let weekEarnings = 0;
  let cashToDeposit = 0;
  const weekStart = now - 7 * DAY_MS;

  for (const order of recent) {
    if (!order.deliveredAt) continue;
    const deliveredAt = order.deliveredAt.getTime();
    const index = Math.floor((deliveredAt - dailyStart.getTime()) / DAY_MS);
    if (index < 0 || index >= daily.length) continue;
    const day = daily[index];
    day.deliveries++;
    day.earnings += order.riderPayout;
    if (order.paymentMethod === "cod") day.cod += order.total;
    if (deliveredAt >= weekStart) weekEarnings += order.riderPayout;
    if (deliveredAt >= todayStart) {
      todayDeliveries++;
      todayEarnings += order.riderPayout;
      if (order.paymentMethod === "cod") cashToDeposit += order.total;
    }
  }

  return {
    todayDeliveries,
    todayEarnings,
    weekEarnings,
    cashToDeposit,
    totalDeliveries: Number(totals.deliveries),
    totalEarnings: Number(totals.earnings ?? 0),
    monthEarnings: Number(month.earnings ?? 0),
    bonusEarned: Number(totals.bonus ?? 0),
    daily,
  };
}