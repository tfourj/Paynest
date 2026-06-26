import "react-native-gesture-handler";

import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import type { FontSource } from "expo-font";
import { NavigationBar } from "expo-navigation-bar";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { TabBar } from "./src/components/common";
import type { Tab } from "./src/constants";
import { convertToBaseCurrency, loadCurrencyRates } from "./src/currencyConversion";
import { requestNotificationPermission, scheduleRenewalNotifications } from "./src/notifications";
import {
  forgetEncryptionPassword,
  loadSavedEncryptionPassword,
  saveEncryptionPassword,
} from "./src/encryptionStorage";
import {
  createPocketBaseClient,
  defaultPocketBaseConnection,
  resolvePocketBaseConfig,
  type PocketBaseConnectionSettings,
  type PocketBaseSession,
} from "./src/pocketbase";
import { AddSubscription } from "./src/screens/AddSubscription";
import { Dashboard } from "./src/screens/Dashboard";
import { Insights } from "./src/screens/Insights";
import { LoginScreen } from "./src/screens/LoginScreen";
import { PrivacyPolicy } from "./src/screens/PrivacyPolicy";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { SubscriptionList } from "./src/screens/SubscriptionList";
import {
  clearAppData,
  loadAppData,
  loadLocalModePreference,
  loadPocketBaseConnection,
  saveLocalModePreference,
  saveSettings,
  saveSubscriptions,
  savePocketBaseConnection,
} from "./src/storage";
import {
  deleteEncryptedCloudData,
  deletePlaintextCloudData,
  deleteSubscriptionFromCloud,
  loadCloudAppData,
  syncAppData,
  upsertEncryptedCloudData,
  upsertSettings,
  upsertSubscriptions,
  type CloudAppData,
  type SyncStrategy,
} from "./src/sync";
import { styles } from "./src/styles";
import { darkColors, lightColors } from "./src/theme";
import type { Colors } from "./src/theme";
import { defaultSettings, type Settings, type Subscription } from "./src/types";
import {
  billableSubscriptions,
  dayDifference,
  monthlyCost,
  nextRenewalDate,
  nextMonthlyPayday,
  nextMonthStart,
  totalsByCurrency,
  type CurrencyTotal,
} from "./src/utils/subscriptions";

const iconFonts: Record<string, FontSource> = Ionicons.font;

export type CloudEncryptionState = "off" | "locked" | "unlocked";

function comparableSubscription(item: Subscription) {
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    price: item.price,
    currency: item.currency,
    billingPeriod: item.billingPeriod,
    payDay: item.payDay ?? null,
    nextRenewalDate: item.nextRenewalDate,
    reminderEnabled: item.reminderEnabled ?? false,
    reminderDays: item.reminderDays ?? 0,
    reminderTime: item.reminderTime ?? "09:00",
    iconName: item.iconName ?? null,
    iconLabel: item.iconLabel ?? null,
    iconColor: item.iconColor ?? null,
    backgroundColor: item.backgroundColor ?? null,
    iconBackgroundColor: item.iconBackgroundColor ?? null,
    simpleIconSlug: item.simpleIconSlug ?? null,
    iconProvider: item.iconProvider ?? null,
    iconUrl: item.iconUrl ?? null,
    iconSourceTitle: item.iconSourceTitle ?? null,
    paused: item.paused ?? false,
  };
}

type SubscriptionDiffField = {
  label: string;
  localValue: (item: Subscription) => string | number | boolean | null;
  cloudValue: (item: Subscription) => string | number | boolean | null;
};
type ChangedSubscriptionDiff = {
  id: string;
  name: string;
  fields: {
    label: string;
    localValue: string;
    cloudValue: string;
  }[];
};
type SyncDiffRow = {
  id: string;
  kind: "local" | "database" | "changed";
  localText: string;
  databaseText: string;
};

const subscriptionDiffFields: SubscriptionDiffField[] = [
  { label: "Name", localValue: (item) => item.name, cloudValue: (item) => item.name },
  { label: "Category", localValue: (item) => item.category, cloudValue: (item) => item.category },
  { label: "Price", localValue: (item) => item.price, cloudValue: (item) => item.price },
  { label: "Currency", localValue: (item) => item.currency, cloudValue: (item) => item.currency },
  {
    label: "Billing period",
    localValue: (item) => item.billingPeriod,
    cloudValue: (item) => item.billingPeriod,
  },
  { label: "Pay day", localValue: (item) => item.payDay ?? null, cloudValue: (item) => item.payDay ?? null },
  {
    label: "Next renewal",
    localValue: (item) => item.nextRenewalDate,
    cloudValue: (item) => item.nextRenewalDate,
  },
  {
    label: "Reminder enabled",
    localValue: (item) => item.reminderEnabled ?? false,
    cloudValue: (item) => item.reminderEnabled ?? false,
  },
  {
    label: "Reminder days",
    localValue: (item) => item.reminderDays ?? 0,
    cloudValue: (item) => item.reminderDays ?? 0,
  },
  {
    label: "Reminder time",
    localValue: (item) => item.reminderTime ?? "09:00",
    cloudValue: (item) => item.reminderTime ?? "09:00",
  },
  {
    label: "Icon",
    localValue: (item) => item.iconName ?? null,
    cloudValue: (item) => item.iconName ?? null,
  },
  {
    label: "Icon label",
    localValue: (item) => item.iconLabel ?? null,
    cloudValue: (item) => item.iconLabel ?? null,
  },
  {
    label: "Icon color",
    localValue: (item) => item.iconColor ?? null,
    cloudValue: (item) => item.iconColor ?? null,
  },
  {
    label: "Background color",
    localValue: (item) => item.backgroundColor ?? null,
    cloudValue: (item) => item.backgroundColor ?? null,
  },
  {
    label: "Icon background",
    localValue: (item) => item.iconBackgroundColor ?? null,
    cloudValue: (item) => item.iconBackgroundColor ?? null,
  },
  {
    label: "Simple icon",
    localValue: (item) => item.simpleIconSlug ?? null,
    cloudValue: (item) => item.simpleIconSlug ?? null,
  },
  {
    label: "Icon provider",
    localValue: (item) => item.iconProvider ?? null,
    cloudValue: (item) => item.iconProvider ?? null,
  },
  {
    label: "Icon URL",
    localValue: (item) => item.iconUrl ?? null,
    cloudValue: (item) => item.iconUrl ?? null,
  },
  {
    label: "Icon source",
    localValue: (item) => item.iconSourceTitle ?? null,
    cloudValue: (item) => item.iconSourceTitle ?? null,
  },
  {
    label: "Paused",
    localValue: (item) => item.paused ?? false,
    cloudValue: (item) => item.paused ?? false,
  },
];

