import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { styles } from "../styles";
import type { Colors } from "../theme";
import type { Subscription } from "../types";
import { colorFor, iconFor } from "../utils/category";
import { dayDifference, formatMoney, renewalLabel } from "../utils/subscriptions";

export function RenewalRow({ c, item, last }: { c: Colors; item: Subscription; last: boolean }) {
  const hasCustomBackground = Boolean(item.backgroundColor);
  const rowTextColor = hasCustomBackground ? "#111827" : c.text;
  const rowMutedColor = hasCustomBackground ? "#475569" : c.textMuted;

  return (
    <View
      style={[
        styles.renewalRow,
        item.backgroundColor && { backgroundColor: item.backgroundColor },
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
      ]}
    >
      <IconBadge item={item} />
      <View style={styles.rowText}>
        <Text style={[styles.rowName, { color: rowTextColor }]}>{item.name}</Text>
        <Text style={[styles.rowMeta, { color: rowMutedColor }]}>Renews {renewalLabel(item.nextRenewalDate)}</Text>
      </View>
      <Text style={[styles.rowPrice, { color: rowTextColor }]}>{formatMoney(item.price, item.currency)}</Text>
    </View>
  );
}

type SubscriptionRowProps = {
  c: Colors;
  item: Subscription;
  last: boolean;
  onRemove?: () => void;
};

export function SubscriptionRow({ c, item, last, onRemove }: SubscriptionRowProps) {
  const hasCustomBackground = Boolean(item.backgroundColor);
  const rowTextColor = hasCustomBackground ? "#111827" : c.text;
  const rowMutedColor = hasCustomBackground ? "#475569" : c.textMuted;

  return (
    <View
      style={[
        styles.subscriptionRow,
        item.backgroundColor && { backgroundColor: item.backgroundColor },
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },
      ]}
    >
      <IconBadge item={item} />
      <View style={styles.rowText}>
        <Text style={[styles.rowName, { color: rowTextColor }]}>{item.name}</Text>
        <Text style={[styles.rowMeta, { color: rowMutedColor }]}>{item.category} · {item.billingPeriod}</Text>
      </View>
      <View style={styles.priceStack}>
        <Text style={[styles.rowPrice, { color: rowTextColor }]}>{formatMoney(item.price, item.currency)}</Text>
        <Text
          style={[
            styles.renewalStatus,
            { color: dayDifference(item.nextRenewalDate) <= 3 ? c.warning : rowMutedColor },
          ]}
        >
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
  const color = item.iconColor ?? colorFor(item.category);
  const iconName = (item.iconName ?? iconFor(item.category)) as keyof typeof Ionicons.glyphMap;
  return (
    <View style={[styles.iconBadge, { backgroundColor: `${color}18` }]}>
      {item.iconLabel ? (
        <Text style={[styles.iconBadgeText, { color }]}>{item.iconLabel}</Text>
      ) : (
        <Ionicons name={iconName} size={22} color={color} />
      )}
    </View>
  );
}
