import { Pressable, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { SubscriptionIcon } from "./SubscriptionIcon";
import { styles } from "../styles";
import type { Colors } from "../theme";
import type { Subscription } from "../types";
import { colorFor, iconFor } from "../utils/category";
import { mutedTextColor, readableTextColor } from "../utils/colors";
import { formatMoney, renewalLabel } from "../utils/subscriptions";
import type { IconSource } from "../iconSearch";

export function RenewalRow({
  c,
  item,
  last,
  convertedPrice,
  displayCurrency,
  showOriginalCurrency,
}: {
  c: Colors;
  item: Subscription;
  last: boolean;
  convertedPrice?: number | null;
  displayCurrency?: string;
  showOriginalCurrency?: boolean;
}) {
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
      <Text style={[styles.rowPrice, { color: rowTextColor }]}>
        {formatDisplayPrice(item, convertedPrice, displayCurrency, showOriginalCurrency)}
      </Text>
    </View>
  );
}

type SubscriptionRowProps = {
  c: Colors;
  item: Subscription;
  last: boolean;
  convertedPrice?: number | null;
  displayCurrency?: string;
  showOriginalCurrency?: boolean;
  onPress?: () => void;
};

export function SubscriptionRow({
  c,
  item,
  last,
  convertedPrice,
  displayCurrency,
  showOriginalCurrency,
  onPress,
}: SubscriptionRowProps) {
  const rowBackground = item.backgroundColor ?? item.iconColor ?? colorFor(item.category);
  const rowTextColor = readableTextColor(rowBackground);
  const rowMutedColor = mutedTextColor(rowTextColor);
  const rowMeta = item.paused
    ? `${item.category} · ${item.billingPeriod} · Paused`
    : `${item.category} · ${item.billingPeriod}`;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.subscriptionRow,
        {
          backgroundColor: rowBackground,
          opacity: item.paused ? 0.58 : 1,
        },
        last && styles.lastSubscriptionPill,
      ]}
    >
      <IconBadge item={item} rowTextColor={rowTextColor} />
      <View style={styles.rowText}>
        <Text style={[styles.rowName, { color: rowTextColor }]}>{item.name}</Text>
        <Text style={[styles.rowMeta, { color: rowMutedColor }]}>{rowMeta}</Text>
      </View>
      <View style={styles.priceStack}>
        <Text style={[styles.rowPrice, { color: rowTextColor }]}>
          {formatDisplayPrice(item, convertedPrice, displayCurrency, showOriginalCurrency)}
        </Text>
        <Text
          style={[
            styles.renewalStatus,
            { color: rowMutedColor },
          ]}
        >
          Renews {renewalLabel(item.nextRenewalDate)}
        </Text>
      </View>
      <Ionicons name="chevron-forward" size={19} color={rowMutedColor} />
    </Pressable>
  );
}

function formatDisplayPrice(
  item: Subscription,
  convertedPrice?: number | null,
  displayCurrency?: string,
  showOriginalCurrency?: boolean,
) {
  const original = formatMoney(item.price, item.currency);
  if (convertedPrice == null || !displayCurrency) return original;

  const converted = formatMoney(convertedPrice, displayCurrency);
  if (!showOriginalCurrency || item.currency === displayCurrency) return converted;
  return `${converted} (${original})`;
}

function IconBadge({ item, rowTextColor }: { item: Subscription; rowTextColor: string }) {
  const iconName = (item.iconName ?? iconFor(item.category)) as keyof typeof Ionicons.glyphMap;
  const badgeBackground = item.iconBackgroundColor
    ?? (rowTextColor === "#FFFFFF" ? "rgba(255,255,255,0.16)" : "rgba(255,255,255,0.72)");
  const iconColor = item.iconBackgroundColor ? readableTextColor(item.iconBackgroundColor) : rowTextColor;
  const iconSource = sourceFromSubscription(item);

  return (
    <View style={[styles.iconBadge, { backgroundColor: badgeBackground }]}>
      <SubscriptionIcon
        color={iconColor}
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
