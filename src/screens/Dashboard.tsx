import { RefreshControl, ScrollView, Text, View } from "react-native";

import { EmptyState, Header, SectionHeader } from "../components/common";
import { RenewalRow } from "../components/subscriptionRows";
import { styles } from "../styles";
import type { Colors } from "../theme";
import type { Subscription } from "../types";
import { formatMoney } from "../utils/subscriptions";

type DashboardProps = {
  c: Colors;
  subscriptions: Subscription[];
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
          <Text style={styles.totalSub}>Across {subscriptions.length} subscriptions</Text>
          <Text style={styles.totalYearly}>{formatMoney(monthly * 12, currency)} / year</Text>
        </View>
      </View>

      {subscriptions.length === 0 ? (
        <EmptyState c={c} onAdd={onAdd} />
      ) : (
        <>
          <SectionHeader c={c} title="Upcoming" action="See all" onPress={onSeeAll} />
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
          <View style={[styles.spendingPill, { backgroundColor: c.primarySoft }]}>
            <Text style={[styles.spendingPillLabel, { color: c.primary }]}>Planned spend</Text>
            <Text style={[styles.spendingPillValue, { color: c.text }]}>
              {formatMoney(spendingUntilBoundary, currency)}
            </Text>
            <Text style={[styles.spendingPillMeta, { color: c.textMuted }]}>{spendingLabel}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}
