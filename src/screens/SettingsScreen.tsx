import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Session, SupabaseClient } from "@supabase/supabase-js";

import { Chip, StatusPill } from "../components/common";
import { clearIconCache } from "../iconCache";
import { sendDebugNotification } from "../notifications";
import { styles } from "../styles";
import {
  createSupabaseClient,
  resolveSupabaseConfig,
  type SupabaseConnectionSettings,
  type SupabaseResolvedConfig,
} from "../supabase";
import type { Colors } from "../theme";
import type { Settings } from "../types";

type SettingsScreenProps = {
  c: Colors;
  settings: Settings;
  session: Session | null;
  supabase: SupabaseClient | null;
  supabaseConfig: SupabaseResolvedConfig;
  supabaseConnection: SupabaseConnectionSettings;
  onUpdate: (settings: Settings) => void;
  onUpdateSupabaseConnection: (settings: SupabaseConnectionSettings) => void;
  onForceSync: () => Promise<void>;
  onReset: () => void;
};

type AuthMode = "login" | "create" | "forgot";

export function SettingsScreen({
  c,
  settings,
  session,
  supabase,
  supabaseConfig,
  supabaseConnection,
  onUpdate,
  onUpdateSupabaseConnection,
  onForceSync,
  onReset,
}: SettingsScreenProps) {
  const syncStatus = supabaseConfig.isConfigured
    ? session ? "Syncing with Supabase" : "Log in to enable sync"
    : supabaseConfig.provider === "custom"
      ? "Add custom Supabase credentials"
      : "Add anon key or choose Custom";

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={[styles.greeting, { color: c.textMuted }]}>Saved on this device</Text>
      <Text style={[styles.title, { color: c.text }]}>Settings</Text>

      <AccountSettings
        c={c}
        session={session}
        supabase={supabase}
        supabaseConnection={supabaseConnection}
        supabaseConfig={supabaseConfig}
        onUpdateSupabaseConnection={onUpdateSupabaseConnection}
      />
      <NotificationSettings c={c} />
      <PaydaySettings c={c} settings={settings} onUpdate={onUpdate} />
      <AppearanceSettings c={c} settings={settings} onUpdate={onUpdate} />
      <SyncSettings
        c={c}
        session={session}
        supabaseConfig={supabaseConfig}
        syncStatus={syncStatus}
        onForceSync={onForceSync}
      />
      <DataSettings c={c} onReset={onReset} />
      <Text style={[styles.version, { color: c.textSoft }]}>Paynest · Version 1.0.0</Text>
    </ScrollView>
  );
}

