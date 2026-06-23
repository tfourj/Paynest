import { useMemo, useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { Chip } from "../components/common";
import { categories, symbols } from "../constants";
import { styles } from "../styles";
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
const weekDays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

function sameDate(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

function addDays(date: Date, days: number) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addMonths(date: Date, months: number) {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

export function AddSubscription({ c, visible, defaultCurrency, onClose, onSave }: AddSubscriptionProps) {
  const today = useMemo(startOfToday, [visible]);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState(noneCategory);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("Monthly");
  const [renewalDate, setRenewalDate] = useState(today);
  const [visibleMonth, setVisibleMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [error, setError] = useState("");
  const renewal = formatDateValue(renewalDate);
  const monthDays = useMemo(() => {
    const firstDay = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1);
    const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate();
    const blanks = Array.from({ length: firstDay.getDay() }, () => null);
    const dates = Array.from(
      { length: daysInMonth },
      (_, index) => new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), index + 1),
    );
    return [...blanks, ...dates];
  }, [visibleMonth]);

  function selectRenewalDate(date: Date) {
    setRenewalDate(date);
    setVisibleMonth(new Date(date.getFullYear(), date.getMonth(), 1));
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
      nextRenewalDate: renewal,
    });
    setName("");
    setPrice("");
    setCategory(noneCategory);
    setBillingPeriod("Monthly");
    selectRenewalDate(today);
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
              style={[styles.input, { color: c.text, borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]}
              autoFocus
            />
            <View style={styles.priceInput}>
              <Text style={[styles.currency, { color: c.textMuted }]}>{symbols[defaultCurrency] ?? defaultCurrency}</Text>
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

          <View style={[styles.datePicker, { backgroundColor: c.surface, borderColor: c.border }]}>
            <View style={styles.dateHeader}>
              <View>
                <Text style={[styles.dateLabel, { color: c.textMuted }]}>Next renewal</Text>
                <Text style={[styles.dateValue, { color: c.text }]}>{renewal}</Text>
              </View>
              <View style={styles.dateNav}>
                <Pressable
                  accessibilityLabel="Previous month"
                  onPress={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}
                  style={[styles.dateNavButton, { backgroundColor: c.surfaceMuted }]}
                >
                  <Text style={[styles.dateNavText, { color: c.text }]}>{"<"}</Text>
                </Pressable>
                <Pressable
                  accessibilityLabel="Next month"
                  onPress={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}
                  style={[styles.dateNavButton, { backgroundColor: c.surfaceMuted }]}
                >
                  <Text style={[styles.dateNavText, { color: c.text }]}>{">"}</Text>
                </Pressable>
              </View>
            </View>
            <Text style={[styles.dateMonth, { color: c.text }]}>
              {visibleMonth.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </Text>
            <View style={styles.datePresetRow}>
              {[
                { label: "Today", date: today },
                { label: "Tomorrow", date: addDays(today, 1) },
                { label: "Next week", date: addDays(today, 7) },
                { label: "Next month", date: addMonths(today, 1) },
              ].map((preset) => (
                <Pressable
                  key={preset.label}
                  onPress={() => selectRenewalDate(preset.date)}
                  style={[styles.datePreset, { backgroundColor: c.surfaceMuted }]}
                >
                  <Text style={[styles.datePresetText, { color: c.textMuted }]}>{preset.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.weekdayGrid}>
              {weekDays.map((day) => (
                <Text key={day} style={[styles.weekdayText, { color: c.textSoft }]}>
                  {day}
                </Text>
              ))}
            </View>
            <View style={styles.dateGrid}>
              {monthDays.map((date, index) => {
                const selected = date ? sameDate(date, renewalDate) : false;
                return (
                  <Pressable
                    key={date ? formatDateValue(date) : `blank-${index}`}
                    disabled={!date}
                    onPress={() => date && selectRenewalDate(date)}
                    style={[
                      styles.dateCell,
                      date && { backgroundColor: selected ? c.primary : c.surfaceMuted },
                    ]}
                  >
                    {date ? (
                      <Text style={[styles.dateCellText, { color: selected ? "#fff" : c.text }]}>
                        {date.getDate()}
                      </Text>
                    ) : null}
                  </Pressable>
                );
              })}
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
