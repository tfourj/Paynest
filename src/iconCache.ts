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

function isCompatibleSvgXml(value: string) {
  return !/<style[\s>]/i.test(value) && !/\sclass=/i.test(value) && !/\sstyle=/i.test(value);
}

function rgbaFromLongHexColor(hex: string) {
  const color = hex.slice(0, 8);
  const red = Number.parseInt(color.slice(0, 2), 16);
  const green = Number.parseInt(color.slice(2, 4), 16);
  const blue = Number.parseInt(color.slice(4, 6), 16);
  const alpha = Number.parseInt(color.slice(6, 8), 16) / 255;

  return `rgba(${red}, ${green}, ${blue}, ${alpha.toFixed(3)})`;
}

function sanitizeSvgXml(xml: string) {
  return xml.replace(/#([0-9a-fA-F]{8,})(?![0-9a-fA-F])/g, (_match, hex: string) => {
    return rgbaFromLongHexColor(hex);
  });
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
    const sanitized = sanitizeSvgXml(cached);
    if (!isSvgXml(sanitized) || !isCompatibleSvgXml(sanitized)) {
      memoryIconCache.delete(key);
      await AsyncStorage.removeItem(key);
      return undefined;
    }

    memoryIconCache.set(key, sanitized);
    if (sanitized !== cached) {
      await AsyncStorage.setItem(key, sanitized);
    }

    return sanitized;
  }

  const response = await fetch(url);
  if (!response.ok) return undefined;

  const xml = sanitizeSvgXml(await response.text());
  if (!isSvgXml(xml) || !isCompatibleSvgXml(xml)) return undefined;

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
