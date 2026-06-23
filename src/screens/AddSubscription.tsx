import { useState } from "react";
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { categories, symbols } from "../constants";
import { Chip } from "../components/common";
import { styles } from "../styles";
import type { Colors } from "../theme";
import type { BillingPeriod, Subscription } from "../types";

export function AddSubscription({ c, visible, defaultCurrency, onClose, onSave }: { c: Colors; visible: boolean; defaultCurrency: string; onClose: () => void; onSave: (item: Omit<Subscription, "id" | "createdAt" | "updatedAt">) => void }) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [category, setCategory] = useState("Streaming");
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("Monthly");
  const [renewal, setRenewal] = useState("");
  const [error, setError] = useState("");

  function save() {
    const parsed = Number.parseFloat(price.replace(",", "."));
    if (!name.trim() || Number.isNaN(parsed) || parsed <= 0) return setError("Enter a subscription name and a price greater than zero.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(renewal) || Number.isNaN(new Date(`${renewal}T00:00:00`).getTime())) return setError("Enter the next renewal as YYYY-MM-DD.");
    onSave({ name: name.trim(), price: parsed, category, billingPeriod, currency: defaultCurrency, nextRenewalDate: renewal });
    setName("");
    setPrice("");
    setRenewal("");
    setError("");
  }

  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><SafeAreaView style={[styles.modal, { backgroundColor: c.background }]}><View style={styles.modalHeader}><Pressable onPress={onClose}><Text style={[styles.cancel, { color: c.primary }]}>Cancel</Text></Pressable><Text style={[styles.modalTitle, { color: c.text }]}>Add subscription</Text><View style={{ width: 48 }} /></View><ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled"><Text style={[styles.formLabel, { color: c.textMuted }]}>BASIC INFO</Text><View style={[styles.inputGroup, { backgroundColor: c.surface, borderColor: c.border }]}><TextInput value={name} onChangeText={setName} placeholder="Subscription name" placeholderTextColor={c.textSoft} style={[styles.input, { color: c.text, borderBottomColor: c.border, borderBottomWidth: StyleSheet.hairlineWidth }]} autoFocus /><View style={styles.priceInput}><Text style={[styles.currency, { color: c.textMuted }]}>{symbols[defaultCurrency] ?? defaultCurrency}</Text><TextInput value={price} onChangeText={setPrice} placeholder="Price" placeholderTextColor={c.textSoft} style={[styles.input, { color: c.text }]} keyboardType={Platform.select({ ios: "decimal-pad", default: "numeric" })} /></View></View><Text style={[styles.formLabel, { color: c.textMuted }]}>BILLING</Text><View style={styles.periods}>{(["Monthly", "Yearly"] as const).map((period) => <Pressable key={period} onPress={() => setBillingPeriod(period)} style={[styles.periodButton, { backgroundColor: billingPeriod === period ? c.primarySoft : c.surface, borderColor: billingPeriod === period ? c.primary : c.border }]}><Text style={{ color: billingPeriod === period ? c.primary : c.textMuted }}>{period}</Text></Pressable>)}</View><View style={[styles.inputGroup, { backgroundColor: c.surface, borderColor: c.border }]}><TextInput value={renewal} onChangeText={setRenewal} placeholder="Next renewal (YYYY-MM-DD)" placeholderTextColor={c.textSoft} style={[styles.input, { color: c.text }]} autoCapitalize="none" /></View><Text style={[styles.formLabel, { color: c.textMuted }]}>CATEGORY</Text><View style={styles.categoryGrid}>{categories.map((item) => <Chip key={item} c={c} label={item} selected={category === item} onPress={() => setCategory(item)} />)}</View>{error ? <Text style={styles.errorText}>{error}</Text> : null}</ScrollView><View style={[styles.saveArea, { borderTopColor: c.border, backgroundColor: c.background }]}><Pressable onPress={save} style={[styles.saveButton, { backgroundColor: c.primary }]}><Text style={styles.saveText}>Add subscription</Text></Pressable></View></SafeAreaView></Modal>;
}
