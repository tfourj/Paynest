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

export function dayDifference(date: string) {
  const target = localDate(date).getTime();
  const today = new Date();
  const todayStart = startOfDate(today).getTime();
  return Math.round((target - todayStart) / 86_400_000);
}

export function renewalLabel(date: string) {
  const days = dayDifference(date);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days > 1 && days < 31) return `in ${days} days`;
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
