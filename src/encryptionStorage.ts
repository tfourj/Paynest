import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";

const passwordKeyPrefix = "paynest.cloudEncryptionPassword.v1";
const masterKeyPrefix = "paynest.cloudMasterKey.v1";

export function loadSavedEncryptionPassword(serverUrl: string, userId: string) {
  return loadSecret(passwordKeyPrefix, serverUrl, userId);
}

export function saveEncryptionPassword(serverUrl: string, userId: string, password: string) {
  return saveSecret(passwordKeyPrefix, serverUrl, userId, password);
}

export function forgetEncryptionPassword(serverUrl: string, userId: string) {
  return forgetSecret(passwordKeyPrefix, serverUrl, userId);
}

export function loadSavedMasterKey(serverUrl: string, userId: string) {
  return loadSecret(masterKeyPrefix, serverUrl, userId);
}

export function saveMasterKey(serverUrl: string, userId: string, masterKeyHex: string) {
  return saveSecret(masterKeyPrefix, serverUrl, userId, masterKeyHex);
}

export function forgetMasterKey(serverUrl: string, userId: string) {
  return forgetSecret(masterKeyPrefix, serverUrl, userId);
}

async function loadSecret(prefix: string, serverUrl: string, userId: string) {
  const key = storageKey(prefix, serverUrl, userId);
  if (Platform.OS === "web") return AsyncStorage.getItem(key);
  if (!await canUseSecureStore()) return null;
  return SecureStore.getItemAsync(key);
}

async function saveSecret(prefix: string, serverUrl: string, userId: string, value: string) {
  const key = storageKey(prefix, serverUrl, userId);
  if (Platform.OS === "web") {
    await AsyncStorage.setItem(key, value);
    return true;
  }
  if (!await canUseSecureStore()) return false;
  await SecureStore.setItemAsync(key, value);
  return true;
}

async function forgetSecret(prefix: string, serverUrl: string, userId: string) {
  const key = storageKey(prefix, serverUrl, userId);
  if (Platform.OS === "web") {
    await AsyncStorage.removeItem(key);
    return;
  }
  if (!await canUseSecureStore()) return;
  await SecureStore.deleteItemAsync(key);
}

async function canUseSecureStore() {
  if (Platform.OS === "web") return false;
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}

function storageKey(prefix: string, serverUrl: string, userId: string) {
  const segment = `${serverUrl}:${userId}`
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
  return `${prefix}.${segment || "default"}`;
}
