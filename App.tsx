import "react-native-gesture-handler";

import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, StatusBar, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { TabBar } from "./src/components/common";
import type { Tab } from "./src/constants";
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
import { defaultSettings, type Settings, type Subscription } from "./src/types";
import {
  billableSubscriptions,
  dayDifference,
  monthlyTotal,
  nextRenewalDate,
  nextMonthlyPayday,
  nextMonthStart,
  pausedMonthlySavings,
  spendUntil,
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
  const [refreshingDashboard, setRefreshingDashboard] = useState(false);
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

    scheduleRenewalNotifications(subscriptions).catch((error) => {
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

      Alert.alert(
        "Sync subscriptions?",
        [
          "This device already has subscriptions.",
          "",
          "Merge: keep subscriptions from both places.",
          "Use cloud: replace this device with your cloud data.",
          "Upload local: replace cloud data with this device.",
        ].join("\n"),
        [
          {
            text: "Merge",
            onPress: () => void runInitialSync(userId, "merge"),
          },
          {
            text: "Use cloud",
            onPress: () => void runInitialSync(userId, "cloud"),
          },
          {
            text: "Upload local",
            style: "destructive",
            onPress: () => void runInitialSync(userId, "local"),
          },
        ],
        { cancelable: false },
      );
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
  const monthly = useMemo(
    () => monthlyTotal(activeSubscriptions),
    [activeSubscriptions],
  );
  const savedMonthly = useMemo(
    () => pausedMonthlySavings(subscriptions),
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
  const spendingUntilBoundary = useMemo(
    () => spendUntil(activeSubscriptions, spendingBoundary, settings.paydayEnabled),
    [activeSubscriptions, spendingBoundary, settings.paydayEnabled],
  );

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
    void savePocketBaseConnection(next);
  }

  function completePocketBaseAuth(next: PocketBaseConnectionSettings, nextSession: PocketBaseSession) {
    setPocketBaseConnection(next);
    setSession(nextSession);
    setAuthReady(true);
    syncedUserId.current = null;
    loginPromptUserId.current = nextSession.user.id;
    void savePocketBaseConnection(next);
  }

  function signOutPocketBase() {
    setSession(null);
    syncedUserId.current = null;
    loginPromptUserId.current = null;
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
                  monthly={monthly}
                  spendingUntilBoundary={spendingUntilBoundary}
                  spendingBoundary={spendingBoundary}
                  paydayEnabled={settings.paydayEnabled}
                  currency={settings.currency}
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
                  monthly={monthly}
                  savedMonthly={savedMonthly}
                  currency={settings.currency}
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
            colorPresets={settings.colorPresets}
            onClose={() => setShowAdd(false)}
            onSave={addSubscription}
            onRequestNotificationPermission={requestNotificationPermission}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
