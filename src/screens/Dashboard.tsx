import { ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { EmptyState, Header, SectionHeader } from "../components/common";
import { RenewalRow, SubscriptionRow } from "../components/subscriptionRows";
import { styles } from "../styles";
import type { Colors } from "../theme";
import type { Subscription } from "../types";
import { formatMoney } from "../utils/subscriptions";

export function Dashboard({ c, subscriptions, upcoming, monthly, currency, onAdd, onSeeAll }: { c: Colors; subscriptions: Subscription[]; upcoming: Subscription[]; monthly: number; currency: string; onAdd: () => void; onSeeAll: () => void }) {
  return <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}><Header c={c} eyebrow="Your recurring payments" title="Dashboard" onAdd={onAdd} />
    <View style={[styles.totalCard, { backgroundColor: c.primary }]}><Text style={styles.totalEyebrow}>MONTHLY SPENDING</Text><Text style={styles.total}>{formatMoney(monthly, currency)}</Text><View style={styles.totalFooter}><Text style={styles.totalSub}>Across {subscriptions.length} subscriptions</Text><Text style={styles.totalYearly}>{formatMoney(monthly * 12, currency)} / year</Text></View></View>
    {subscriptions.length === 0 ? <EmptyState c={c} onAdd={onAdd} /> : <><SectionHeader c={c} title="Upcoming" action="See all" onPress={onSeeAll} /><View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>{upcoming.slice(0, 3).map((item, index) => <RenewalRow key={item.id} c={c} item={item} last={index === Math.min(upcoming.length, 3) - 1} />)}</View><SectionHeader c={c} title="Recent subscriptions" action="Manage" onPress={onSeeAll} /><View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>{subscriptions.slice(-3).reverse().map((item, index) => <SubscriptionRow key={item.id} c={c} item={item} last={index === Math.min(subscriptions.length, 3) - 1} />)}</View></>}
    <View style={[styles.summary, { backgroundColor: c.primarySoft }]}><Ionicons name="phone-portrait-outline" size={21} color={c.primary} /><Text style={[styles.summaryText, { color: c.text }]}>Subscriptions and preferences are stored locally on this device.</Text></View>
  </ScrollView>;
}
