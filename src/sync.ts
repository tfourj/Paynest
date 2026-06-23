import { supabase } from "./supabase";
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
  icon_name?: string | null;
  icon_label?: string | null;
  icon_color?: string | null;
  background_color?: string | null;
  simple_icon_slug?: string | null;
  created_at: string;
  updated_at: string;
};

type SettingsRow = {
  user_id: string;
  theme: ThemePreference;
  reminders_enabled: boolean;
  reminder_days: number;
  currency: string;
  updated_at: string;
};

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
    iconName: row.icon_name ?? undefined,
    iconLabel: row.icon_label ?? undefined,
    iconColor: row.icon_color ?? undefined,
    backgroundColor: row.background_color ?? undefined,
    simpleIconSlug: row.simple_icon_slug ?? undefined,
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
    icon_name: item.iconName,
    icon_label: item.iconLabel,
    icon_color: item.iconColor,
    background_color: item.backgroundColor,
    simple_icon_slug: item.simpleIconSlug,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

function toSettings(row: SettingsRow): Settings {
  return {
    ...defaultSettings,
    theme: row.theme,
    remindersEnabled: row.reminders_enabled,
    reminderDays: row.reminder_days,
    currency: row.currency,
  };
}

function toSettingsRow(userId: string, settings: Settings) {
  return {
    user_id: userId,
    theme: settings.theme,
    reminders_enabled: settings.remindersEnabled,
    reminder_days: settings.reminderDays,
    currency: settings.currency,
  };
}

function newerSubscription(a: Subscription, b: Subscription) {
  return new Date(a.updatedAt).getTime() >= new Date(b.updatedAt).getTime() ? a : b;
}

export async function syncAppData(userId: string, localSubscriptions: Subscription[], localSettings: Settings) {
  if (!supabase) return { subscriptions: localSubscriptions, settings: localSettings };

  const [
    { data: cloudSubscriptions, error: subscriptionsError },
    { data: cloudSettings, error: settingsError },
  ] = await Promise.all([
    supabase.from("subscriptions").select("*").eq("user_id", userId),
    supabase.from("settings").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  if (subscriptionsError) throw subscriptionsError;
  if (settingsError) throw settingsError;

  const merged = new Map<string, Subscription>();
  for (const item of localSubscriptions) merged.set(item.id, item);
  for (const row of (cloudSubscriptions ?? []) as SubscriptionRow[]) {
    const cloudItem = toSubscription(row);
    const localItem = merged.get(cloudItem.id);
    merged.set(cloudItem.id, localItem ? newerSubscription(localItem, cloudItem) : cloudItem);
  }

  const subscriptions = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
  const settings = cloudSettings ? toSettings(cloudSettings as SettingsRow) : localSettings;

  await Promise.all([
    upsertSubscriptions(userId, subscriptions),
    upsertSettings(userId, settings),
  ]);

  return { subscriptions, settings };
}

export async function upsertSubscriptions(userId: string, subscriptions: Subscription[]) {
  if (!supabase || subscriptions.length === 0) return;
  const { error } = await supabase
    .from("subscriptions")
    .upsert(subscriptions.map((item) => toSubscriptionRow(userId, item)), { onConflict: "user_id,local_id" });
  if (error) throw error;
}

export async function deleteSubscriptionFromCloud(userId: string, localId: string) {
  if (!supabase) return;
  const { error } = await supabase
    .from("subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("local_id", localId);
  if (error) throw error;
}

export async function upsertSettings(userId: string, settings: Settings) {
  if (!supabase) return;
  const { error } = await supabase
    .from("settings")
    .upsert(toSettingsRow(userId, settings), { onConflict: "user_id" });
  if (error) throw error;
}
