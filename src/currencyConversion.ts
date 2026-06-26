import AsyncStorage from "@react-native-async-storage/async-storage";

const cachePrefix = "paynest.currencyRates.v1";
const cacheTtlMs = 12 * 60 * 60 * 1000;
const ratesEndpoint = "https://api.frankfurter.dev/v2/rates";

type CachedRates = {
  fetchedAt: number;
  rates: Record<string, number>;
};

type FrankfurterArrayRate = {
  base?: string;
  quote?: string;
  rate?: number;
};

type FrankfurterObjectRate = {
  rates?: Record<string, number>;
};

function cacheKey(base: string, quotes: string[]) {
  return `${cachePrefix}.${base}.${quotes.slice().sort().join(",")}`;
}

function parseRates(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload.reduce<Record<string, number>>((rates, item: FrankfurterArrayRate) => {
      if (typeof item.quote === "string" && typeof item.rate === "number") {
        rates[item.quote] = item.rate;
      }
      return rates;
    }, {});
  }

  const objectPayload = payload as FrankfurterObjectRate;
  return objectPayload.rates ?? {};
}

export async function loadCurrencyRates(base: string, quotes: string[]) {
  const uniqueQuotes = Array.from(new Set(quotes.filter((quote) => quote !== base))).sort();
  if (uniqueQuotes.length === 0) return {};

  const key = cacheKey(base, uniqueQuotes);
  const cachedRaw = await AsyncStorage.getItem(key);
  if (cachedRaw) {
    try {
      const cached = JSON.parse(cachedRaw) as CachedRates;
      if (Date.now() - cached.fetchedAt < cacheTtlMs) return cached.rates;
    } catch {
      await AsyncStorage.removeItem(key);
    }
  }

  const params = new URLSearchParams({ base, quotes: uniqueQuotes.join(",") });
  const response = await fetch(`${ratesEndpoint}?${params.toString()}`);
  if (!response.ok) throw new Error("Could not load currency conversion rates.");

  const rates = parseRates(await response.json());
  const cacheValue: CachedRates = { fetchedAt: Date.now(), rates };
  await AsyncStorage.setItem(key, JSON.stringify(cacheValue));
  return rates;
}

export async function clearCurrencyConversionCache() {
  const keys = await AsyncStorage.getAllKeys();
  const currencyKeys = keys.filter((key) => key.startsWith(cachePrefix));
  if (currencyKeys.length > 0) await AsyncStorage.multiRemove(currencyKeys);
}

export function convertToBaseCurrency(
  amount: number,
  fromCurrency: string,
  baseCurrency: string,
  rates: Record<string, number>,
) {
  if (fromCurrency === baseCurrency) return amount;
  const rate = rates[fromCurrency];
  if (!rate || rate <= 0) return null;
  return amount / rate;
}
