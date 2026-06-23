import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, StatusBar, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import type { Session } from "@supabase/supabase-js";

import { TabBar } from "./src/components/common";
import type { Tab } from "./src/constants";
import { AddSubscription } from "./src/screens/AddSubscription";
import { Dashboard } from "./src/screens/Dashboard";
import { Insights } from "./src/screens/Insights";
import { SettingsScreen } from "./src/screens/SettingsScreen";
import { SubscriptionList } from "./src/screens/SubscriptionList";
import { clearAppData, loadAppData, saveSettings, saveSubscriptions } from "./src/storage";
import {
  deleteSubscriptionFromCloud,
  loadCloudAppData,
  syncAppData,
  upsertSettings,
  upsertSubscriptions,
  type SyncStrategy,
} from "./src/sync";
import { styles } from "./src/styles";
import { supabase } from "./src/supabase";
import { darkColors, lightColors } from "./src/theme";
import { defaultSettings, type Settings, type Subscription } from "./src/types";
import {
  dayDifference,
  monthlyCost,
  nextMonthlyPayday,
  nextMonthStart,
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
    iconName: item.iconName ?? null,
    iconLabel: item.iconLabel ?? null,
    iconColor: item.iconColor ?? null,
    backgroundColor: item.backgroundColor ?? null,
    iconBackgroundColor: item.iconBackgroundColor ?? null,
    simpleIconSlug: item.simpleIconSlug ?? null,
    iconProvider: item.iconProvider ?? null,
    iconUrl: item.iconUrl ?? null,
    iconSourceTitle: item.iconSourceTitle ?? null,
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
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const syncedUserId = useRef<string | null>(null);
  const loginPromptUserId = useRef<string | null>(null);

  useEffect(() => {
    loadAppData().then(({ subscriptions: loadedSubscriptions, settings: loadedSettings }) => {
      setSubscriptions(loadedSubscriptions);
      setSettings(loadedSettings);
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!supabase) return;
    void supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (event === "SIGNED_IN" && nextSession?.user.id) {
        loginPromptUserId.current = nextSession.user.id;
      }
      setSession(nextSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    if (!ready || !userId) {
      if (!userId) syncedUserId.current = null;
      return;
    }
    if (syncedUserId.current === userId) return;

    syncedUserId.current = userId;
    loadCloudAppData(userId).then((cloud) => {
      const canAskForChoice = loginPromptUserId.current === userId;
      const needsChoice = canAskForChoice
        && subscriptions.length > 0
        && cloud.subscriptions.length > 0
        && !subscriptionListsMatch(subscriptions, cloud.subscriptions);
      if (!needsChoice) {
        void syncUserData(userId, "merge");
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
      console.warn("Supabase sync failed", error);
    });
  }, [ready, session?.user.id]);

  const dark = settings.theme === "dark";
  const c = dark ? darkColors : lightColors;
  const monthly = useMemo(
    () => subscriptions.reduce((total, item) => total + monthlyCost(item), 0),
    [subscriptions],
  );
  const upcoming = useMemo(
    () => subscriptions
      .filter((item) => dayDifference(item.nextRenewalDate) >= 0)
      .sort((a, b) => dayDifference(a.nextRenewalDate) - dayDifference(b.nextRenewalDate)),
    [subscriptions],
  );
  const spendingBoundary = useMemo(
    () => settings.paydayEnabled ? nextMonthlyPayday(settings.payday) : nextMonthStart(),
    [settings.payday, settings.paydayEnabled],
  );
  const spendingUntilBoundary = useMemo(
    () => spendUntil(subscriptions, spendingBoundary, settings.paydayEnabled),
    [spendingBoundary, settings.paydayEnabled, subscriptions],
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
      void upsertSubscriptions(session.user.id, [subscription]).catch((error) => {
        console.warn("Supabase subscription sync failed", error);
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
      void deleteSubscriptionFromCloud(session.user.id, item.id).catch((error) => {
        console.warn("Supabase delete failed", error);
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
      void upsertSubscriptions(session.user.id, [updated]).catch((error) => {
        console.warn("Supabase subscription sync failed", error);
      });
    }
  }

  function updateSettings(next: Settings) {
    setSettings(next);
    void saveSettings(next);
    if (session?.user.id) {
      void upsertSettings(session.user.id, next).catch((error) => {
        console.warn("Supabase settings sync failed", error);
      });
    }
  }

  async function syncUserData(userId: string, strategy: SyncStrategy) {
    const synced = await syncAppData(userId, subscriptions, settings, strategy);
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
      console.warn("Supabase sync failed", error);
    }
  }

  async function forceSync() {
    const userId = session?.user.id;
    if (!userId) throw new Error("Log in to sync your data.");

    await syncUserData(userId, "merge");
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

  if (!ready) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.loading, { backgroundColor: c.background }]}>
          <ActivityIndicator size="large" color={c.primary} />
          <Text style={[styles.loadingText, { color: c.textMuted }]}>Loading Paynest</Text>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top"]}>
        <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
        <View style={styles.shell}>
          <View style={styles.content}>
            {tab === "Dashboard" && (
              <Dashboard
                c={c}
                subscriptions={subscriptions}
                upcoming={upcoming}
                monthly={monthly}
                spendingUntilBoundary={spendingUntilBoundary}
                spendingBoundary={spendingBoundary}
                paydayEnabled={settings.paydayEnabled}
                currency={settings.currency}
                onAdd={() => setShowAdd(true)}
                onSeeAll={() => setTab("Subscriptions")}
              />
            )}
            {tab === "Subscriptions" && (
              <SubscriptionList
                c={c}
                subscriptions={subscriptions}
                onAdd={() => setShowAdd(true)}
                onUpdate={updateSubscription}
                onRemove={removeSubscription}
              />
            )}
            {tab === "Insights" && (
              <Insights
                c={c}
                subscriptions={subscriptions}
                monthly={monthly}
                currency={settings.currency}
              />
            )}
            {tab === "Settings" && (
              <SettingsScreen
                c={c}
                settings={settings}
                session={session}
                onUpdate={updateSettings}
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
          onClose={() => setShowAdd(false)}
          onSave={addSubscription}
        />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
