import type { PocketBaseClient } from "./pocketbase";
import { defaultSettings, type BillingPeriod, type Settings, type Subscription, type ThemePreference } from "./types";

type SubscriptionRecord = {
  id: string;
  user: string;
  local_id: string;
  name: string;
  category: string;
  price: number | string;
  currency: string;
  billing_period: BillingPeriod;
  pay_day?: number | null;
  next_renewal_date: string;
  paused?: boolean | null;
  reminder_enabled?: boolean | null;
  reminder_days?: number | null;
  reminder_time?: string | null;
  icon_name?: string | null;
  icon_label?: string | null;
  icon_color?: string | null;
  background_color?: string | null;
  icon_background_color?: string | null;
  simple_icon_slug?: string | null;
  icon_provider?: string | null;
  icon_url?: string | null;
  icon_source_title?: string | null;
  created_at: string;
  updated_at: string;
};

type SettingsRecord = {
  id: string;
  user: string;
  theme?: ThemePreference | null;
  reminders_enabled: boolean;
  reminder_days: number;
  currency: string;
  payday_enabled?: boolean | null;
  payday?: number | null;
  color_presets?: string | null;
  updated_at: string;
};

export type SyncStrategy = "merge" | "cloud" | "local";
export type CloudAppData = Awaited<ReturnType<typeof loadCloudAppData>>;

