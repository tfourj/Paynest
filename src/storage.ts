import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  defaultPocketBaseConnection,
  type PocketBaseConnectionSettings,
} from "./pocketbase";
import { defaultSettings, type Settings, type Subscription } from "./types";

const subscriptionsKey = "paynest.subscriptions.v1";
const settingsKey = "paynest.settings.v1";
const pocketBaseConnectionKey = "paynest.pocketBaseConnection.v1";

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

  const settings = { ...defaultSettings, ...readJson(storedSettings, {}) };

  return {
    subscriptions: readJson<Subscription[]>(storedSubscriptions, []).map(normalizeSubscription),
    settings: { ...settings, theme: settings.theme === "system" ? "light" : settings.theme },
  };
}

export async function loadPocketBaseConnection(): Promise<PocketBaseConnectionSettings> {
  const storedConnection = await AsyncStorage.getItem(pocketBaseConnectionKey);
  return normalizePocketBaseConnection(
    readJson<PocketBaseConnectionSettings>(storedConnection, defaultPocketBaseConnection),
  );
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

export function clearAppData() {
  return AsyncStorage.multiRemove([subscriptionsKey, settingsKey]);
}

function normalizeSubscription(item: Subscription): Subscription {
  return {
    ...item,
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
