import { useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { Chip } from "../components/common";
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
const payDayOptions = Array.from({ length: 31 }, (_, index) => index + 1);
const quickPayDays = [1, 15, 28, 31];
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
const backgroundColorOptions = ["#EFF6FF", "#FEE2E2", "#ECFDF5", "#F5F3FF", "#FFF7ED", "#ECFEFF", "#F3F4F6", "#F8FAFC"];

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
  return date.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function ordinal(day: number) {
  if (day >= 11 && day <= 13) return `${day}th`;
  const suffix = { 1: "st", 2: "nd", 3: "rd" }[day % 10] ?? "th";
  return `${day}${suffix}`;
}

function dateForPayDay(baseDate: Date, payDay: number) {
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const day = Math.min(payDay, lastDay);
  const candidate = new Date(year, month, day);

  if (candidate.getTime() >= baseDate.getTime()) {
    return candidate;
  }

  const nextMonthLastDay = new Date(year, month + 2, 0).getDate();
  return new Date(year, month + 1, Math.min(payDay, nextMonthLastDay));
}

export function AddSubscription({ c, visible, defaultCurrency, onClose, onSave }: AddSubscriptionProps) {
  const today = useMemo(startOfToday, [visible]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState(noneCategory);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("Monthly");
  const [payDay, setPayDay] = useState(today.getDate());
  const [iconName, setIconName] = useState<(typeof visualIconOptions)[number]>("card");
  const [iconLabel, setIconLabel] = useState("");
  const [iconColor, setIconColor] = useState("#2563EB");
  const [backgroundColor, setBackgroundColor] = useState("#EFF6FF");
  const [simpleIconSlug, setSimpleIconSlug] = useState<string | undefined>();
  const [error, setError] = useState("");
  const renewalDate = useMemo(() => dateForPayDay(today, payDay), [payDay, today]);
  const renewal = formatDateValue(renewalDate);
  const previewMutedColor = "#475569";

  function applyPreset(preset: SubscriptionPreset) {
    setName(preset.name);
    setCategory(preset.category);
    setIconLabel(preset.iconLabel);
    setIconColor(preset.iconColor);
    setBackgroundColor(preset.backgroundColor);
    setSimpleIconSlug(preset.simpleIconSlug);
  }

  function adjustPayDay(delta: number) {
    setPayDay((current) => Math.min(31, Math.max(1, current + delta)));
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
    setCategory(noneCategory);
    setBillingPeriod("Monthly");
    setPayDay(today.getDate());
    setIconName("card");
    setIconLabel("");
    setIconColor("#2563EB");
    setBackgroundColor("#EFF6FF");
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.presetList}>
            {subscriptionPresets.map((preset) => {
              const selected = simpleIconSlug === preset.simpleIconSlug;
              return (
                <Pressable
                  key={preset.simpleIconSlug}
                  onPress={() => applyPreset(preset)}
                  style={[
                    styles.presetPill,
                    {
                      backgroundColor: selected ? preset.backgroundColor : c.surface,
                      borderColor: selected ? preset.iconColor : c.border,
                    },
                  ]}
                >
                  <View style={[styles.presetIcon, { backgroundColor: preset.iconColor }]}>
                    <Text style={styles.presetIconText}>{preset.iconLabel}</Text>
                  </View>
                  <Text style={[styles.presetText, { color: c.text }]}>{preset.name}</Text>
                </Pressable>
              );
            })}
          </ScrollView>

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

          <View style={[styles.payDatePanel, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={styles.payDateTopRow}>
              <View>
                <Text style={[styles.dateLabel, { color: c.textMuted }]}>PAY DATE</Text>
                <Text style={[styles.payDateTitle, { color: c.text }]}>
                  Every {ordinal(payDay)}
                </Text>
                <Text style={[styles.payDateSubtitle, { color: c.textMuted }]}>
                  Next charge {formatLongDate(renewalDate)}
                </Text>
              </View>
              <View style={styles.payDateStepper}>
                <Pressable
                  accessibilityLabel="Previous pay day"
                  onPress={() => adjustPayDay(-1)}
                  style={[styles.payDateStepButton, { backgroundColor: c.surfaceMuted }]}
                >
                  <Ionicons name="remove" size={18} color={c.text} />
                </Pressable>
                <View style={[styles.payDateNumber, { backgroundColor: c.primary }]}>
                  <Text style={styles.payDateNumberText}>{payDay}</Text>
                </View>
                <Pressable
                  accessibilityLabel="Next pay day"
                  onPress={() => adjustPayDay(1)}
                  style={[styles.payDateStepButton, { backgroundColor: c.surfaceMuted }]}
                >
                  <Ionicons name="add" size={18} color={c.text} />
                </Pressable>
              </View>
            </View>

            <View style={styles.payDateQuickRow}>
              {quickPayDays.map((day) => (
                <Pressable
                  key={day}
                  onPress={() => setPayDay(day)}
                  style={[
                    styles.payDateQuickChip,
                    {
                      backgroundColor: payDay === day ? c.primarySoft : c.surfaceMuted,
                      borderColor: payDay === day ? c.primary : "transparent",
                    },
                  ]}
                >
                  <Text style={[styles.payDateQuickText, { color: payDay === day ? c.primary : c.textMuted }]}>
                    {day === 31 ? "Last day" : ordinal(day)}
                  </Text>
                </Pressable>
              ))}
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.payDateRail}
            >
              {payDayOptions.map((day) => (
                <Pressable
                  key={day}
                  onPress={() => setPayDay(day)}
                  style={[
                    styles.payDateRailItem,
                    {
                      backgroundColor: payDay === day ? c.primary : c.surfaceMuted,
                      borderColor: payDay === day ? c.primary : c.border,
                    },
                  ]}
                >
                  <Text style={[styles.payDateRailText, { color: payDay === day ? "#fff" : c.textMuted }]}>
                    {day}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          <Text style={[styles.formLabel, { color: c.textMuted }]}>VISUAL STYLE</Text>
          <View style={[styles.visualPanel, { backgroundColor, borderColor: c.border }]}>
            <View style={styles.visualPreviewRow}>
              <View style={[styles.iconBadge, { backgroundColor: iconColor }]}>
                {iconLabel ? (
                  <Text style={styles.iconBadgeText}>{iconLabel}</Text>
                ) : (
                  <Ionicons name={iconName} size={22} color="#fff" />
                )}
              </View>
              <View style={styles.rowText}>
                <Text style={[styles.rowName, { color: "#111827" }]}>{name.trim() || "Subscription"}</Text>
                <Text style={[styles.rowMeta, { color: previewMutedColor }]}>{category} · {billingPeriod}</Text>
              </View>
              <Text style={[styles.rowPrice, { color: "#111827" }]}>
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
