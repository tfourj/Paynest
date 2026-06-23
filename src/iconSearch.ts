import * as SimpleIcons from "simple-icons";

type SimpleIconData = {
  path: string;
  slug: string;
  title: string;
  hex: string;
};

export type IconProvider = "simpleicons" | "svgl" | "dashboardicons";

export type IconSource = {
  provider: IconProvider;
  title: string;
  slug?: string;
  url?: string;
  color?: string;
};

export type IconSearchResult = IconSource & {
  id: string;
};

const dashboardIconNames = [
  "1password",
  "adobe-creative-cloud",
  "amazon-prime",
  "apple-music",
  "apple-tv",
  "backblaze",
  "bitwarden",
  "canva",
  "chatgpt",
  "cloudflare",
  "crunchyroll",
  "discord",
  "disney-plus",
  "dropbox",
  "figma",
  "github",
  "gitlab",
  "hulu",
  "icloud",
  "jira",
  "linear",
  "max",
  "netflix",
  "nextcloud",
  "notion",
  "obsidian",
  "plex",
  "proton-mail",
  "proton-vpn",
  "revolut",
  "slack",
  "spotify",
  "steam",
  "trello",
  "twitch",
  "webflow",
  "youtube",
  "zoom",
];
let dashboardIconNameCache: string[] | undefined;

const simpleIconIndex = Object.values(SimpleIcons as Record<string, unknown>)
  .filter((icon): icon is SimpleIconData => {
    if (!icon || typeof icon !== "object") return false;
    const candidate = icon as Partial<SimpleIconData>;
    return Boolean(candidate.slug && candidate.title && candidate.path);
  })
  .sort((a, b) => a.title.localeCompare(b.title));

export function getSimpleIcon(slug?: string) {
  if (!slug) return undefined;
  const key = `si${slug[0].toUpperCase()}${slug.slice(1)}`;
  return (SimpleIcons as Record<string, unknown>)[key] as SimpleIconData | undefined;
}

export function searchSimpleIcons(query: string, limit = 18): IconSearchResult[] {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];

  return simpleIconIndex
    .filter((icon) => {
      const title = normalizeQuery(icon.title);
      return title.includes(normalized) || icon.slug.includes(normalized);
    })
    .slice(0, limit)
    .map((icon) => ({
      id: `simpleicons:${icon.slug}`,
      provider: "simpleicons",
      title: icon.title,
      slug: icon.slug,
      color: `#${icon.hex}`,
    }));
}

export async function searchRemoteIcons(query: string, providers: IconProvider[]) {
  const searches = providers.map((provider) => {
    if (provider === "svgl") return searchSvglIcons(query);
    if (provider === "dashboardicons") return searchDashboardIcons(query);
    return Promise.resolve([]);
  });

  const settled = await Promise.allSettled(searches);
  return settled.flatMap((result) => (result.status === "fulfilled" ? result.value : []));
}

async function searchSvglIcons(query: string): Promise<IconSearchResult[]> {
  const endpoints = [
    `https://api.svgl.app?search=${encodeURIComponent(query)}`,
    `https://api.svgl.app/svgs?search=${encodeURIComponent(query)}`,
  ];

  for (const endpoint of endpoints) {
    const response = await fetch(endpoint);
    if (!response.ok) continue;

    const data = await response.json();
    const items: unknown[] = Array.isArray(data) ? data : data?.icons ?? data?.data ?? [];
    const results = items
      .map((item) => normalizeSvglIcon(item))
      .filter((item): item is IconSearchResult => Boolean(item))
      .slice(0, 18);

    if (results.length > 0) return results;
  }

  return [];
}

async function searchDashboardIcons(query: string): Promise<IconSearchResult[]> {
  const normalized = normalizeQuery(query);
  if (!normalized) return [];
  const iconNames = await getDashboardIconNames();

  return iconNames
    .filter((name) => name.includes(normalized))
    .slice(0, 18)
    .map((name) => ({
      id: `dashboardicons:${name}`,
      provider: "dashboardicons",
      title: titleFromSlug(name),
      slug: name,
      url: `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/${name}.svg`,
    }));
}

async function getDashboardIconNames() {
  if (dashboardIconNameCache) return dashboardIconNameCache;

  try {
    const response = await fetch("https://api.github.com/repos/homarr-labs/dashboard-icons/git/trees/main?recursive=1");
    if (!response.ok) throw new Error("dashboard icon tree unavailable");

    const data = await response.json();
    const tree: unknown[] = Array.isArray(data?.tree) ? data.tree : [];
    const names = tree
      .map((item) => {
        if (!item || typeof item !== "object") return undefined;
        const path = stringValue((item as Record<string, unknown>).path);
        if (!path?.startsWith("svg/") || !path.endsWith(".svg")) return undefined;
        return path.slice(4, -4);
      })
      .filter((name): name is string => Boolean(name))
      .sort((a, b) => a.localeCompare(b));

    dashboardIconNameCache = names.length > 0 ? names : dashboardIconNames;
    return dashboardIconNameCache;
  } catch {
    dashboardIconNameCache = dashboardIconNames;
    return dashboardIconNameCache;
  }
}

function normalizeSvglIcon(item: unknown): IconSearchResult | undefined {
  if (!item || typeof item !== "object") return undefined;

  const record = item as Record<string, unknown>;
  const title = stringValue(record.title) ?? stringValue(record.name);
  const slug = stringValue(record.slug) ?? stringValue(record.id);
  const url = extractSvglRoute(record.route ?? record.url);
  if (!title || !url) return undefined;

  return {
    id: `svgl:${slug ?? title}:${url}`,
    provider: "svgl",
    title,
    slug,
    url,
  };
}

function extractSvglRoute(route: unknown) {
  if (typeof route === "string") return absoluteSvglUrl(route);
  if (!route || typeof route !== "object") return undefined;

  const variants = route as Record<string, unknown>;
  const value = stringValue(variants.light) ?? stringValue(variants.dark) ?? stringValue(Object.values(variants)[0]);
  return value ? absoluteSvglUrl(value) : undefined;
}

function normalizeQuery(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function titleFromSlug(slug: string) {
  return slug
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function absoluteSvglUrl(url: string) {
  if (url.startsWith("http")) return url;
  if (url.startsWith("/")) return `https://svgl.app${url}`;
  return `https://svgl.app/${url}`;
}
