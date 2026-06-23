export const billingPeriods = ["Weekly", "Monthly", "3 months", "6 months", "Yearly"] as const;
export type BillingPeriod = (typeof billingPeriods)[number];
export type ThemePreference = "system" | "light" | "dark";

export type Subscription = {
  id: string;
  name: string;
  category: string;
  price: number;
  currency: string;
  billingPeriod: BillingPeriod;
  payDay?: number;
  nextRenewalDate: string;
  iconName?: string;
  iconLabel?: string;
  iconColor?: string;
  backgroundColor?: string;
  simpleIconSlug?: string;
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
};

export const defaultSettings: Settings = {
  theme: "system",
  remindersEnabled: true,
  reminderDays: 3,
  currency: "EUR",
  paydayEnabled: false,
  payday: 1,
};
