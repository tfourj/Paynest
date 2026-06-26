import { useState, type ReactNode } from "react";
import { Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AuthModal, type AuthMode } from "../components/AuthModal";
import { ColorPickerSheet } from "../components/ColorPickerSheet";
import { Chip, StatusPill } from "../components/common";
import { clearCurrencyConversionCache } from "../currencyConversion";
import { clearIconCache } from "../iconCache";
import { sendDebugNotification } from "../notifications";
import {
  type PocketBaseClient,
  type PocketBaseConnectionSettings,
  type PocketBaseResolvedConfig,
  type PocketBaseSession,
} from "../pocketbase";
import { styles } from "../styles";
import type { Colors } from "../theme";
import type { Settings } from "../types";
import { currencies } from "../constants";
import { normalizeHexColor, readableTextColor } from "../utils/colors";

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
  onOpenPrivacyPolicy: () => void;
};

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
  onOpenPrivacyPolicy,
}: SettingsScreenProps) {
  const syncStatus = pocketBaseConfig.isConfigured
    ? session ? "Syncing with PocketBase" : "Log in to enable sync"
    : "Add your PocketBase URL";

  return (
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
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
      {Platform.OS === "web" ? null : <NotificationSettings c={c} />}
      <CurrencySettings c={c} settings={settings} onUpdate={onUpdate} />
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
      <LegalSettings c={c} onOpenPrivacyPolicy={onOpenPrivacyPolicy} />
      <Text style={[styles.version, { color: c.textSoft }]}>Paynest · Version 1.0.0</Text>
    </ScrollView>
  );
}

function LegalSettings({
  c,
  onOpenPrivacyPolicy,
}: {
  c: Colors;
  onOpenPrivacyPolicy: () => void;
}) {
  return (
    <CollapsibleSettingsSection c={c} title="Legal" icon="shield-checkmark-outline">
        <Pressable onPress={onOpenPrivacyPolicy} style={styles.settingRow}>
          <Ionicons name="shield-checkmark-outline" size={21} color={c.primary} />
          <View style={styles.rowText}>
            <Text style={[styles.rowName, { color: c.text }]}>Privacy Policy</Text>
            <Text style={[styles.rowMeta, { color: c.textMuted }]}>
              Review how Paynest stores and syncs data
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={18} color={c.textSoft} />
        </Pressable>
    </CollapsibleSettingsSection>
  );
}

function DataSettings({ c, onReset }: { c: Colors; onReset: () => void }) {
  const [cacheStatus, setCacheStatus] = useState("");

  async function clearCache() {
    setCacheStatus("Clearing icon cache");
    await clearIconCache();
    setCacheStatus("Icon cache cleared");
  }

  async function clearCurrencyCache() {
    setCacheStatus("Clearing currency cache");
    await clearCurrencyConversionCache();
    setCacheStatus("Currency cache cleared");
  }

  return (
    <>
      <CollapsibleSettingsSection c={c} title="Data" icon="folder-open-outline">
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
        <Pressable onPress={() => void clearCurrencyCache()} style={[styles.settingRow, { borderTopColor: c.border }]}>
          <Ionicons name="cash-outline" size={21} color={c.primary} />
          <View style={styles.rowText}>
            <Text style={[styles.rowName, { color: c.text }]}>Clear currency cache</Text>
            <Text style={[styles.rowMeta, { color: c.textMuted }]}>
              Refresh cached exchange rates on next conversion
            </Text>
          </View>
        </Pressable>
      </CollapsibleSettingsSection>
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
    <CollapsibleSettingsSection c={c} title="Notifications" icon="notifications-outline">
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
    </CollapsibleSettingsSection>
  );
}

