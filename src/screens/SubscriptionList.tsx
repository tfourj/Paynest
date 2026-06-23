import { useState } from "react";
import { ScrollView, View } from "react-native";

import { Chip, EmptyState, Header } from "../components/common";
import { SubscriptionRow } from "../components/subscriptionRows";
import { styles } from "../styles";
import type { Colors } from "../theme";
import type { BillingPeriod, Subscription } from "../types";

type SubscriptionListProps = {
  c: Colors;
  subscriptions: Subscription[];
  onAdd: () => void;
  onRemove: (item: Subscription) => void;
};

export function SubscriptionList({ c, subscriptions, onAdd, onRemove }: SubscriptionListProps) {
  const [filter, setFilter] = useState<"All" | BillingPeriod>("All");
  const visible = filter === "All"
    ? subscriptions
    : subscriptions.filter((item) => item.billingPeriod === filter);

  return (
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <Header c={c} eyebrow="All recurring payments" title="Subscriptions" onAdd={onAdd} />
      <View style={styles.chips}>
        {(["All", "Monthly", "Yearly"] as const).map((item) => (
          <Chip
            key={item}
            c={c}
            label={item}
            selected={filter === item}
            onPress={() => setFilter(item)}
          />
        ))}
      </View>

      {visible.length === 0 ? (
        <EmptyState c={c} onAdd={onAdd} compact />
      ) : (
        <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
          {visible.map((item, index) => (
            <SubscriptionRow
              key={item.id}
              c={c}
              item={item}
              last={index === visible.length - 1}
              onRemove={() => onRemove(item)}
            />
          ))}
        </View>
      )}
    </ScrollView>
  );
}
