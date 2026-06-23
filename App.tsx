import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { clearAppData, loadAppData, saveSettings, saveSubscriptions } from "./src/storage";
import { supabaseConfig } from "./src/supabase";
import { defaultSettings, type BillingPeriod, type Settings, type Subscription } from "./src/types";

type Tab = "Dashboard" | "Subscriptions" | "Insights" | "Settings";
type Colors = typeof lightColors;

const categories = ["Streaming", "Music", "Software", "Cloud", "Gaming", "Fitness", "Finance", "Utilities", "Education", "Other"];
const symbols: Record<string, string> = { EUR: "€", USD: "$", GBP: "£" };
const formatMoney = (value: number, currency: string) => `${symbols[currency] ?? currency} ${value.toFixed(2)}`;
const monthlyCost = (item: Subscription) => item.billingPeriod === "Monthly" ? item.price : item.price / 12;

function dayDifference(date: string) {
  const target = new Date(`${date}T00:00:00`).getTime();
  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  return Math.round((target - todayStart) / 86_400_000);
}

function renewalLabel(date: string) {
  const days = dayDifference(date);
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days > 1 && days < 31) return `in ${days} days`;
  return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function iconFor(category: string): keyof typeof Ionicons.glyphMap {
  return ({ Streaming: "film", Music: "musical-notes", Software: "code-slash", Cloud: "cloud", Gaming: "game-controller", Fitness: "fitness", Finance: "wallet", Utilities: "flash", Education: "school", Other: "ellipse" }[category] ?? "ellipse") as keyof typeof Ionicons.glyphMap;
}

function colorFor(category: string) {
  return ({ Streaming: "#E50914", Music: "#1DB954", Software: "#8B5CF6", Cloud: "#3B82F6", Gaming: "#F97316", Fitness: "#16A34A", Finance: "#0891B2", Utilities: "#EAB308", Education: "#6366F1", Other: "#64748B" }[category] ?? "#64748B");
}