function formatDiffValue(value: string | number | boolean | null) {
  if (value === null || value === undefined || value === "") return "Not set";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function subscriptionDiff(localSubscriptions: Subscription[], cloudSubscriptions: Subscription[]) {
  const localById = new Map(localSubscriptions.map((item) => [item.id, item]));
  const cloudById = new Map(cloudSubscriptions.map((item) => [item.id, item]));
  const onlyLocal = localSubscriptions
    .filter((item) => !cloudById.has(item.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const onlyCloud = cloudSubscriptions
    .filter((item) => !localById.has(item.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  const changed: ChangedSubscriptionDiff[] = [];
  for (const localItem of localSubscriptions) {
    const cloudItem = cloudById.get(localItem.id);
    if (!cloudItem) continue;

    const fields = [];
    for (const field of subscriptionDiffFields) {
      const localValue = field.localValue(localItem);
      const cloudValue = field.cloudValue(cloudItem);
      if (localValue === cloudValue) continue;

      fields.push({
        label: field.label,
        localValue: formatDiffValue(localValue),
        cloudValue: formatDiffValue(cloudValue),
      });
    }

    if (fields.length > 0) {
      changed.push({
        id: localItem.id,
        name: localItem.name || cloudItem.name,
        fields,
      });
    }
  }
  changed.sort((a, b) => a.name.localeCompare(b.name));

  return { onlyLocal, onlyCloud, changed };
}

function syncDiffRows(localSubscriptions: Subscription[], cloudSubscriptions: Subscription[]) {
  const diff = subscriptionDiff(localSubscriptions, cloudSubscriptions);
  const rows: SyncDiffRow[] = [];

  for (const item of diff.onlyLocal) {
    rows.push({
      id: `local-${item.id}`,
      kind: "local",
      localText: `- ${item.name}`,
      databaseText: "",
    });
  }

  for (const item of diff.onlyCloud) {
    rows.push({
      id: `database-${item.id}`,
      kind: "database",
      localText: "",
      databaseText: `+ ${item.name}`,
    });
  }

  for (const item of diff.changed) {
    for (const field of item.fields) {
      rows.push({
        id: `changed-${item.id}-${field.label}`,
        kind: "changed",
        localText: `~ ${item.name}\n${field.label}: ${field.localValue}`,
        databaseText: `~ ${item.name}\n${field.label}: ${field.cloudValue}`,
      });
    }
  }

  return rows;
}

function subscriptionListsMatch(left: Subscription[], right: Subscription[]) {
  if (left.length !== right.length) return false;

  const normalize = (items: Subscription[]) => items
    .map(comparableSubscription)
    .sort((a, b) => a.id.localeCompare(b.id));

  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

type WebRuntime = {
  addEventListener?: (event: "popstate", listener: () => void) => void;
  removeEventListener?: (event: "popstate", listener: () => void) => void;
  history?: { pushState: (data: unknown, unused: string, url?: string | URL | null) => void };
  location?: { pathname?: string };
};

function webRuntime() {
  return Platform.OS === "web" ? globalThis as WebRuntime : undefined;
}

function isPrivacyPolicyPath() {
  const pathname = webRuntime()?.location?.pathname?.replace(/\/$/, "");
  return pathname === "/privacypolicy";
}

function convertSubscriptionAmount(
  amount: number,
  fromCurrency: string,
  displayCurrency: string,
  rates: Record<string, number>,
) {
  return convertToBaseCurrency(amount, fromCurrency, displayCurrency, rates);
}

function currencyDisplayTotals(
  subscriptions: Subscription[],
  displayCurrency: string,
  convertToPrimaryCurrency: boolean,
  rates: Record<string, number>,
  amountForItem: (item: Subscription) => number,
): CurrencyTotal[] {
  if (!convertToPrimaryCurrency) return totalsByCurrency(subscriptions, amountForItem);

  const totals = subscriptions.reduce<Map<string, number>>((map, item) => {
    const amount = amountForItem(item);
    const converted = convertSubscriptionAmount(amount, item.currency, displayCurrency, rates);
    const currency = converted == null ? item.currency : displayCurrency;
    map.set(currency, (map.get(currency) ?? 0) + (converted ?? amount));
    return map;
  }, new Map());

  return Array.from(totals, ([currency, amount]) => ({ currency, amount }))
    .sort((a, b) => {
      if (a.currency === displayCurrency) return -1;
      if (b.currency === displayCurrency) return 1;
      return a.currency.localeCompare(b.currency);
    });
}

export default function App() {
  const [iconsLoaded, iconsError] = useFonts(iconFonts);
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [pocketBaseConnection, setPocketBaseConnection] = useState<PocketBaseConnectionSettings>(
    defaultPocketBaseConnection,
  );
  const [session, setSession] = useState<PocketBaseSession | null>(null);
  const [ready, setReady] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  const [localMode, setLocalMode] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(isPrivacyPolicyPath);
  const [cloudEncryptionState, setCloudEncryptionState] = useState<CloudEncryptionState>("off");
  const [encryptionPassword, setEncryptionPassword] = useState<string | null>(null);
  const [pendingSyncPrompt, setPendingSyncPrompt] = useState<{
    userId: string;
    cloudSubscriptions: Subscription[];
  } | null>(null);
  const [refreshingDashboard, setRefreshingDashboard] = useState(false);
  const [currencyRates, setCurrencyRates] = useState<Record<string, number>>({});
  const syncedUserId = useRef<string | null>(null);
  const loginPromptUserId = useRef<string | null>(null);
  const pendingSyncCloud = useRef<CloudAppData | null>(null);
  const pocketBaseConfig = useMemo(
    () => resolvePocketBaseConfig(pocketBaseConnection),
    [pocketBaseConnection],
  );
  const pocketBase = useMemo(
    () => createPocketBaseClient(pocketBaseConfig),
    [pocketBaseConfig],
  );

  useEffect(() => {
    Promise.all([
      loadAppData(),
      loadPocketBaseConnection(),
      loadLocalModePreference(),
    ]).then(([appData, loadedPocketBaseConnection, loadedLocalMode]) => {
      setSubscriptions(appData.subscriptions);
      setSettings(appData.settings);
      if (loadedPocketBaseConnection.url !== pocketBaseConnection.url) {
        setAuthReady(false);
      }
      setPocketBaseConnection(loadedPocketBaseConnection);
      setLocalMode(loadedLocalMode);
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  useEffect(() => {
    const runtime = webRuntime();
    if (!runtime?.addEventListener || !runtime.removeEventListener) return;

    const syncPrivacyRoute = () => setShowPrivacyPolicy(isPrivacyPolicyPath());
    runtime.addEventListener("popstate", syncPrivacyRoute);
    return () => runtime.removeEventListener?.("popstate", syncPrivacyRoute);
  }, []);

  useEffect(() => {
    if (!ready) setAuthReady(false);
    if (!pocketBase) {
      setSession(null);
      syncedUserId.current = null;
      loginPromptUserId.current = null;
      setCloudEncryptionState("off");
      setEncryptionPassword(null);
      setAuthReady(true);
      return;
    }

    let cancelled = false;
    void pocketBase.loadSession().then((loadedSession) => {
      if (!cancelled) {
        setSession(loadedSession);
        setAuthReady(true);
      }
    }).catch(() => {
      if (!cancelled) {
        setSession(null);
        setAuthReady(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pocketBase]);

  useEffect(() => {
    if (!ready) return;

    const hasEnabledReminders = billableSubscriptions(subscriptions).some((item) => item.reminderEnabled);
    scheduleRenewalNotifications(subscriptions, hasEnabledReminders).catch((error) => {
      console.warn("Notification scheduling failed", error);
    });
  }, [ready, subscriptions]);

  useEffect(() => {
    if (!ready || Platform.OS === "web" || !session || settings.usesMobile) return;
    updateSettings({ ...settings, usesMobile: true });
  }, [ready, session?.user.id, settings.usesMobile]);

  useEffect(() => {
    const userId = session?.user.id;
    if (!ready || !userId) {
      if (!userId) syncedUserId.current = null;
      return;
    }
    if (syncedUserId.current === userId) return;

    syncedUserId.current = userId;
    loadSavedEncryptionPassword(pocketBaseConfig.url, userId).then((savedPassword) => (
      loadCloudAppData(pocketBase, session.token, userId, savedPassword).then((cloud) => ({ cloud, savedPassword }))
    )).then(({ cloud, savedPassword }) => {
      if (cloud.encrypted && cloud.locked) {
        setCloudEncryptionState("locked");
        setEncryptionPassword(null);
        return;
      }
      if (cloud.encrypted) {
        setCloudEncryptionState("unlocked");
        setEncryptionPassword(savedPassword);
      } else {
        setCloudEncryptionState("off");
        setEncryptionPassword(null);
      }
      const canAskForChoice = loginPromptUserId.current === userId;
      const needsChoice = canAskForChoice
        && subscriptions.length > 0
        && cloud.subscriptions.length > 0
        && !subscriptionListsMatch(subscriptions, cloud.subscriptions);
      if (!needsChoice) {
        void syncUserData(userId, canAskForChoice ? "merge" : "cloud", cloud, savedPassword);
        return;
      }

      pendingSyncCloud.current = cloud;
      setPendingSyncPrompt({ userId, cloudSubscriptions: cloud.subscriptions });
    }).catch((error) => {
      syncedUserId.current = null;
      console.warn("PocketBase sync failed", error);
    });
  }, [ready, session?.token, session?.user.id, pocketBase, pocketBaseConfig.url]);

  const dark = settings.theme === "dark";
  const c = dark ? darkColors : lightColors;

  useEffect(() => {
    if (Platform.OS === "web") return;

    void SystemUI.setBackgroundColorAsync(c.background).catch((error) => {
      console.warn("System background color update failed", error);
    });

  }, [c.background]);

  const activeSubscriptions = useMemo(
    () => billableSubscriptions(subscriptions),
    [subscriptions],
  );
  const upcoming = useMemo(
    () => activeSubscriptions
      .map((item) => ({
        ...item,
        nextRenewalDate: nextRenewalDate(item),
      }))
      .sort((a, b) => dayDifference(a.nextRenewalDate) - dayDifference(b.nextRenewalDate)),
    [activeSubscriptions],
  );
  const spendingBoundary = useMemo(
    () => settings.paydayEnabled ? nextMonthlyPayday(settings.payday) : nextMonthStart(),
    [settings.payday, settings.paydayEnabled],
  );
  const sourceCurrencies = useMemo(
    () => Array.from(new Set(
      subscriptions
        .map((item) => item.currency)
        .filter((currency) => currency !== settings.currency),
    )),
    [settings.currency, subscriptions],
  );
  const convertedMonthlyAmounts = useMemo(
    () => activeSubscriptions.reduce<Record<string, number | null>>((amounts, item) => {
      amounts[item.id] = convertSubscriptionAmount(monthlyCost(item), item.currency, settings.currency, currencyRates);
      return amounts;
    }, {}),
    [activeSubscriptions, currencyRates, settings.currency],
  );
  const convertedRenewalPrices = useMemo(
    () => subscriptions.reduce<Record<string, number | null>>((amounts, item) => {
      amounts[item.id] = convertSubscriptionAmount(item.price, item.currency, settings.currency, currencyRates);
      return amounts;
    }, {}),
    [currencyRates, settings.currency, subscriptions],
  );
  const monthlyTotals = useMemo(
    () => currencyDisplayTotals(
      activeSubscriptions,
      settings.currency,
      settings.convertToPrimaryCurrency,
      currencyRates,
      monthlyCost,
    ),
    [activeSubscriptions, currencyRates, settings.convertToPrimaryCurrency, settings.currency],
  );
  const savedMonthlyTotals = useMemo(
    () => currencyDisplayTotals(
      subscriptions.filter((item) => item.paused),
      settings.currency,
      settings.convertToPrimaryCurrency,
      currencyRates,
      monthlyCost,
    ),
    [currencyRates, settings.convertToPrimaryCurrency, settings.currency, subscriptions],
  );
  const spendingUntilBoundaryTotals = useMemo(
    () => currencyDisplayTotals(
      activeSubscriptions,
      settings.currency,
      settings.convertToPrimaryCurrency,
      currencyRates,
      (item) => {
        const today = new Date();
        const renewal = new Date(`${item.nextRenewalDate}T00:00:00`).getTime();
        const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
        const boundaryStart = new Date(
          spendingBoundary.getFullYear(),
          spendingBoundary.getMonth(),
          spendingBoundary.getDate(),
        ).getTime();
        const beforeBoundary = settings.paydayEnabled ? renewal <= boundaryStart : renewal < boundaryStart;
        return renewal >= todayStart && beforeBoundary ? item.price : 0;
      },
    ),
    [
      activeSubscriptions,
      currencyRates,
      settings.convertToPrimaryCurrency,
      settings.currency,
      settings.paydayEnabled,
      spendingBoundary,
    ],
  );

  useEffect(() => {
    if (!ready || !settings.convertToPrimaryCurrency || sourceCurrencies.length === 0) {
      setCurrencyRates({});
      return;
    }

    let cancelled = false;
    loadCurrencyRates(settings.currency, sourceCurrencies)
      .then((rates) => {
        if (!cancelled) setCurrencyRates(rates);
      })
      .catch((error) => {
        if (!cancelled) setCurrencyRates({});
        console.warn("Currency conversion failed", error);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, settings.convertToPrimaryCurrency, settings.currency, sourceCurrencies]);

  async function addSubscription(input: Omit<Subscription, "id" | "createdAt" | "updatedAt">) {
    const now = new Date().toISOString();
    const subscription = {
      ...input,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      createdAt: now,
      updatedAt: now,
    };
    const next = [...subscriptions, subscription];
    setSubscriptions(next);
    await saveSubscriptions(next);
    if (session?.user.id) {
      void syncSubscriptionsAfterChange(next, settings, [subscription]).catch((error) => {
        console.warn("PocketBase subscription sync failed", error);
      });
    }
    setShowAdd(false);
    setTab("Subscriptions");
  }

  function removeSubscription(item: Subscription) {
    setSubscriptions((current) => {
      const next = current.filter((subscription) => subscription.id !== item.id);
      void saveSubscriptions(next);
      if (session?.user.id) {
        void syncSubscriptionDeleteAfterChange(next, settings, item.id).catch((error) => {
          console.warn("PocketBase delete failed", error);
        });
      }
      return next;
    });
  }

  function updateSubscription(item: Subscription, input: Omit<Subscription, "id" | "createdAt" | "updatedAt">) {
    const updated = {
      ...item,
      ...input,
      updatedAt: new Date().toISOString(),
    };

    setSubscriptions((current) => {
      const next = current.map((subscription) => subscription.id === item.id ? updated : subscription);
      void saveSubscriptions(next);
      if (session?.user.id) {
        void syncSubscriptionsAfterChange(next, settings, [updated]).catch((error) => {
          console.warn("PocketBase subscription sync failed", error);
        });
      }
      return next;
    });
  }

  function updateSettings(next: Settings) {
    const shouldSyncSettings = settings.remindersEnabled !== next.remindersEnabled
      || settings.reminderDays !== next.reminderDays
      || settings.reminderTime !== next.reminderTime
      || settings.currency !== next.currency
      || JSON.stringify(settings.enabledCurrencies) !== JSON.stringify(next.enabledCurrencies)
      || settings.convertToPrimaryCurrency !== next.convertToPrimaryCurrency
      || settings.showOriginalCurrency !== next.showOriginalCurrency
      || settings.paydayEnabled !== next.paydayEnabled
      || settings.payday !== next.payday
      || settings.usesMobile !== next.usesMobile
      || JSON.stringify(settings.colorPresets) !== JSON.stringify(next.colorPresets);

    setSettings(next);
    void saveSettings(next);
    if (session?.user.id && shouldSyncSettings) {
      void syncSettingsAfterChange(subscriptions, next).catch((error) => {
        console.warn("PocketBase settings sync failed", error);
      });
    }
  }

  function applyGlobalReminderSettings() {
    const now = new Date().toISOString();
    const next = subscriptions.map((subscription) => ({
      ...subscription,
      reminderEnabled: settings.remindersEnabled,
      reminderDays: settings.reminderDays,
      reminderTime: settings.reminderTime,
      updatedAt: now,
    }));

    setSubscriptions(next);
    void saveSubscriptions(next);
    if (session?.user.id) {
      void syncSubscriptionsAfterChange(next, settings, next).catch((error) => {
        console.warn("PocketBase subscription sync failed", error);
      });
    }
  }

  async function syncSubscriptionsAfterChange(
    nextSubscriptions: Subscription[],
    nextSettings: Settings,
    changedSubscriptions: Subscription[],
  ) {
    const userId = session?.user.id;
    if (!userId) return;
    if (cloudEncryptionState === "locked") return;
    if (cloudEncryptionState === "unlocked") {
      if (!encryptionPassword) return;
      await upsertEncryptedCloudData(
        pocketBase,
        session.token,
        userId,
        encryptionPassword,
        nextSubscriptions,
        nextSettings,
      );
      return;
    }

    await upsertSubscriptions(pocketBase, session.token, userId, changedSubscriptions);
  }

  async function syncSubscriptionDeleteAfterChange(
    nextSubscriptions: Subscription[],
    nextSettings: Settings,
    localId: string,
  ) {
    const userId = session?.user.id;
    if (!userId) return;
    if (cloudEncryptionState === "locked") return;
    if (cloudEncryptionState === "unlocked") {
      if (!encryptionPassword) return;
      await upsertEncryptedCloudData(
        pocketBase,
        session.token,
        userId,
        encryptionPassword,
        nextSubscriptions,
        nextSettings,
      );
      return;
    }

    await deleteSubscriptionFromCloud(pocketBase, session.token, userId, localId);
  }

  async function syncSettingsAfterChange(nextSubscriptions: Subscription[], nextSettings: Settings) {
    const userId = session?.user.id;
    if (!userId) return;
    if (cloudEncryptionState === "locked") return;
    if (cloudEncryptionState === "unlocked") {
      if (!encryptionPassword) return;
      await upsertEncryptedCloudData(
        pocketBase,
        session.token,
        userId,
        encryptionPassword,
        nextSubscriptions,
        nextSettings,
      );
      return;
    }

    await upsertSettings(pocketBase, session.token, userId, nextSettings);
  }

  function updatePocketBaseConnection(next: PocketBaseConnectionSettings) {
    setPocketBaseConnection(next);
    setSession(null);
    syncedUserId.current = null;
    loginPromptUserId.current = null;
    pendingSyncCloud.current = null;
    setPendingSyncPrompt(null);
    setCloudEncryptionState("off");
    setEncryptionPassword(null);
    void savePocketBaseConnection(next);
  }

  function completePocketBaseAuth(next: PocketBaseConnectionSettings, nextSession: PocketBaseSession) {
    setPocketBaseConnection(next);
    setSession(nextSession);
    setAuthReady(true);
    syncedUserId.current = null;
    loginPromptUserId.current = nextSession.user.id;
    pendingSyncCloud.current = null;
    setPendingSyncPrompt(null);
    setCloudEncryptionState("off");
    setEncryptionPassword(null);
    void savePocketBaseConnection(next);
  }

  function signOutPocketBase() {
    setSession(null);
    syncedUserId.current = null;
    loginPromptUserId.current = null;
    pendingSyncCloud.current = null;
    setPendingSyncPrompt(null);
    setCloudEncryptionState("off");
    setEncryptionPassword(null);
  }

  function useLocally() {
    setLocalMode(true);
    void saveLocalModePreference(true);
  }

  async function syncUserData(
    userId: string,
    strategy: SyncStrategy,
    initialCloud?: CloudAppData,
    passwordOverride?: string | null,
    forceEncryption = false,
  ) {
    if (!session) throw new Error("Log in to sync your data.");
    const password = passwordOverride ?? encryptionPassword;
    const encrypted = forceEncryption || cloudEncryptionState === "unlocked" || Boolean(initialCloud?.encrypted);

    const synced = await syncAppData(
      pocketBase,
      session.token,
      userId,
      subscriptions,
      settings,
      strategy,
      initialCloud,
      { enabled: encrypted, password },
    );
    syncedUserId.current = userId;
    if (loginPromptUserId.current === userId) loginPromptUserId.current = null;
    if (encrypted) setCloudEncryptionState("unlocked");
    setSubscriptions(synced.subscriptions);
    setSettings(synced.settings);
    await Promise.all([
      saveSubscriptions(synced.subscriptions),
      saveSettings(synced.settings),
    ]);
  }

  async function runInitialSync(userId: string, strategy: SyncStrategy, initialCloud?: CloudAppData) {
    setPendingSyncPrompt(null);
    try {
      await syncUserData(userId, strategy, initialCloud);
      pendingSyncCloud.current = null;
    } catch (error) {
      pendingSyncCloud.current = null;
      if (loginPromptUserId.current === userId) loginPromptUserId.current = null;
      syncedUserId.current = null;
      console.warn("PocketBase sync failed", error);
    }
  }

  async function forceSync() {
    const userId = session?.user.id;
    if (!userId) throw new Error("Log in to sync your data.");

    await syncUserData(userId, "cloud");
  }

  async function enableCloudEncryption(password: string, rememberPassword: boolean) {
    const userId = session?.user.id;
    if (!session || !userId) throw new Error("Log in to enable encryption.");
    const normalizedPassword = password.trim();
    if (normalizedPassword.length < 8) throw new Error("Use an encryption password with at least 8 characters.");

    if (rememberPassword) {
      const saved = await saveEncryptionPassword(pocketBaseConfig.url, userId, normalizedPassword);
      if (!saved) throw new Error("This device cannot securely remember the encryption password.");
    } else {
      await forgetEncryptionPassword(pocketBaseConfig.url, userId);
    }
    const cloud = await loadCloudAppData(pocketBase, session.token, userId, normalizedPassword);
    const synced = await syncAppData(
      pocketBase,
      session.token,
      userId,
      subscriptions,
      settings,
      "merge",
      cloud,
      { enabled: true, password: normalizedPassword },
    );
    setEncryptionPassword(normalizedPassword);
    setCloudEncryptionState("unlocked");
    setSubscriptions(synced.subscriptions);
    setSettings(synced.settings);
    await Promise.all([
      saveSubscriptions(synced.subscriptions),
      saveSettings(synced.settings),
    ]);
  }

  async function unlockCloudEncryption(password: string, rememberPassword: boolean) {
    const userId = session?.user.id;
    if (!session || !userId) throw new Error("Log in to unlock encrypted data.");
    const normalizedPassword = password.trim();
    const cloud = await loadCloudAppData(pocketBase, session.token, userId, normalizedPassword);
    if (!cloud.encrypted || cloud.locked) throw new Error("Could not unlock encrypted cloud data.");
    if (rememberPassword) {
      const saved = await saveEncryptionPassword(pocketBaseConfig.url, userId, normalizedPassword);
      if (!saved) throw new Error("This device cannot securely remember the encryption password.");
    } else {
      await forgetEncryptionPassword(pocketBaseConfig.url, userId);
    }
    setEncryptionPassword(normalizedPassword);
    setCloudEncryptionState("unlocked");
    await syncUserData(userId, "cloud", cloud, normalizedPassword);
  }

  async function forgetCloudEncryptionPassword() {
    const userId = session?.user.id;
    if (!userId) return;
    await forgetEncryptionPassword(pocketBaseConfig.url, userId);
  }

  async function changeCloudEncryptionPassword(
    currentPassword: string,
    nextPassword: string,
    rememberPassword: boolean,
  ) {
    const userId = session?.user.id;
    if (!session || !userId) throw new Error("Log in to change the encryption password.");
    const normalizedCurrent = currentPassword.trim();
    const normalizedNext = nextPassword.trim();
    if (normalizedNext.length < 8) throw new Error("Use an encryption password with at least 8 characters.");
    await loadCloudAppData(pocketBase, session.token, userId, normalizedCurrent);
    if (rememberPassword) {
      const saved = await saveEncryptionPassword(pocketBaseConfig.url, userId, normalizedNext);
      if (!saved) throw new Error("This device cannot securely remember the encryption password.");
    } else {
      await forgetEncryptionPassword(pocketBaseConfig.url, userId);
    }
    await upsertEncryptedCloudData(pocketBase, session.token, userId, normalizedNext, subscriptions, settings);
    setEncryptionPassword(normalizedNext);
    setCloudEncryptionState("unlocked");
  }

  async function disableCloudEncryption() {
    const userId = session?.user.id;
    if (!session || !userId) throw new Error("Log in to disable encryption.");
    if (cloudEncryptionState !== "unlocked" || !encryptionPassword) {
      throw new Error("Unlock encrypted data before disabling encryption.");
    }

    await deletePlaintextCloudData(pocketBase, session.token, userId);
    await Promise.all([
      upsertSubscriptions(pocketBase, session.token, userId, subscriptions),
      upsertSettings(pocketBase, session.token, userId, settings),
    ]);
    await deleteEncryptedCloudData(pocketBase, session.token, userId);
    await forgetEncryptionPassword(pocketBaseConfig.url, userId);
    setEncryptionPassword(null);
    setCloudEncryptionState("off");
  }

  async function refreshDashboard() {
    if (refreshingDashboard) return;

    setRefreshingDashboard(true);
    try {
      const userId = session?.user.id;
      if (userId) {
        await syncUserData(userId, "cloud");
        return;
      }

      const data = await loadAppData();
      setSubscriptions(data.subscriptions);
      setSettings(data.settings);
    } catch (error) {
      console.warn("Dashboard refresh failed", error);
    } finally {
      setRefreshingDashboard(false);
    }
  }

  function resetData() {
    Alert.alert("Delete all local data?", "This removes all subscriptions and resets preferences on this device.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete data", style: "destructive", onPress: () => {
        setSubscriptions([]);
        setSettings(defaultSettings);
        void clearAppData();
      } },
    ]);
  }

  function openPrivacyPolicy() {
    setShowPrivacyPolicy(true);
    const runtime = webRuntime();
    if (!isPrivacyPolicyPath()) runtime?.history?.pushState(null, "", "/privacypolicy");
  }

  function closePrivacyPolicy() {
    setShowPrivacyPolicy(false);
    const runtime = webRuntime();
    if (isPrivacyPolicyPath()) runtime?.history?.pushState(null, "", "/");
  }

  useEffect(() => {
    if (iconsError) console.warn("Ionicons font failed to load", iconsError);
  }, [iconsError]);

  if (!ready || !authReady || (!iconsLoaded && !iconsError)) {
    return (
      <GestureHandlerRootView style={styles.safe}>
        <SystemBars dark={dark} />
        <SafeAreaProvider>
          <SafeAreaView style={[styles.loading, { backgroundColor: c.background }]}>
            <ActivityIndicator size="large" color={c.primary} />
            <Text style={[styles.loadingText, { color: c.textMuted }]}>Loading Paynest</Text>
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  if (showPrivacyPolicy) {
    return (
      <GestureHandlerRootView style={styles.safe}>
        <SystemBars dark={dark} />
        <SafeAreaProvider>
          <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top"]}>
            <View style={styles.shell}>
              <PrivacyPolicy c={c} onBack={closePrivacyPolicy} />
            </View>
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  if (!session && !localMode) {
    return (
      <GestureHandlerRootView style={styles.safe}>
        <SystemBars dark={dark} />
        <SafeAreaProvider>
          <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]}>
            <LoginScreen
              c={c}
              pocketBaseConnection={pocketBaseConnection}
              onAuthSuccess={completePocketBaseAuth}
              onUpdatePocketBaseConnection={updatePocketBaseConnection}
              onUseLocally={useLocally}
            />
          </SafeAreaView>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    );
  }

  return (
    <GestureHandlerRootView style={styles.safe}>
      <SystemBars dark={dark} />
      <SafeAreaProvider>
        <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top"]}>
          <View style={styles.shell}>
            <View style={styles.content}>
              {tab === "Dashboard" && (
                <Dashboard
                  c={c}
                  subscriptions={subscriptions}
                  activeSubscriptionCount={activeSubscriptions.length}
                  upcoming={upcoming}
                  monthly={monthlyTotals}
                  spendingUntilBoundary={spendingUntilBoundaryTotals}
                  spendingBoundary={spendingBoundary}
                  paydayEnabled={settings.paydayEnabled}
                  convertedRenewalPrices={convertedRenewalPrices}
                  displayCurrency={settings.currency}
                  showOriginalCurrency={settings.showOriginalCurrency && settings.convertToPrimaryCurrency}
                  refreshing={refreshingDashboard}
                  onAdd={() => setShowAdd(true)}
                  onRefresh={() => void refreshDashboard()}
                  onSeeAll={() => setTab("Subscriptions")}
                />
              )}
              {tab === "Subscriptions" && (
                <SubscriptionList
                  c={c}
                  subscriptions={subscriptions}
                  refreshing={refreshingDashboard}
                  colorPresets={settings.colorPresets}
                  enabledCurrencies={settings.enabledCurrencies}
                  convertedPrices={convertedRenewalPrices}
                  displayCurrency={settings.currency}
                  showOriginalCurrency={settings.showOriginalCurrency && settings.convertToPrimaryCurrency}
                  onAdd={() => setShowAdd(true)}
                  onRefresh={() => void refreshDashboard()}
                  onUpdate={updateSubscription}
                  onRemove={removeSubscription}
                  onRequestNotificationPermission={requestNotificationPermission}
                />
              )}
              {tab === "Insights" && (
                <Insights
                  c={c}
                  subscriptions={subscriptions}
                  activeSubscriptions={activeSubscriptions}
                  monthly={monthlyTotals}
                  savedMonthly={savedMonthlyTotals}
                  convertedMonthlyAmounts={convertedMonthlyAmounts}
                  displayCurrency={settings.currency}
                  convertToPrimaryCurrency={settings.convertToPrimaryCurrency}
                  showOriginalCurrency={settings.showOriginalCurrency}
                />
              )}
              {tab === "Settings" && (
                <SettingsScreen
                  c={c}
                  settings={settings}
                  session={session}
                  pocketBase={pocketBase}
                  pocketBaseConfig={pocketBaseConfig}
                  pocketBaseConnection={pocketBaseConnection}
                  cloudEncryptionState={cloudEncryptionState}
                  onUpdate={updateSettings}
                  onUpdatePocketBaseConnection={updatePocketBaseConnection}
                  onAuthSuccess={completePocketBaseAuth}
                  onSignOut={signOutPocketBase}
                  onForceSync={forceSync}
                  onEnableCloudEncryption={enableCloudEncryption}
                  onUnlockCloudEncryption={unlockCloudEncryption}
                  onForgetCloudEncryptionPassword={forgetCloudEncryptionPassword}
                  onChangeCloudEncryptionPassword={changeCloudEncryptionPassword}
                  onDisableCloudEncryption={disableCloudEncryption}
                  onReset={resetData}
                  onApplyGlobalReminderSettings={applyGlobalReminderSettings}
                  onRequestNotificationPermission={requestNotificationPermission}
                />
              )}
            </View>
            <TabBar c={c} active={tab} onChange={setTab} />
          </View>
          <AddSubscription
            c={c}
            visible={showAdd}
            defaultCurrency={settings.currency}
            enabledCurrencies={settings.enabledCurrencies}
            colorPresets={settings.colorPresets}
            onClose={() => setShowAdd(false)}
            onSave={addSubscription}
            onRequestNotificationPermission={requestNotificationPermission}
          />
          <SyncChoicePrompt
            c={c}
            visible={Boolean(pendingSyncPrompt)}
            localSubscriptions={subscriptions}
            cloudSubscriptions={pendingSyncPrompt?.cloudSubscriptions ?? []}
            onChoose={(strategy) => {
              if (!pendingSyncPrompt) return;
              void runInitialSync(
                pendingSyncPrompt.userId,
                strategy,
                pendingSyncCloud.current ?? undefined,
              );
            }}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function SystemBars({ dark }: { dark: boolean }) {
  const style = dark ? "light" : "dark";

  return (
    <>
      <StatusBar style={style} />
      <NavigationBar style={style} />
    </>
  );
}

function SyncChoicePrompt({
  c,
  visible,
  localSubscriptions,
  cloudSubscriptions,
  onChoose,
}: {
  c: Colors;
  visible: boolean;
  localSubscriptions: Subscription[];
  cloudSubscriptions: Subscription[];
  onChoose: (strategy: SyncStrategy) => void;
}) {
  const [showDiff, setShowDiff] = useState(false);
  const diffRows = useMemo(
    () => syncDiffRows(localSubscriptions, cloudSubscriptions),
    [cloudSubscriptions, localSubscriptions],
  );
  const changedCount = diffRows.length;

  useEffect(() => {
    if (!visible) setShowDiff(false);
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.syncPromptOverlay}>
        <View style={[styles.syncPromptPanel, { backgroundColor: c.surface, borderColor: c.border }]}>
          {showDiff ? (
            <>
              <View style={styles.syncPromptHeaderRow}>
                <Pressable
                  accessibilityLabel="Back to sync options"
                  onPress={() => setShowDiff(false)}
                  style={[styles.syncPromptIconButton, { backgroundColor: c.surfaceMuted }]}
                >
                  <Ionicons name="chevron-back" size={20} color={c.text} />
                </Pressable>
                <Text style={[styles.syncPromptTitle, styles.syncPromptHeaderTitle, { color: c.text }]}>
                  Sync diff
                </Text>
              </View>
              <View style={[styles.syncDiffBox, { borderColor: c.border }]}>
                <View style={[styles.syncDiffHeader, { borderBottomColor: c.border }]}>
                  <Text style={[styles.syncDiffHeaderText, { color: c.text }]}>Local</Text>
                  <Text
                    style={[
                      styles.syncDiffHeaderText,
                      styles.syncDiffRightHeader,
                      { color: c.text, borderLeftColor: c.border },
                    ]}
                  >
                    Database
                  </Text>
                </View>
                <ScrollView style={styles.syncDiffScroll} contentContainerStyle={styles.syncDiffContent}>
                  {changedCount === 0 ? (
                    <Text style={[styles.syncDiffEmptyBox, { color: c.textMuted }]}>
                      No subscription differences found.
                    </Text>
                  ) : diffRows.map((row) => (
                    <View
                      key={row.id}
                      style={[
                        styles.syncDiffRow,
                        row.kind === "local" ? styles.syncDiffLocalRow : null,
                        row.kind === "database" ? styles.syncDiffDatabaseRow : null,
                        row.kind === "changed" ? styles.syncDiffChangedRow : null,
                        { borderBottomColor: c.border },
                      ]}
                    >
                      <Text
                        style={[
                          styles.syncDiffCell,
                          row.kind === "local" ? styles.syncDiffLocalText : null,
                          row.kind === "changed" ? styles.syncDiffChangedText : null,
                          { color: row.localText ? undefined : c.textSoft },
                        ]}
                      >
                        {row.localText || " "}
                      </Text>
                      <Text
                        style={[
                          styles.syncDiffCell,
                          styles.syncDiffDatabaseCell,
                          row.kind === "database" ? styles.syncDiffDatabaseText : null,
                          row.kind === "changed" ? styles.syncDiffChangedText : null,
                          { color: row.databaseText ? undefined : c.textSoft, borderLeftColor: c.border },
                        ]}
                      >
                        {row.databaseText || " "}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.syncPromptTitle, { color: c.text }]}>Sync subscriptions?</Text>
              <Text style={[styles.syncPromptBody, { color: c.textMuted }]}>
                This device already has subscriptions. Choose how Paynest should combine local and cloud data.
              </Text>

              <Pressable
                onPress={() => setShowDiff(true)}
                style={[styles.syncPromptButton, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}
              >
                <Text style={[styles.syncPromptButtonText, { color: c.text }]}>See diff</Text>
                <Text style={[styles.syncPromptButtonMeta, { color: c.textMuted }]}>
                  {changedCount} subscription {changedCount === 1 ? "difference" : "differences"} found
                </Text>
              </Pressable>
            </>
          )}

          <View style={styles.syncPromptActions}>
            <Pressable
              onPress={() => onChoose("merge")}
              style={[styles.syncPromptPrimaryButton, { backgroundColor: c.primary }]}
            >
              <Text style={styles.syncPromptPrimaryText}>Merge</Text>
              <Text style={styles.syncPromptPrimaryMeta}>Keep subscriptions from both places</Text>
            </Pressable>

            <Pressable
              onPress={() => onChoose("cloud")}
              style={[styles.syncPromptButton, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}
            >
              <Text style={[styles.syncPromptButtonText, { color: c.text }]}>Use cloud</Text>
              <Text style={[styles.syncPromptButtonMeta, { color: c.textMuted }]}>
                Replace this device with cloud data
              </Text>
            </Pressable>

            <Pressable
              onPress={() => onChoose("local")}
              style={[styles.syncPromptButton, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}
            >
              <Text style={[styles.syncPromptDangerText, { color: "#DC2626" }]}>Upload local</Text>
              <Text style={[styles.syncPromptButtonMeta, { color: c.textMuted }]}>
                Replace cloud data with this device
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
