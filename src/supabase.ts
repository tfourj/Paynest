import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const defaultSupabaseUrl = "https://xfegnwhtyjqrzlrtvoui.supabase.co";

export type SupabaseProvider = "paynest" | "custom";

export type SupabaseConnectionSettings = {
  provider: SupabaseProvider;
  customUrl: string;
  customAnonKey: string;
};

export type SupabaseResolvedConfig = {
  provider: SupabaseProvider;
  url: string;
  anonKey: string;
  storageKey?: string;
  hasAnonKey: boolean;
  isConfigured: boolean;
};

export const defaultSupabaseConnection: SupabaseConnectionSettings = {
  provider: "paynest",
  customUrl: "",
  customAnonKey: "",
};

const paynestSupabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || defaultSupabaseUrl;
const paynestSupabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";

export function resolveSupabaseConfig(settings: SupabaseConnectionSettings): SupabaseResolvedConfig {
  const provider = settings.provider;
  const url = provider === "custom" ? settings.customUrl.trim() : paynestSupabaseUrl;
  const anonKey = provider === "custom" ? settings.customAnonKey.trim() : paynestSupabaseAnonKey;

  return {
    provider,
    url,
    anonKey,
    storageKey: provider === "custom" ? `paynest.auth.custom.${storageKeySegment(url)}` : undefined,
    hasAnonKey: anonKey.length > 0,
    isConfigured: url.length > 0 && anonKey.length > 0,
  };
}

export function createSupabaseClient(config: SupabaseResolvedConfig): SupabaseClient | null {
  if (!config.isConfigured) return null;

  return createClient(config.url, config.anonKey, {
    auth: {
      ...(config.storageKey ? { storageKey: config.storageKey } : {}),
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}

function storageKeySegment(value: string) {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "default";
}
