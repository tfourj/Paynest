import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

import { billingPeriods, type BillingPeriod, type Subscription } from "./types";
import { currencyCodes } from "./constants";

export type SubscriptionExportFormat = "json" | "zip";

export type SubscriptionImportResult = {
  subscriptions: Subscription[];
  importedAt?: string;
};

type SubscriptionExportFile = {
  app: "Paynest";
  schemaVersion: 1;
  exportedAt: string;
  subscriptions: Subscription[];
};

const exportJsonFileName = "subscriptions.json";
const billingPeriodSet = new Set<string>(billingPeriods);

export function subscriptionExportFileName(format: SubscriptionExportFormat, now = new Date()) {
  const date = now.toISOString().slice(0, 10);
  return `paynest-subscriptions-${date}.${format}`;
}

export function subscriptionExportMimeType(format: SubscriptionExportFormat) {
  return format === "zip" ? "application/zip" : "application/json";
}

export function createSubscriptionExportJson(subscriptions: Subscription[], exportedAt = new Date().toISOString()) {
  return JSON.stringify(
    {
      app: "Paynest",
      schemaVersion: 1,
      exportedAt,
      subscriptions,
    } satisfies SubscriptionExportFile,
    null,
    2,
  );
}

export function createSubscriptionExportZip(subscriptions: Subscription[]) {
  return zipSync({
    [exportJsonFileName]: strToU8(createSubscriptionExportJson(subscriptions)),
  });
}

export function parseSubscriptionImportText(text: string): SubscriptionImportResult {
  const parsed = parseJson(text);
  return parseSubscriptionImportData(parsed);
}

export function parseSubscriptionImportZip(data: Uint8Array): SubscriptionImportResult {
  const files = unzipSync(data);
  const jsonEntry = Object.entries(files).find(([name]) => name.toLowerCase().endsWith(".json"));
  if (!jsonEntry) throw new Error("The ZIP file does not contain a JSON subscription export.");

  const [, contents] = jsonEntry;
  return parseSubscriptionImportText(strFromU8(contents));
}

function parseJson(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new Error("The selected file is not valid JSON.");
  }
}

function parseSubscriptionImportData(data: unknown): SubscriptionImportResult {
  const exportedAt = readExportedAt(data);
  const subscriptions = readSubscriptions(data).map(normalizeImportedSubscription);
  const ids = new Set<string>();

  if (subscriptions.length === 0) {
    throw new Error("The selected file does not contain any subscriptions.");
  }

  for (const subscription of subscriptions) {
    if (ids.has(subscription.id)) {
      throw new Error("The selected file contains duplicate subscription IDs.");
    }
    ids.add(subscription.id);
  }

  return { subscriptions, importedAt: exportedAt };
}

function readExportedAt(data: unknown) {
  if (!isRecord(data)) return undefined;
  return typeof data.exportedAt === "string" ? data.exportedAt : undefined;
}

function readSubscriptions(data: unknown) {
  if (Array.isArray(data)) return data;
  if (isRecord(data) && Array.isArray(data.subscriptions)) return data.subscriptions;
  throw new Error("The selected file does not contain Paynest subscriptions.");
}

function normalizeImportedSubscription(data: unknown): Subscription {
  if (!isRecord(data)) throw new Error("One subscription has an invalid format.");

  const id = readRequiredString(data, "id");
  const name = readRequiredString(data, "name");
  const category = readRequiredString(data, "category");
  const price = readRequiredNumber(data, "price");
  const currency = readRequiredString(data, "currency");
  const billingPeriod = readBillingPeriod(data.billingPeriod);
  const nextRenewalDate = readDateString(data.nextRenewalDate, "nextRenewalDate");
  const createdAt = readOptionalDateTime(data.createdAt) ?? new Date().toISOString();
  const updatedAt = readOptionalDateTime(data.updatedAt) ?? createdAt;
  const payDay = readOptionalNumber(data.payDay);

  if (!currencyCodes.includes(currency)) {
    throw new Error(`${name} uses an unsupported currency.`);
  }

  if (payDay !== undefined && (payDay < 1 || payDay > 31)) {
    throw new Error(`${name} has an invalid pay day.`);
  }

  return {
    id,
    name,
    category,
    price,
    currency,
    billingPeriod,
    payDay,
    nextRenewalDate,
    paused: readOptionalBoolean(data.paused) ?? false,
    reminderEnabled: readOptionalBoolean(data.reminderEnabled) ?? false,
    reminderDays: readOptionalNumber(data.reminderDays) ?? 0,
    reminderTime: readOptionalTime(data.reminderTime) ?? "09:00",
    iconName: readOptionalString(data.iconName),
    iconLabel: readOptionalString(data.iconLabel),
    iconColor: readOptionalString(data.iconColor),
    backgroundColor: readOptionalString(data.backgroundColor),
    iconBackgroundColor: readOptionalString(data.iconBackgroundColor),
    simpleIconSlug: readOptionalString(data.simpleIconSlug),
    iconProvider: readOptionalString(data.iconProvider),
    iconUrl: readOptionalString(data.iconUrl),
    iconSourceTitle: readOptionalString(data.iconSourceTitle),
    createdAt,
    updatedAt,
  };
}

function readBillingPeriod(value: unknown): BillingPeriod {
  if (typeof value === "string" && billingPeriodSet.has(value)) return value as BillingPeriod;
  throw new Error("One subscription has an invalid billing period.");
}

function readRequiredString(data: Record<string, unknown>, key: string) {
  const value = data[key];
  if (typeof value === "string" && value.trim()) return value;
  throw new Error(`One subscription is missing ${key}.`);
}

function readRequiredNumber(data: Record<string, unknown>, key: string) {
  const value = data[key];
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  throw new Error(`One subscription has an invalid ${key}.`);
}

function readOptionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readOptionalBoolean(value: unknown) {
  return typeof value === "boolean" ? value : undefined;
}

function readDateString(value: unknown, key: string) {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  throw new Error(`One subscription has an invalid ${key}.`);
}

function readOptionalDateTime(value: unknown) {
  if (typeof value !== "string") return undefined;
  return Number.isNaN(Date.parse(value)) ? undefined : value;
}

function readOptionalTime(value: unknown) {
  if (typeof value !== "string") return undefined;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
