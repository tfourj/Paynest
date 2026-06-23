import { ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { EmptyState, Metric } from "../components/common";
import { styles } from "../styles";
import type { Colors } from "../theme";
import type { Subscription } from "../types";
import { colorFor } from "../utils/category";
import { dayDifference, formatMoney, monthlyCost } from "../utils/subscriptions";

export function Insights({ c, subscriptions, monthly, currency }: { c: Colors; subscriptions: Subscription[]; monthly: number; currency: string }) {
  const max = Math.max(1, ...subscriptions.map(monthlyCost));
  const thisMonth = subscriptions.filter((item) => dayDifference(item.nextRenewalDate) >= 0 && dayDifference(item.nextRenewalDate) < 31).length;

  return <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}><Text style={[styles.greeting, { color: c.textMuted }]}>Your spending patterns</Text><Text style={[styles.title, { color: c.text }]}>Insights</Text><View style={styles.metricGrid}><Metric c={c} label="Monthly" value={formatMoney(monthly, currency)} /><Metric c={c} label="Yearly" value={formatMoney(monthly * 12, currency)} /></View>{subscriptions.length === 0 ? <EmptyState c={c} /> : <><Text style={[styles.sectionTitle, { color: c.text }]}>Monthly breakdown</Text><View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>{subscriptions.map((item) => <View key={item.id} style={styles.barRow}><View style={styles.barTitle}><Text style={[styles.barName, { color: c.text }]}>{item.name}</Text><Text style={[styles.barPrice, { color: c.textMuted }]}>{formatMoney(monthlyCost(item), item.currency)}</Text></View><View style={[styles.barTrack, { backgroundColor: c.surfaceMuted }]}><View style={[styles.barFill, { backgroundColor: colorFor(item.category), width: `${Math.max((monthlyCost(item) / max) * 100, 8)}%` }]} /></View></View>)}</View><Text style={[styles.sectionTitle, { color: c.text }]}>At a glance</Text><View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}><View style={styles.insightRow}><Ionicons name="calendar-outline" size={22} color={c.primary} /><View><Text style={[styles.insightTitle, { color: c.text }]}>{thisMonth} renewal{thisMonth === 1 ? "" : "s"} in the next 30 days</Text><Text style={[styles.insightDetail, { color: c.textMuted }]}>Keep an eye on upcoming payment dates.</Text></View></View></View></>}</ScrollView>;
}
