import { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Session } from "@supabase/supabase-js";

import { Chip, StatusPill } from "../components/common";
import { styles } from "../styles";
import { supabase, supabaseConfig } from "../supabase";
import type { Colors } from "../theme";
import type { Settings } from "../types";

export function SettingsScreen({ c, settings, session, onUpdate, onReset }: { c: Colors; settings: Settings; session: Session | null; onUpdate: (settings: Settings) => void; onReset: () => void }) {
  const syncStatus = supabaseConfig.isConfigured ? (session ? "Signed in for future sync" : "Sign in to prepare sync") : "Add anon key to enable sync";

  return <ScrollView contentContainerStyle={styles.screen}><Text style={[styles.greeting, { color: c.textMuted }]}>Saved on this device</Text><Text style={[styles.title, { color: c.text }]}>Settings</Text>
    <AccountSettings c={c} session={session} />
    <Text style={[styles.settingsLabel, { color: c.textMuted }]}>REMINDERS</Text><View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}><View style={styles.settingRow}><Ionicons name="notifications-outline" size={21} color={c.primary} /><View style={styles.rowText}><Text style={[styles.rowName, { color: c.text }]}>Renewal reminders</Text><Text style={[styles.rowMeta, { color: c.textMuted }]}>Show reminders before a renewal</Text></View><Switch value={settings.remindersEnabled} onValueChange={(remindersEnabled) => onUpdate({ ...settings, remindersEnabled })} trackColor={{ false: c.surfaceMuted, true: c.primary }} /></View>{settings.remindersEnabled && <View style={[styles.settingOption, { borderTopColor: c.border }]}><Text style={[styles.rowMeta, { color: c.textMuted }]}>Remind me</Text><View style={styles.chips}>{[0, 1, 3, 7].map((days) => <Chip key={days} c={c} label={days === 0 ? "Same day" : `${days} day${days > 1 ? "s" : ""}`} selected={settings.reminderDays === days} onPress={() => onUpdate({ ...settings, reminderDays: days })} />)}</View></View>}</View>
    <Text style={[styles.settingsLabel, { color: c.textMuted }]}>APPEARANCE</Text><View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}><View style={styles.settingOption}><Text style={[styles.rowName, { color: c.text }]}>Theme</Text><View style={styles.chips}>{(["system", "light", "dark"] as const).map((theme) => <Chip key={theme} c={c} label={theme[0].toUpperCase() + theme.slice(1)} selected={settings.theme === theme} onPress={() => onUpdate({ ...settings, theme })} />)}</View></View><View style={[styles.settingOption, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}><Text style={[styles.rowName, { color: c.text }]}>Default currency</Text><View style={styles.chips}>{["EUR", "USD", "GBP"].map((currency) => <Chip key={currency} c={c} label={currency} selected={settings.currency === currency} onPress={() => onUpdate({ ...settings, currency })} />)}</View></View></View>
    <Text style={[styles.settingsLabel, { color: c.textMuted }]}>SYNC</Text><View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}><View style={styles.settingRow}><Ionicons name="cloud-outline" size={21} color={c.primary} /><View style={styles.rowText}><Text style={[styles.rowName, { color: c.text }]}>Cloud sync</Text><Text style={[styles.rowMeta, { color: c.textMuted }]}>{syncStatus}</Text><Text style={[styles.rowMeta, { color: c.textSoft }]} numberOfLines={1}>{supabaseConfig.url}</Text><StatusPill c={c} label={session ? "Account connected" : "Local only"} /></View><Text style={[styles.comingSoon, { color: c.textSoft }]}>Soon</Text></View></View>
    <Text style={[styles.settingsLabel, { color: c.textMuted }]}>DATA</Text><Pressable onPress={onReset} style={[styles.dangerRow, { backgroundColor: c.surface, borderColor: c.border }]}><Ionicons name="trash-outline" size={20} color="#DC2626" /><Text style={styles.dangerText}>Delete local data</Text></Pressable><Text style={[styles.version, { color: c.textSoft }]}>Paynest · Version 1.0.0</Text></ScrollView>;
}