function DataSettings({ c, onReset }: { c: Colors; onReset: () => void }) {
  const [cacheStatus, setCacheStatus] = useState("");

  async function clearCache() {
    setCacheStatus("Clearing icon cache");
    await clearIconCache();
    setCacheStatus("Icon cache cleared");
  }

  return (
    <>
      <Text style={[styles.settingsLabel, { color: c.textMuted }]}>DATA</Text>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Pressable onPress={() => void clearCache()} style={styles.settingRow}>
          <Ionicons name="image-outline" size={21} color={c.primary} />
          <View style={styles.rowText}>
            <Text style={[styles.rowName, { color: c.text }]}>Clear icon cache</Text>
            <Text style={[styles.rowMeta, { color: c.textMuted }]}>
              Remove cached custom icons from this device
            </Text>
            {cacheStatus ? (
              <Text style={[styles.rowMeta, { color: c.textSoft }]}>{cacheStatus}</Text>
            ) : null}
          </View>
        </Pressable>
      </View>
      <Pressable onPress={onReset} style={[styles.dangerRow, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Ionicons name="trash-outline" size={20} color="#DC2626" />
        <Text style={styles.dangerText}>Delete local data</Text>
      </Pressable>
    </>
  );
}

function AccountSettings({
  c,
  session,
  supabase,
  supabaseConnection,
  supabaseConfig,
  onUpdateSupabaseConnection,
}: {
  c: Colors;
  session: Session | null;
  supabase: SupabaseClient | null;
  supabaseConnection: SupabaseConnectionSettings;
  supabaseConfig: SupabaseResolvedConfig;
  onUpdateSupabaseConnection: (settings: SupabaseConnectionSettings) => void;
}) {
  const [mode, setMode] = useState<AuthMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function signOut() {
    if (!supabase) return;
    setBusy(true);
    const { error } = await supabase.auth.signOut();
    setBusy(false);
    if (error) setMessage(error.message);
  }

  return (
    <>
      <Text style={[styles.settingsLabel, { color: c.textMuted }]}>ACCOUNT</Text>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        {session ? (
          <View style={styles.settingOption}>
            <View style={styles.accountHeader}>
              <Ionicons name="person-circle-outline" size={24} color={c.primary} />
              <View style={styles.rowText}>
                <Text style={[styles.rowName, { color: c.text }]}>Signed in</Text>
                <Text style={[styles.rowMeta, { color: c.textMuted }]} numberOfLines={1}>
                  {session.user.email}
                </Text>
                <StatusPill c={c} label="Sync active" />
              </View>
            </View>
            <Pressable
              disabled={busy}
              onPress={signOut}
              style={[styles.authButton, { backgroundColor: c.surfaceMuted }]}
            >
              <Text style={[styles.authButtonText, { color: c.text }]}>
                {busy ? "Working" : "Sign out"}
              </Text>
            </Pressable>
            {message ? <Text style={[styles.statusText, { color: c.textMuted }]}>{message}</Text> : null}
          </View>
        ) : (
          <View style={styles.settingOption}>
            <Text style={[styles.rowMeta, { color: c.textMuted }]}>
              {supabaseConfig.isConfigured
                ? "Connect Paynest to your Supabase account."
                : "Choose Paynest or add a custom Supabase project."}
            </Text>
            <View style={styles.authButtons}>
              <Pressable
                onPress={() => setMode("login")}
                style={[styles.authButton, { backgroundColor: c.primary }]}
              >
                <Text style={styles.primaryButtonText}>Log in</Text>
              </Pressable>
              <Pressable
                onPress={() => setMode("create")}
                style={[styles.authButton, { backgroundColor: c.surfaceMuted }]}
              >
                <Text style={[styles.authButtonText, { color: c.text }]}>Create account</Text>
              </Pressable>
            </View>
          </View>
        )}
      </View>
      <AuthModal
        c={c}
        mode={mode}
        supabaseConnection={supabaseConnection}
        onModeChange={setMode}
        onUpdateSupabaseConnection={onUpdateSupabaseConnection}
      />
    </>
  );
}

function NotificationSettings({ c }: { c: Colors }) {
  const [status, setStatus] = useState("");

  async function testNotifications() {
    setStatus("Requesting notification permission");
    try {
      const scheduled = await sendDebugNotification();
      setStatus(scheduled ? "Test notification scheduled" : "Notification permission not granted");
    } catch {
      setStatus("Could not schedule notification");
    }
  }

  return (
    <>
      <Text style={[styles.settingsLabel, { color: c.textMuted }]}>NOTIFICATIONS</Text>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Pressable onPress={() => void testNotifications()} style={styles.settingRow}>
          <Ionicons name="notifications-outline" size={21} color={c.primary} />
          <View style={styles.rowText}>
            <Text style={[styles.rowName, { color: c.text }]}>Send test notification</Text>
            <Text style={[styles.rowMeta, { color: c.textMuted }]}>
              Request permission and schedule a local test
            </Text>
            {status ? <Text style={[styles.rowMeta, { color: c.textSoft }]}>{status}</Text> : null}
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textSoft} />
        </Pressable>
      </View>
    </>
  );
}

function PaydaySettings({
  c,
  settings,
  onUpdate,
}: {
  c: Colors;
  settings: Settings;
  onUpdate: (settings: Settings) => void;
}) {
  function updatePayday(value: string) {
    const parsed = Number.parseInt(value.replace(/\D/g, ""), 10);
    if (Number.isNaN(parsed)) return;
    onUpdate({ ...settings, payday: Math.max(1, Math.min(parsed, 31)) });
  }

  return (
    <>
      <Text style={[styles.settingsLabel, { color: c.textMuted }]}>PAYDAY</Text>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={styles.settingRow}>
          <Ionicons name="wallet-outline" size={21} color={c.primary} />
          <View style={styles.rowText}>
            <Text style={[styles.rowName, { color: c.text }]}>Monthly payday</Text>
            <Text style={[styles.rowMeta, { color: c.textMuted }]}>
              Count upcoming spend until your next payday
            </Text>
          </View>
          <Switch
            value={settings.paydayEnabled}
            onValueChange={(paydayEnabled) => onUpdate({ ...settings, paydayEnabled })}
            trackColor={{ false: c.surfaceMuted, true: c.primary }}
          />
        </View>

        {settings.paydayEnabled && (
          <View style={[styles.settingOption, { borderTopColor: c.border }]}>
            <Text style={[styles.rowMeta, { color: c.textMuted }]}>Payday date</Text>
            <TextInput
              value={`${settings.payday}`}
              onChangeText={updatePayday}
              placeholder="Day of month"
              placeholderTextColor={c.textSoft}
              keyboardType="number-pad"
              maxLength={2}
              style={[
                styles.paydayInput,
                {
                  backgroundColor: c.surfaceMuted,
                  color: c.text,
                },
              ]}
            />
          </View>
        )}
      </View>
    </>
  );
}

function AppearanceSettings({
  c,
  settings,
  onUpdate,
}: {
  c: Colors;
  settings: Settings;
  onUpdate: (settings: Settings) => void;
}) {
  return (
    <>
      <Text style={[styles.settingsLabel, { color: c.textMuted }]}>APPEARANCE</Text>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={styles.settingRow}>
          <Ionicons name="moon-outline" size={21} color={c.primary} />
          <View style={styles.rowText}>
            <Text style={[styles.rowName, { color: c.text }]}>Dark mode</Text>
            <Text style={[styles.rowMeta, { color: c.textMuted }]}>Use a dark appearance</Text>
          </View>
          <Switch
            value={settings.theme === "dark"}
            onValueChange={(enabled) => onUpdate({ ...settings, theme: enabled ? "dark" : "light" })}
            trackColor={{ false: c.surfaceMuted, true: c.primary }}
          />
        </View>

        <View style={[styles.settingOption, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
          <Text style={[styles.rowName, { color: c.text }]}>Default currency</Text>
          <View style={styles.chips}>
            {["EUR", "USD", "GBP"].map((currency) => (
              <Chip
                key={currency}
                c={c}
                label={currency}
                selected={settings.currency === currency}
                onPress={() => onUpdate({ ...settings, currency })}
              />
            ))}
          </View>
        </View>
      </View>
    </>
  );
}

function SyncSettings({
  c,
  session,
  supabaseConfig,
  syncStatus,
  onForceSync,
}: {
  c: Colors;
  session: Session | null;
  supabaseConfig: SupabaseResolvedConfig;
  syncStatus: string;
  onForceSync: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const canSync = supabaseConfig.isConfigured && Boolean(session) && !busy;

  async function forceSync() {
    if (!canSync) return;

    setBusy(true);
    setMessage("");
    try {
      await onForceSync();
      setMessage("Sync complete");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Text style={[styles.settingsLabel, { color: c.textMuted }]}>SYNC</Text>
      <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
        <View style={styles.settingRow}>
          <Ionicons name="cloud-outline" size={21} color={c.primary} />
          <View style={styles.rowText}>
            <Text style={[styles.rowName, { color: c.text }]}>Cloud sync</Text>
            <Text style={[styles.rowMeta, { color: c.textMuted }]}>{syncStatus}</Text>
            <StatusPill c={c} label={session ? "Sync active" : "Local only"} />
          </View>
        </View>
        <View style={[styles.settingOption, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
          <Pressable
            disabled={!canSync}
            onPress={() => void forceSync()}
            style={[
              styles.syncButton,
              {
                backgroundColor: canSync ? c.primary : c.surfaceMuted,
              },
            ]}
          >
            <Ionicons name="sync" size={18} color={canSync ? "#fff" : c.textSoft} />
            <Text style={[styles.syncButtonText, { color: canSync ? "#fff" : c.textSoft }]}>
              {busy ? "Syncing" : "Force sync"}
            </Text>
          </Pressable>
          {message ? <Text style={[styles.statusText, { color: c.textMuted }]}>{message}</Text> : null}
        </View>
      </View>
    </>
  );
}

function AuthModal({
  c,
  mode,
  supabaseConnection,
  onModeChange,
  onUpdateSupabaseConnection,
}: {
  c: Colors;
  mode: AuthMode | null;
  supabaseConnection: SupabaseConnectionSettings;
  onModeChange: (mode: AuthMode | null) => void;
  onUpdateSupabaseConnection: (settings: SupabaseConnectionSettings) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [provider, setProvider] = useState<SupabaseConnectionSettings["provider"]>(
    supabaseConnection.provider,
  );
  const [customUrl, setCustomUrl] = useState(supabaseConnection.customUrl);
  const [customAnonKey, setCustomAnonKey] = useState(supabaseConnection.customAnonKey);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const title = mode === "create" ? "Create account" : mode === "forgot" ? "Reset password" : "Log in";
  const submitLabel = busy
    ? "Working"
    : mode === "create"
      ? "Create account"
      : mode === "forgot"
        ? "Send reset email"
        : "Log in";
  const success = message.includes("Check") || message.includes("Signed") || message.includes("sent");

  useEffect(() => {
    if (!mode) return;

    setProvider(supabaseConnection.provider);
    setCustomUrl(supabaseConnection.customUrl);
    setCustomAnonKey(supabaseConnection.customAnonKey);
  }, [mode, supabaseConnection]);

  function close() {
    onModeChange(null);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setProvider(supabaseConnection.provider);
    setCustomUrl(supabaseConnection.customUrl);
    setCustomAnonKey(supabaseConnection.customAnonKey);
    setMessage("");
  }

  function currentConnection(): SupabaseConnectionSettings {
    return {
      provider,
      customUrl,
      customAnonKey,
    };
  }

  function validateConnection(connection: SupabaseConnectionSettings) {
    const config = resolveSupabaseConfig(connection);
    if (connection.provider === "custom") {
      if (!connection.customUrl.trim()) return "Enter your Supabase URL.";
      if (!connection.customAnonKey.trim()) return "Enter your Supabase anon key.";
      if (!connection.customAnonKey.trim().startsWith("sb_")) {
        return "Custom anon key must start with sb_.";
      }
    }
    if (!config.isConfigured) return "Add Supabase credentials before signing in.";
    return "";
  }

  async function submit() {
    const connection = currentConnection();
    const validationError = validateConnection(connection);
    if (validationError) return setMessage(validationError);
    if (!email.trim()) return setMessage("Enter your email address.");
    if (mode === "forgot") return resetPassword();
    if (password.length < 6) return setMessage("Enter a password with at least 6 characters.");
    if (mode === "create" && password !== confirmPassword) return setMessage("Passwords do not match.");

    const config = resolveSupabaseConfig(connection);
    const authClient = createSupabaseClient(config);
    if (!authClient) return setMessage("Add Supabase credentials before signing in.");

    setBusy(true);
    setMessage("");
    const credentials = { email: email.trim(), password };
    const { data, error } = mode === "login"
      ? await authClient.auth.signInWithPassword(credentials)
      : await authClient.auth.signUp(credentials);
    setBusy(false);

    if (error) return setMessage(error.message);
    onUpdateSupabaseConnection(connection);
    setPassword("");
    setConfirmPassword("");
    if (data.session) return close();
    setMessage("Check your email to confirm your account.");
  }

  async function resetPassword() {
    const connection = currentConnection();
    const validationError = validateConnection(connection);
    if (validationError) return setMessage(validationError);
    if (!email.trim()) return setMessage("Enter your email to reset your password.");
    const config = resolveSupabaseConfig(connection);
    const authClient = createSupabaseClient(config);
    if (!authClient) return setMessage("Add Supabase credentials before resetting a password.");

    setBusy(true);
    setMessage("");
    const { error } = await authClient.auth.resetPasswordForEmail(email.trim());
    setBusy(false);
    if (!error) onUpdateSupabaseConnection(connection);
    setMessage(error ? error.message : "Password reset email sent.");
  }

  return (
    <Modal visible={mode !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={close}>
      <View style={[styles.modal, { backgroundColor: c.background }]}>
        <View style={styles.modalHeader}>
          <Pressable onPress={close}>
            <Text style={[styles.cancel, { color: c.primary }]}>Cancel</Text>
          </Pressable>
          <Text style={[styles.modalTitle, { color: c.text }]}>{title}</Text>
          <View style={{ width: 48 }} />
        </View>

        <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
          <Text style={[styles.formLabel, { color: c.textMuted }]}>PROVIDER</Text>
          <View style={styles.chips}>
            {(["paynest", "custom"] as const).map((item) => (
              <Chip
                key={item}
                c={c}
                label={item === "paynest" ? "Paynest" : "Custom"}
                selected={provider === item}
                onPress={() => setProvider(item)}
              />
            ))}
          </View>

          {provider === "custom" ? (
            <View style={[styles.inputGroup, { backgroundColor: c.surface, borderColor: c.border }]}>
              <TextInput
                value={customUrl}
                onChangeText={setCustomUrl}
                placeholder="Supabase URL"
                placeholderTextColor={c.textSoft}
                style={[
                  styles.input,
                  {
                    color: c.text,
                    borderBottomColor: c.border,
                    borderBottomWidth: StyleSheet.hairlineWidth,
                  },
                ]}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                textContentType="URL"
              />
              <TextInput
                value={customAnonKey}
                onChangeText={setCustomAnonKey}
                placeholder="Anon key"
                placeholderTextColor={c.textSoft}
                style={[styles.input, { color: c.text }]}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>
          ) : null}

          <Text style={[styles.formLabel, { color: c.textMuted }]}>ACCOUNT</Text>
          <View style={[styles.inputGroup, { backgroundColor: c.surface, borderColor: c.border }]}>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={c.textSoft}
              style={[
                styles.input,
                {
                  color: c.text,
                  borderBottomColor: mode === "forgot" ? "transparent" : c.border,
                  borderBottomWidth: mode === "forgot" ? 0 : StyleSheet.hairlineWidth,
                },
              ]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
            />

            {mode !== "forgot" && (
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="Password"
                placeholderTextColor={c.textSoft}
                style={[
                  styles.input,
                  {
                    color: c.text,
                    borderBottomColor: mode === "create" ? c.border : "transparent",
                    borderBottomWidth: mode === "create" ? StyleSheet.hairlineWidth : 0,
                  },
                ]}
                secureTextEntry
                textContentType={mode === "create" ? "newPassword" : "password"}
              />
            )}

            {mode === "create" && (
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm password"
                placeholderTextColor={c.textSoft}
                style={[styles.input, { color: c.text }]}
                secureTextEntry
                textContentType="newPassword"
              />
            )}
          </View>

          {mode === "login" && (
            <Pressable disabled={busy} onPress={() => onModeChange("forgot")} style={styles.textButton}>
              <Text style={[styles.textButtonText, { color: c.primary }]}>Forgot password?</Text>
            </Pressable>
          )}
          {message ? (
            <Text style={[styles.statusText, { color: success ? c.textMuted : "#DC2626" }]}>{message}</Text>
          ) : null}
        </ScrollView>

        <View style={[styles.saveArea, { borderTopColor: c.border, backgroundColor: c.background }]}>
          <Pressable
            disabled={busy}
            onPress={() => void submit()}
            style={[styles.saveButton, { backgroundColor: c.primary }]}
          >
            <Text style={styles.saveText}>{submitLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
