import { symbols } from "../constants";
import type { Subscription } from "../types";

export const formatMoney = (value: number, currency: string) => `${symbols[currency] ?? currency} ${value.toFixed(2)}`;

export const monthlyCost = (item: Subscription) => item.billingPeriod === "Monthly" ? item.price : item.price / 12;

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
