import { useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useColorScheme,
  View,
} from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

type Tab = "Dashboard" | "Subscriptions" | "Insights" | "Settings";
type Period = "Monthly" | "Yearly";

type Subscription = {
  id: number;
  name: string;
  category: string;
  price: number;
  period: Period;
  renewal: string;
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
};

const initialSubscriptions: Subscription[] = [
  { id: 1, name: "Netflix", category: "Streaming", price: 12.99, period: "Monthly", renewal: "Tomorrow", color: "#E50914", icon: "film" },
  { id: 2, name: "Spotify", category: "Music", price: 10.99, period: "Monthly", renewal: "In 4 days", color: "#1DB954", icon: "musical-notes" },
  { id: 3, name: "iCloud+", category: "Cloud", price: 2.99, period: "Monthly", renewal: "Jun 29", color: "#3B82F6", icon: "cloud" },
  { id: 4, name: "Strava", category: "Fitness", price: 59.99, period: "Yearly", renewal: "Jul 5", color: "#FC4C02", icon: "bicycle" },
];

const categories = ["Streaming", "Music", "Software", "Cloud", "Gaming", "Fitness", "Finance", "Utilities", "Education", "Other"];
const money = (value: number) => `€${value.toFixed(2)}`;

export default function App() {
  const scheme = useColorScheme();
  const dark = scheme === "dark";
  const c = dark ? darkColors : lightColors;
  const [tab, setTab] = useState<Tab>("Dashboard");
  const [subscriptions, setSubscriptions] = useState(initialSubscriptions);
  const [showAdd, setShowAdd] = useState(false);

  const monthly = useMemo(
    () => subscriptions.reduce((total, item) => total + (item.period === "Monthly" ? item.price : item.price / 12), 0),
    [subscriptions],
  );

  const addSubscription = (subscription: Omit<Subscription, "id" | "color" | "icon">) => {
    setSubscriptions((current) => [
      ...current,
      { ...subscription, id: Date.now(), color: "#2563EB", icon: "wallet" },
    ]);
    setShowAdd(false);
    setTab("Subscriptions");
  };

  return (
    <SafeAreaProvider>
      <SafeAreaView style={[styles.safe, { backgroundColor: c.background }]} edges={["top"]}>
        <StatusBar barStyle={dark ? "light-content" : "dark-content"} />
        <View style={styles.shell}>
          <View style={styles.content}>
            {tab === "Dashboard" && <Dashboard c={c} subscriptions={subscriptions} monthly={monthly} onAdd={() => setShowAdd(true)} onSeeAll={() => setTab("Subscriptions")} />}
            {tab === "Subscriptions" && <SubscriptionList c={c} subscriptions={subscriptions} onAdd={() => setShowAdd(true)} />}
            {tab === "Insights" && <Insights c={c} subscriptions={subscriptions} monthly={monthly} />}
            {tab === "Settings" && <Settings c={c} />}
          </View>
          <TabBar c={c} active={tab} onChange={setTab} />
        </View>
        <AddSubscription c={c} visible={showAdd} onClose={() => setShowAdd(false)} onSave={addSubscription} />
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Dashboard({ c, subscriptions, monthly, onAdd, onSeeAll }: { c: Colors; subscriptions: Subscription[]; monthly: number; onAdd: () => void; onSeeAll: () => void }) {
  return <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
    <View style={styles.topRow}><View><Text style={[styles.greeting, { color: c.textMuted }]}>Good morning</Text><Text style={[styles.title, { color: c.text }]}>Your payments</Text></View><Pressable onPress={onAdd} style={[styles.addCircle, { backgroundColor: c.primary }]}><Ionicons name="add" size={25} color="#fff" /></Pressable></View>
    <View style={[styles.totalCard, { backgroundColor: c.primary }]}><Text style={styles.totalEyebrow}>MONTHLY SPENDING</Text><Text style={styles.total}>{money(monthly)}</Text><View style={styles.totalFooter}><Text style={styles.totalSub}>Across {subscriptions.length} subscriptions</Text><Text style={styles.totalYearly}>{money(monthly * 12)} / year</Text></View></View>
    <SectionHeader c={c} title="Upcoming" action="See all" onPress={onSeeAll} />
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>{subscriptions.slice(0, 2).map((item, index) => <RenewalRow key={item.id} c={c} item={item} last={index === 1} />)}</View>
    <SectionHeader c={c} title="Recent subscriptions" action="Manage" onPress={onSeeAll} />
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>{subscriptions.slice(-3).reverse().map((item, index) => <SubscriptionRow key={item.id} c={c} item={item} last={index === 2 || index === subscriptions.length - 1} />)}</View>
    <View style={[styles.summary, { backgroundColor: c.primarySoft }]}><Ionicons name="shield-checkmark-outline" size={21} color={c.primary} /><Text style={[styles.summaryText, { color: c.text }]}>Your data stays private and under your control.</Text></View>
  </ScrollView>;
}

function SubscriptionList({ c, subscriptions, onAdd }: { c: Colors; subscriptions: Subscription[]; onAdd: () => void }) {
  return <View style={styles.flex}><ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}><View style={styles.topRow}><View><Text style={[styles.greeting, { color: c.textMuted }]}>All recurring payments</Text><Text style={[styles.title, { color: c.text }]}>Subscriptions</Text></View><Pressable onPress={onAdd} style={[styles.addCircle, { backgroundColor: c.primary }]}><Ionicons name="add" size={25} color="#fff" /></Pressable></View><View style={styles.chips}><Chip c={c} label="All" selected /><Chip c={c} label="Monthly" /><Chip c={c} label="Yearly" /></View><View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>{subscriptions.map((item, index) => <SubscriptionRow key={item.id} c={c} item={item} last={index === subscriptions.length - 1} />)}</View></ScrollView></View>;
}

function Insights({ c, subscriptions, monthly }: { c: Colors; subscriptions: Subscription[]; monthly: number }) {
  const max = Math.max(...subscriptions.map((item) => item.period === "Monthly" ? item.price : item.price / 12));
  return <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}><Text style={[styles.greeting, { color: c.textMuted }]}>Your spending patterns</Text><Text style={[styles.title, { color: c.text }]}>Insights</Text><View style={styles.metricGrid}><Metric c={c} label="Monthly" value={money(monthly)} /><Metric c={c} label="Yearly" value={money(monthly * 12)} /></View><Text style={[styles.sectionTitle, { color: c.text }]}>Monthly breakdown</Text><View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>{subscriptions.map((item) => { const value = item.period === "Monthly" ? item.price : item.price / 12; return <View key={item.id} style={styles.barRow}><View style={styles.barTitle}><Text style={[styles.barName, { color: c.text }]}>{item.name}</Text><Text style={[styles.barPrice, { color: c.textMuted }]}>{money(value)}</Text></View><View style={[styles.barTrack, { backgroundColor: c.surfaceMuted }]}><View style={[styles.barFill, { backgroundColor: item.color, width: `${Math.max((value / max) * 100, 8)}%` }]} /></View></View>; })}</View><Text style={[styles.sectionTitle, { color: c.text }]}>At a glance</Text><View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}><View style={styles.insightRow}><Ionicons name="calendar-outline" size={22} color={c.primary} /><View><Text style={[styles.insightTitle, { color: c.text }]}>2 renewals this week</Text><Text style={[styles.insightDetail, { color: c.textMuted }]}>Netflix and Spotify are coming up</Text></View></View></View></ScrollView>;
}

