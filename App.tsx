import "react-native-gesture-handler";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, Modal, Platform, Pressable, StatusBar, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { TabBar } from "./src/components/common";
import type { Tab } from "./src/constants";
import { convertToBaseCurrency, loadCurrencyRates } from "./src/currencyConversion";
import { requestNotificationPermission, scheduleRenewalNotifications } from "./src/notifications";
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
  deleteSubscriptionFromCloud,
  loadCloudAppData,
  syncAppData,
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
  const [pendingSyncPrompt, setPendingSyncPrompt] = useState<{ userId: string } | null>(null);
  const [refreshingDashboard, setRefreshingDashboard] = useState(false);
  const [currencyRates, setCurrencyRates] = useState<Record<string, number>>({});
  const syncedUserId = useRef<string | null>(null);
  const loginPromptUserId = useRef<string | null>(null);
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
    const userId = session?.user.id;
    if (!ready || !userId) {
      if (!userId) syncedUserId.current = null;
      return;
    }
    if (syncedUserId.current === userId) return;

    syncedUserId.current = userId;
    loadCloudAppData(pocketBase, session.token, userId).then((cloud) => {
      const canAskForChoice = loginPromptUserId.current === userId;
      const needsChoice = canAskForChoice
        && subscriptions.length > 0
        && cloud.subscriptions.length > 0
        && !subscriptionListsMatch(subscriptions, cloud.subscriptions);
      if (!needsChoice) {
        void syncUserData(userId, canAskForChoice ? "merge" : "cloud", cloud);
        return;
      }

      setPendingSyncPrompt({ userId });
    }).catch((error) => {
      syncedUserId.current = null;
      console.warn("PocketBase sync failed", error);
    });
  }, [ready, session?.token, session?.user.id, pocketBase]);

  const dark = settings.theme === "dark";
  const c = dark ? darkColors : lightColors;
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
    () => activeSubscriptions.reduce<Record<string, number | null>>((amounts, item) => {
      amounts[item.id] = convertSubscriptionAmount(item.price, item.currency, settings.currency, currencyRates);
      return amounts;
    }, {}),
    [activeSubscriptions, currencyRates, settings.currency],
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
      void upsertSubscriptions(pocketBase, session.token, session.user.id, [subscription]).catch((error) => {
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
      return next;
    });
    if (session?.user.id) {
      void deleteSubscriptionFromCloud(pocketBase, session.token, session.user.id, item.id).catch((error) => {
        console.warn("PocketBase delete failed", error);
      });
    }
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
      return next;
    });
    if (session?.user.id) {
      void upsertSubscriptions(pocketBase, session.token, session.user.id, [updated]).catch((error) => {
        console.warn("PocketBase subscription sync failed", error);
      });
    }
  }

  function updateSettings(next: Settings) {
    const shouldSyncSettings = settings.remindersEnabled !== next.remindersEnabled
      || settings.reminderDays !== next.reminderDays
      || settings.currency !== next.currency
      || JSON.stringify(settings.enabledCurrencies) !== JSON.stringify(next.enabledCurrencies)
      || settings.convertToPrimaryCurrency !== next.convertToPrimaryCurrency
      || settings.showOriginalCurrency !== next.showOriginalCurrency
      || settings.paydayEnabled !== next.paydayEnabled
      || settings.payday !== next.payday
      || JSON.stringify(settings.colorPresets) !== JSON.stringify(next.colorPresets);

    setSettings(next);
    void saveSettings(next);
    if (session?.user.id && shouldSyncSettings) {
      void upsertSettings(pocketBase, session.token, session.user.id, next).catch((error) => {
        console.warn("PocketBase settings sync failed", error);
      });
    }
  }

  function updatePocketBaseConnection(next: PocketBaseConnectionSettings) {
    setPocketBaseConnection(next);
    setSession(null);
    syncedUserId.current = null;
    loginPromptUserId.current = null;
    setPendingSyncPrompt(null);
    void savePocketBaseConnection(next);
  }

  function completePocketBaseAuth(next: PocketBaseConnectionSettings, nextSession: PocketBaseSession) {
    setPocketBaseConnection(next);
    setSession(nextSession);
    setAuthReady(true);
    syncedUserId.current = null;
    loginPromptUserId.current = nextSession.user.id;
    setPendingSyncPrompt(null);
    void savePocketBaseConnection(next);
  }

  function signOutPocketBase() {
    setSession(null);
    syncedUserId.current = null;
    loginPromptUserId.current = null;
    setPendingSyncPrompt(null);
  }

  function useLocally() {
    setLocalMode(true);
    void saveLocalModePreference(true);
  }

  async function syncUserData(userId: string, strategy: SyncStrategy, initialCloud?: CloudAppData) {
    if (!session) throw new Error("Log in to sync your data.");

    const synced = await syncAppData(
      pocketBase,
      session.token,
      userId,
      subscriptions,
      settings,
      strategy,
      initialCloud,
    );
    syncedUserId.current = userId;
    if (loginPromptUserId.current === userId) loginPromptUserId.current = null;
    setSubscriptions(synced.subscriptions);
    setSettings(synced.settings);
    await Promise.all([
      saveSubscriptions(synced.subscriptions),
      saveSettings(synced.settings),
    ]);
  }

  async function runInitialSync(userId: string, strategy: SyncStrategy) {
    setPendingSyncPrompt(null);
    try {
      await syncUserData(userId, strategy);
    } catch (error) {
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

  if (!ready || !authReady) {
    return (
      <GestureHandlerRootView style={styles.safe}>
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
        <SafeAreaProvider>
          <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top"]}>
            <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
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
        <SafeAreaProvider>
          <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]}>
            <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
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
      <SafeAreaProvider>
        <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top"]}>
          <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
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
                  onUpdate={updateSettings}
                  onUpdatePocketBaseConnection={updatePocketBaseConnection}
                  onAuthSuccess={completePocketBaseAuth}
                  onSignOut={signOutPocketBase}
                  onForceSync={forceSync}
                  onReset={resetData}
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
            onChoose={(strategy) => {
              if (!pendingSyncPrompt) return;
              void runInitialSync(pendingSyncPrompt.userId, strategy);
            }}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function SyncChoicePrompt({
  c,
  visible,
  onChoose,
}: {
  c: Colors;
  visible: boolean;
  onChoose: (strategy: SyncStrategy) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.syncPromptOverlay}>
        <View style={[styles.syncPromptPanel, { backgroundColor: c.surface, borderColor: c.border }]}>
          <Text style={[styles.syncPromptTitle, { color: c.text }]}>Sync subscriptions?</Text>
          <Text style={[styles.syncPromptBody, { color: c.textMuted }]}>
            This device already has subscriptions. Choose how Paynest should combine local and cloud data.
          </Text>

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
