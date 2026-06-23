import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const defaultSupabaseUrl = "https://xfegnwhtyjqrzlrtvoui.supabase.co";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() || defaultSupabaseUrl;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";

export const supabaseConfig = {
  url: supabaseUrl,
  hasAnonKey: supabaseAnonKey.length > 0,
  isConfigured: supabaseUrl.length > 0 && supabaseAnonKey.length > 0,
};

export const supabase = supabaseConfig.isConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;
