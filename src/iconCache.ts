import AsyncStorage from "@react-native-async-storage/async-storage";

const iconCachePrefix = "paynest.icon-cache.v1:";
const iconCacheIndexKey = "paynest.icon-cache-index.v1";
const memoryIconCache = new Map<string, string>();
const pendingIconRequests = new Map<string, Promise<string | undefined>>();

function cacheKey(url: string) {
  return `${iconCachePrefix}${encodeURIComponent(url)}`;
}

function isSvgXml(value: string) {
  return value.trimStart().startsWith("<svg");
}

function readCacheKeys(rawKeys: string | null) {
  if (!rawKeys) return [];

  try {
    const keys = JSON.parse(rawKeys) as unknown;
    return Array.isArray(keys) ? keys.filter((key): key is string => typeof key === "string") : [];
  } catch {
    return [];
  }
}

async function addCacheKey(key: string) {
  const rawKeys = await AsyncStorage.getItem(iconCacheIndexKey);
  const keys = readCacheKeys(rawKeys);
  if (keys.includes(key)) return;

  await AsyncStorage.setItem(iconCacheIndexKey, JSON.stringify([...keys, key]));
}

export async function loadCachedIconXml(url: string) {
  const key = cacheKey(url);
  const memoryCached = memoryIconCache.get(key);
  if (memoryCached) return memoryCached;

  const pendingRequest = pendingIconRequests.get(key);
  if (pendingRequest) return pendingRequest;

  const request = loadIconXml(key, url);
  pendingIconRequests.set(key, request);

  try {
    return await request;
  } finally {
    pendingIconRequests.delete(key);
  }
}

async function loadIconXml(key: string, url: string) {
  const cached = await AsyncStorage.getItem(key);
  if (cached) {
    memoryIconCache.set(key, cached);
    return cached;
  }

  const response = await fetch(url);
  if (!response.ok) return undefined;

  const xml = await response.text();
  if (!isSvgXml(xml)) return undefined;

  await AsyncStorage.setItem(key, xml);
  await addCacheKey(key);
  memoryIconCache.set(key, xml);
  return xml;
}

export async function clearIconCache() {
  const rawKeys = await AsyncStorage.getItem(iconCacheIndexKey);
  const keys = readCacheKeys(rawKeys);
  memoryIconCache.clear();
  pendingIconRequests.clear();
  await AsyncStorage.multiRemove([...keys, iconCacheIndexKey]);
}
