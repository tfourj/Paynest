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
    hasAnonKey: anonKey.length > 0,
    isConfigured: url.length > 0 && anonKey.length > 0,
  };
}

export function createSupabaseClient(config: SupabaseResolvedConfig): SupabaseClient | null {
  if (!config.isConfigured) return null;

  return createClient(config.url, config.anonKey, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
}
