import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Chip } from "../components/common";
import { getSimpleIcon, SimpleIcon } from "../components/SimpleIcon";
import { SubscriptionIcon } from "../components/SubscriptionIcon";
import { categories, symbols } from "../constants";
import {
  searchRemoteIcons,
  searchSimpleIcons,
  type IconProvider,
  type IconSearchResult,
  type IconSource,
} from "../iconSearch";
import { styles } from "../styles";
import { subscriptionPresets, type SubscriptionPreset } from "../subscriptionPresets";
import type { Colors } from "../theme";
import { billingPeriods, type BillingPeriod, type Subscription } from "../types";

type AddSubscriptionProps = {
  c: Colors;
  visible: boolean;
  defaultCurrency: string;
  subscription?: Subscription | null;
  onClose: () => void;
  onSave: (item: Omit<Subscription, "id" | "createdAt" | "updatedAt">) => void;
  onDelete?: (item: Subscription) => void;
};

const noneCategory = "None";
const categoryOptions = [noneCategory, ...categories];
const yearOptions = Array.from({ length: 6 }, (_, index) => new Date().getFullYear() + index);
const monthOptions = Array.from({ length: 12 }, (_, index) => index);
const visualIconOptions = [
  "card",
  "play-circle",
  "musical-notes",
  "cloud",
  "game-controller",
  "fitness",
  "code-slash",
  "school",
] as const;
const backgroundColorOptions = [
  "#2563EB",
  "#E50914",
  "#1DB954",
  "#8B5CF6",
  "#F97316",
  "#111827",
  "#EFF6FF",
  "#F3F4F6",
];
const iconProviderOptions: { label: string; value: IconProvider }[] = [
  { label: "Simple Icons", value: "simpleicons" },
  { label: "SVGL", value: "svgl" },
  { label: "Dashboard Icons", value: "dashboardicons" },
];
const dateWheelItemOffset = 48;

