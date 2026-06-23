import type { SupabaseClient } from "@supabase/supabase-js";

import { defaultSettings, type BillingPeriod, type Settings, type Subscription, type ThemePreference } from "./types";

type SubscriptionRow = {
  id: string;
  user_id: string;
  local_id: string;
  name: string;
  category: string;
  price: number | string;
  currency: string;
  billing_period: BillingPeriod;
  pay_day?: number | null;
  next_renewal_date: string;
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

type SettingsRow = {
  user_id: string;
  theme: ThemePreference;
  reminders_enabled: boolean;
  reminder_days: number;
  currency: string;
  payday_enabled?: boolean | null;
  payday?: number | null;
  updated_at: string;
};

export type SyncStrategy = "merge" | "cloud" | "local";

function toSubscription(row: SubscriptionRow): Subscription {
  return {
    id: row.local_id || row.id,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    currency: row.currency,
    billingPeriod: row.billing_period,
    payDay: row.pay_day ?? undefined,
    nextRenewalDate: row.next_renewal_date,
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

function toSubscriptionRow(userId: string, item: Subscription) {
  return {
    user_id: userId,
    local_id: item.id,
    name: item.name,
    category: item.category,
    price: item.price,
    currency: item.currency,
    billing_period: item.billingPeriod,
    pay_day: item.payDay,
    next_renewal_date: item.nextRenewalDate,
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

function toSettings(row: SettingsRow): Settings {
  return {
    ...defaultSettings,
    theme: defaultSettings.theme,
    remindersEnabled: row.reminders_enabled,
    reminderDays: row.reminder_days,
    currency: row.currency,
    paydayEnabled: row.payday_enabled ?? defaultSettings.paydayEnabled,
    payday: row.payday ?? defaultSettings.payday,
  };
}

function toSettingsRow(userId: string, settings: Settings) {
  return {
    user_id: userId,
    reminders_enabled: settings.remindersEnabled,
    reminder_days: settings.reminderDays,
    currency: settings.currency,
    payday_enabled: settings.paydayEnabled,
    payday: settings.payday,
  };
}

function newerSubscription(a: Subscription, b: Subscription) {
  return new Date(a.updatedAt).getTime() >= new Date(b.updatedAt).getTime() ? a : b;
}

export async function loadCloudAppData(supabase: SupabaseClient | null, userId: string) {
  if (!supabase) return { subscriptions: [], settings: null };
  const [
    { data: cloudSubscriptions, error: subscriptionsError },
    { data: cloudSettings, error: settingsError },
  ] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("user_id", userId),
    supabase.from("settings").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  if (subscriptionsError) throw subscriptionsError;
  if (settingsError) throw settingsError;

  return {
    subscriptions: ((cloudSubscriptions ?? []) as SubscriptionRow[])
      .map(toSubscription)
      .sort((a, b) => a.name.localeCompare(b.name)),
    settings: cloudSettings ? toSettings(cloudSettings as SettingsRow) : null,
  };
}

export async function syncAppData(
  supabase: SupabaseClient | null,
  userId: string,
  localSubscriptions: Subscription[],
  localSettings: Settings,
  strategy: SyncStrategy = "merge",
) {
  if (!supabase) return { subscriptions: localSubscriptions, settings: localSettings };

  const cloud = await loadCloudAppData(supabase, userId);

  if (strategy === "cloud") {
    const settings = { ...(cloud.settings ?? localSettings), theme: localSettings.theme };
    if (!cloud.settings) await upsertSettings(supabase, userId, settings);
    return { subscriptions: cloud.subscriptions, settings };
  }

  if (strategy === "local") {
    const { error } = await supabase.from("subscriptions").delete().eq("user_id", userId);
    if (error) throw error;

    const subscriptions = [...localSubscriptions].sort((a, b) => a.name.localeCompare(b.name));
    await Promise.all([
      upsertSubscriptions(supabase, userId, subscriptions),
      upsertSettings(supabase, userId, localSettings),
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
    upsertSubscriptions(supabase, userId, subscriptions),
    upsertSettings(supabase, userId, settings),
  ]);

  return { subscriptions, settings };
}

export async function upsertSubscriptions(
  supabase: SupabaseClient | null,
  userId: string,
  subscriptions: Subscription[],
) {
  if (!supabase || subscriptions.length === 0) return;
  const { error } = await supabase
    .from("subscriptions")
    .upsert(subscriptions.map((item) => toSubscriptionRow(userId, item)), { onConflict: "user_id,local_id" });
  if (error) throw error;
}

export async function deleteSubscriptionFromCloud(
  supabase: SupabaseClient | null,
  userId: string,
  localId: string,
) {
  if (!supabase) return;
  const { error } = await supabase
    .from("subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("local_id", localId);
  if (error) throw error;
}

export async function upsertSettings(
  supabase: SupabaseClient | null,
  userId: string,
  settings: Settings,
) {
  if (!supabase) return;
  const { error } = await supabase
    .from("settings")
    .upsert(toSettingsRow(userId, settings), { onConflict: "user_id" });
  if (error) throw error;
}
