import { useMemo, useState } from "react";
import { Modal, Pressable, RefreshControl, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Chip, EmptyState, Header } from "../components/common";
import { SubscriptionRow } from "../components/subscriptionRows";
import { AddSubscription } from "./AddSubscription";
import { styles } from "../styles";
import type { Colors } from "../theme";
import { billingPeriods, type BillingPeriod, type Subscription } from "../types";
import { monthlyCost, nextRenewalDate } from "../utils/subscriptions";

type SubscriptionListProps = {
  c: Colors;
  subscriptions: Subscription[];
  refreshing: boolean;
  colorPresets: string[];
  onAdd: () => void;
  onRefresh: () => void;
  onUpdate: (item: Subscription, input: Omit<Subscription, "id" | "createdAt" | "updatedAt">) => void;
  onRemove: (item: Subscription) => void;
  onRequestNotificationPermission: () => Promise<boolean>;
};

type SubscriptionFilter = "All" | BillingPeriod | "Paused";
type SortOption = "name" | "priceAsc" | "priceDesc" | "upcoming" | "added";

const sortOptions: { label: string; value: SortOption; icon: keyof typeof Ionicons.glyphMap }[] = [
  { label: "A to Z", value: "name", icon: "text-outline" },
  { label: "Price low to high", value: "priceAsc", icon: "trending-up-outline" },
  { label: "Price high to low", value: "priceDesc", icon: "trending-down-outline" },
  { label: "Upcoming", value: "upcoming", icon: "calendar-outline" },
  { label: "Recently added", value: "added", icon: "time-outline" },
];

export function SubscriptionList({
  c,
  subscriptions,
  refreshing,
  colorPresets,
  onAdd,
  onRefresh,
  onUpdate,
  onRemove,
  onRequestNotificationPermission,
}: SubscriptionListProps) {
  const [filter, setFilter] = useState<SubscriptionFilter>("All");
  const [sort, setSort] = useState<SortOption>("name");
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [editing, setEditing] = useState<Subscription | null>(null);
  const visible = useMemo(() => {
    const filtered = filter === "All"
      ? subscriptions
      : subscriptions.filter((item) => (
        filter === "Paused" ? item.paused : item.billingPeriod === filter
      ));

    return [...filtered].sort((a, b) => sortSubscriptions(a, b, sort));
  }, [filter, sort, subscriptions]);
  const selectedSort = sortOptions.find((item) => item.value === sort) ?? sortOptions[0];

  return (
    <>
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
        <Header c={c} eyebrow="All recurring payments" title="Subscriptions" onAdd={onAdd} />
        <View style={styles.subscriptionToolbar}>
          <View style={styles.subscriptionFilterChips}>
            {(["All", ...billingPeriods, "Paused"] as const).map((item) => (
              <Chip
                key={item}
                c={c}
                label={item}
                bordered
                selected={filter === item}
                onPress={() => setFilter(item)}
              />
            ))}
          </View>
          <Pressable
            accessibilityLabel={`Sort subscriptions by ${selectedSort.label}`}
            onPress={() => setShowSortOptions(true)}
            style={[styles.sortButton, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <Ionicons name="swap-vertical-outline" size={20} color={c.primary} />
          </Pressable>
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
        colorPresets={colorPresets}
        subscription={editing}
        onClose={() => setEditing(null)}
        onRequestNotificationPermission={onRequestNotificationPermission}
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
      <Modal
        visible={showSortOptions}
        animationType="slide"
        transparent
        onRequestClose={() => setShowSortOptions(false)}
      >
        <Pressable style={styles.sheetScrim} onPress={() => setShowSortOptions(false)} />
        <View style={styles.sortSheetHost}>
          <View style={[styles.sortSheet, { backgroundColor: c.background, borderColor: c.border }]}>
            <View style={styles.dateSheetHandle} />
            <Text style={[styles.sortSheetTitle, { color: c.text }]}>Sort subscriptions</Text>
            <View style={styles.sortOptionList}>
              {sortOptions.map((item) => {
                const selected = item.value === sort;

                return (
                  <Pressable
                    key={item.value}
                    onPress={() => {
                      setSort(item.value);
                      setShowSortOptions(false);
                    }}
                    style={[
                      styles.sortOption,
                      {
                        backgroundColor: selected ? c.primarySoft : c.surface,
                        borderColor: selected ? c.primary : c.border,
                      },
                    ]}
                  >
                    <Ionicons name={item.icon} size={20} color={selected ? c.primary : c.textMuted} />
                    <Text style={[styles.sortOptionText, { color: selected ? c.primary : c.text }]}>
                      {item.label}
                    </Text>
                    {selected ? <Ionicons name="checkmark" size={20} color={c.primary} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

function sortSubscriptions(a: Subscription, b: Subscription, sort: SortOption) {
  if (sort === "priceAsc") return monthlyCost(a) - monthlyCost(b) || compareNames(a, b);
  if (sort === "priceDesc") return monthlyCost(b) - monthlyCost(a) || compareNames(a, b);
  if (sort === "upcoming") {
    return nextRenewalDate(a).localeCompare(nextRenewalDate(b)) || compareNames(a, b);
  }
  if (sort === "added") {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || compareNames(a, b);
  }

  return compareNames(a, b);
}

function compareNames(a: Subscription, b: Subscription) {
  return a.name.localeCompare(b.name);
}
