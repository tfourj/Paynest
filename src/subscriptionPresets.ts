import { categories } from "./constants";

export type SubscriptionPreset = {
  name: string;
  category: (typeof categories)[number];
  simpleIconSlug: string;
  iconLabel: string;
  iconColor: string;
  backgroundColor: string;
};

function preset(
  name: string,
  category: SubscriptionPreset["category"],
  simpleIconSlug: string,
  iconLabel: string,
  iconColor: string,
  backgroundColor: string,
): SubscriptionPreset {
  return { name, category, simpleIconSlug, iconLabel, iconColor, backgroundColor };
}

export const subscriptionPresets: SubscriptionPreset[] = [
  preset("Netflix", "Streaming", "netflix", "N", "#E50914", "#FDE8EA"),
  preset("Spotify", "Music", "spotify", "S", "#1DB954", "#E8F8EF"),
  preset("YouTube Premium", "Streaming", "youtube", "Y", "#FF0000", "#FFE7E7"),
  preset("Disney+", "Streaming", "disneyplus", "D+", "#113CCF", "#E9EDFF"),
  preset("Prime Video", "Streaming", "primevideo", "P", "#00A8E1", "#E5F7FD"),
  preset("Apple TV+", "Streaming", "appletv", "TV", "#111111", "#ECECEC"),
  preset("Apple Music", "Music", "applemusic", "AM", "#FA243C", "#FEE9EC"),
  preset("Hulu", "Streaming", "hulu", "H", "#1CE783", "#E8FCF2"),
  preset("Max", "Streaming", "max", "M", "#002BE7", "#E7EAFF"),
  preset("Paramount+", "Streaming", "paramountplus", "P+", "#0064FF", "#E7F0FF"),
  preset("Peacock", "Streaming", "peacock", "P", "#000000", "#F2F2F2"),
  preset("Crunchyroll", "Streaming", "crunchyroll", "C", "#F47521", "#FEF0E8"),
  preset("Audible", "Education", "audible", "A", "#F8991C", "#FFF3E2"),
  preset("Kindle", "Education", "amazonkindle", "K", "#00A4B8", "#E5F8FA"),
  preset("Adobe", "Software", "adobe", "A", "#FF0000", "#FFE7E7"),
  preset("Canva", "Software", "canva", "C", "#00C4CC", "#E5FAFB"),
  preset("Figma", "Software", "figma", "F", "#F24E1E", "#FEEDE8"),
  preset("Notion", "Software", "notion", "N", "#000000", "#F2F2F2"),
  preset("Slack", "Software", "slack", "S", "#4A154B", "#F1E8F1"),
  preset("GitHub", "Software", "github", "GH", "#181717", "#ECECEC"),
  preset("Dropbox", "Cloud", "dropbox", "D", "#0061FF", "#E7F0FF"),
  preset("Google One", "Cloud", "googleone", "G", "#4285F4", "#EBF3FE"),
  preset("Microsoft 365", "Software", "microsoft", "MS", "#5E5E5E", "#F0F0F0"),
  preset("iCloud", "Cloud", "icloud", "iC", "#3693F3", "#EAF4FE"),
  preset("Xbox Game Pass", "Gaming", "xbox", "X", "#107C10", "#E7F2E7"),
  preset("PlayStation Plus", "Gaming", "playstation", "PS", "#003791", "#E7ECF4"),
  preset("Nintendo Switch Online", "Gaming", "nintendoswitch", "NS", "#E60012", "#FDE7E9"),
  preset("Discord Nitro", "Gaming", "discord", "D", "#5865F2", "#EEF0FE"),
  preset("Twitch", "Streaming", "twitch", "T", "#9146FF", "#F4EDFF"),
  preset("OpenAI", "Software", "openai", "AI", "#412991", "#EEEAF8"),
  preset("Coursera", "Education", "coursera", "C", "#0056D2", "#E7EFFE"),
  preset("Duolingo", "Education", "duolingo", "D", "#58CC02", "#EEFBE6"),
  preset("Strava", "Fitness", "strava", "S", "#FC4C02", "#FEEDE5"),
  preset("Peloton", "Fitness", "peloton", "P", "#181A1D", "#ECEDEE"),
  preset("Patreon", "Finance", "patreon", "P", "#000000", "#F2F2F2"),
];
