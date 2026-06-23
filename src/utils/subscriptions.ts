import { symbols } from "../constants";
import type { BillingPeriod, Subscription } from "../types";

export const formatMoney = (value: number, currency: string) => `${symbols[currency] ?? currency} ${value.toFixed(2)}`;

const monthlyCostMultipliers: Record<BillingPeriod, number> = {
  Weekly: 52 / 12,
  Monthly: 1,
  "3 months": 1 / 3,
  "6 months": 1 / 6,
  Yearly: 1 / 12,
};

export const monthlyCost = (item: Subscription) => item.price * monthlyCostMultipliers[item.billingPeriod];

export function dayDifference(date: string) {
  const target = new Date(`${date}T00:00:00`).getTime();
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((target - todayStart) / 86_400_000);
}

export function renewalLabel(date: string) {
  const days = dayDifference(date);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days > 1 && days < 31) return `in ${days} days`;
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
