import { useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Chip } from "../components/common";
import { getSimpleIcon, SimpleIcon } from "../components/SimpleIcon";
import { categories, symbols } from "../constants";
import { styles } from "../styles";
import { subscriptionPresets, type SubscriptionPreset } from "../subscriptionPresets";
import type { Colors } from "../theme";
import { billingPeriods, type BillingPeriod, type Subscription } from "../types";

type AddSubscriptionProps = {
  c: Colors;
  visible: boolean;
  defaultCurrency: string;
  onClose: () => void;
  onSave: (item: Omit<Subscription, "id" | "createdAt" | "updatedAt">) => void;
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
const visualColorOptions = ["#2563EB", "#E50914", "#1DB954", "#8B5CF6", "#F97316", "#0891B2", "#111827", "#64748B"];
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

export function AddSubscription({ c, visible, defaultCurrency, onClose, onSave }: AddSubscriptionProps) {
  const today = useMemo(startOfToday, [visible]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [presetSearch, setPresetSearch] = useState("");
  const [category, setCategory] = useState(noneCategory);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("Monthly");
  const [firstPaymentDate, setFirstPaymentDate] = useState(today);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [iconName, setIconName] = useState<(typeof visualIconOptions)[number]>("card");
  const [iconLabel, setIconLabel] = useState("");
  const [iconColor, setIconColor] = useState("#2563EB");
  const [backgroundColor, setBackgroundColor] = useState("#2563EB");
  const [simpleIconSlug, setSimpleIconSlug] = useState<string | undefined>();
  const [error, setError] = useState("");
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
  const previewTextColor = readableTextColor(backgroundColor);
  const previewMutedColor = previewTextColor === "#FFFFFF" ? "rgba(255,255,255,0.78)" : "#475569";
  const previewBadgeBackground = previewTextColor === "#FFFFFF"
    ? "rgba(255,255,255,0.16)"
    : "rgba(255,255,255,0.72)";

  function applyPreset(preset: SubscriptionPreset) {
    setName(preset.name);
    setPresetSearch(preset.name);
    setCategory(preset.category);
    setIconLabel(preset.iconLabel);
    setIconColor(preset.iconColor);
    setBackgroundColor(preset.iconColor);
    setSimpleIconSlug(preset.simpleIconSlug);
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
      currency: defaultCurrency,
      payDay,
      nextRenewalDate: renewal,
      iconName: iconLabel ? undefined : iconName,
      iconLabel: iconLabel || undefined,
      iconColor,
      backgroundColor,
      simpleIconSlug,
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
    setError("");
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.modal, { backgroundColor: c.background }]}>
        <View style={styles.modalHeader}>
          <Pressable onPress={onClose}>
            <Text style={[styles.cancel, { color: c.primary }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.modalTitle, { color: c.text }]}>Add subscription</Text>
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
                {symbols[defaultCurrency] ?? defaultCurrency}
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

          <Text style={[styles.formLabel, { color: c.textMuted }]}>PRESETS</Text>
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
          <View style={styles.presetList}>
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
                    <Text style={[styles.presetCategory, { color: selected ? "rgba(255,255,255,0.78)" : "#475569" }]}>
                      {preset.category}
                    </Text>
                  </View>
                  {selected ? <Ionicons name="checkmark-circle" size={20} color={presetTextColor} /> : null}
                </Pressable>
              );
            })}
          </View>

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
                  <ScrollView showsVerticalScrollIndicator={false} style={styles.dateWheel}>
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
                  <ScrollView showsVerticalScrollIndicator={false} style={styles.dateWheel}>
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
                  <ScrollView showsVerticalScrollIndicator={false} style={styles.dateWheel}>
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

          <Text style={[styles.formLabel, { color: c.textMuted }]}>VISUAL STYLE</Text>
          <View style={[styles.visualPanel, { backgroundColor, borderColor: c.border }]}>
            <View style={styles.visualPreviewRow}>
              <View style={[styles.iconBadge, { backgroundColor: previewBadgeBackground }]}>
                {getSimpleIcon(simpleIconSlug) ? (
                  <SimpleIcon slug={simpleIconSlug} size={23} color={previewTextColor} />
                ) : iconLabel ? (
                  <Text style={[styles.iconBadgeText, { color: previewTextColor }]}>{iconLabel}</Text>
                ) : (
                  <Ionicons name={iconName} size={22} color={previewTextColor} />
                )}
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowName, { color: previewTextColor }]}>{name.trim() || "Subscription"}</Text>
                <Text style={[styles.rowMeta, { color: previewMutedColor }]}>{category} · {billingPeriod}</Text>
              </View>
              <Text style={[styles.rowPrice, { color: previewTextColor }]}>
                {symbols[defaultCurrency] ?? defaultCurrency} {price || "0.00"}
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
                  }}
                  style={[
                    styles.iconChoice,
                    {
                      backgroundColor: !iconLabel && iconName === item ? c.primarySoft : c.surface,
                      borderColor: !iconLabel && iconName === item ? c.primary : c.border,
                    },
                  ]}
                >
                  <Ionicons name={item} size={18} color={!iconLabel && iconName === item ? c.primary : c.textMuted} />
                </Pressable>
              ))}
            </View>
            <View style={styles.swatchRow}>
              {visualColorOptions.map((color) => (
                <Pressable
                  key={color}
                  accessibilityLabel={`Use accent ${color}`}
                  onPress={() => setIconColor(color)}
                  style={[
                    styles.colorSwatch,
                    {
                      backgroundColor: color,
                      borderColor: iconColor === color ? c.text : "transparent",
                    },
                  ]}
                />
              ))}
            </View>
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
          <Pressable onPress={save} style={[styles.saveButton, { backgroundColor: c.primary }]}>
            <Text style={styles.saveText}>Add subscription</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
