import { symbols } from "../constants";
import type { BillingPeriod, Subscription } from "../types";

const suffixSymbolCurrencies = new Set([
  "BGN",
  "CZK",
  "DKK",
  "EUR",
  "HRK",
  "HUF",
  "ISK",
  "NOK",
  "PLN",
  "RON",
  "RUB",
  "SEK",
]);

export const formatMoney = (value: number, currency: string) => {
  const formattedValue = value.toFixed(2);
  const symbol = symbols[currency] ?? currency;
  if (suffixSymbolCurrencies.has(currency)) return `${formattedValue} ${symbol}`;
  return `${symbol} ${formattedValue}`;
};

export type CurrencyTotal = {
  currency: string;
  amount: number;
};

const monthlyCostMultipliers: Record<BillingPeriod, number> = {
  Weekly: 52 / 12,
  Monthly: 1,
  "3 months": 1 / 3,
  "6 months": 1 / 6,
  Yearly: 1 / 12,
};

export const monthlyCost = (item: Subscription) => item.price * monthlyCostMultipliers[item.billingPeriod];

export const isSubscriptionPaused = (item: Subscription) => item.paused;

export const billableSubscriptions = (subscriptions: Subscription[]) => (
  subscriptions.filter((item) => !isSubscriptionPaused(item))
);

export const pausedSubscriptions = (subscriptions: Subscription[]) => (
  subscriptions.filter(isSubscriptionPaused)
);

export const monthlyTotal = (subscriptions: Subscription[]) => (
  subscriptions.reduce((total, item) => total + monthlyCost(item), 0)
);

export const pausedMonthlySavings = (subscriptions: Subscription[]) => (
  monthlyTotal(pausedSubscriptions(subscriptions))
);

export function totalsByCurrency(
  subscriptions: Subscription[],
  amountForItem: (item: Subscription) => number = monthlyCost,
) {
  const totals = subscriptions.reduce<Map<string, number>>((map, item) => {
    map.set(item.currency, (map.get(item.currency) ?? 0) + amountForItem(item));
    return map;
  }, new Map());

  return Array.from(totals, ([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

function startOfDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function localDate(date: string) {
  return new Date(`${date}T00:00:00`);
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function monthlyDate(year: number, month: number, day: number) {
  return new Date(year, month, Math.min(day, daysInMonth(year, month)));
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthDifference(start: Date, end: Date) {
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth();
}

function billingPeriodMonthInterval(billingPeriod: Exclude<BillingPeriod, "Weekly">) {
  if (billingPeriod === "3 months") return 3;
  if (billingPeriod === "6 months") return 6;
  if (billingPeriod === "Yearly") return 12;
  return 1;
}

export function dayDifference(date: string) {
  const target = localDate(date).getTime();
  const today = new Date();
  const todayStart = startOfDate(today).getTime();
  return Math.round((target - todayStart) / 86_400_000);
}

export function nextRenewalDate(item: Subscription, from = new Date()) {
  const anchor = localDate(item.nextRenewalDate);
  const today = startOfDate(from);
  if (anchor.getTime() >= today.getTime()) return item.nextRenewalDate;

  if (item.billingPeriod === "Weekly") {
    const daysSinceAnchor = Math.ceil((today.getTime() - anchor.getTime()) / 86_400_000);
    const weeksSinceAnchor = Math.ceil(daysSinceAnchor / 7);
    return formatDateKey(addDays(anchor, weeksSinceAnchor * 7));
  }

  const monthInterval = billingPeriodMonthInterval(item.billingPeriod);
  const monthsSinceAnchor = monthDifference(anchor, today);
  const intervalsSinceAnchor = Math.max(0, Math.ceil(monthsSinceAnchor / monthInterval));
  let renewal = monthlyDate(
    anchor.getFullYear(),
    anchor.getMonth() + intervalsSinceAnchor * monthInterval,
    anchor.getDate(),
  );

  if (renewal.getTime() < today.getTime()) {
    renewal = monthlyDate(renewal.getFullYear(), renewal.getMonth() + monthInterval, anchor.getDate());
  }

  return formatDateKey(renewal);
}

export function renewalLabel(date: string) {
  const days = dayDifference(date);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === 2) return "in 2 days";
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function nextMonthStart(from = new Date()) {
  return new Date(from.getFullYear(), from.getMonth() + 1, 1);
}

export function nextMonthlyPayday(day: number, from = new Date()) {
  const today = startOfDate(from);
  const safeDay = Math.max(1, Math.min(day, 31));
  const thisMonth = monthlyDate(today.getFullYear(), today.getMonth(), safeDay);
  if (thisMonth.getTime() > today.getTime()) return thisMonth;
  return monthlyDate(today.getFullYear(), today.getMonth() + 1, safeDay);
}

export function spendUntil(subscriptions: Subscription[], boundary: Date, includeBoundary: boolean) {
  const today = startOfDate(new Date()).getTime();
  const boundaryTime = startOfDate(boundary).getTime();

  return subscriptions.reduce((total, item) => {
    const renewal = localDate(item.nextRenewalDate).getTime();
    const beforeBoundary = includeBoundary ? renewal <= boundaryTime : renewal < boundaryTime;
    return renewal >= today && beforeBoundary ? total + item.price : total;
  }, 0);
}