function CurrencySettings({
  c,
  settings,
  onUpdate,
}: {
  c: Colors;
  settings: Settings;
  onUpdate: (settings: Settings) => void;
}) {
  function toggleCurrency(code: string) {
    const enabled = settings.enabledCurrencies.includes(code);
    if (enabled && code === settings.currency) return;
    const nextEnabledCurrencies = enabled
      ? settings.enabledCurrencies.filter((currency) => currency !== code)
      : [...settings.enabledCurrencies, code];

    onUpdate({ ...settings, enabledCurrencies: nextEnabledCurrencies });
  }

  function setDisplayCurrency(code: string) {
    const enabledCurrencies = settings.enabledCurrencies.includes(code)
      ? settings.enabledCurrencies
      : [...settings.enabledCurrencies, code];
    onUpdate({ ...settings, currency: code, enabledCurrencies });
  }

  return (
    <CollapsibleSettingsSection c={c} title="Currencies" icon="cash-outline" defaultOpen>
      <View style={styles.settingRow}>
        <Ionicons name="swap-horizontal-outline" size={21} color={c.primary} />
        <View style={styles.rowText}>
          <Text style={[styles.rowName, { color: c.text }]}>Convert totals to display currency</Text>
          <Text style={[styles.rowMeta, { color: c.textMuted }]}>
            Dashboard and insights use one primary currency
          </Text>
        </View>
        <Switch
          value={settings.convertToPrimaryCurrency}
          onValueChange={(convertToPrimaryCurrency) => onUpdate({ ...settings, convertToPrimaryCurrency })}
          trackColor={{ false: "#9CA3AF", true: c.primary }}
        />
      </View>
      <View style={[styles.settingRow, { borderTopColor: c.border }]}>
        <Ionicons name="albums-outline" size={21} color={c.primary} />
        <View style={styles.rowText}>
          <Text style={[styles.rowName, { color: c.text }]}>Show original currency too</Text>
          <Text style={[styles.rowMeta, { color: c.textMuted }]}>
            Keep the source amount beside converted amounts
          </Text>
        </View>
        <Switch
          value={settings.showOriginalCurrency}
          onValueChange={(showOriginalCurrency) => onUpdate({ ...settings, showOriginalCurrency })}
          trackColor={{ false: "#9CA3AF", true: c.primary }}
        />
      </View>
      <View style={[styles.settingOption, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
        <Text style={[styles.rowName, { color: c.text }]}>Display currency</Text>
        <View style={styles.currencyGrid}>
          {currencies.map((currency) => (
            <Pressable
              key={currency.code}
              onPress={() => setDisplayCurrency(currency.code)}
              style={[
                styles.currencyOption,
                {
                  backgroundColor: settings.currency === currency.code ? c.primarySoft : c.surfaceMuted,
                  borderColor: settings.currency === currency.code ? c.primary : c.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.currencyOptionCode,
                  { color: settings.currency === currency.code ? c.primary : c.text },
                ]}
              >
                {currency.symbol} {currency.code}
              </Text>
              <Text style={[styles.currencyOptionName, { color: c.textMuted }]} numberOfLines={1}>
                {currency.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>
      <View style={[styles.settingOption, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
        <Text style={[styles.rowName, { color: c.text }]}>Enabled for subscriptions</Text>
        <View style={styles.currencyGrid}>
          {currencies.map((currency) => {
            const enabled = settings.enabledCurrencies.includes(currency.code);
            const locked = currency.code === settings.currency;

            return (
              <Pressable
                key={currency.code}
                onPress={() => toggleCurrency(currency.code)}
                style={[
                  styles.currencyOption,
                  {
                    backgroundColor: enabled ? c.primarySoft : c.surfaceMuted,
                    borderColor: enabled ? c.primary : c.border,
                  },
                ]}
              >
                <View style={styles.currencyOptionHeader}>
                  <Text style={[styles.currencyOptionCode, { color: enabled ? c.primary : c.text }]}>
                    {currency.symbol} {currency.code}
                  </Text>
                  <Ionicons
                    name={enabled ? "checkmark-circle" : "ellipse-outline"}
                    size={17}
                    color={enabled ? c.primary : c.textSoft}
                  />
                </View>
                <Text style={[styles.currencyOptionName, { color: c.textMuted }]} numberOfLines={1}>
                  {locked ? "Display currency" : currency.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </CollapsibleSettingsSection>
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
    <CollapsibleSettingsSection c={c} title="Payday" icon="wallet-outline">
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
            trackColor={{ false: "#9CA3AF", true: c.primary }}
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
    </CollapsibleSettingsSection>
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
  const [presetInput, setPresetInput] = useState("");
  const [showPresetColorPicker, setShowPresetColorPicker] = useState(false);
  const [presetPickerColor, setPresetPickerColor] = useState(settings.colorPresets[0] ?? "#2563EB");
  const normalizedPresetInput = normalizeHexColor(presetInput);
  const canAddPreset = Boolean(
    normalizedPresetInput && !settings.colorPresets.includes(normalizedPresetInput),
  );

  function addColorPreset() {
    if (!normalizedPresetInput || !canAddPreset) return;
    addPresetColor(normalizedPresetInput);
    setPresetInput("");
  }

  function addPresetColor(color: string) {
    if (settings.colorPresets.includes(color)) return;
    onUpdate({ ...settings, colorPresets: [...settings.colorPresets, color] });
  }

  function openPresetColorPicker() {
    setPresetPickerColor(normalizedPresetInput ?? settings.colorPresets[0] ?? "#2563EB");
    setShowPresetColorPicker(true);
  }

  function addPickerPreset() {
    addPresetColor(presetPickerColor);
    setPresetInput("");
    setShowPresetColorPicker(false);
  }

  function removeColorPreset(color: string) {
    const nextPresets = settings.colorPresets.filter((preset) => preset !== color);
    onUpdate({ ...settings, colorPresets: nextPresets.length > 0 ? nextPresets : settings.colorPresets });
  }

  return (
    <>
      <CollapsibleSettingsSection c={c} title="Appearance" icon="moon-outline">
        <View style={styles.settingRow}>
          <Ionicons name="moon-outline" size={21} color={c.primary} />
          <View style={styles.rowText}>
            <Text style={[styles.rowName, { color: c.text }]}>Dark mode</Text>
            <Text style={[styles.rowMeta, { color: c.textMuted }]}>Use a dark appearance</Text>
          </View>
          <Switch
            value={settings.theme === "dark"}
            onValueChange={(enabled) => onUpdate({ ...settings, theme: enabled ? "dark" : "light" })}
            trackColor={{ false: "#9CA3AF", true: c.primary }}
          />
        </View>

        <View style={[styles.settingOption, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
          <Text style={[styles.rowName, { color: c.text }]}>Color presets</Text>
          <View style={styles.colorPresetGrid}>
            {settings.colorPresets.map((color) => (
              <Pressable
                key={color}
                accessibilityLabel={`Remove color preset ${color}`}
                onPress={() => removeColorPreset(color)}
                style={[
                  styles.settingsColorPreset,
                  { backgroundColor: color, borderColor: c.border },
                ]}
              >
                <Ionicons name="close" size={15} color={readableTextColor(color)} />
              </Pressable>
            ))}
          </View>
          <View style={styles.colorPresetInputRow}>
            <TextInput
              value={presetInput}
              onChangeText={setPresetInput}
              placeholder="#2563EB"
              placeholderTextColor={c.textSoft}
              style={[
                styles.colorPresetInput,
                {
                  backgroundColor: c.surfaceMuted,
                  borderColor: c.border,
                  color: c.text,
                },
              ]}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={7}
            />
            <Pressable
              accessibilityLabel="Pick color preset"
              onPress={openPresetColorPicker}
              style={[
                styles.colorPresetAddButton,
                { backgroundColor: c.surfaceMuted },
              ]}
            >
              <Ionicons name="color-palette-outline" size={20} color={c.text} />
            </Pressable>
            <Pressable
              disabled={!canAddPreset}
              onPress={addColorPreset}
              style={[
                styles.colorPresetAddButton,
                { backgroundColor: canAddPreset ? c.primary : c.surfaceMuted },
              ]}
            >
              <Ionicons name="add" size={20} color={canAddPreset ? "#FFFFFF" : c.textSoft} />
            </Pressable>
          </View>
        </View>
      </CollapsibleSettingsSection>
      <ColorPickerSheet
        c={c}
        visible={showPresetColorPicker}
        title="Color preset"
        value={presetPickerColor}
        presets={settings.colorPresets}
        onClose={() => setShowPresetColorPicker(false)}
        onChangeColor={setPresetPickerColor}
        onDone={addPickerPreset}
      />
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
    <CollapsibleSettingsSection c={c} title="Sync" icon="cloud-outline">
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
    </CollapsibleSettingsSection>
  );
}

function CollapsibleSettingsSection({
  c,
  title,
  icon,
  defaultOpen = false,
  children,
}: {
  c: Colors;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Pressable onPress={() => setOpen((current) => !current)} style={styles.settingsSectionHeader}>
        <Ionicons name={icon} size={20} color={c.primary} />
        <Text style={[styles.settingsSectionTitle, { color: c.text }]}>{title}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={c.textSoft} />
      </Pressable>
      {open ? <View style={[styles.settingsSectionBody, { borderTopColor: c.border }]}>{children}</View> : null}
    </View>
  );
}