function Settings({ c }: { c: Colors }) { return <ScrollView contentContainerStyle={styles.screen}><Text style={[styles.greeting, { color: c.textMuted }]}>Account and preferences</Text><Text style={[styles.title, { color: c.text }]}>Settings</Text><Text style={[styles.settingsLabel, { color: c.textMuted }]}>PREFERENCES</Text><View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}><SettingRow c={c} icon="notifications-outline" label="Renewal reminders" value="3 days before" /><SettingRow c={c} icon="moon-outline" label="Appearance" value="System" last /></View><Text style={[styles.settingsLabel, { color: c.textMuted }]}>ACCOUNT</Text><View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}><SettingRow c={c} icon="cloud-outline" label="Sync" value="Not connected" /><SettingRow c={c} icon="lock-closed-outline" label="Privacy" value="Your data, your control" last /></View><Text style={[styles.version, { color: c.textSoft }]}>Paynest · Version 1.0.0</Text></ScrollView>; }

function SectionHeader({ c, title, action, onPress }: { c: Colors; title: string; action: string; onPress: () => void }) { return <View style={styles.sectionHeader}><Text style={[styles.sectionTitle, { color: c.text }]}>{title}</Text><Pressable onPress={onPress}><Text style={[styles.sectionAction, { color: c.primary }]}>{action}</Text></Pressable></View>; }
function RenewalRow({ c, item, last }: { c: Colors; item: Subscription; last: boolean }) { return <View style={[styles.renewalRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}><IconBadge item={item} /><View style={styles.rowText}><Text style={[styles.rowName, { color: c.text }]}>{item.name}</Text><Text style={[styles.rowMeta, { color: c.textMuted }]}>Renews {item.renewal.toLowerCase()}</Text></View><Text style={[styles.rowPrice, { color: c.text }]}>{money(item.price)}</Text></View>; }
function SubscriptionRow({ c, item, last }: { c: Colors; item: Subscription; last: boolean }) { return <View style={[styles.subscriptionRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}><IconBadge item={item} /><View style={styles.rowText}><Text style={[styles.rowName, { color: c.text }]}>{item.name}</Text><Text style={[styles.rowMeta, { color: c.textMuted }]}>{item.category} · {item.period}</Text></View><View style={styles.priceStack}><Text style={[styles.rowPrice, { color: c.text }]}>{money(item.price)}</Text><Text style={[styles.renewalStatus, { color: item.renewal === "Tomorrow" ? c.warning : c.textMuted }]}>Renews {item.renewal}</Text></View></View>; }
function IconBadge({ item }: { item: Subscription }) { return <View style={[styles.iconBadge, { backgroundColor: `${item.color}18` }]}><Ionicons name={item.icon} size={22} color={item.color} /></View>; }
function Chip({ c, label, selected = false }: { c: Colors; label: string; selected?: boolean }) { return <View style={[styles.chip, { backgroundColor: selected ? c.primarySoft : c.surfaceMuted }]}><Text style={[styles.chipText, { color: selected ? c.primary : c.textMuted }]}>{label}</Text></View>; }
function Metric({ c, label, value }: { c: Colors; label: string; value: string }) { return <View style={[styles.metric, { backgroundColor: c.surface, borderColor: c.border }]}><Text style={[styles.metricLabel, { color: c.textMuted }]}>{label}</Text><Text style={[styles.metricValue, { color: c.text }]}>{value}</Text></View>; }
function SettingRow({ c, icon, label, value, last = false }: { c: Colors; icon: keyof typeof Ionicons.glyphMap; label: string; value: string; last?: boolean }) { return <View style={[styles.settingRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}><Ionicons name={icon} size={21} color={c.primary} /><View style={styles.rowText}><Text style={[styles.rowName, { color: c.text }]}>{label}</Text><Text style={[styles.rowMeta, { color: c.textMuted }]}>{value}</Text></View><Ionicons name="chevron-forward" size={18} color={c.textSoft} /></View>; }

function TabBar({ c, active, onChange }: { c: Colors; active: Tab; onChange: (tab: Tab) => void }) { const tabs: { label: Tab; icon: keyof typeof Ionicons.glyphMap }[] = [{ label: "Dashboard", icon: "home-outline" }, { label: "Subscriptions", icon: "card-outline" }, { label: "Insights", icon: "pie-chart-outline" }, { label: "Settings", icon: "settings-outline" }]; return <View style={[styles.tabBar, { backgroundColor: c.surface, borderColor: c.border }]}>{tabs.map((item) => <Pressable key={item.label} onPress={() => onChange(item.label)} style={styles.tab}><Ionicons name={item.icon} size={22} color={active === item.label ? c.primary : c.textSoft} /><Text style={[styles.tabText, { color: active === item.label ? c.primary : c.textSoft }]}>{item.label}</Text></Pressable>)}</View>; }

function AddSubscription({ c, visible, onClose, onSave }: { c: Colors; visible: boolean; onClose: () => void; onSave: (item: Omit<Subscription, "id" | "color" | "icon">) => void }) { const [name, setName] = useState(""); const [price, setPrice] = useState(""); const [category, setCategory] = useState("Streaming"); const [period, setPeriod] = useState<Period>("Monthly"); const save = () => { const parsed = Number.parseFloat(price); if (!name.trim() || Number.isNaN(parsed) || parsed <= 0) return; onSave({ name: name.trim(), price: parsed, category, period, renewal: "In 30 days" }); setName(""); setPrice(""); };
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><SafeAreaView style={[styles.modal, { backgroundColor: c.background }]}><View style={styles.modalHeader}><Pressable onPress={onClose}><Text style={[styles.cancel, { color: c.primary }]}>Cancel</Text></Pressable><Text style={[styles.modalTitle, { color: c.text }]}>Add subscription</Text><View style={{ width: 48 }} /></View><ScrollView contentContainerStyle={styles.form}><Text style={[styles.formLabel, { color: c.textMuted }]}>BASIC INFO</Text><View style={[styles.inputGroup, { backgroundColor: c.surface, borderColor: c.border }]}><TextInput value={name} onChangeText={setName} placeholder="Subscription name" placeholderTextColor={c.textSoft} style={[styles.input, { color: c.text, borderBottomColor: c.border }]} autoFocus /><View style={styles.priceInput}><Text style={[styles.currency, { color: c.textMuted }]}>€</Text><TextInput value={price} onChangeText={setPrice} placeholder="0.00" placeholderTextColor={c.textSoft} style={[styles.input, { color: c.text }]} keyboardType={Platform.select({ ios: "decimal-pad", default: "numeric" })} /></View></View><Text style={[styles.formLabel, { color: c.textMuted }]}>BILLING PERIOD</Text><View style={styles.periods}><Pressable onPress={() => setPeriod("Monthly")} style={[styles.periodButton, { backgroundColor: period === "Monthly" ? c.primarySoft : c.surface, borderColor: period === "Monthly" ? c.primary : c.border }]}><Text style={{ color: period === "Monthly" ? c.primary : c.textMuted }}>Monthly</Text></Pressable><Pressable onPress={() => setPeriod("Yearly")} style={[styles.periodButton, { backgroundColor: period === "Yearly" ? c.primarySoft : c.surface, borderColor: period === "Yearly" ? c.primary : c.border }]}><Text style={{ color: period === "Yearly" ? c.primary : c.textMuted }}>Yearly</Text></Pressable></View><Text style={[styles.formLabel, { color: c.textMuted }]}>CATEGORY</Text><View style={styles.categoryGrid}>{categories.map((item) => <Pressable key={item} onPress={() => setCategory(item)} style={[styles.categoryChip, { backgroundColor: category === item ? c.primarySoft : c.surfaceMuted }]}><Text style={{ color: category === item ? c.primary : c.textMuted }}>{item}</Text></Pressable>)}</View></ScrollView><View style={[styles.saveArea, { borderTopColor: c.border, backgroundColor: c.background }]}><Pressable onPress={save} style={[styles.saveButton, { backgroundColor: c.primary, opacity: name && price ? 1 : 0.55 }]}><Text style={styles.saveText}>Add subscription</Text></Pressable></View></SafeAreaView></Modal>; }

type Colors = typeof lightColors;
const lightColors = { background: "#F7F8FA", surface: "#FFFFFF", surfaceMuted: "#F1F3F5", text: "#111827", textMuted: "#6B7280", textSoft: "#9CA3AF", border: "#E5E7EB", primary: "#2563EB", primarySoft: "#DBEAFE", warning: "#F59E0B" };
const darkColors: Colors = { background: "#0B0F14", surface: "#111827", surfaceMuted: "#1F2937", text: "#F9FAFB", textMuted: "#9CA3AF", textSoft: "#6B7280", border: "#273142", primary: "#60A5FA", primarySoft: "#1E3A5F", warning: "#FBBF24" };
const styles = StyleSheet.create({ safe: { flex: 1 }, shell: { flex: 1, alignSelf: "center", width: "100%", maxWidth: 680 }, content: { flex: 1 }, flex: { flex: 1 }, screen: { padding: 20, paddingBottom: 36, gap: 12 }, topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }, greeting: { fontSize: 14, fontWeight: "500", marginBottom: 3 }, title: { fontSize: 28, fontWeight: "700", letterSpacing: -0.5 }, addCircle: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center" }, totalCard: { borderRadius: 22, padding: 20, marginBottom: 8 }, totalEyebrow: { color: "#BFDBFE", fontSize: 12, fontWeight: "700", letterSpacing: 1 }, total: { color: "#fff", fontSize: 36, fontWeight: "700", letterSpacing: -1, marginTop: 8 }, totalFooter: { flexDirection: "row", justifyContent: "space-between", marginTop: 17, alignItems: "center" }, totalSub: { color: "#DBEAFE", fontSize: 13 }, totalYearly: { color: "#fff", fontSize: 13, fontWeight: "600" }, sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 13, marginBottom: 1 }, sectionTitle: { fontSize: 18, fontWeight: "700" }, sectionAction: { fontSize: 14, fontWeight: "600" }, card: { borderWidth: 1, borderRadius: 18, overflow: "hidden" }, renewalRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 }, subscriptionRow: { flexDirection: "row", alignItems: "center", padding: 14, gap: 12 }, iconBadge: { width: 44, height: 44, borderRadius: 13, alignItems: "center", justifyContent: "center" }, rowText: { flex: 1 }, rowName: { fontSize: 16, fontWeight: "600" }, rowMeta: { fontSize: 13, marginTop: 3 }, rowPrice: { fontSize: 15, fontWeight: "700", textAlign: "right" }, priceStack: { alignItems: "flex-end" }, renewalStatus: { fontSize: 12, marginTop: 4 }, summary: { flexDirection: "row", gap: 10, alignItems: "center", padding: 15, borderRadius: 16, marginTop: 8 }, summaryText: { fontSize: 13, flex: 1, lineHeight: 18 }, chips: { flexDirection: "row", gap: 8, marginBottom: 4 }, chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 }, chipText: { fontSize: 14, fontWeight: "600" }, metricGrid: { flexDirection: "row", gap: 12, marginTop: 12, marginBottom: 10 }, metric: { flex: 1, borderWidth: 1, borderRadius: 18, padding: 16 }, metricLabel: { fontSize: 13 }, metricValue: { fontSize: 21, fontWeight: "700", marginTop: 7 }, barRow: { padding: 15, gap: 9 }, barTitle: { flexDirection: "row", justifyContent: "space-between" }, barName: { fontSize: 15, fontWeight: "600" }, barPrice: { fontSize: 14 }, barTrack: { height: 7, borderRadius: 99, overflow: "hidden" }, barFill: { height: "100%", borderRadius: 99 }, insightRow: { flexDirection: "row", padding: 16, gap: 12, alignItems: "center" }, insightTitle: { fontSize: 15, fontWeight: "600" }, insightDetail: { fontSize: 13, marginTop: 3 }, settingsLabel: { marginTop: 12, marginBottom: -2, fontSize: 12, fontWeight: "700", letterSpacing: 0.8 }, settingRow: { flexDirection: "row", padding: 15, gap: 12, alignItems: "center" }, version: { textAlign: "center", marginTop: 16, fontSize: 12 }, tabBar: { flexDirection: "row", borderTopWidth: 1, paddingTop: 9, paddingBottom: Platform.select({ ios: 16, default: 10 }) }, tab: { flex: 1, alignItems: "center", gap: 4 }, tabText: { fontSize: 10, fontWeight: "600" }, modal: { flex: 1 }, modalHeader: { flexDirection: "row", padding: 20, alignItems: "center", justifyContent: "space-between" }, cancel: { fontSize: 16, fontWeight: "600" }, modalTitle: { fontSize: 17, fontWeight: "700" }, form: { padding: 20, gap: 12 }, formLabel: { fontSize: 12, fontWeight: "700", letterSpacing: 0.8, marginTop: 7 }, inputGroup: { borderRadius: 14, borderWidth: 1, overflow: "hidden" }, input: { fontSize: 16, padding: 15, minHeight: 50 }, priceInput: { flexDirection: "row", alignItems: "center" }, currency: { fontSize: 16, paddingLeft: 15 }, periods: { flexDirection: "row", gap: 10 }, periodButton: { flex: 1, padding: 14, alignItems: "center", borderRadius: 14, borderWidth: 1 }, categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, categoryChip: { paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999 }, saveArea: { padding: 16, borderTopWidth: 1 }, saveButton: { height: 50, borderRadius: 14, justifyContent: "center", alignItems: "center" }, saveText: { color: "#fff", fontSize: 16, fontWeight: "700" } });