export default function App() {
  const deviceTheme = useColorScheme();
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [ready, setReady] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    loadAppData().then(({ subscriptions: loadedSubscriptions, settings: loadedSettings }) => {
      setSubscriptions(loadedSubscriptions);
      setSettings(loadedSettings);
      setReady(true);
    }).catch(() => setReady(true));
  }, []);

  const dark = settings.theme === "dark" || (settings.theme === "system" && deviceTheme === "dark");
  const c = dark ? darkColors : lightColors;
  const monthly = useMemo(() => subscriptions.reduce((total, item) => total + monthlyCost(item), 0), [subscriptions]);
  const upcoming = useMemo(() => [...subscriptions].sort((a, b) => dayDifference(a.nextRenewalDate) - dayDifference(b.nextRenewalDate)), [subscriptions]);

  async function addSubscription(input: Omit<Subscription, "id" | "createdAt" | "updatedAt">) {
    const now = new Date().toISOString();
    const next = [...subscriptions, { ...input, id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, createdAt: now, updatedAt: now }];
    setSubscriptions(next);
    await saveSubscriptions(next);
    setShowAdd(false);
    setTab("Subscriptions");
  }

  function removeSubscription(item: Subscription) {
    Alert.alert("Remove subscription?", `${item.name} will be removed from your local payment list.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => {
        const next = subscriptions.filter((subscription) => subscription.id !== item.id);
        setSubscriptions(next);
        void saveSubscriptions(next);
      } },
    ]);
  }

  function updateSettings(next: Settings) {
    setSettings(next);
    void saveSettings(next);
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

  if (!ready) return <SafeAreaProvider><SafeAreaView style={[styles.loading, { backgroundColor: c.background }]}><ActivityIndicator size="large" color={c.primary} /><Text style={[styles.loadingText, { color: c.textMuted }]}>Loading Paynest</Text></SafeAreaView></SafeAreaProvider>;

  return <SafeAreaProvider><SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top"]}>
    <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
    <View style={styles.shell}><View style={styles.content}>
      {tab === "Dashboard" && <Dashboard c={c} subscriptions={subscriptions} upcoming={upcoming} monthly={monthly} currency={settings.currency} onAdd={() => setShowAdd(true)} onSeeAll={() => setTab("Subscriptions")} />}
      {tab === "Subscriptions" && <SubscriptionList c={c} subscriptions={subscriptions} onAdd={() => setShowAdd(true)} onRemove={removeSubscription} />}
      {tab === "Insights" && <Insights c={c} subscriptions={subscriptions} monthly={monthly} currency={settings.currency} />}
      {tab === "Settings" && <SettingsScreen c={c} settings={settings} onUpdate={updateSettings} onReset={resetData} />}
    </View><TabBar c={c} active={tab} onChange={setTab} /></View>
    <AddSubscription c={c} visible={showAdd} defaultCurrency={settings.currency} onClose={() => setShowAdd(false)} onSave={addSubscription} />
  </SafeAreaView></SafeAreaProvider>;
}

function Dashboard({ c, subscriptions, upcoming, monthly, currency, onAdd, onSeeAll }: { c: Colors; subscriptions: Subscription[]; upcoming: Subscription[]; monthly: number; currency: string; onAdd: () => void; onSeeAll: () => void }) {
  return <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}><Header c={c} eyebrow="Your recurring payments" title="Dashboard" onAdd={onAdd} />
    <View style={[styles.totalCard, { backgroundColor: c.primary }]}><Text style={styles.totalEyebrow}>MONTHLY SPENDING</Text><Text style={styles.total}>{formatMoney(monthly, currency)}</Text><View style={styles.totalFooter}><Text style={styles.totalSub}>Across {subscriptions.length} subscriptions</Text><Text style={styles.totalYearly}>{formatMoney(monthly * 12, currency)} / year</Text></View></View>
    {subscriptions.length === 0 ? <EmptyState c={c} onAdd={onAdd} /> : <><SectionHeader c={c} title="Upcoming" action="See all" onPress={onSeeAll} /><View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>{upcoming.slice(0, 3).map((item, index) => <RenewalRow key={item.id} c={c} item={item} last={index === Math.min(upcoming.length, 3) - 1} />)}</View><SectionHeader c={c} title="Recent subscriptions" action="Manage" onPress={onSeeAll} /><View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>{subscriptions.slice(-3).reverse().map((item, index) => <SubscriptionRow key={item.id} c={c} item={item} last={index === Math.min(subscriptions.length, 3) - 1} />)}</View></>}
    <View style={[styles.summary, { backgroundColor: c.primarySoft }]}><Ionicons name="phone-portrait-outline" size={21} color={c.primary} /><Text style={[styles.summaryText, { color: c.text }]}>Subscriptions and preferences are stored locally on this device.</Text></View>
  </ScrollView>;
}

function SubscriptionList({ c, subscriptions, onAdd, onRemove }: { c: Colors; subscriptions: Subscription[]; onAdd: () => void; onRemove: (item: Subscription) => void }) {
  const [filter, setFilter] = useState<"All" | BillingPeriod>("All");
  const visible = filter === "All" ? subscriptions : subscriptions.filter((item) => item.billingPeriod === filter);
  return <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}><Header c={c} eyebrow="All recurring payments" title="Subscriptions" onAdd={onAdd} /><View style={styles.chips}>{(["All", "Monthly", "Yearly"] as const).map((item) => <Chip key={item} c={c} label={item} selected={filter === item} onPress={() => setFilter(item)} />)}</View>{visible.length === 0 ? <EmptyState c={c} onAdd={onAdd} compact /> : <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>{visible.map((item, index) => <SubscriptionRow key={item.id} c={c} item={item} last={index === visible.length - 1} onRemove={() => onRemove(item)} />)}</View>}</ScrollView>;
}

function Insights({ c, subscriptions, monthly, currency }: { c: Colors; subscriptions: Subscription[]; monthly: number; currency: string }) {
  const max = Math.max(1, ...subscriptions.map(monthlyCost));
  const thisMonth = subscriptions.filter((item) => dayDifference(item.nextRenewalDate) >= 0 && dayDifference(item.nextRenewalDate) < 31).length;
  return <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}><Text style={[styles.greeting, { color: c.textMuted }]}>Your spending patterns</Text><Text style={[styles.title, { color: c.text }]}>Insights</Text><View style={styles.metricGrid}><Metric c={c} label="Monthly" value={formatMoney(monthly, currency)} /><Metric c={c} label="Yearly" value={formatMoney(monthly * 12, currency)} /></View>{subscriptions.length === 0 ? <EmptyState c={c} /> : <><Text style={[styles.sectionTitle, { color: c.text }]}>Monthly breakdown</Text><View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>{subscriptions.map((item) => <View key={item.id} style={styles.barRow}><View style={styles.barTitle}><Text style={[styles.barName, { color: c.text }]}>{item.name}</Text><Text style={[styles.barPrice, { color: c.textMuted }]}>{formatMoney(monthlyCost(item), item.currency)}</Text></View><View style={[styles.barTrack, { backgroundColor: c.surfaceMuted }]}><View style={[styles.barFill, { backgroundColor: colorFor(item.category), width: `${Math.max((monthlyCost(item) / max) * 100, 8)}%` }]} /></View></View>)}</View><Text style={[styles.sectionTitle, { color: c.text }]}>At a glance</Text><View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}><View style={styles.insightRow}><Ionicons name="calendar-outline" size={22} color={c.primary} /><View><Text style={[styles.insightTitle, { color: c.text }]}>{thisMonth} renewal{thisMonth === 1 ? "" : "s"} in the next 30 days</Text><Text style={[styles.insightDetail, { color: c.textMuted }]}>Keep an eye on upcoming payment dates.</Text></View></View></View></>}</ScrollView>;
}

function SettingsScreen({ c, settings, onUpdate, onReset }: { c: Colors; settings: Settings; onUpdate: (settings: Settings) => void; onReset: () => void }) {
  const syncStatus = supabaseConfig.isConfigured ? "Ready for Supabase sync" : "Add anon key to enable sync";
  return <ScrollView contentContainerStyle={styles.screen}><Text style={[styles.greeting, { color: c.textMuted }]}>Saved on this device</Text><Text style={[styles.title, { color: c.text }]}>Settings</Text>
    <Text style={[styles.settingsLabel, { color: c.textMuted }]}>REMINDERS</Text><View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}><View style={styles.settingRow}><Ionicons name="notifications-outline" size={21} color={c.primary} /><View style={styles.rowText}><Text style={[styles.rowName, { color: c.text }]}>Renewal reminders</Text><Text style={[styles.rowMeta, { color: c.textMuted }]}>Show reminders before a renewal</Text></View><Switch value={settings.remindersEnabled} onValueChange={(remindersEnabled) => onUpdate({ ...settings, remindersEnabled })} trackColor={{ false: c.surfaceMuted, true: c.primary }} /></View>{settings.remindersEnabled && <View style={[styles.settingOption, { borderTopColor: c.border }]}><Text style={[styles.rowMeta, { color: c.textMuted }]}>Remind me</Text><View style={styles.chips}>{[0, 1, 3, 7].map((days) => <Chip key={days} c={c} label={days === 0 ? "Same day" : `${days} day${days > 1 ? "s" : ""}`} selected={settings.reminderDays === days} onPress={() => onUpdate({ ...settings, reminderDays: days })} />)}</View></View>}</View>
    <Text style={[styles.settingsLabel, { color: c.textMuted }]}>APPEARANCE</Text><View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}><View style={styles.settingOption}><Text style={[styles.rowName, { color: c.text }]}>Theme</Text><View style={styles.chips}>{(["system", "light", "dark"] as const).map((theme) => <Chip key={theme} c={c} label={theme[0].toUpperCase() + theme.slice(1)} selected={settings.theme === theme} onPress={() => onUpdate({ ...settings, theme })} />)}</View></View><View style={[styles.settingOption, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}><Text style={[styles.rowName, { color: c.text }]}>Default currency</Text><View style={styles.chips}>{["EUR", "USD", "GBP"].map((currency) => <Chip key={currency} c={c} label={currency} selected={settings.currency === currency} onPress={() => onUpdate({ ...settings, currency })} />)}</View></View></View>
    <Text style={[styles.settingsLabel, { color: c.textMuted }]}>SYNC</Text><View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}><View style={styles.settingRow}><Ionicons name="cloud-outline" size={21} color={c.primary} /><View style={styles.rowText}><Text style={[styles.rowName, { color: c.text }]}>Cloud sync</Text><Text style={[styles.rowMeta, { color: c.textMuted }]}>{syncStatus}</Text><Text style={[styles.rowMeta, { color: c.textSoft }]} numberOfLines={1}>{supabaseConfig.url}</Text></View><Text style={[styles.comingSoon, { color: c.textSoft }]}>Soon</Text></View></View>
    <Text style={[styles.settingsLabel, { color: c.textMuted }]}>DATA</Text><Pressable onPress={onReset} style={[styles.dangerRow, { backgroundColor: c.surface, borderColor: c.border }]}><Ionicons name="trash-outline" size={20} color="#DC2626" /><Text style={styles.dangerText}>Delete local data</Text></Pressable><Text style={[styles.version, { color: c.textSoft }]}>Paynest · Version 1.0.0</Text></ScrollView>;
}

function Header({ c, eyebrow, title, onAdd }: { c: Colors; eyebrow: string; title: string; onAdd: () => void }) { return <View style={styles.topRow}><View><Text style={[styles.greeting, { color: c.textMuted }]}>{eyebrow}</Text><Text style={[styles.title, { color: c.text }]}>{title}</Text></View><Pressable accessibilityLabel="Add subscription" onPress={onAdd} style={[styles.addCircle, { backgroundColor: c.primary }]}><Ionicons name="add" size={25} color="#fff" /></Pressable></View>; }
function EmptyState({ c, onAdd, compact = false }: { c: Colors; onAdd?: () => void; compact?: boolean }) { return <View style={[styles.empty, { backgroundColor: c.surface, borderColor: c.border, marginTop: compact ? 0 : 8 }]}><Ionicons name="card-outline" size={34} color={c.primary} /><Text style={[styles.emptyTitle, { color: c.text }]}>No subscriptions yet</Text><Text style={[styles.emptyText, { color: c.textMuted }]}>Add your first subscription to track spending and renewals.</Text>{onAdd && <Pressable onPress={onAdd} style={[styles.emptyButton, { backgroundColor: c.primary }]}><Text style={styles.emptyButtonText}>Add subscription</Text></Pressable>}</View>; }
function SectionHeader({ c, title, action, onPress }: { c: Colors; title: string; action: string; onPress: () => void }) { return <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: c.text }]}>{title}</Text><Pressable onPress={onPress}><Text style={[styles.sectionAction, { color: c.primary }]}>{action}</Text></Pressable></View>; }
function RenewalRow({ c, item, last }: { c: Colors; item: Subscription; last: boolean }) { return <View style={[styles.renewalRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}><IconBadge item={item} /><View style={styles.rowText}><Text style={[styles.rowName, { color: c.text }]}>{item.name}</Text><Text style={[styles.rowMeta, { color: c.textMuted }]}>Renews {renewalLabel(item.nextRenewalDate)}</Text></View><Text style={[styles.rowPrice, { color: c.text }]}>{formatMoney(item.price, item.currency)}</Text></View>; }
function SubscriptionRow({ c, item, last, onRemove }: { c: Colors; item: Subscription; last: boolean; onRemove?: () => void }) { return <View style={[styles.subscriptionRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}><IconBadge item={item} /><View style={styles.rowText}><Text style={[styles.rowName, { color: c.text }]}>{item.name}</Text><Text style={[styles.rowMeta, { color: c.textMuted }]}>{item.category} · {item.billingPeriod}</Text></View><View style={styles.priceStack}><Text style={[styles.rowPrice, { color: c.text }]}>{formatMoney(item.price, item.currency)}</Text><Text style={[styles.renewalStatus, { color: dayDifference(item.nextRenewalDate) <= 3 ? c.warning : c.textMuted }]}>Renews {renewalLabel(item.nextRenewalDate)}</Text></View>{onRemove && <Pressable accessibilityLabel={`Remove ${item.name}`} hitSlop={8} onPress={onRemove} style={styles.removeButton}><Ionicons name="trash-outline" size={19} color="#DC2626" /></Pressable>}</View>; }
function IconBadge({ item }: { item: Subscription }) { const color = colorFor(item.category); return <View style={[styles.iconBadge, { backgroundColor: `${color}18` }]}><Ionicons name={iconFor(item.category)} size={22} color={color} /></View>; }
function Chip({ c, label, selected = false, onPress }: { c: Colors; label: string; selected?: boolean; onPress?: () => void }) { return <Pressable onPress={onPress} style={[styles.chip, { backgroundColor: selected ? c.primarySoft : c.surfaceMuted }]}><Text style={[styles.chipText, { color: selected ? c.primary : c.textMuted }]}>{label}</Text></Pressable>; }
function Metric({ c, label, value }: { c: Colors; label: string; value: string }) { return <View style={[styles.metric, { backgroundColor: c.surface, borderColor: c.border }]}><Text style={[styles.metricLabel, { color: c.textMuted }]}>{label}</Text><Text style={[styles.metricValue, { color: c.text }]}>{value}</Text></View>; }
function TabBar({ c, active, onChange }: { c: Colors; active: Tab; onChange: (tab: Tab) => void }) { const tabs: { label: Tab; icon: keyof typeof Ionicons.glyphMap }[] = [{ label: "Dashboard", icon: "home-outline" }, { label: "Subscriptions", icon: "card-outline" }, { label: "Insights", icon: "pie-chart-outline" }, { label: "Settings", icon: "settings-outline" }]; return <View style={[styles.tabBar, { backgroundColor: c.surface, borderColor: c.border }]}>{tabs.map((item) => <Pressable key={item.label} onPress={() => onChange(item.label)} style={styles.tab}><Ionicons name={item.icon} size={22} color={active === item.label ? c.primary : c.textSoft} /><Text style={[styles.tabText, { color: active === item.label ? c.primary : c.textSoft }]}>{item.label}</Text></Pressable>)}</View>; }

function AddSubscription({ c, visible, defaultCurrency, onClose, onSave }: { c: Colors; visible: boolean; defaultCurrency: string; onClose: () => void; onSave: (item: Omit<Subscription, "id" | "createdAt" | "updatedAt">) => void }) {
  const [name, setName] = useState(""); const [price, setPrice] = useState(""); const [category, setCategory] = useState("Streaming"); const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("Monthly"); const [renewal, setRenewal] = useState(""); const [error, setError] = useState("");
  const save = () => { const parsed = Number.parseFloat(price.replace(",", ".")); if (!name.trim() || Number.isNaN(parsed) || parsed <= 0) return setError("Enter a subscription name and a price greater than zero."); if (!/^\d{4}-\d{2}-\d{2}$/.test(renewal) || Number.isNaN(new Date(`${renewal}T00:00:00`).getTime())) return setError("Enter the next renewal as YYYY-MM-DD."); onSave({ name: name.trim(), price: parsed, category, billingPeriod, currency: defaultCurrency, nextRenewalDate: renewal }); setName(""); setPrice(""); setRenewal(""); setError(""); };
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><SafeAreaView style={[styles.modal, { backgroundColor: c.background }]}><View style={styles.modalHeader}><Pressable onPress={onClose}><Text style={[styles.cancel, { color: c.primary }]}>Cancel</Text></Pressable><Text style={[styles.modalTitle, { color: c.text }]}>Add subscription</Text><View style={{ width: 48 }} /></View><ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled"><Text style={[styles.formLabel, { color: c.textMuted }]}>BASIC INFO</Text><View style={[styles.inputGroup, { backgroundColor: c.surface, borderColor: c.border }]}><TextInput value={name} onChangeText={setName} placeholder="Subscription name" placeholderTextColor={c.textSoft} style={[styles.input, { color: c.text, borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]} autoFocus /><View style={styles.priceInput}><Text style={[styles.currency, { color: c.textMuted }]}>{symbols[defaultCurrency] ?? defaultCurrency}</Text><TextInput value={price} onChangeText={setPrice} placeholder="Price" placeholderTextColor={c.textSoft} style={[styles.input, { color: c.text }]} keyboardType={Platform.select({ ios: "decimal-pad", default: "numeric" })} /></View></View><Text style={[styles.formLabel, { color: c.textMuted }]}>BILLING</Text><View style={styles.periods}>{(["Monthly", "Yearly"] as const).map((period) => <Pressable key={period} onPress={() => setBillingPeriod(period)} style={[styles.periodButton, { backgroundColor: billingPeriod === period ? c.primarySoft : c.surface, borderColor: billingPeriod === period ? c.primary : c.border }]}><Text style={{ color: billingPeriod === period ? c.primary : c.textMuted }}>{period}</Text></Pressable>)}</View><View style={[styles.inputGroup, { backgroundColor: c.surface, borderColor: c.border }]}><TextInput value={renewal} onChangeText={setRenewal} placeholder="Next renewal (YYYY-MM-DD)" placeholderTextColor={c.textSoft} style={[styles.input, { color: c.text }]} autoCapitalize="none" /></View><Text style={[styles.formLabel, { color: c.textMuted }]}>CATEGORY</Text><View style={styles.categoryGrid}>{categories.map((item) => <Chip key={item} c={c} label={item} selected={category === item} onPress={() => setCategory(item)} />)}</View>{error ? <Text style={styles.errorText}>{error}</Text> : null}</ScrollView><View style={[styles.saveArea, { borderTopColor: c.border, backgroundColor: c.background }]}><Pressable onPress={save} style={[styles.saveButton, { backgroundColor: c.primary }]}><Text style={styles.saveText}>Add subscription</Text></Pressable></View></SafeAreaView></Modal>;
}

const lightColors = { background: "#F7F8FA", surface: "#FFFFFF", surfaceMuted: "#F1F3F5", text: "#111827", textMuted: "#6B7280", textSoft: "#9CA3AF", border: "#E5E7EB", primary: "#2563EB", primarySoft: "#DBEAFE", warning: "#F59E0B" };
const darkColors: Colors = { background: "#0B0F14", surface: "#111827", surfaceMuted: "#1F2937", text: "#F9FAFB", textMuted: "#9CA3AF", textSoft: "#6B7280", border: "#273142", primary: "#60A5FA", primarySoft: "#1E3A5F", warning: "#FBBF24" };
const styles = StyleSheet.create({ safe: { flex: 1 }, loading: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }, loadingText: { fontSize: 14 }, shell: { flex: 1, alignSelf: "center", width: "100%", maxWidth: 680 }, content: { flex: 1 }, screen: { padding: 20, paddingBottom: 36, gap: 12 }, topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }, greeting: { fontSize: 14, fontWeight: "500", marginBottom: 3 }, title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 }, addCircle: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" }, totalCard: { borderRadius: 22, padding: 20, marginBottom: 8 }, totalEyebrow: { color: "#BFDBFE", fontSize: 12, fontWeight: "700", letterSpacing: 1 }, total: { color: "#fff", fontSize: 36, fontWeight: "700", letterSpacing: -1, marginTop: 8 }, totalFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 17, alignItems: "center" }, totalSub: { color: "#DBEAFE", fontSize: 13 }, totalYearly: { color: "#fff", fontSize: 13, fontWeight: "600" }, sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 13, marginBottom: 1 }, sectionTitle: { fontSize: 18, fontWeight: "700" }, sectionAction: { fontSize: 14, fontWeight: "600" }, card: { borderWidth: 1, borderRadius: 18, overflow: "hidden" }, renewalRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 }, subscriptionRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 }, iconBadge: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" }, rowText: { flex: 1 }, rowName: { fontSize: 16, fontWeight: "600" }, rowMeta: { fontSize: 13, marginTop: 3 }, rowPrice: { fontSize: 15, fontWeight: "700", textAlign: "right" }, priceStack: { alignItems: "flex-end" }, renewalStatus: { fontSize: 12, marginTop: 4 }, removeButton: { marginLeft: 3, padding: 4 }, summary: { flexDirection: "row", gap: 10, alignItems: "center", padding: 15, borderRadius: 16, marginTop: 8 }, summaryText: { fontSize: 13, flex: 1, lineHeight: 18 }, chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 }, chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 }, chipText: { fontSize: 14, fontWeight: "600" }, empty: { alignItems: "center", padding: 28, borderWidth: 1, borderRadius: 18 }, emptyTitle: { fontSize: 17, fontWeight: "700", marginTop: 12 }, emptyText: { textAlign: "center", fontSize: 14, lineHeight: 20, marginTop: 6 }, emptyButton: { marginTop: 18, paddingHorizontal: 16, height: 42, justifyContent: "center", borderRadius: 12 }, emptyButtonText: { color: "#fff", fontWeight: "700" }, metricGrid: { flexDirection: "row", gap: 12, marginTop: 12, marginBottom: 10 }, metric: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 16 }, metricLabel: { fontSize: 13 }, metricValue: { fontSize: 21, fontWeight: "700", marginTop: 7 }, barRow: { padding: 15, gap: 9 }, barTitle: { flexDirection: "row", justifyContent: "space-between" }, barName: { fontSize: 15, fontWeight: "600" }, barPrice: { fontSize: 14 }, barTrack: { height: 7, borderRadius: 99, overflow: "hidden" }, barFill: { height: "100%", borderRadius: 99 }, insightRow: { flexDirection: "row", padding: 16, gap: 12, alignItems: "center" }, insightTitle: { fontSize: 15, fontWeight: "600" }, insightDetail: { fontSize: 13, marginTop: 3 }, settingsLabel: { marginTop: 12, marginBottom: -2, fontSize: 12, fontWeight: "700", letterSpacing: 0.8 }, settingRow: { flexDirection: "row", padding: 15, gap: 12, alignItems: "center" }, settingOption: { padding: 15, gap: 12 }, comingSoon: { fontSize: 12, fontWeight: "600" }, dangerRow: { flexDirection: "row", gap: 12, padding: 16, borderRadius: 18, borderWidth: 1, alignItems: "center" }, dangerText: { color: "#DC2626", fontSize: 16, fontWeight: "600" }, version: { textAlign: "center", marginTop: 16, fontSize: 12 }, tabBar: { flexDirection: "row", borderTopWidth: 1, paddingTop: 9, paddingBottom: Platform.select({ ios: 16, default: 10 }) }, tab: { flex: 1, alignItems: "center", gap: 4 }, tabText: { fontSize: 10, fontWeight: "600" }, modal: { flex: 1 }, modalHeader: { flexDirection: "row", padding: 20, alignItems: "center", justifyContent: "space-between" }, cancel: { fontSize: 16, fontWeight: "600" }, modalTitle: { fontSize: 17, fontWeight: "700" }, form: { padding: 20, gap: 12 }, formLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8, marginTop: 7 }, inputGroup: { borderRadius: 14, borderWidth: 1, overflow: "hidden" }, input: { fontSize: 16, padding: 15, minHeight: 50 }, priceInput: { flexDirection: "row", alignItems: "center" }, currency: { fontSize: 16, paddingLeft: 15 }, periods: { flexDirection: "row", gap: 10 }, periodButton: { flex: 1, padding: 14, alignItems: "center", borderRadius: 14, borderWidth: 1 }, categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, errorText: { color: "#DC2626", fontSize: 13 }, saveArea: { padding: 16, borderTopWidth: 1 }, saveButton: { height: 50, borderRadius: 14, justifyContent: "center", alignItems: "center" }, saveText: { color: "#fff", fontSize: 16, fontWeight: "700" } });
