import "react-native-gesture-handler";

import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import type { FontSource } from "expo-font";
import { NavigationBar } from "expo-navigation-bar";
import { StatusBar } from "expo-status-bar";
import * as SystemUI from "expo-system-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { TabBar } from "./src/components/common";
import type { Tab } from "./src/constants";
import { convertToBaseCurrency, loadCurrencyRates } from "./src/currencyConversion";
import { requestNotificationPermission, scheduleRenewalNotifications } from "./src/notifications";
import { exportMasterKey, importMasterKey } from "./src/encryption";
import {
  forgetEncryptionPassword,
  forgetMasterKey,
  loadSavedEncryptionPassword,
  loadSavedMasterKey,
  saveEncryptionPassword,
  saveMasterKey,
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
  deleteEncryptedSubscriptionFromCloud,
  deletePlaintextCloudData,
  deleteSubscriptionFromCloud,
  loadCloudAppData,
  syncAppData,
  upsertEncryptedSettingsChange,
  upsertEncryptedSubscriptionChanges,
  upsertUserKey,
  upsertSettings,
  upsertSubscriptions,
  type CloudAppData,
  type CloudEncryptionSession,
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

type EncryptionOperationStatus = {
  visible: boolean;
  message: string;
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
  const [deleteLocalDataPromptVisible, setDeleteLocalDataPromptVisible] = useState(false);
  const [cloudEncryptionState, setCloudEncryptionState] = useState<CloudEncryptionState>("off");
  const [encryptionPassword, setEncryptionPassword] = useState<string | null>(null);
  const [encryptionOperationStatus, setEncryptionOperationStatus] = useState<EncryptionOperationStatus>({
    visible: false,
    message: "",
  });
  const [unlockPromptVisible, setUnlockPromptVisible] = useState(false);
  const [pendingSyncPrompt, setPendingSyncPrompt] = useState<{
    userId: string;
    cloudSubscriptions: Subscription[];
  } | null>(null);
  const [refreshingDashboard, setRefreshingDashboard] = useState(false);
  const [currencyRates, setCurrencyRates] = useState<Record<string, number>>({});
  const syncedUserId = useRef<string | null>(null);
  const loginPromptUserId = useRef<string | null>(null);
  const pendingSyncCloud = useRef<CloudAppData | null>(null);
  const pendingSyncPassword = useRef<string | null>(null);
  const savedEncryptionPassword = useRef<string | null>(null);
  const cloudEncryptionSession = useRef<CloudEncryptionSession | null>(null);
  const encryptionOperationId = useRef(0);
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
      pendingSyncPassword.current = null;
      setCloudEncryptionState("off");
      setEncryptionPassword(null);
      savedEncryptionPassword.current = null;
      cloudEncryptionSession.current = null;
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
    void initializeCloudSession(userId, session.token);
  }, [ready, session?.token, session?.user.id, pocketBase, pocketBaseConfig.url]);

  useEffect(() => {
    if (cloudEncryptionState !== "locked") setUnlockPromptVisible(false);
  }, [cloudEncryptionState]);

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

  async function importSubscriptions(importedSubscriptions: Subscription[]) {
    const importedById = new Map(importedSubscriptions.map((subscription) => [subscription.id, subscription]));
    const next = [
      ...subscriptions.filter((subscription) => !importedById.has(subscription.id)),
      ...importedSubscriptions,
    ];

    setSubscriptions(next);
    await saveSubscriptions(next);
    if (session?.user.id) {
      void syncSubscriptionsAfterChange(next, settings, importedSubscriptions).catch((error) => {
        console.warn("PocketBase subscription import sync failed", error);
      });
    }

    return importedSubscriptions.length;
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
      const encryptedSession = cloudEncryptionSession.current;
      if (!encryptedSession) return;
      await upsertEncryptedSubscriptionChanges(
        pocketBase,
        session.token,
        userId,
        encryptedSession,
        changedSubscriptions,
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
      const encryptedSession = cloudEncryptionSession.current;
      if (!encryptedSession) return;
      await deleteEncryptedSubscriptionFromCloud(
        pocketBase,
        session.token,
        userId,
        localId,
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
      const encryptedSession = cloudEncryptionSession.current;
      if (!encryptedSession) return;
      await upsertEncryptedSettingsChange(
        pocketBase,
        session.token,
        userId,
        encryptedSession,
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
    pendingSyncPassword.current = null;
    setPendingSyncPrompt(null);
    setCloudEncryptionState("off");
    setEncryptionPassword(null);
    cloudEncryptionSession.current = null;
    savedEncryptionPassword.current = null;
    void savePocketBaseConnection(next);
  }

  function completePocketBaseAuth(next: PocketBaseConnectionSettings, nextSession: PocketBaseSession) {
    setPocketBaseConnection(next);
    setSession(nextSession);
    setAuthReady(true);
    syncedUserId.current = null;
    loginPromptUserId.current = nextSession.user.id;
    pendingSyncCloud.current = null;
    pendingSyncPassword.current = null;
    setPendingSyncPrompt(null);
    setCloudEncryptionState("off");
    setEncryptionPassword(null);
    cloudEncryptionSession.current = null;
    savedEncryptionPassword.current = null;
    void savePocketBaseConnection(next);
  }

  function signOutPocketBase() {
    setSession(null);
    syncedUserId.current = null;
    loginPromptUserId.current = null;
    pendingSyncCloud.current = null;
    pendingSyncPassword.current = null;
    setPendingSyncPrompt(null);
    setCloudEncryptionState("off");
    setEncryptionPassword(null);
    cloudEncryptionSession.current = null;
    savedEncryptionPassword.current = null;
  }

  function useLocally() {
    setLocalMode(true);
    void saveLocalModePreference(true);
  }

  async function initializeCloudSession(userId: string, token: string) {
    try {
      const [masterKeyHex, savedPassword] = await Promise.all([
        loadSavedMasterKey(pocketBaseConfig.url, userId),
        loadSavedEncryptionPassword(pocketBaseConfig.url, userId),
      ]);
      savedEncryptionPassword.current = savedPassword;
      const cachedSession = restoreCachedSession(masterKeyHex);

      const cloud = await loadCloudAppData(
        pocketBase,
        token,
        userId,
        cachedSession ? { session: cachedSession } : undefined,
      );

      if (cloud.encrypted) {
        if (!cloud.locked && cloud.encryptionSession) {
          await applyUnlockedCloud(userId, cloud);
          return;
        }

        setCloudEncryptionState("locked");
        setEncryptionPassword(null);
        cloudEncryptionSession.current = null;
        promptForEncryptionUnlock();
        return;
      }

      setCloudEncryptionState("off");
      setEncryptionPassword(null);
      cloudEncryptionSession.current = null;
      const canAskForChoice = loginPromptUserId.current === userId;
      const needsChoice = canAskForChoice
        && subscriptions.length > 0
        && cloud.subscriptions.length > 0
        && !subscriptionListsMatch(subscriptions, cloud.subscriptions);
      if (!needsChoice) {
        void syncUserData(userId, canAskForChoice ? "merge" : "cloud", cloud);
        return;
      }

      pendingSyncCloud.current = cloud;
      pendingSyncPassword.current = null;
      setPendingSyncPrompt({ userId, cloudSubscriptions: cloud.subscriptions });
    } catch (error) {
      if (savedEncryptionFailed(error)) {
        // A cached master key that no longer matches the cloud data. Drop it and
        // fall back to the locked flow so a saved password can recover the session.
        await forgetMasterKey(pocketBaseConfig.url, userId).catch(() => undefined);
        setCloudEncryptionState("locked");
        setEncryptionPassword(null);
        cloudEncryptionSession.current = null;
        promptForEncryptionUnlock();
        return;
      }
      syncedUserId.current = null;
      console.warn("PocketBase sync failed", error);
    }
  }

  function promptForEncryptionUnlock() {
    // Try a remembered password silently first; if that fails (or none is saved),
    // surface the unlock prompt so the user can enter the encryption password.
    if (savedEncryptionPassword.current) {
      void unlockCloudEncryption(savedEncryptionPassword.current, true).catch((error) => {
        savedEncryptionPassword.current = null;
        setUnlockPromptVisible(true);
        console.warn("PocketBase encrypted background unlock failed", error);
      });
      return;
    }
    setUnlockPromptVisible(true);
  }

  async function applyUnlockedCloud(userId: string, cloud: CloudAppData) {
    const session = cloud.encryptionSession;
    cloudEncryptionSession.current = session;
    setEncryptionPassword(savedEncryptionPassword.current);
    setCloudEncryptionState("unlocked");
    if (session) void persistMasterKey(userId, session.masterKey);

    const canAskForChoice = loginPromptUserId.current === userId;
    const needsChoice = canAskForChoice
      && subscriptions.length > 0
      && cloud.subscriptions.length > 0
      && !subscriptionListsMatch(subscriptions, cloud.subscriptions);
    if (needsChoice) {
      pendingSyncCloud.current = cloud;
      pendingSyncPassword.current = savedEncryptionPassword.current;
      setPendingSyncPrompt({ userId, cloudSubscriptions: cloud.subscriptions });
      return;
    }

    await syncUserData(
      userId,
      canAskForChoice ? "merge" : "cloud",
      cloud,
      savedEncryptionPassword.current,
    );
  }

  function restoreCachedSession(masterKeyHex: string | null): CloudEncryptionSession | null {
    if (!masterKeyHex) return null;
    try {
      return { masterKey: importMasterKey(masterKeyHex) };
    } catch (error) {
      console.warn("Cached master key is unusable", error);
      return null;
    }
  }

  async function persistMasterKey(userId: string, masterKey: Uint8Array) {
    try {
      await saveMasterKey(pocketBaseConfig.url, userId, exportMasterKey(masterKey));
    } catch (error) {
      console.warn("Caching master key failed", error);
    }
  }

  async function rememberEncryptionPassword(userId: string, password: string, remember: boolean) {
    if (remember) {
      const saved = await saveEncryptionPassword(pocketBaseConfig.url, userId, password);
      if (!saved) throw new Error("This device cannot securely remember the encryption password.");
      savedEncryptionPassword.current = password;
      return;
    }
    await forgetEncryptionPassword(pocketBaseConfig.url, userId);
    savedEncryptionPassword.current = null;
  }

  async function rememberMasterKey(
    userId: string,
    encryptionSession: CloudEncryptionSession | null | undefined,
    remember: boolean,
  ) {
    if (remember && encryptionSession) {
      await persistMasterKey(userId, encryptionSession.masterKey);
      return;
    }
    await forgetMasterKey(pocketBaseConfig.url, userId).catch((error) => {
      console.warn("Forgetting cached master key failed", error);
    });
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
      {
        enabled: encrypted,
        password,
        session: cloudEncryptionSession.current ?? initialCloud?.encryptionSession,
      },
    );
    syncedUserId.current = userId;
    if (loginPromptUserId.current === userId) loginPromptUserId.current = null;
    if (encrypted) {
      cloudEncryptionSession.current = synced.encryptionSession
        ?? initialCloud?.encryptionSession
        ?? cloudEncryptionSession.current;
      setCloudEncryptionState("unlocked");
    }
    setSubscriptions(synced.subscriptions);
    setSettings(synced.settings);
    await Promise.all([
      saveSubscriptions(synced.subscriptions),
      saveSettings(synced.settings),
    ]);
  }

  async function runInitialSync(
    userId: string,
    strategy: SyncStrategy,
    initialCloud?: CloudAppData,
    passwordOverride?: string | null,
  ) {
    setPendingSyncPrompt(null);
    try {
      await syncUserData(userId, strategy, initialCloud, passwordOverride);
      pendingSyncCloud.current = null;
      pendingSyncPassword.current = null;
    } catch (error) {
      pendingSyncCloud.current = null;
      pendingSyncPassword.current = null;
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

  function showEncryptionOperation(message: string) {
    encryptionOperationId.current += 1;
    const operationId = encryptionOperationId.current;
    setEncryptionOperationStatus({ visible: true, message });
    return operationId;
  }

  function hideEncryptionOperation(operationId?: number) {
    if (operationId && encryptionOperationId.current !== operationId) return;
    setEncryptionOperationStatus({ visible: false, message: "" });
  }

  // Wraps the slow, password-based operations (key derivation runs PBKDF2 and
  // briefly blocks the JS thread) so a native spinner stays visible. The fast
  // cached-key launch path does not use this and stays silent.
  async function withEncryptionOverlay<T>(message: string, run: () => Promise<T>) {
    const operationId = showEncryptionOperation(message);
    await new Promise((resolve) => setTimeout(resolve, 50));
    try {
      return await run();
    } finally {
      hideEncryptionOperation(operationId);
    }
  }

  async function enableCloudEncryption(password: string, rememberPassword: boolean) {
    const userId = session?.user.id;
    if (!session || !userId) throw new Error("Log in to enable encryption.");
    const token = session.token;
    const normalizedPassword = password.trim();
    if (normalizedPassword.length < 8) throw new Error("Use an encryption password with at least 8 characters.");

    await withEncryptionOverlay("Encrypting cloud data", async () => {
      await rememberEncryptionPassword(userId, normalizedPassword, rememberPassword);
      const cloud = await loadCloudAppData(pocketBase, token, userId, normalizedPassword);
      const synced = await syncAppData(
        pocketBase,
        token,
        userId,
        subscriptions,
        settings,
        "merge",
        cloud,
        { enabled: true, password: normalizedPassword },
      );
      const encryptedSession = synced.encryptionSession ?? cloud.encryptionSession;
      setEncryptionPassword(normalizedPassword);
      cloudEncryptionSession.current = encryptedSession;
      setCloudEncryptionState("unlocked");
      setSubscriptions(synced.subscriptions);
      setSettings(synced.settings);
      await Promise.all([
        saveSubscriptions(synced.subscriptions),
        saveSettings(synced.settings),
      ]);
      await rememberMasterKey(userId, encryptedSession, rememberPassword);
    });
  }

  async function unlockCloudEncryption(password: string, rememberPassword: boolean) {
    const userId = session?.user.id;
    if (!session || !userId) throw new Error("Log in to unlock encrypted data.");
    const token = session.token;
    const normalizedPassword = password.trim();

    await withEncryptionOverlay("Decrypting cloud data", async () => {
      const cloud = await loadCloudAppData(pocketBase, token, userId, {
        password: normalizedPassword,
      });
      if (!cloud.encrypted || cloud.locked) throw new Error("Could not unlock encrypted cloud data.");
      await rememberEncryptionPassword(userId, normalizedPassword, rememberPassword);
      setEncryptionPassword(normalizedPassword);
      cloudEncryptionSession.current = cloud.encryptionSession;
      setCloudEncryptionState("unlocked");
      await rememberMasterKey(userId, cloud.encryptionSession, rememberPassword);

      const canAskForChoice = loginPromptUserId.current === userId;
      const needsChoice = canAskForChoice
        && subscriptions.length > 0
        && cloud.subscriptions.length > 0
        && !subscriptionListsMatch(subscriptions, cloud.subscriptions);
      if (needsChoice) {
        pendingSyncCloud.current = cloud;
        pendingSyncPassword.current = normalizedPassword;
        setPendingSyncPrompt({ userId, cloudSubscriptions: cloud.subscriptions });
        return;
      }

      await syncUserData(userId, canAskForChoice ? "merge" : "cloud", cloud, normalizedPassword);
    });
  }

  async function forgetCloudEncryptionPassword() {
    const userId = session?.user.id;
    if (!userId) return;
    await Promise.all([
      forgetEncryptionPassword(pocketBaseConfig.url, userId),
      forgetMasterKey(pocketBaseConfig.url, userId),
    ]);
    savedEncryptionPassword.current = null;
    setEncryptionPassword(null);
    cloudEncryptionSession.current = null;
    if (cloudEncryptionState !== "off") {
      setCloudEncryptionState("locked");
      setUnlockPromptVisible(true);
    }
  }

  async function changeCloudEncryptionPassword(
    currentPassword: string,
    nextPassword: string,
    rememberPassword: boolean,
  ) {
    const userId = session?.user.id;
    if (!session || !userId) throw new Error("Log in to change the encryption password.");
    const token = session.token;
    const normalizedCurrent = currentPassword.trim();
    const normalizedNext = nextPassword.trim();
    if (normalizedNext.length < 8) throw new Error("Use an encryption password with at least 8 characters.");

    await withEncryptionOverlay("Updating encryption password", async () => {
      const cloud = await loadCloudAppData(pocketBase, token, userId, {
        password: normalizedCurrent,
      });
      const encryptedSession = cloudEncryptionSession.current ?? cloud.encryptionSession;
      if (!encryptedSession) throw new Error("Unlock encrypted data before changing the encryption password.");
      await rememberEncryptionPassword(userId, normalizedNext, rememberPassword);
      await upsertUserKey(pocketBase, token, userId, normalizedNext, encryptedSession.masterKey);
      cloudEncryptionSession.current = encryptedSession;
      setEncryptionPassword(normalizedNext);
      setCloudEncryptionState("unlocked");
      await rememberMasterKey(userId, encryptedSession, rememberPassword);
    });
  }

  async function disableCloudEncryption() {
    const userId = session?.user.id;
    if (!session || !userId) throw new Error("Log in to disable encryption.");
    const encryptedSession = cloudEncryptionSession.current;
    if (cloudEncryptionState !== "unlocked" || !encryptedSession) {
      throw new Error("Unlock encrypted data before disabling encryption.");
    }

    await deletePlaintextCloudData(pocketBase, session.token, userId);
    await Promise.all([
      upsertSubscriptions(pocketBase, session.token, userId, subscriptions),
      upsertSettings(pocketBase, session.token, userId, settings),
    ]);
    await deleteEncryptedCloudData(pocketBase, session.token, userId);
    await Promise.all([
      forgetEncryptionPassword(pocketBaseConfig.url, userId),
      forgetMasterKey(pocketBaseConfig.url, userId),
    ]);
    savedEncryptionPassword.current = null;
    setEncryptionPassword(null);
    cloudEncryptionSession.current = null;
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
    setDeleteLocalDataPromptVisible(true);
  }

  function deleteLocalData() {
    setDeleteLocalDataPromptVisible(false);
    setSubscriptions([]);
    setSettings(defaultSettings);
    void clearAppData();
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
                  subscriptions={subscriptions}
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
                  onImportSubscriptions={importSubscriptions}
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
                pendingSyncPassword.current,
              );
            }}
          />
          <DeleteLocalDataPrompt
            c={c}
            visible={deleteLocalDataPromptVisible}
            onCancel={() => setDeleteLocalDataPromptVisible(false)}
            onDelete={deleteLocalData}
          />
          <UnlockEncryptionPrompt
            c={c}
            visible={unlockPromptVisible}
            onUnlock={unlockCloudEncryption}
            onDismiss={() => setUnlockPromptVisible(false)}
          />
          <EncryptionOperationOverlay c={c} status={encryptionOperationStatus} />
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function savedEncryptionFailed(error: unknown) {
  return error instanceof Error && /decrypt|encrypted|password|corrupted/i.test(error.message);
}

function EncryptionOperationOverlay({
  c,
  status,
}: {
  c: Colors;
  status: EncryptionOperationStatus;
}) {
  return (
    <Modal visible={status.visible} transparent animationType="fade">
      <View style={styles.encryptionModalOverlay}>
        <View style={[styles.encryptionStatusPanel, { backgroundColor: c.surface, borderColor: c.border }]}>
          <ActivityIndicator size="large" color={c.primary} />
          <Text style={[styles.encryptionStatusTitle, { color: c.text }]}>{status.message}</Text>
          <Text style={[styles.encryptionStatusText, { color: c.textMuted }]}>
            Keep Paynest open while this finishes.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function UnlockEncryptionPrompt({
  c,
  visible,
  onUnlock,
  onDismiss,
}: {
  c: Colors;
  visible: boolean;
  onUnlock: (password: string, rememberPassword: boolean) => Promise<void>;
  onDismiss: () => void;
}) {
  const [password, setPassword] = useState("");
  const [rememberPassword, setRememberPassword] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!visible) {
      setPassword("");
      setRememberPassword(true);
      setBusy(false);
      setMessage("");
    }
  }, [visible]);

  async function submit() {
    if (busy) return;
    const trimmed = password.trim();
    if (trimmed.length === 0) {
      setMessage("Enter your encryption password.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await onUnlock(trimmed, rememberPassword);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not unlock encrypted data.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.syncPromptOverlay}>
        <View style={[styles.syncPromptPanel, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.syncPromptHeaderRow}>
            <View style={[styles.syncPromptIconButton, { backgroundColor: c.primarySoft }]}>
              <Ionicons name="lock-closed-outline" size={20} color={c.primary} />
            </View>
            <Text style={[styles.syncPromptTitle, styles.syncPromptHeaderTitle, { color: c.text }]}>
              Unlock encrypted data
            </Text>
          </View>
          <Text style={[styles.syncPromptBody, { color: c.textMuted }]}>
            Enter your encryption password to decrypt your synced subscriptions and settings on this device.
          </Text>
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder="Encryption password"
            placeholderTextColor={c.textSoft}
            secureTextEntry
            autoCapitalize="none"
            onSubmitEditing={() => void submit()}
            style={[styles.encryptionInput, styles.inputNoOutline, { color: c.text, borderColor: c.border }]}
          />
          <View style={[styles.encryptionRememberRow, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}>
            <View style={styles.rowText}>
              <Text style={[styles.rowName, { color: c.text }]}>Remember on this device</Text>
              <Text style={[styles.rowMeta, { color: c.textMuted }]}>
                Turn off to require the password after restarting or signing in again.
              </Text>
            </View>
            <Switch value={rememberPassword} onValueChange={setRememberPassword} />
          </View>
          {message ? <Text style={[styles.syncPromptBody, { color: "#DC2626" }]}>{message}</Text> : null}
          <View style={styles.syncPromptActions}>
            <Pressable
              disabled={busy}
              onPress={onDismiss}
              style={[styles.syncPromptButton, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}
            >
              <View style={styles.syncPromptButtonContent}>
                <Text style={[styles.syncPromptButtonText, { color: c.text }]}>Not now</Text>
              </View>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => void submit()}
              style={[styles.syncPromptButton, { backgroundColor: c.primary, borderColor: c.primary }]}
            >
              <View style={styles.syncPromptButtonContent}>
                {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
                <Text style={[styles.syncPromptButtonText, { color: "#FFFFFF" }]}>
                  {busy ? "Unlocking" : "Unlock"}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function DeleteLocalDataPrompt({
  c,
  visible,
  onCancel,
  onDelete,
}: {
  c: Colors;
  visible: boolean;
  onCancel: () => void;
  onDelete: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.syncPromptOverlay}>
        <View style={[styles.syncPromptPanel, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.syncPromptHeaderRow}>
            <View style={[styles.syncPromptIconButton, { backgroundColor: "#FEE2E2" }]}>
              <Ionicons name="trash-outline" size={20} color="#DC2626" />
            </View>
            <Text style={[styles.syncPromptTitle, styles.syncPromptHeaderTitle, { color: c.text }]}>
              Delete local data?
            </Text>
          </View>
          <Text style={[styles.syncPromptBody, { color: c.textMuted }]}>
            This removes subscriptions and resets preferences stored on this device.
          </Text>
          <View style={styles.syncPromptActions}>
            <Pressable
              onPress={onCancel}
              style={[styles.syncPromptButton, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}
            >
              <Text style={[styles.syncPromptButtonText, { color: c.text }]}>Cancel</Text>
              <Text style={[styles.syncPromptButtonMeta, { color: c.textMuted }]}>
                Keep local subscriptions and settings
              </Text>
            </Pressable>
            <Pressable
              onPress={onDelete}
              style={[styles.syncPromptButton, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}
            >
              <Text style={[styles.syncPromptDangerText, { color: "#DC2626" }]}>Delete local data</Text>
              <Text style={[styles.syncPromptButtonMeta, { color: "#991B1B" }]}>
                Remove the local copy on this device
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
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
