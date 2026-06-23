import AsyncStorage from "@react-native-async-storage/async-storage";

const iconCachePrefix = "paynest.icon-cache.v1:";
const iconCacheIndexKey = "paynest.icon-cache-index.v1";

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
  const cached = await AsyncStorage.getItem(key);
  if (cached) return cached;

  const response = await fetch(url);
  if (!response.ok) return undefined;

  const xml = await response.text();
  if (!isSvgXml(xml)) return undefined;

  await AsyncStorage.setItem(key, xml);
  await addCacheKey(key);
  return xml;
}

export async function clearIconCache() {
  const rawKeys = await AsyncStorage.getItem(iconCacheIndexKey);
  const keys = readCacheKeys(rawKeys);
  await AsyncStorage.multiRemove([...keys, iconCacheIndexKey]);
}
