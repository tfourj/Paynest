import { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { ColorPickerSheet } from "../components/ColorPickerSheet";
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
import {
  mutedTextColor,
  normalizeHexColor,
  readableTextColor,
  suggestedIconBackgroundColor,
} from "../utils/colors";

type AddSubscriptionProps = {
  c: Colors;
  visible: boolean;
  defaultCurrency: string;
  colorPresets: string[];
  subscription?: Subscription | null;
  onClose: () => void;
  onSave: (item: Omit<Subscription, "id" | "createdAt" | "updatedAt">) => void;
  onRequestNotificationPermission: () => Promise<boolean>;
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
const iconProviderOptions: { label: string; value: IconProvider }[] = [
  { label: "Simple Icons", value: "simpleicons" },
  { label: "SVGL", value: "svgl" },
  { label: "Dashboard Icons", value: "dashboardicons" },
];
const reminderDayOptions = [0, 1, 3];
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

function normalizeTimeInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function isValidReminderTime(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;

  const hour = Number.parseInt(match[1], 10);
  const minute = Number.parseInt(match[2], 10);
  return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
}

export function AddSubscription({
  c,
  visible,
  defaultCurrency,
  colorPresets,
  subscription,
  onClose,
  onSave,
  onRequestNotificationPermission,
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
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderDays, setReminderDays] = useState(0);
  const [reminderTime, setReminderTime] = useState("09:00");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showPresetPicker, setShowPresetPicker] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [activeColorPicker, setActiveColorPicker] = useState<"row" | "icon" | null>(null);
  const [iconName, setIconName] = useState<(typeof visualIconOptions)[number]>("card");
  const [iconLabel, setIconLabel] = useState("");
  const [iconColor, setIconColor] = useState("#2563EB");
  const [backgroundColor, setBackgroundColor] = useState("#2563EB");
  const [customBackgroundInput, setCustomBackgroundInput] = useState("#2563EB");
  const [iconBackgroundColor, setIconBackgroundColor] = useState("#FFFFFF");
  const [customIconBackgroundInput, setCustomIconBackgroundInput] = useState("#FFFFFF");
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
  const previewIconColor = readableTextColor(iconBackgroundColor);
  const previewMutedColor = mutedTextColor(previewTextColor);

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
    setReminderEnabled(subscription?.reminderEnabled ?? false);
    setReminderDays(subscription?.reminderDays ?? 0);
    setReminderTime(subscription?.reminderTime ?? "09:00");
    setIconName((subscription?.iconName as (typeof visualIconOptions)[number] | undefined) ?? "card");
    setIconLabel(subscription?.iconLabel ?? "");
    setIconColor(subscription?.iconColor ?? "#2563EB");
    setBackgroundColor(subscription?.backgroundColor ?? subscription?.iconColor ?? "#2563EB");
    setCustomBackgroundInput(subscription?.backgroundColor ?? subscription?.iconColor ?? "#2563EB");
    setIconBackgroundColor(subscription?.iconBackgroundColor ?? "#FFFFFF");
    setCustomIconBackgroundInput(subscription?.iconBackgroundColor ?? "#FFFFFF");
    setSimpleIconSlug(subscription?.simpleIconSlug);
    setIconProvider(subscription?.iconProvider as IconProvider | undefined);
    setIconUrl(subscription?.iconUrl);
    setIconSourceTitle(subscription?.iconSourceTitle);
    setSymbolSearch("");
    setRemoteIconResults([]);
    setSymbolSearchLoading(false);
    setShowPresetPicker(false);
    setConfirmingDelete(false);
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
    setCustomBackgroundInput(preset.iconColor);
    setIconBackgroundColor("#FFFFFF");
    setCustomIconBackgroundInput("#FFFFFF");
    setSimpleIconSlug(preset.simpleIconSlug);
    setIconProvider("simpleicons");
    setIconUrl(undefined);
    setIconSourceTitle(preset.name);
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

  function updateCustomBackground(value: string) {
    setCustomBackgroundInput(value);
    const color = normalizeHexColor(value);
    if (color) setBackgroundColor(color);
  }

  function updateCustomIconBackground(value: string) {
    setCustomIconBackgroundInput(value);
    const color = normalizeHexColor(value);
    if (color) setIconBackgroundColor(color);
  }

  function applySuggestedIconBackground() {
    const color = suggestedIconBackgroundColor(backgroundColor);
    setIconBackgroundColor(color);
    setCustomIconBackgroundInput(color);
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

  async function updateReminderEnabled(enabled: boolean) {
    if (!enabled) {
      setReminderEnabled(false);
      return;
    }

    const hasPermission = await onRequestNotificationPermission();
    if (!hasPermission) {
      setError("Allow notifications to enable renewal reminders.");
      setReminderEnabled(false);
      return;
    }

    setError("");
    setReminderEnabled(true);
  }

  function save() {
    const parsed = Number.parseFloat(price.replace(",", "."));
    if (!name.trim() || Number.isNaN(parsed) || parsed <= 0) {
      return setError("Enter a subscription name and a price greater than zero.");
    }
    if (reminderEnabled && !isValidReminderTime(reminderTime)) {
      return setError("Enter a reminder time between 00:00 and 23:59.");
    }

    onSave({
      name: name.trim(),
      price: parsed,
      category,
      billingPeriod,
      currency: formCurrency,
      payDay,
      nextRenewalDate: renewal,
      reminderEnabled,
      reminderDays,
      reminderTime,
      iconName: iconLabel ? undefined : iconName,
      iconLabel: iconLabel || undefined,
      iconColor,
      backgroundColor,
      iconBackgroundColor,
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
    setReminderEnabled(false);
    setReminderDays(0);
    setReminderTime("09:00");
    setIconName("card");
    setIconLabel("");
    setIconColor("#2563EB");
    setBackgroundColor("#2563EB");
    setCustomBackgroundInput("#2563EB");
    setIconBackgroundColor("#FFFFFF");
    setCustomIconBackgroundInput("#FFFFFF");
    setSimpleIconSlug(undefined);
    setIconProvider(undefined);
    setIconUrl(undefined);
    setIconSourceTitle(undefined);
    setSymbolSearch("");
    setRemoteIconResults([]);
    setSymbolSearchLoading(false);
    setShowPresetPicker(false);
    setConfirmingDelete(false);
    setError("");
  }

  function deleteSubscription() {
    if (!subscription || !onDelete) return;
    onDelete(subscription);
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
              autoFocus={!editing}
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
              <View style={[styles.iconBadge, { backgroundColor: iconBackgroundColor }]}>
                <SubscriptionIcon
                  color={previewIconColor}
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
            <ColorPickerControl
              c={c}
              label="Row background"
              value={backgroundColor}
              inputValue={customBackgroundInput}
              onOpenPicker={() => setActiveColorPicker("row")}
              onChangeInput={updateCustomBackground}
            />
            <ColorPickerControl
              c={c}
              label="Icon background"
              value={iconBackgroundColor}
              inputValue={customIconBackgroundInput}
              onOpenPicker={() => setActiveColorPicker("icon")}
              onChangeInput={updateCustomIconBackground}
              onSuggest={applySuggestedIconBackground}
            />
          </View>

          <Text style={[styles.formLabel, { color: c.textMuted }]}>CATEGORY</Text>
          <View style={styles.categoryGrid}>
            {categoryOptions.map((item) => (
              <Chip key={item} c={c} label={item} selected={category === item} onPress={() => setCategory(item)} />
            ))}
          </View>

          <Text style={[styles.formLabel, { color: c.textMuted }]}>RENEWAL REMINDER</Text>
          <View style={[styles.inputGroup, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={styles.settingRow}>
              <Ionicons name="notifications-outline" size={21} color={c.primary} />
              <View style={styles.rowText}>
                <Text style={[styles.rowName, { color: c.text }]}>Reminder</Text>
                <Text style={[styles.rowMeta, { color: c.textMuted }]}>Off by default for each subscription</Text>
              </View>
              <Switch
                value={reminderEnabled}
                onValueChange={(enabled) => void updateReminderEnabled(enabled)}
                trackColor={{ false: "#9CA3AF", true: c.primary }}
              />
            </View>

            {reminderEnabled ? (
              <View style={[styles.settingOption, { borderTopColor: c.border }]}>
                <Text style={[styles.rowMeta, { color: c.textMuted }]}>When to remind</Text>
                <View style={styles.chips}>
                  {reminderDayOptions.map((days) => (
                    <Chip
                      key={days}
                      c={c}
                      label={days === 0 ? "Same day" : `${days} day${days > 1 ? "s" : ""} before`}
                      selected={reminderDays === days}
                      onPress={() => setReminderDays(days)}
                    />
                  ))}
                </View>
                <Text style={[styles.rowMeta, { color: c.textMuted }]}>Time</Text>
                <View style={[styles.reminderTimeRow, { backgroundColor: c.surfaceMuted }]}>
                  <Ionicons name="time-outline" size={18} color={c.textMuted} />
                  <TextInput
                    value={reminderTime}
                    onChangeText={(value) => setReminderTime(normalizeTimeInput(value))}
                    placeholder="09:00"
                    placeholderTextColor={c.textSoft}
                    keyboardType={Platform.select({ ios: "number-pad", default: "numeric" })}
                    maxLength={5}
                    style={[styles.reminderTimeInput, { color: c.text }]}
                  />
                </View>
              </View>
            ) : null}
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>

        <ColorPickerSheet
          c={c}
          visible={activeColorPicker !== null}
          title={activeColorPicker === "icon" ? "Icon background" : "Row background"}
          value={activeColorPicker === "icon" ? iconBackgroundColor : backgroundColor}
          presets={colorPresets}
          onClose={() => setActiveColorPicker(null)}
          onChangeColor={(color) => {
            if (activeColorPicker === "icon") {
              updateCustomIconBackground(color);
            } else {
              updateCustomBackground(color);
            }
          }}
        />

        <View style={[styles.saveArea, { borderTopColor: c.border, backgroundColor: c.background }]}>
          {subscription && onDelete ? (
            confirmingDelete ? (
              <View style={styles.deleteConfirmRow}>
                <Pressable
                  onPress={() => setConfirmingDelete(false)}
                  style={[styles.deleteConfirmButton, { backgroundColor: c.surfaceMuted }]}
                >
                  <Text style={[styles.deleteConfirmText, { color: c.text }]}>Cancel</Text>
                </Pressable>
                <Pressable
                  onPress={deleteSubscription}
                  style={[styles.deleteConfirmButton, { backgroundColor: "#DC2626" }]}
                >
                  <Text style={[styles.deleteConfirmText, { color: "#FFFFFF" }]}>Delete</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                onPress={() => setConfirmingDelete(true)}
                style={[styles.deleteSubscriptionButton, { backgroundColor: c.surfaceMuted }]}
              >
                <Ionicons name="trash-outline" size={18} color="#DC2626" />
                <Text style={styles.deleteSubscriptionText}>Delete subscription</Text>
              </Pressable>
            )
          ) : null}
          <Pressable onPress={save} style={[styles.saveButton, { backgroundColor: c.primary }]}>
            <Text style={styles.saveText}>{editing ? "Save changes" : "Add subscription"}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

type ColorPickerControlProps = {
  c: Colors;
  label: string;
  value: string;
  inputValue: string;
  onOpenPicker: () => void;
  onChangeInput: (value: string) => void;
  onSuggest?: () => void;
};

function ColorPickerControl({
  c,
  label,
  value,
  inputValue,
  onOpenPicker,
  onChangeInput,
  onSuggest,
}: ColorPickerControlProps) {
  const inputTextColor = readableTextColor(value);

  return (
    <View style={styles.colorPickerGroup}>
      <Text style={[styles.colorPickerLabel, { color: c.textMuted }]}>{label}</Text>
      <View style={styles.colorPickerRow}>
        <Pressable
          accessibilityLabel={`Choose ${label.toLowerCase()}`}
          onPress={onOpenPicker}
          style={[
            styles.colorWheelButton,
            { backgroundColor: value, borderColor: c.border },
          ]}
        >
          <Ionicons name="color-palette-outline" size={19} color={readableTextColor(value)} />
        </Pressable>
        <TextInput
          value={inputValue}
          onChangeText={onChangeInput}
          placeholder="#2563EB"
          placeholderTextColor={c.textSoft}
          style={[
            styles.customBackgroundInput,
            {
              backgroundColor: value,
              borderColor: c.border,
              color: inputTextColor,
            },
          ]}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
        />
        {onSuggest ? (
          <Pressable
            accessibilityLabel="Suggest icon background color"
            onPress={onSuggest}
            style={[
              styles.colorSuggestButton,
              {
                backgroundColor: c.surface,
                borderColor: c.border,
              },
            ]}
          >
            <Text style={[styles.colorSuggestText, { color: c.text }]}>!</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}
