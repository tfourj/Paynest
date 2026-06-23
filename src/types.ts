export const billingPeriods = ["Weekly", "Monthly", "3 months", "6 months", "Yearly"] as const;
export type BillingPeriod = (typeof billingPeriods)[number];
export type ThemePreference = "system" | "light" | "dark";

export const defaultColorPresets = [
  "#EF4444",
  "#F97316",
  "#F59E0B",
  "#22C55E",
  "#06B6D4",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#111827",
  "#FFFFFF",
];

export type Subscription = {
  id: string;
  name: string;
  category: string;
  price: number;
  currency: string;
  billingPeriod: BillingPeriod;
  payDay?: number;
  nextRenewalDate: string;
  paused: boolean;
  reminderEnabled: boolean;
  reminderDays: number;
  reminderTime: string;
  iconName?: string;
  iconLabel?: string;
  iconColor?: string;
  backgroundColor?: string;
  iconBackgroundColor?: string;
  simpleIconSlug?: string;
  iconProvider?: string;
  iconUrl?: string;
  iconSourceTitle?: string;
  createdAt: string;
  updatedAt: string;
};

export type Settings = {
  theme: ThemePreference;
  remindersEnabled: boolean;
  reminderDays: number;
  currency: string;
  paydayEnabled: boolean;
  payday: number;
  colorPresets: string[];
};

export const defaultSettings: Settings = {
  theme: "light",
  remindersEnabled: false,
  reminderDays: 0,
  currency: "EUR",
  paydayEnabled: false,
  payday: 1,
  colorPresets: defaultColorPresets,
};
