import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { Chip, StatusPill } from "../components/common";
import { clearIconCache } from "../iconCache";
import { sendDebugNotification } from "../notifications";
import {
  createPocketBaseClient,
  resolvePocketBaseConfig,
  type PocketBaseClient,
  type PocketBaseConnectionSettings,
  type PocketBaseResolvedConfig,
  type PocketBaseSession,
} from "../pocketbase";
import { styles } from "../styles";
import type { Colors } from "../theme";
import type { Settings } from "../types";

type SettingsScreenProps = {
  c: Colors;
  settings: Settings;
  session: PocketBaseSession | null;
  pocketBase: PocketBaseClient | null;
  pocketBaseConfig: PocketBaseResolvedConfig;
  pocketBaseConnection: PocketBaseConnectionSettings;
  onUpdate: (settings: Settings) => void;
  onUpdatePocketBaseConnection: (settings: PocketBaseConnectionSettings) => void;
  onAuthSuccess: (settings: PocketBaseConnectionSettings, session: PocketBaseSession) => void;
  onSignOut: () => void;
  onForceSync: () => Promise<void>;
  onReset: () => void;
};

type AuthMode = "login" | "create" | "forgot";

export function SettingsScreen({
  c,
  settings,
  session,
  pocketBase,
  pocketBaseConfig,
  pocketBaseConnection,
  onUpdate,
  onUpdatePocketBaseConnection,
  onAuthSuccess,
  onSignOut,
  onForceSync,
  onReset,
}: SettingsScreenProps) {
  const syncStatus = pocketBaseConfig.isConfigured
    ? session ? "Syncing with PocketBase" : "Log in to enable sync"
    : "Add your PocketBase URL";

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={[styles.greeting, { color: c.textMuted }]}>Saved on this device</Text>
      <Text style={[styles.title, { color: c.text }]}>Settings</Text>

      <AccountSettings
        c={c}
        session={session}
        pocketBase={pocketBase}
        pocketBaseConnection={pocketBaseConnection}
        pocketBaseConfig={pocketBaseConfig}
        onUpdatePocketBaseConnection={onUpdatePocketBaseConnection}
        onAuthSuccess={onAuthSuccess}
        onSignOut={onSignOut}
      />
      <NotificationSettings c={c} />
      <PaydaySettings c={c} settings={settings} onUpdate={onUpdate} />
      <AppearanceSettings c={c} settings={settings} onUpdate={onUpdate} />
      <SyncSettings
        c={c}
        session={session}
        pocketBaseConfig={pocketBaseConfig}
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
  pocketBase,
  pocketBaseConnection,
  pocketBaseConfig,
  onUpdatePocketBaseConnection,
  onAuthSuccess,
  onSignOut,
}: {
  c: Colors;
  session: PocketBaseSession | null;
  pocketBase: PocketBaseClient | null;
  pocketBaseConnection: PocketBaseConnectionSettings;
  pocketBaseConfig: PocketBaseResolvedConfig;
  onUpdatePocketBaseConnection: (settings: PocketBaseConnectionSettings) => void;
  onAuthSuccess: (settings: PocketBaseConnectionSettings, session: PocketBaseSession) => void;
  onSignOut: () => void;
}) {
  const [mode, setMode] = useState<AuthMode | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function signOut() {
    if (!pocketBase) return;
    setBusy(true);
    await pocketBase.signOut();
    setBusy(false);
    onSignOut();
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
              {pocketBaseConfig.isConfigured
                ? "Connect Paynest to your PocketBase account."
                : "Add your PocketBase server URL to enable sync."}
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
        pocketBaseConnection={pocketBaseConnection}
        onModeChange={setMode}
        onUpdatePocketBaseConnection={onUpdatePocketBaseConnection}
        onAuthSuccess={onAuthSuccess}
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
  pocketBaseConfig,
  syncStatus,
  onForceSync,
}: {
  c: Colors;
  session: PocketBaseSession | null;
  pocketBaseConfig: PocketBaseResolvedConfig;
  syncStatus: string;
  onForceSync: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const canSync = pocketBaseConfig.isConfigured && Boolean(session) && !busy;

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
  pocketBaseConnection,
  onModeChange,
  onUpdatePocketBaseConnection,
  onAuthSuccess,
}: {
  c: Colors;
  mode: AuthMode | null;
  pocketBaseConnection: PocketBaseConnectionSettings;
  onModeChange: (mode: AuthMode | null) => void;
  onUpdatePocketBaseConnection: (settings: PocketBaseConnectionSettings) => void;
  onAuthSuccess: (settings: PocketBaseConnectionSettings, session: PocketBaseSession) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [url, setUrl] = useState(pocketBaseConnection.url);
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

    setUrl(pocketBaseConnection.url);
  }, [mode, pocketBaseConnection]);

  function close() {
    onModeChange(null);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setUrl(pocketBaseConnection.url);
    setMessage("");
  }

  function currentConnection(): PocketBaseConnectionSettings {
    return {
      url,
    };
  }

  function validateConnection(connection: PocketBaseConnectionSettings) {
    const config = resolvePocketBaseConfig(connection);
    if (!connection.url.trim()) return "Enter your PocketBase URL.";
    if (!config.isConfigured) return "Add your PocketBase URL before signing in.";
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

    const config = resolvePocketBaseConfig(connection);
    const authClient = createPocketBaseClient(config);
    if (!authClient) return setMessage("Add your PocketBase URL before signing in.");

    setBusy(true);
    setMessage("");
    try {
      if (mode === "login") {
        const nextSession = await authClient.signIn(email.trim(), password);
        onAuthSuccess(connection, nextSession);
        close();
        return;
      }

      await authClient.signUp(email.trim(), password);
      onUpdatePocketBaseConnection(connection);
      setPassword("");
      setConfirmPassword("");
      setMessage("Check your email to verify your account.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    const connection = currentConnection();
    const validationError = validateConnection(connection);
    if (validationError) return setMessage(validationError);
    if (!email.trim()) return setMessage("Enter your email to reset your password.");
    const config = resolvePocketBaseConfig(connection);
    const authClient = createPocketBaseClient(config);
    if (!authClient) return setMessage("Add your PocketBase URL before resetting a password.");

    setBusy(true);
    setMessage("");
    try {
      await authClient.requestPasswordReset(email.trim());
      onUpdatePocketBaseConnection(connection);
      setMessage("Password reset email sent.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not send reset email");
    } finally {
      setBusy(false);
    }
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
          <Text style={[styles.formLabel, { color: c.textMuted }]}>SERVER</Text>
          <View style={[styles.inputGroup, { backgroundColor: c.surface, borderColor: c.border }]}>
            <TextInput
              value={url}
              onChangeText={setUrl}
              placeholder="PocketBase URL"
              placeholderTextColor={c.textSoft}
              style={[styles.input, { color: c.text }]}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              textContentType="URL"
            />
          </View>

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