function toSubscription(row: SubscriptionRecord): Subscription {
  return {
    id: row.local_id || row.id,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    currency: row.currency,
    billingPeriod: row.billing_period,
    payDay: row.pay_day ?? undefined,
    nextRenewalDate: dateOnly(row.next_renewal_date),
    paused: row.paused ?? false,
    reminderEnabled: row.reminder_enabled ?? false,
    reminderDays: row.reminder_days ?? 0,
    reminderTime: row.reminder_time ?? "09:00",
    iconName: row.icon_name ?? undefined,
    iconLabel: row.icon_label ?? undefined,
    iconColor: row.icon_color ?? undefined,
    backgroundColor: row.background_color ?? undefined,
    iconBackgroundColor: row.icon_background_color ?? undefined,
    simpleIconSlug: row.simple_icon_slug ?? undefined,
    iconProvider: row.icon_provider ?? undefined,
    iconUrl: row.icon_url ?? undefined,
    iconSourceTitle: row.icon_source_title ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSubscriptionRecord(userId: string, item: Subscription) {
  return {
    user: userId,
    local_id: item.id,
    name: item.name,
    category: item.category,
    price: item.price,
    currency: item.currency,
    billing_period: item.billingPeriod,
    pay_day: item.payDay,
    next_renewal_date: item.nextRenewalDate,
    paused: item.paused,
    reminder_enabled: item.reminderEnabled,
    reminder_days: item.reminderDays,
    reminder_time: item.reminderTime,
    icon_name: item.iconName,
    icon_label: item.iconLabel,
    icon_color: item.iconColor,
    background_color: item.backgroundColor,
    icon_background_color: item.iconBackgroundColor,
    simple_icon_slug: item.simpleIconSlug,
    icon_provider: item.iconProvider,
    icon_url: item.iconUrl,
    icon_source_title: item.iconSourceTitle,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

function toSettings(row: SettingsRecord): Settings {
  return {
    ...defaultSettings,
    theme: defaultSettings.theme,
    remindersEnabled: row.reminders_enabled,
    reminderDays: row.reminder_days,
    currency: row.currency,
    paydayEnabled: row.payday_enabled ?? defaultSettings.paydayEnabled,
    payday: row.payday ?? defaultSettings.payday,
    colorPresets: parseColorPresets(row.color_presets),
  };
}

function toSettingsRecord(userId: string, settings: Settings) {
  return {
    user: userId,
    reminders_enabled: settings.remindersEnabled,
    reminder_days: settings.reminderDays,
    currency: settings.currency,
    payday_enabled: settings.paydayEnabled,
    payday: settings.payday,
    color_presets: JSON.stringify(settings.colorPresets),
    updated_at: new Date().toISOString(),
  };
}

function newerSubscription(a: Subscription, b: Subscription) {
  return new Date(a.updatedAt).getTime() >= new Date(b.updatedAt).getTime() ? a : b;
}

export async function loadCloudAppData(client: PocketBaseClient | null, token: string, userId: string) {
  if (!client) return { subscriptions: [], settings: null };
  const [cloudSubscriptions, cloudSettings] = await Promise.all([
    listUserSubscriptions(client, token, userId),
    listUserSettings(client, token, userId),
  ]);

  return {
    subscriptions: cloudSubscriptions
      .map(toSubscription)
      .sort((a, b) => a.name.localeCompare(b.name)),
    settings: cloudSettings[0] ? toSettings(cloudSettings[0]) : null,
  };
}

export async function syncAppData(
  client: PocketBaseClient | null,
  token: string,
  userId: string,
  localSubscriptions: Subscription[],
  localSettings: Settings,
  strategy: SyncStrategy = "merge",
  initialCloud?: CloudAppData,
) {
  if (!client) return { subscriptions: localSubscriptions, settings: localSettings };

  const cloud = initialCloud ?? await loadCloudAppData(client, token, userId);

  if (strategy === "cloud") {
    const settings = { ...(cloud.settings ?? localSettings), theme: localSettings.theme };
    if (!cloud.settings) await upsertSettings(client, token, userId, settings);
    return { subscriptions: cloud.subscriptions, settings };
  }

  if (strategy === "local") {
    await deleteUserSubscriptions(client, token, userId);

    const subscriptions = [...localSubscriptions].sort((a, b) => a.name.localeCompare(b.name));
    await Promise.all([
      upsertSubscriptions(client, token, userId, subscriptions),
      upsertSettings(client, token, userId, localSettings),
    ]);
    return { subscriptions, settings: localSettings };
  }

  const merged = new Map<string, Subscription>();
  for (const item of localSubscriptions) merged.set(item.id, item);
  for (const cloudItem of cloud.subscriptions) {
    const localItem = merged.get(cloudItem.id);
    merged.set(cloudItem.id, localItem ? newerSubscription(localItem, cloudItem) : cloudItem);
  }

  const subscriptions = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
  const settings = { ...(cloud.settings ?? localSettings), theme: localSettings.theme };

  await Promise.all([
    upsertSubscriptions(client, token, userId, subscriptions),
    upsertSettings(client, token, userId, settings),
  ]);

  return { subscriptions, settings };
}

export async function upsertSubscriptions(
  client: PocketBaseClient | null,
  token: string,
  userId: string,
  subscriptions: Subscription[],
) {
  if (!client || subscriptions.length === 0) return;

  const existingRecords = await listUserSubscriptions(client, token, userId);
  const recordsByLocalId = new Map(existingRecords.map((record) => [record.local_id, record]));

  await Promise.all(subscriptions.map((item) => {
    const existing = recordsByLocalId.get(item.id);
    const body = toSubscriptionRecord(userId, item);
    return existing
      ? client.updateRecord("subscriptions", existing.id, token, body)
      : client.createRecord("subscriptions", token, body);
  }));
}

export async function deleteSubscriptionFromCloud(
  client: PocketBaseClient | null,
  token: string,
  userId: string,
  localId: string,
) {
  if (!client) return;

  const records = await listUserSubscriptions(client, token, userId, localId);
  await Promise.all(records.map((record) => client.deleteRecord("subscriptions", record.id, token)));
}

export async function upsertSettings(
  client: PocketBaseClient | null,
  token: string,
  userId: string,
  settings: Settings,
) {
  if (!client) return;

  const existing = await listUserSettings(client, token, userId);
  const body = toSettingsRecord(userId, settings);
  if (existing[0]) {
    await client.updateRecord("settings", existing[0].id, token, body);
    return;
  }

  await client.createRecord("settings", token, body);
}

async function listUserSubscriptions(
  client: PocketBaseClient,
  token: string,
  userId: string,
  localId?: string,
) {
  const localIdFilter = localId ? ` && local_id="${escapeFilterValue(localId)}"` : "";
  return client.listRecords<SubscriptionRecord>("subscriptions", token, {
    filter: `user="${escapeFilterValue(userId)}"${localIdFilter}`,
    perPage: 500,
    sort: "name",
  });
}

function listUserSettings(client: PocketBaseClient, token: string, userId: string) {
  return client.listRecords<SettingsRecord>("settings", token, {
    filter: `user="${escapeFilterValue(userId)}"`,
    perPage: 1,
  });
}

async function deleteUserSubscriptions(client: PocketBaseClient, token: string, userId: string) {
  const records = await listUserSubscriptions(client, token, userId);
  await Promise.all(records.map((record) => client.deleteRecord("subscriptions", record.id, token)));
}

function escapeFilterValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function dateOnly(value: string) {
  return value.slice(0, 10);
}

function parseColorPresets(value?: string | null) {
  if (!value) return defaultSettings.colorPresets;

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return defaultSettings.colorPresets;
    const colors = parsed.filter((color) => typeof color === "string" && /^#[0-9A-F]{6}$/i.test(color));
    return colors.length > 0 ? colors : defaultSettings.colorPresets;
  } catch {
    return defaultSettings.colorPresets;
  }
}
