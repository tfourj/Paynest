import AsyncStorage from "@react-native-async-storage/async-storage";

import { defaultSettings, type Settings, type Subscription } from "./types";

const subscriptionsKey = "paynest.subscriptions.v1";
const settingsKey = "paynest.settings.v1";

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

  return {
    subscriptions: readJson(storedSubscriptions, []),
    settings: { ...defaultSettings, ...readJson(storedSettings, {}) },
  };
}

export function saveSubscriptions(subscriptions: Subscription[]) {
  return AsyncStorage.setItem(subscriptionsKey, JSON.stringify(subscriptions));
}

export function saveSettings(settings: Settings) {
  return AsyncStorage.setItem(settingsKey, JSON.stringify(settings));
}

export function clearAppData() {
  return AsyncStorage.multiRemove([subscriptionsKey, settingsKey]);
}