function startOfToday() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatDateValue(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLongDate(date: Date) {
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}

function ordinal(day: number) {
  if (day >= 11 && day <= 13) return `${day}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[day % 10] ?? "th";
  return `${day}${suffix}`;
}

function readableTextColor(background: string) {
  const normalized = background.replace("#", "");
  if (normalized.length !== 6) return "#111827";

  const r = Number.parseInt(normalized.slice(0, 2), 16);
  const g = Number.parseInt(normalized.slice(2, 4), 16);
  const b = Number.parseInt(normalized.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance > 0.68 ? "#111827" : "#FFFFFF";
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function clampDate(year: number, month: number, day: number) {
  return new Date(year, month, Math.min(day, daysInMonth(year, month)));
}

function dateFromValue(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? startOfToday() : date;
}

export function AddSubscription({
  c,
  visible,
  defaultCurrency,
  subscription,
  onClose,
  onSave,
  onDelete,
}: AddSubscriptionProps) {
  const today = useMemo(startOfToday, [visible]);
  const dayWheelRef = useRef<ScrollView>(null);
  const monthWheelRef = useRef<ScrollView>(null);
  const yearWheelRef = useRef<ScrollView>(null);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [presetSearch, setPresetSearch] = useState("");
  const [category, setCategory] = useState(noneCategory);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("Monthly");
  const [firstPaymentDate, setFirstPaymentDate] = useState(today);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const [iconName, setIconName] = useState<(typeof visualIconOptions)[number]>("card");
  const [iconLabel, setIconLabel] = useState("");
  const [iconColor, setIconColor] = useState("#2563EB");
  const [backgroundColor, setBackgroundColor] = useState("#2563EB");
  const [simpleIconSlug, setSimpleIconSlug] = useState<string | undefined>();
  const [iconProvider, setIconProvider] = useState<IconProvider | undefined>();
  const [iconUrl, setIconUrl] = useState<string | undefined>();
  const [iconSourceTitle, setIconSourceTitle] = useState<string | undefined>();
  const [symbolSearch, setSymbolSearch] = useState("");
  const [enabledIconProviders, setEnabledIconProviders] = useState<IconProvider[]>([
    "simpleicons",
    "svgl",
    "dashboardicons",
  ]);
  const [remoteIconResults, setRemoteIconResults] = useState<IconSearchResult[]>([]);
  const [symbolSearchLoading, setSymbolSearchLoading] = useState(false);
  const [error, setError] = useState("");
  const editing = Boolean(subscription);
  const formCurrency = subscription?.currency ?? defaultCurrency;
  const payDay = firstPaymentDate.getDate();
  const renewal = formatDateValue(firstPaymentDate);
  const datePickerDays = Array.from(
    { length: daysInMonth(firstPaymentDate.getFullYear(), firstPaymentDate.getMonth()) },
    (_, index) => index + 1,
  );
  const visiblePresets = useMemo(() => {
    const query = presetSearch.trim().toLowerCase();
    if (!query) return subscriptionPresets.slice(0, 18);
    return subscriptionPresets.filter((preset) => preset.name.toLowerCase().includes(query)).slice(0, 24);
  }, [presetSearch]);
  const localIconResults = useMemo(() => {
    if (!enabledIconProviders.includes("simpleicons")) return [];
    return searchSimpleIcons(symbolSearch);
  }, [enabledIconProviders, symbolSearch]);
  const symbolResults = useMemo(
    () => [...localIconResults, ...remoteIconResults].slice(0, 36),
    [localIconResults, remoteIconResults],
  );
  const selectedIconSource = useMemo<IconSource | undefined>(() => {
    if (iconProvider) {
      return {
        provider: iconProvider,
        slug: simpleIconSlug,
        title: iconSourceTitle ?? (name.trim() || "Subscription"),
        url: iconUrl,
        color: iconColor,
      };
    }

    if (!simpleIconSlug) return undefined;

    return {
      provider: "simpleicons",
      slug: simpleIconSlug,
      title: iconSourceTitle ?? (name.trim() || "Subscription"),
      color: iconColor,
    };
  }, [iconColor, iconProvider, iconSourceTitle, iconUrl, name, simpleIconSlug]);
  const previewTextColor = readableTextColor(backgroundColor);
  const previewMutedColor = previewTextColor === "#FFFFFF" ? "rgba(255,255,255,0.78)" : "#475569";
  const previewBadgeBackground = previewTextColor === "#FFFFFF"
    ? "rgba(255,255,255,0.16)"
    : "rgba(255,255,255,0.72)";

  useEffect(() => {
    if (!showDatePicker) return;

    const scrollTimer = setTimeout(() => {
      dayWheelRef.current?.scrollTo({
        y: Math.max(payDay - 2, 0) * dateWheelItemOffset,
        animated: false,
      });
      monthWheelRef.current?.scrollTo({
        y: Math.max(firstPaymentDate.getMonth() - 1, 0) * dateWheelItemOffset,
        animated: false,
      });
      yearWheelRef.current?.scrollTo({
        y: Math.max(yearOptions.indexOf(firstPaymentDate.getFullYear()) - 1, 0) * dateWheelItemOffset,
        animated: false,
      });
    }, 50);

    return () => clearTimeout(scrollTimer);
  }, [firstPaymentDate, payDay, showDatePicker]);

  useEffect(() => {
    if (!visible) return;

    setName(subscription?.name ?? "");
    setPrice(subscription ? `${subscription.price}` : "");
    setPresetSearch(subscription?.name ?? "");
    setCategory(subscription?.category ?? noneCategory);
    setBillingPeriod(subscription?.billingPeriod ?? "Monthly");
    setFirstPaymentDate(subscription ? dateFromValue(subscription.nextRenewalDate) : today);
    setIconName((subscription?.iconName as (typeof visualIconOptions)[number] | undefined) ?? "card");
    setIconLabel(subscription?.iconLabel ?? "");
    setIconColor(subscription?.iconColor ?? "#2563EB");
    setBackgroundColor(subscription?.backgroundColor ?? subscription?.iconColor ?? "#2563EB");
    setSimpleIconSlug(subscription?.simpleIconSlug);
    setIconProvider(subscription?.iconProvider as IconProvider | undefined);
    setIconUrl(subscription?.iconUrl);
    setIconSourceTitle(subscription?.iconSourceTitle);
    setSymbolSearch(subscription?.name ?? "");
    setRemoteIconResults([]);
    setSymbolSearchLoading(false);
    setShowPresetPicker(false);
    setError("");
  }, [subscription?.id, today, visible]);

  useEffect(() => {
    const query = symbolSearch.trim();
    const remoteProviders = enabledIconProviders.filter((provider) => provider !== "simpleicons");
    if (!visible || query.length < 2 || remoteProviders.length === 0) {
      setRemoteIconResults([]);
      setSymbolSearchLoading(false);
      return;
    }

    let cancelled = false;
    setSymbolSearchLoading(true);

    const searchTimer = setTimeout(() => {
      searchRemoteIcons(query, remoteProviders)
        .then((results) => {
          if (!cancelled) setRemoteIconResults(results);
        })
        .catch(() => {
          if (!cancelled) setRemoteIconResults([]);
        })
        .finally(() => {
          if (!cancelled) setSymbolSearchLoading(false);
        });
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(searchTimer);
    };
  }, [enabledIconProviders, symbolSearch, visible]);

  function applyPreset(preset: SubscriptionPreset) {
    setName(preset.name);
    setPresetSearch(preset.name);
    setCategory(preset.category);
    setIconLabel(preset.iconLabel);
    setIconColor(preset.iconColor);
    setBackgroundColor(preset.iconColor);
    setSimpleIconSlug(preset.simpleIconSlug);
    setIconProvider("simpleicons");
    setIconUrl(undefined);
    setIconSourceTitle(preset.name);
    setSymbolSearch(preset.name);
    setShowPresetPicker(false);
  }

  function applyIconSource(icon: IconSearchResult) {
    setIconProvider(icon.provider);
    setSimpleIconSlug(icon.provider === "simpleicons" ? icon.slug : undefined);
    setIconUrl(icon.url);
    setIconSourceTitle(icon.title);
    setIconLabel("");
    setIconName("card");
    setIconColor(icon.color ?? iconColor);
  }

  function toggleIconProvider(provider: IconProvider) {
    setEnabledIconProviders((current) => {
      if (current.includes(provider)) {
        return current.length === 1 ? current : current.filter((item) => item !== provider);
      }

      return [...current, provider];
    });
  }

  function updateFirstPaymentDate(part: "day" | "month" | "year", value: number) {
    setFirstPaymentDate((current) => {
      const nextYear = part === "year" ? value : current.getFullYear();
      const nextMonth = part === "month" ? value : current.getMonth();
      const nextDay = part === "day" ? value : current.getDate();
      return clampDate(nextYear, nextMonth, nextDay);
    });
  }

  function save() {
    const parsed = Number.parseFloat(price.replace(",", "."));
    if (!name.trim() || Number.isNaN(parsed) || parsed <= 0) {
      return setError("Enter a subscription name and a price greater than zero.");
    }

    onSave({
      name: name.trim(),
      price: parsed,
      category,
      billingPeriod,
      currency: formCurrency,
      payDay,
      nextRenewalDate: renewal,
      iconName: iconLabel ? undefined : iconName,
      iconLabel: iconLabel || undefined,
      iconColor,
      backgroundColor,
      simpleIconSlug,
      iconProvider,
      iconUrl,
      iconSourceTitle,
    });
    setName("");
    setPrice("");
    setPresetSearch("");
    setCategory(noneCategory);
    setBillingPeriod("Monthly");
    setFirstPaymentDate(today);
    setIconName("card");
    setIconLabel("");
    setIconColor("#2563EB");
    setBackgroundColor("#2563EB");
    setSimpleIconSlug(undefined);
    setIconProvider(undefined);
    setIconUrl(undefined);
    setIconSourceTitle(undefined);
    setSymbolSearch("");
    setRemoteIconResults([]);
    setSymbolSearchLoading(false);
    setShowPresetPicker(false);
    setError("");
  }

  function confirmDelete() {
    if (!subscription || !onDelete) return;

    Alert.alert(`Delete ${subscription.name}?`, "This removes the subscription from your list.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: () => onDelete(subscription) },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.modal, { backgroundColor: c.background }]}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose}>
            <Text style={[styles.cancel, { color: c.primary }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.modalTitle, { color: c.text }]}>
            {editing ? "Edit subscription" : "Add subscription"}
          </Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={[styles.formLabel, { color: c.textMuted }]}>BASIC INFO</Text>
          <View style={[styles.inputGroup, { backgroundColor: c.surface, borderColor: c.border }]}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Subscription name"
              placeholderTextColor={c.textSoft}
              style={[
                styles.input,
                {
                  color: c.text,
                  borderBottomColor: c.border,
                  borderBottomWidth: StyleSheet.hairlineWidth,
                },
              ]}
              autoFocus
            />
            <View style={styles.priceInput}>
              <Text style={[styles.currency, { color: c.textMuted }]}>
                {symbols[formCurrency] ?? formCurrency}
              </Text>
              <TextInput
                value={price}
                onChangeText={setPrice}
                placeholder="Price"
                placeholderTextColor={c.textSoft}
                style={[styles.input, { color: c.text }]}
                keyboardType={Platform.select({ ios: "decimal-pad", default: "numeric" })}
              />
            </View>
          </View>

          <Pressable
            onPress={() => setShowPresetPicker(true)}
            style={[styles.presetPickerButton, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <View style={styles.payDateRowIcon}>
              <Ionicons name="sparkles-outline" size={21} color={c.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.payDateRowLabel, { color: c.textMuted }]}>Optional shortcut</Text>
              <Text style={[styles.payDateRowValue, { color: c.text }]}>Choose from presets</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={c.textSoft} />
          </Pressable>

          <Text style={[styles.formLabel, { color: c.textMuted }]}>BILLING</Text>
          <View style={styles.periods}>
            {billingPeriods.map((period) => (
              <Pressable
                key={period}
                onPress={() => setBillingPeriod(period)}
                style={[
                  styles.periodButton,
                  {
                    backgroundColor: billingPeriod === period ? c.primarySoft : c.surface,
                    borderColor: billingPeriod === period ? c.primary : c.border,
                  },
                ]}
              >
                <Text style={{ color: billingPeriod === period ? c.primary : c.textMuted }}>{period}</Text>
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={[styles.payDateRow, { backgroundColor: c.surface, borderColor: c.border }]}
          >
            <View style={styles.payDateRowIcon}>
              <Ionicons name="calendar-outline" size={21} color={c.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.payDateRowLabel, { color: c.textMuted }]}>First payment</Text>
              <Text style={[styles.payDateRowValue, { color: c.text }]}>{formatLongDate(firstPaymentDate)}</Text>
            </View>
            <View style={styles.payDateRowMeta}>
              <Text style={[styles.payDateRowDay, { color: c.primary }]}>Day {payDay}</Text>
              <Ionicons name="chevron-forward" size={18} color={c.textSoft} />
            </View>
          </Pressable>

          <Modal
            visible={showDatePicker}
            animationType="slide"
            transparent
            onRequestClose={() => setShowDatePicker(false)}
          >
            <Pressable style={styles.sheetScrim} onPress={() => setShowDatePicker(false)} />
            <View style={[styles.dateSheet, { backgroundColor: c.background }]}>
              <View style={styles.dateSheetHandle} />
              <View style={styles.dateSheetHeader}>
                <View>
                  <Text style={[styles.dateLabel, { color: c.textMuted }]}>FIRST PAYMENT</Text>
                  <Text style={[styles.payDateTitle, { color: c.text }]}>
                    {formatLongDate(firstPaymentDate)}
                  </Text>
                  <Text style={[styles.payDateSubtitle, { color: c.textMuted }]}>
                    Recurs every {ordinal(payDay)}
                  </Text>
                </View>
                <Pressable onPress={() => setShowDatePicker(false)} style={styles.doneButton}>
                  <Text style={[styles.doneButtonText, { color: c.primary }]}>Done</Text>
                </Pressable>
              </View>

              <View style={styles.dateWheelRow}>
                <View style={styles.dateWheelColumn}>
                  <Text style={[styles.dateWheelLabel, { color: c.textMuted }]}>Day</Text>
                  <ScrollView ref={dayWheelRef} showsVerticalScrollIndicator={false} style={styles.dateWheel}>
                    {datePickerDays.map((day) => (
                      <Pressable
                        key={day}
                        onPress={() => updateFirstPaymentDate("day", day)}
                        style={[
                          styles.dateWheelItem,
                          { backgroundColor: payDay === day ? c.primarySoft : "transparent" },
                        ]}
                      >
                        <Text style={[styles.dateWheelText, { color: payDay === day ? c.primary : c.text }]}>
                          {day}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.dateWheelColumn}>
                  <Text style={[styles.dateWheelLabel, { color: c.textMuted }]}>Month</Text>
                  <ScrollView ref={monthWheelRef} showsVerticalScrollIndicator={false} style={styles.dateWheel}>
                    {monthOptions.map((month) => (
                      <Pressable
                        key={month}
                        onPress={() => updateFirstPaymentDate("month", month)}
                        style={[
                          styles.dateWheelItem,
                          { backgroundColor: firstPaymentDate.getMonth() === month ? c.primarySoft : "transparent" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dateWheelText,
                            { color: firstPaymentDate.getMonth() === month ? c.primary : c.text },
                          ]}
                        >
                          {new Date(2026, month, 1).toLocaleDateString(undefined, { month: "short" })}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>

                <View style={styles.dateWheelColumn}>
                  <Text style={[styles.dateWheelLabel, { color: c.textMuted }]}>Year</Text>
                  <ScrollView ref={yearWheelRef} showsVerticalScrollIndicator={false} style={styles.dateWheel}>
                    {yearOptions.map((year) => (
                      <Pressable
                        key={year}
                        onPress={() => updateFirstPaymentDate("year", year)}
                        style={[
                          styles.dateWheelItem,
                          { backgroundColor: firstPaymentDate.getFullYear() === year ? c.primarySoft : "transparent" },
                        ]}
                      >
                        <Text
                          style={[
                            styles.dateWheelText,
                            { color: firstPaymentDate.getFullYear() === year ? c.primary : c.text },
                          ]}
                        >
                          {year}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                </View>
              </View>
            </View>
          </Modal>

          <Modal
            visible={showPresetPicker}
            animationType="slide"
            transparent
            onRequestClose={() => setShowPresetPicker(false)}
          >
            <Pressable style={styles.sheetScrim} onPress={() => setShowPresetPicker(false)} />
            <View style={[styles.presetSheet, { backgroundColor: c.background }]}>
              <View style={styles.dateSheetHandle} />
              <View style={styles.dateSheetHeader}>
                <View>
                  <Text style={[styles.dateLabel, { color: c.textMuted }]}>PRESETS</Text>
                  <Text style={[styles.payDateTitle, { color: c.text }]}>Choose from presets</Text>
                </View>
                <Pressable onPress={() => setShowPresetPicker(false)} style={styles.doneButton}>
                  <Text style={[styles.doneButtonText, { color: c.primary }]}>Done</Text>
                </Pressable>
              </View>
              <View style={[styles.presetSearchGroup, { backgroundColor: c.surface, borderColor: c.border }]}>
                <Ionicons name="search" size={18} color={c.textSoft} />
                <TextInput
                  value={presetSearch}
                  onChangeText={setPresetSearch}
                  placeholder="Search subscription presets"
                  placeholderTextColor={c.textSoft}
                  style={[styles.presetSearchInput, { color: c.text }]}
                  autoCapitalize="none"
                />
              </View>
              <ScrollView
                nestedScrollEnabled
                showsVerticalScrollIndicator={false}
                style={styles.presetSheetListScroll}
                contentContainerStyle={styles.presetList}
              >
                {visiblePresets.map((preset) => {
                  const selected = simpleIconSlug === preset.simpleIconSlug;
                  const presetTextColor = readableTextColor(preset.iconColor);
                  const presetIcon = getSimpleIcon(preset.simpleIconSlug);
                  return (
                    <Pressable
                      key={preset.simpleIconSlug}
                      onPress={() => applyPreset(preset)}
                      style={[
                        styles.presetRow,
                        {
                          backgroundColor: selected ? preset.iconColor : preset.backgroundColor,
                          borderColor: selected ? preset.iconColor : c.border,
                        },
                      ]}
                    >
                      <View
                        style={[
                          styles.presetIcon,
                          { backgroundColor: selected ? "rgba(255,255,255,0.18)" : preset.iconColor },
                        ]}
                      >
                        {presetIcon ? (
                          <SimpleIcon
                            slug={presetIcon.slug}
                            size={19}
                            color={selected ? presetTextColor : "#fff"}
                          />
                        ) : (
                          <Text style={[styles.presetIconText, { color: selected ? presetTextColor : "#fff" }]}>
                            {preset.iconLabel}
                          </Text>
                        )}
                      </View>
                      <View style={styles.rowText}>
                        <Text style={[styles.presetText, { color: selected ? presetTextColor : "#111827" }]}>
                          {preset.name}
                        </Text>
                        <Text
                          style={[
                            styles.presetCategory,
                            { color: selected ? "rgba(255,255,255,0.78)" : "#475569" },
                          ]}
                        >
                          {preset.category}
                        </Text>
                      </View>
                      <View style={styles.presetCheckSlot}>
                        {selected ? <Ionicons name="checkmark-circle" size={20} color={presetTextColor} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          </Modal>

          <Text style={[styles.formLabel, { color: c.textMuted }]}>VISUAL STYLE</Text>
          <View style={[styles.visualPanel, { backgroundColor, borderColor: c.border }]}>
            <View style={styles.visualPreviewRow}>
              <View style={[styles.iconBadge, { backgroundColor: previewBadgeBackground }]}>
                <SubscriptionIcon
                  color={previewTextColor}
                  fallbackLabel={iconLabel}
                  iconName={iconName}
                  iconSource={selectedIconSource}
                  size={23}
                />
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowName, { color: previewTextColor }]}>{name.trim() || "Subscription"}</Text>
                <Text style={[styles.rowMeta, { color: previewMutedColor }]}>{category} · {billingPeriod}</Text>
              </View>
              <Text style={[styles.rowPrice, { color: previewTextColor }]}>
                {symbols[formCurrency] ?? formCurrency} {price || "0.00"}
              </Text>
            </View>
            <View style={styles.iconChoiceRow}>
              {visualIconOptions.map((item) => (
                <Pressable
                  key={item}
                  onPress={() => {
                    setIconName(item);
                    setIconLabel("");
                    setSimpleIconSlug(undefined);
                    setIconProvider(undefined);
                    setIconUrl(undefined);
                    setIconSourceTitle(undefined);
                  }}
                  style={[
                    styles.iconChoice,
                    {
                      backgroundColor:
                        !selectedIconSource && !iconLabel && iconName === item ? c.primarySoft : c.surface,
                      borderColor:
                        !selectedIconSource && !iconLabel && iconName === item ? c.primary : c.border,
                    },
                  ]}
                >
                  <Ionicons
                    name={item}
                    size={18}
                    color={!selectedIconSource && !iconLabel && iconName === item ? c.primary : c.textMuted}
                  />
                </Pressable>
              ))}
            </View>
            <View style={[styles.symbolSearchGroup, { backgroundColor: c.surface, borderColor: c.border }]}>
              <Ionicons name="search" size={18} color={c.textSoft} />
              <TextInput
                value={symbolSearch}
                onChangeText={setSymbolSearch}
                placeholder="Search subscription icons"
                placeholderTextColor={c.textSoft}
                style={[styles.symbolSearchInput, { color: c.text }]}
                autoCapitalize="none"
              />
            </View>
            <View style={styles.symbolProviderRow}>
              {iconProviderOptions.map((provider) => {
                const selected = enabledIconProviders.includes(provider.value);
                return (
                  <Pressable
                    key={provider.value}
                    onPress={() => toggleIconProvider(provider.value)}
                    style={[
                      styles.symbolProviderButton,
                      {
                        backgroundColor: selected ? c.primarySoft : "rgba(255,255,255,0.18)",
                        borderColor: selected ? c.primary : "rgba(255,255,255,0.26)",
                      },
                    ]}
                  >
                    <Text style={[styles.symbolProviderText, { color: selected ? c.primary : previewTextColor }]}>
                      {provider.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.symbolResultList}
            >
              {symbolResults.map((icon) => {
                const selected =
                  selectedIconSource?.provider === icon.provider &&
                  selectedIconSource?.slug === icon.slug &&
                  selectedIconSource?.url === icon.url;

                return (
                  <Pressable
                    key={icon.id}
                    onPress={() => applyIconSource(icon)}
                    style={[
                      styles.symbolResult,
                      {
                        backgroundColor: selected ? c.primarySoft : "rgba(255,255,255,0.18)",
                        borderColor: selected ? c.primary : "rgba(255,255,255,0.26)",
                      },
                    ]}
                  >
                    <View style={styles.symbolResultIcon}>
                      <SubscriptionIcon
                        color={previewTextColor}
                        iconSource={icon}
                        size={22}
                      />
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[styles.symbolResultText, { color: selected ? c.primary : previewTextColor }]}
                    >
                      {icon.title}
                    </Text>
                  </Pressable>
                );
              })}
              {symbolSearchLoading ? (
                <View style={[styles.symbolResult, { backgroundColor: "rgba(255,255,255,0.18)" }]}>
                  <Ionicons name="sync" size={20} color={previewTextColor} />
                  <Text numberOfLines={1} style={[styles.symbolResultText, { color: previewTextColor }]}>
                    Searching
                  </Text>
                </View>
              ) : null}
            </ScrollView>
            <View style={styles.swatchRow}>
              {backgroundColorOptions.map((color) => (
                <Pressable
                  key={color}
                  accessibilityLabel={`Use background ${color}`}
                  onPress={() => setBackgroundColor(color)}
                  style={[
                    styles.backgroundSwatch,
                    {
                      backgroundColor: color,
                      borderColor: backgroundColor === color ? c.text : c.border,
                    },
                  ]}
                />
              ))}
            </View>
          </View>

          <Text style={[styles.formLabel, { color: c.textMuted }]}>CATEGORY</Text>
          <View style={styles.categoryGrid}>
            {categoryOptions.map((item) => (
              <Chip key={item} c={c} label={item} selected={category === item} onPress={() => setCategory(item)} />
            ))}
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>

        <View style={[styles.saveArea, { borderTopColor: c.border, backgroundColor: c.background }]}>
          {subscription && onDelete ? (
            <Pressable
              onPress={confirmDelete}
              style={[styles.deleteSubscriptionButton, { backgroundColor: c.surfaceMuted }]}
            >
              <Ionicons name="trash-outline" size={18} color="#DC2626" />
              <Text style={styles.deleteSubscriptionText}>Delete subscription</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={save} style={[styles.saveButton, { backgroundColor: c.primary }]}>
            <Text style={styles.saveText}>{editing ? "Save changes" : "Add subscription"}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
