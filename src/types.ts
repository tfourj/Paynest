export type BillingPeriod = "Monthly" | "Yearly";
export type ThemePreference = "system" | "light" | "dark";

export type Subscription = {
  id: string;
  name: string;
  category: string;
  price: number;
  currency: string;
  billingPeriod: BillingPeriod;
  nextRenewalDate: string;
  createdAt: string;
  updatedAt: string;
};

export type Settings = {
  theme: ThemePreference;
  remindersEnabled: boolean;
  reminderDays: number;
  currency: string;
};

export const defaultSettings: Settings = {
  theme: "system",
  remindersEnabled: true,
  reminderDays: 3,
  currency: "EUR",
};
