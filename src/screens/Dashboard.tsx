import { RefreshControl, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { EmptyState, Header, SectionHeader } from "../components/common";
import { RenewalRow } from "../components/subscriptionRows";
import { styles } from "../styles";
import type { Colors } from "../theme";
import type { Subscription } from "../types";
import { formatMoney } from "../utils/subscriptions";

type DashboardProps = {
  c: Colors;
  subscriptions: Subscription[];
  activeSubscriptionCount: number;
  upcoming: Subscription[];
  monthly: number;
  spendingUntilBoundary: number;
  spendingBoundary: Date;
  paydayEnabled: boolean;
  currency: string;
  refreshing: boolean;
  onAdd: () => void;
  onRefresh: () => void;
  onSeeAll: () => void;
};

export function Dashboard({
  c,
  subscriptions,
  activeSubscriptionCount,
  upcoming,
  monthly,
  spendingUntilBoundary,
  spendingBoundary,
  paydayEnabled,
  currency,
  refreshing,
  onAdd,
  onRefresh,
  onSeeAll,
}: DashboardProps) {
  const visibleUpcoming = upcoming.slice(0, 5);
  const spendingDate = spendingBoundary.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const spendingLabel = paydayEnabled ? `Until payday on ${spendingDate}` : `Until ${spendingDate}`;
  const subscriptionLabel = activeSubscriptionCount === 1 ? "subscription" : "subscriptions";

  return (
    <ScrollView
      contentContainerStyle={styles.screen}
      refreshControl={(
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={c.primary}
          colors={[c.primary]}
        />
      )}
      showsVerticalScrollIndicator={false}
    >
      <Header c={c} eyebrow="Your recurring payments" title="Dashboard" onAdd={onAdd} />

      <View style={[styles.totalCard, { backgroundColor: c.primary }]}>
        <Text style={styles.totalEyebrow}>MONTHLY SPENDING</Text>
        <Text style={styles.total}>{formatMoney(monthly, currency)}</Text>
        <View style={styles.totalFooter}>
          <Text style={styles.totalSub}>Across {activeSubscriptionCount} active {subscriptionLabel}</Text>
          <View style={styles.totalRemainingStack}>
            <Text style={styles.totalRemainingValue}>
              {formatMoney(spendingUntilBoundary, currency)}
            </Text>
            <Text style={styles.totalRemainingLabel}>{spendingLabel}</Text>
          </View>
        </View>
      </View>

      {subscriptions.length === 0 ? (
        <EmptyState c={c} onAdd={onAdd} />
      ) : (
        <>
          <SectionHeader c={c} title="Upcoming" action="See all" onPress={onSeeAll} />
          {visibleUpcoming.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: c.surface, borderColor: c.border, marginTop: 0 }]}>
              <Ionicons name="pause-circle-outline" size={34} color={c.primary} />
              <Text style={[styles.emptyTitle, { color: c.text }]}>No active renewals</Text>
              <Text style={[styles.emptyText, { color: c.textMuted }]}>
                Paused subscriptions stay in your list but are not billed.
              </Text>
            </View>
          ) : (
            <View style={styles.subscriptionStack}>
              {visibleUpcoming.map((item, index) => (
                <RenewalRow
                  key={item.id}
                  c={c}
                  item={item}
                  last={index === visibleUpcoming.length - 1}
                />
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}
