import { useState } from "react";
import { ScrollView, View } from "react-native";

import { Chip, EmptyState, Header } from "../components/common";
import { SubscriptionRow } from "../components/subscriptionRows";
import { AddSubscription } from "./AddSubscription";
import { styles } from "../styles";
import type { Colors } from "../theme";
import { billingPeriods, type BillingPeriod, type Subscription } from "../types";

type SubscriptionListProps = {
  c: Colors;
  subscriptions: Subscription[];
  onAdd: () => void;
  onUpdate: (item: Subscription, input: Omit<Subscription, "id" | "createdAt" | "updatedAt">) => void;
  onRemove: (item: Subscription) => void;
};

export function SubscriptionList({ c, subscriptions, onAdd, onUpdate, onRemove }: SubscriptionListProps) {
  const [filter, setFilter] = useState<"All" | BillingPeriod>("All");
  const [editing, setEditing] = useState<Subscription | null>(null);
  const visible = filter === "All"
    ? subscriptions
    : subscriptions.filter((item) => item.billingPeriod === filter);

  return (
    <>
      <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
        <Header c={c} eyebrow="All recurring payments" title="Subscriptions" onAdd={onAdd} />
        <View style={styles.chips}>
          {(["All", ...billingPeriods] as const).map((item) => (
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
          <View style={styles.subscriptionStack}>
            {visible.map((item, index) => (
              <SubscriptionRow
                key={item.id}
                c={c}
                item={item}
                last={index === visible.length - 1}
                onPress={() => setEditing(item)}
              />
            ))}
          </View>
        )}
      </ScrollView>
      <AddSubscription
        c={c}
        visible={editing !== null}
        defaultCurrency={editing?.currency ?? "EUR"}
        subscription={editing}
        onClose={() => setEditing(null)}
        onSave={(input) => {
          if (!editing) return;
          onUpdate(editing, input);
          setEditing(null);
        }}
        onDelete={(item) => {
          onRemove(item);
          setEditing(null);
        }}
      />
    </>
  );
}
