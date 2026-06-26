import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  defaultPocketBaseConnection,
  type PocketBaseConnectionSettings,
} from "./pocketbase";
import { currencyCodes } from "./constants";
import {
  defaultColorPresets,
  defaultSettings,
  type Settings,
  type Subscription,
} from "./types";

const subscriptionsKey = "paynest.subscriptions.v1";
const settingsKey = "paynest.settings.v1";
const pocketBaseConnectionKey = "paynest.pocketBaseConnection.v1";
const localModeKey = "paynest.localMode.v1";

function readJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function loadAppData(): Promise<{ subscriptions: Subscription[]; settings: Settings }> {
  const [storedSubscriptions, storedSettings] = await Promise.all([
    AsyncStorage.getItem(subscriptionsKey),
    AsyncStorage.getItem(settingsKey),
  ]);

  const settings = normalizeSettings(readJson<Partial<Settings>>(storedSettings, {}));

  return {
    subscriptions: readJson<Subscription[]>(storedSubscriptions, []).map(normalizeSubscription),
    settings,
  };
}

export async function loadPocketBaseConnection(): Promise<PocketBaseConnectionSettings> {
  const storedConnection = await AsyncStorage.getItem(pocketBaseConnectionKey);
  return normalizePocketBaseConnection(
    readJson<PocketBaseConnectionSettings>(storedConnection, defaultPocketBaseConnection),
  );
}

export async function loadLocalModePreference() {
  return AsyncStorage.getItem(localModeKey).then((value) => value === "true");
}

export function saveSubscriptions(subscriptions: Subscription[]) {
  return AsyncStorage.setItem(subscriptionsKey, JSON.stringify(subscriptions));
}

export function saveSettings(settings: Settings) {
  return AsyncStorage.setItem(settingsKey, JSON.stringify(settings));
}

export function savePocketBaseConnection(settings: PocketBaseConnectionSettings) {
  return AsyncStorage.setItem(pocketBaseConnectionKey, JSON.stringify(normalizePocketBaseConnection(settings)));
}

export function saveLocalModePreference(enabled: boolean) {
  return AsyncStorage.setItem(localModeKey, enabled ? "true" : "false");
}

export function clearAppData() {
  return AsyncStorage.multiRemove([subscriptionsKey, settingsKey]);
}

function normalizeSettings(settings: Partial<Settings>): Settings {
  const merged = { ...defaultSettings, ...settings };
  const currency = currencyCodes.includes(merged.currency) ? merged.currency : defaultSettings.currency;
  const enabledCurrencies = normalizeEnabledCurrencies(merged.enabledCurrencies, currency);

  return {
    ...merged,
    currency,
    enabledCurrencies,
    theme: merged.theme === "system" ? "light" : merged.theme,
    reminderTime: normalizeReminderTime(merged.reminderTime),
    convertToPrimaryCurrency: merged.convertToPrimaryCurrency ?? defaultSettings.convertToPrimaryCurrency,
    showOriginalCurrency: merged.showOriginalCurrency ?? defaultSettings.showOriginalCurrency,
    colorPresets: normalizeColorPresets(merged.colorPresets),
  };
}

function normalizeReminderTime(value?: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value ?? "") ? value as string : defaultSettings.reminderTime;
}

function normalizeEnabledCurrencies(currencies: string[] | undefined, displayCurrency: string) {
  const normalized = Array.isArray(currencies)
    ? currencies.filter((currency) => currencyCodes.includes(currency))
    : [];
  const unique = Array.from(new Set([displayCurrency, ...normalized]));
  return unique.length > 0 ? unique : defaultSettings.enabledCurrencies;
}

function normalizeColorPresets(colors?: string[]) {
  if (!Array.isArray(colors)) return defaultColorPresets;

  const normalized = colors.filter((color) => /^#[0-9A-F]{6}$/i.test(color));
  return normalized.length > 0 ? normalized : defaultColorPresets;
}

function normalizeSubscription(item: Subscription): Subscription {
  return {
    ...item,
    paused: item.paused ?? false,
    reminderEnabled: item.reminderEnabled ?? false,
    reminderDays: item.reminderDays ?? 0,
    reminderTime: item.reminderTime ?? "09:00",
  };
}

function normalizePocketBaseConnection(settings: PocketBaseConnectionSettings): PocketBaseConnectionSettings {
  return {
    url: settings.url ?? "",
  };
}
