import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { SubscriptionIcon } from "./SubscriptionIcon";
import { styles } from "../styles";
import type { Colors } from "../theme";
import type { Subscription } from "../types";
import { colorFor, iconFor } from "../utils/category";
import { dayDifference, formatMoney, renewalLabel } from "../utils/subscriptions";
import type { IconSource } from "../iconSearch";

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  if (normalized.length !== 6) return null;

  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16),
  };
}

function readableTextColor(background: string) {
  const rgb = hexToRgb(background);
  if (!rgb) return "#111827";

  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.68 ? "#111827" : "#FFFFFF";
}

function mutedTextColor(textColor: string) {
  return textColor === "#FFFFFF" ? "rgba(255,255,255,0.78)" : "#475569";
}

export function RenewalRow({ c, item, last }: { c: Colors; item: Subscription; last: boolean }) {
  const rowBackground = item.backgroundColor ?? item.iconColor ?? colorFor(item.category);
  const rowTextColor = readableTextColor(rowBackground);
  const rowMutedColor = mutedTextColor(rowTextColor);

  return (
    <View
      style={[
        styles.renewalRow,
        { backgroundColor: rowBackground },
        last && styles.lastSubscriptionPill,
      ]}
    >
      <IconBadge item={item} rowTextColor={rowTextColor} />
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
  onPress?: () => void;
};

export function SubscriptionRow({ c, item, last, onPress }: SubscriptionRowProps) {
  const rowBackground = item.backgroundColor ?? item.iconColor ?? colorFor(item.category);
  const rowTextColor = readableTextColor(rowBackground);
  const rowMutedColor = mutedTextColor(rowTextColor);

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.subscriptionRow,
        { backgroundColor: rowBackground },
        last && styles.lastSubscriptionPill,
      ]}
    >
      <IconBadge item={item} rowTextColor={rowTextColor} />
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
      <Ionicons name="chevron-forward" size={19} color={rowMutedColor} />
    </Pressable>
  );
}

function IconBadge({ item, rowTextColor }: { item: Subscription; rowTextColor: string }) {
  const iconName = (item.iconName ?? iconFor(item.category)) as keyof typeof Ionicons.glyphMap;
  const badgeBackground = rowTextColor === "#FFFFFF" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.72)";
  const iconSource = sourceFromSubscription(item);

  return (
    <View style={[styles.iconBadge, { backgroundColor: badgeBackground }]}>
      <SubscriptionIcon
        color={rowTextColor}
        fallbackLabel={item.iconLabel}
        iconName={iconName}
        iconSource={iconSource}
        size={23}
      />
    </View>
  );
}

function sourceFromSubscription(item: Subscription): IconSource | undefined {
  if (item.iconProvider) {
    return {
      provider: item.iconProvider as IconSource["provider"],
      slug: item.simpleIconSlug,
      title: item.iconSourceTitle ?? item.name,
      url: item.iconUrl,
      color: item.iconColor,
    };
  }

  if (!item.simpleIconSlug) return undefined;

  return {
    provider: "simpleicons",
    slug: item.simpleIconSlug,
    title: item.iconSourceTitle ?? item.name,
    color: item.iconColor,
  };
}
