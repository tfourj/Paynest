import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { styles } from "../styles";
import type { Colors } from "../theme";
import type { Subscription } from "../types";
import { colorFor, iconFor } from "../utils/category";
import { dayDifference, formatMoney, renewalLabel } from "../utils/subscriptions";

export function RenewalRow({ c, item, last }: { c: Colors; item: Subscription; last: boolean }) {
  return (
    <View style={[styles.renewalRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}>
      <IconBadge item={item} />
      <View style={styles.rowText}>
        <Text style={[styles.rowName, { color: c.text }]}>{item.name}</Text>
        <Text style={[styles.rowMeta, { color: c.textMuted }]}>Renews {renewalLabel(item.nextRenewalDate)}</Text>
      </View>
      <Text style={[styles.rowPrice, { color: c.text }]}>{formatMoney(item.price, item.currency)}</Text>
    </View>
  );
}

export function SubscriptionRow({ c, item, last, onRemove }: { c: Colors; item: Subscription; last: boolean; onRemove?: () => void }) {
  return (
    <View style={[styles.subscriptionRow, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border }]}>
      <IconBadge item={item} />
      <View style={styles.rowText}>
        <Text style={[styles.rowName, { color: c.text }]}>{item.name}</Text>
        <Text style={[styles.rowMeta, { color: c.textMuted }]}>{item.category} · {item.billingPeriod}</Text>
      </View>
      <View style={styles.priceStack}>
        <Text style={[styles.rowPrice, { color: c.text }]}>{formatMoney(item.price, item.currency)}</Text>
        <Text style={[styles.renewalStatus, { color: dayDifference(item.nextRenewalDate) <= 3 ? c.warning : c.textMuted }]}>
          Renews {renewalLabel(item.nextRenewalDate)}
        </Text>
      </View>
      {onRemove && (
        <Pressable
          accessibilityLabel={`Remove ${item.name}`}
          hitSlop={8}
          onPress={onRemove}
          style={styles.removeButton}
        >
          <Ionicons name="trash-outline" size={19} color="#DC2626" />
        </Pressable>
      )}
    </View>
  );
}

function IconBadge({ item }: { item: Subscription }) {
  const color = colorFor(item.category);
  return (
    <View style={[styles.iconBadge, { backgroundColor: `${color}18` }]}>
      <Ionicons name={iconFor(item.category)} size={22} color={color} />
    </View>
  );
}
