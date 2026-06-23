import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, StatusBar, Text, useColorScheme, View } from "react-native";
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
import { deleteSubscriptionFromCloud, syncAppData, upsertSettings, upsertSubscriptions } from "./src/sync";
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

export default function App() {
  const deviceTheme = useColorScheme();
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const syncedUserId = useRef<string | null>(null);

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
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
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
    syncAppData(userId, subscriptions, settings).then(({ subscriptions: syncedSubscriptions, settings: syncedSettings }) => {
      setSubscriptions(syncedSubscriptions);
      setSettings(syncedSettings);
      void saveSubscriptions(syncedSubscriptions);
      void saveSettings(syncedSettings);
    }).catch((error) => {
      syncedUserId.current = null;
      console.warn("Supabase sync failed", error);
    });
  }, [ready, session?.user.id]);

  const dark = settings.theme === "dark" || (settings.theme === "system" && deviceTheme === "dark");
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

  function updateSettings(next: Settings) {
    setSettings(next);
    void saveSettings(next);
    if (session?.user.id) {
      void upsertSettings(session.user.id, next).catch((error) => {
        console.warn("Supabase settings sync failed", error);
      });
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