function AccountSettings({ c, session }: { c: Colors; session: Session | null }) {
  const [mode, setMode] = useState<"login" | "create" | "forgot" | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function signOut() {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setBusy(false);
    if (error) setMessage(error.message);
  }

  return <><Text style={[styles.settingsLabel, { color: c.textMuted }]}>ACCOUNT</Text><View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
    {!supabaseConfig.isConfigured ? <View style={styles.settingRow}><Ionicons name="person-circle-outline" size={22} color={c.primary} /><View style={styles.rowText}><Text style={[styles.rowName, { color: c.text }]}>Supabase Auth</Text><Text style={[styles.rowMeta, { color: c.textMuted }]}>Add your anon key in .env to enable sign in.</Text></View></View> : session ? <View style={styles.settingOption}><View style={styles.accountHeader}><Ionicons name="person-circle-outline" size={24} color={c.primary} /><View style={styles.rowText}><Text style={[styles.rowName, { color: c.text }]}>Signed in</Text><Text style={[styles.rowMeta, { color: c.textMuted }]} numberOfLines={1}>{session.user.email}</Text><StatusPill c={c} label="Ready for sync setup" /></View></View><Pressable disabled={busy} onPress={signOut} style={[styles.authButton, { backgroundColor: c.surfaceMuted }]}><Text style={[styles.authButtonText, { color: c.text }]}>{busy ? "Working" : "Sign out"}</Text></Pressable>{message ? <Text style={[styles.statusText, { color: c.textMuted }]}>{message}</Text> : null}</View> : <View style={styles.settingOption}><Text style={[styles.rowMeta, { color: c.textMuted }]}>Connect Paynest to your Supabase account.</Text><View style={styles.authButtons}><Pressable onPress={() => setMode("login")} style={[styles.authButton, { backgroundColor: c.primary }]}><Text style={styles.primaryButtonText}>Log in</Text></Pressable><Pressable onPress={() => setMode("create")} style={[styles.authButton, { backgroundColor: c.surfaceMuted }]}><Text style={[styles.authButtonText, { color: c.text }]}>Create account</Text></Pressable></View></View>}
  </View><AuthModal c={c} mode={mode} onModeChange={setMode} /></>;
}

function AuthModal({ c, mode, onModeChange }: { c: Colors; mode: "login" | "create" | "forgot" | null; onModeChange: (mode: "login" | "create" | "forgot" | null) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const title = mode === "create" ? "Create account" : mode === "forgot" ? "Reset password" : "Log in";
  const success = message.includes("Check") || message.includes("Signed") || message.includes("sent");

  function close() {
    onModeChange(null);
    setPassword("");
    setConfirmPassword("");
    setMessage("");
  }

  async function submit() {
    if (!supabase) return setMessage("Add the Supabase anon key before signing in.");
    if (!email.trim()) return setMessage("Enter your email address.");
    if (mode === "forgot") return resetPassword();
    if (password.length < 6) return setMessage("Enter a password with at least 6 characters.");
    if (mode === "create" && password !== confirmPassword) return setMessage("Passwords do not match.");
    setBusy(true);
    setMessage("");
    const credentials = { email: email.trim(), password };
    const { data, error } = mode === "login"
      ? await supabase.auth.signInWithPassword(credentials)
      : await supabase.auth.signUp(credentials);
    setBusy(false);
    if (error) return setMessage(error.message);
    setPassword("");
    setConfirmPassword("");
    setMessage(data.session ? "Signed in." : "Check your email to confirm your account.");
  }

  async function resetPassword() {
    if (!supabase) return setMessage("Add the Supabase anon key before resetting a password.");
    if (!email.trim()) return setMessage("Enter your email to reset your password.");
    setBusy(true);
    setMessage("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setBusy(false);
    setMessage(error ? error.message : "Password reset email sent.");
  }

  return <Modal visible={mode !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}><View style={[styles.modal, { backgroundColor: c.background }]}><View style={styles.modalHeader}><Pressable onPress={close}><Text style={[styles.cancel, { color: c.primary }]}>Cancel</Text></Pressable><Text style={[styles.modalTitle, { color: c.text }]}>{title}</Text><View style={{ width: 48 }} /></View><ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled"><Text style={[styles.formLabel, { color: c.textMuted }]}>ACCOUNT</Text><View style={[styles.inputGroup, { backgroundColor: c.surface, borderColor: c.border }]}><TextInput value={email} onChangeText={setEmail} placeholder="Email" placeholderTextColor={c.textSoft} style={[styles.input, { color: c.text, borderBottomColor: mode === "forgot" ? "transparent" : c.border, borderBottomWidth: mode === "forgot" ? 0 : StyleSheet.hairlineWidth }]} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="emailAddress" />{mode !== "forgot" && <TextInput value={password} onChangeText={setPassword} placeholder="Password" placeholderTextColor={c.textSoft} style={[styles.input, { color: c.text, borderBottomColor: mode === "create" ? c.border : "transparent", borderBottomWidth: mode === "create" ? StyleSheet.hairlineWidth : 0 }]} secureTextEntry textContentType={mode === "create" ? "newPassword" : "password"} />}{mode === "create" && <TextInput value={confirmPassword} onChangeText={setConfirmPassword} placeholder="Confirm password" placeholderTextColor={c.textSoft} style={[styles.input, { color: c.text }]} secureTextEntry textContentType="newPassword" />}</View>{mode === "login" && <Pressable disabled={busy} onPress={() => onModeChange("forgot")} style={styles.textButton}><Text style={[styles.textButtonText, { color: c.primary }]}>Forgot password?</Text></Pressable>}{message ? <Text style={[styles.statusText, { color: success ? c.textMuted : "#DC2626" }]}>{message}</Text> : null}</ScrollView><View style={[styles.saveArea, { borderTopColor: c.border, backgroundColor: c.background }]}><Pressable disabled={busy} onPress={() => void submit()} style={[styles.saveButton, { backgroundColor: c.primary }]}><Text style={styles.saveText}>{busy ? "Working" : mode === "create" ? "Create account" : mode === "forgot" ? "Send reset email" : "Log in"}</Text></Pressable></View></View></Modal>;
}
