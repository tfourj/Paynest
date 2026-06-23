import AsyncStorage from "@react-native-async-storage/async-storage";

const iconCachePrefix = "paynest.icon-cache.v2:";
const iconCacheIndexKey = "paynest.icon-cache-index.v2";
const legacyIconCacheIndexKeys = ["paynest.icon-cache-index.v1"];
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

function attributeName(property: string) {
  return property.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function parseStyleDeclarations(value: string) {
  return value.split(";").reduce<Record<string, string>>((styles, declaration) => {
    const [rawProperty, ...rawValue] = declaration.split(":");
    const property = rawProperty?.trim();
    const styleValue = rawValue.join(":").trim();

    if (!property || !styleValue) return styles;
    return {
      ...styles,
      [attributeName(property)]: styleValue,
    };
  }, {});
}

function parseClassStyles(xml: string) {
  const classStyles = new Map<string, Record<string, string>>();
  const styleBlocks = xml.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi);

  Array.from(styleBlocks).forEach((styleBlock) => {
    const css = stripMediaBlocks(styleBlock[1] ?? "");
    const classRules = css.matchAll(/\.([_a-zA-Z][\w-]*)\s*\{([^}]*)\}/g);

    Array.from(classRules).forEach((classRule) => {
      const className = classRule[1];
      const declarations = parseStyleDeclarations(classRule[2] ?? "");
      classStyles.set(className, {
        ...(classStyles.get(className) ?? {}),
        ...declarations,
      });
    });
  });

  return classStyles;
}

function stripMediaBlocks(css: string) {
  let output = "";
  let index = 0;

  while (index < css.length) {
    const mediaIndex = css.indexOf("@media", index);
    if (mediaIndex === -1) {
      output += css.slice(index);
      break;
    }

    output += css.slice(index, mediaIndex);
    const blockStart = css.indexOf("{", mediaIndex);
    if (blockStart === -1) break;

    let depth = 1;
    let cursor = blockStart + 1;
    while (cursor < css.length && depth > 0) {
      if (css[cursor] === "{") depth += 1;
      if (css[cursor] === "}") depth -= 1;
      cursor += 1;
    }

    index = cursor;
  }

  return output;
}

function inlineStyleAttributes(xml: string) {
  return xml.replace(/\sstyle=(["'])(.*?)\1/gis, (_match, quote: string, styleValue: string) => {
    const declarations = parseStyleDeclarations(styleValue);
    const attributes = Object.entries(declarations)
      .map(([property, value]) => ` ${property}=${quote}${value}${quote}`)
      .join("");

    return attributes;
  });
}

function inlineClassAttributes(xml: string) {
  const classStyles = parseClassStyles(xml);
  const withoutStyleBlocks = xml.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");

  return withoutStyleBlocks.replace(/\sclass=(["'])(.*?)\1/g, (_match, quote: string, classValue: string) => {
    const attributes = classValue
      .split(/\s+/)
      .flatMap((className) => Object.entries(classStyles.get(className) ?? {}))
      .map(([property, value]) => ` ${property}=${quote}${value}${quote}`)
      .join("");

    return attributes;
  });
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
  return inlineClassAttributes(inlineStyleAttributes(xml))
    .replace(/#([0-9a-fA-F]{8,})(?![0-9a-fA-F])/g, (_match, hex: string) => {
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
  const legacyRawKeys = await Promise.all(
    legacyIconCacheIndexKeys.map((key) => AsyncStorage.getItem(key)),
  );
  const legacyKeys = legacyRawKeys.flatMap(readCacheKeys);

  memoryIconCache.clear();
  pendingIconRequests.clear();
  await AsyncStorage.multiRemove([
    ...keys,
    ...legacyKeys,
    iconCacheIndexKey,
    ...legacyIconCacheIndexKeys,
  ]);
}
