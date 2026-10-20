// The next Friday at midnight in Asia/Kolkata, returned as a UTC Date.
export function nextPayoutFriday(now: Date): Date {
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istClock = new Date(now.getTime() + istOffsetMs);
  const daysUntilFriday = (5 - istClock.getUTCDay() + 7) % 7 || 7;
  istClock.setUTCHours(0, 0, 0, 0);
  istClock.setUTCDate(istClock.getUTCDate() + daysUntilFriday);
  return new Date(istClock.getTime() - istOffsetMs);
}