import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const keyPrefix = "paynest.cloudEncryptionPassword.v1";

export async function loadSavedEncryptionPassword(serverUrl: string, userId: string) {
  if (Platform.OS === "web") return AsyncStorage.getItem(storageKey(serverUrl, userId));
  if (!await canUseSecureStore()) return null;
  return SecureStore.getItemAsync(storageKey(serverUrl, userId));
}

export async function saveEncryptionPassword(serverUrl: string, userId: string, password: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(storageKey(serverUrl, userId), password);
    return true;
  }
  if (!await canUseSecureStore()) return false;
  await SecureStore.setItemAsync(storageKey(serverUrl, userId), password);
  return true;
}

export async function forgetEncryptionPassword(serverUrl: string, userId: string) {
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(storageKey(serverUrl, userId));
    return;
  }
  if (!await canUseSecureStore()) return;
  await SecureStore.deleteItemAsync(storageKey(serverUrl, userId));
}

async function canUseSecureStore() {
  if (Platform.OS === "web") return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

function storageKey(serverUrl: string, userId: string) {
  const segment = `${serverUrl}:${userId}`
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  return `${keyPrefix}.${segment || "default"}`;
}
