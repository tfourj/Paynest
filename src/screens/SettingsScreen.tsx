import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Animated,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AuthModal, type AuthMode } from "../components/AuthModal";
import { appBuildLabel } from "../buildInfo";
import { ColorPickerSheet } from "../components/ColorPickerSheet";
import { Chip, StatusPill } from "../components/common";
import { clearCurrencyConversionCache } from "../currencyConversion";
import { clearIconCache } from "../iconCache";
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
  onApplyGlobalReminderSettings: () => void;
  onRequestNotificationPermission: () => Promise<boolean>;
};

type SettingsSectionId =
  | "notifications"
  | "currencies"
  | "payday"
  | "appearance"
  | "sync"
  | "data"
  | "about";

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
  onApplyGlobalReminderSettings,
  onRequestNotificationPermission,
}: SettingsScreenProps) {
  const [toastMessage, setToastMessage] = useState("");
  const [openSection, setOpenSection] = useState<SettingsSectionId | null>(null);
  const clearToast = useCallback(() => setToastMessage(""), []);
  const toggleSection = useCallback((section: SettingsSectionId) => {
    setOpenSection((current) => current === section ? null : section);
  }, []);
  const shouldShowNotificationSettings = Platform.OS !== "web" || Boolean(session);
  const syncStatus = pocketBaseConfig.isConfigured
    ? session ? "Syncing with PocketBase" : "Log in to enable sync"
    : "Add your PocketBase URL";

  return (
    <View style={styles.screenHost}>
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
        {shouldShowNotificationSettings ? (
          <NotificationSettings
            c={c}
            isWeb={Platform.OS === "web"}
            openSection={openSection}
            settings={settings}
            onApplyGlobalReminderSettings={onApplyGlobalReminderSettings}
            onRequestNotificationPermission={onRequestNotificationPermission}
            onToggleSection={toggleSection}
            onUpdate={onUpdate}
            onToast={setToastMessage}
          />
        ) : null}
        <CurrencySettings
          c={c}
          settings={settings}
          openSection={openSection}
          onToggleSection={toggleSection}
          onUpdate={onUpdate}
        />
        <PaydaySettings
          c={c}
          settings={settings}
          openSection={openSection}
          onToggleSection={toggleSection}
          onUpdate={onUpdate}
        />
        <AppearanceSettings
          c={c}
          settings={settings}
          openSection={openSection}
          onToggleSection={toggleSection}
          onUpdate={onUpdate}
        />
        <SyncSettings
          c={c}
          session={session}
          pocketBaseConfig={pocketBaseConfig}
          syncStatus={syncStatus}
          openSection={openSection}
          onForceSync={onForceSync}
          onToggleSection={toggleSection}
          onToast={setToastMessage}
        />
        <DataSettings
          c={c}
          openSection={openSection}
          onReset={onReset}
          onToast={setToastMessage}
          onToggleSection={toggleSection}
        />
        <AboutSettings
          c={c}
          openSection={openSection}
          onToast={setToastMessage}
          onToggleSection={toggleSection}
        />
        <Text style={[styles.version, { color: c.textSoft }]}>{appBuildLabel}</Text>
      </ScrollView>
      <Toast c={c} message={toastMessage} onDone={clearToast} />
    </View>
  );
}

const websiteUrl = "https://usepaynest.com";
const privacyUrl = "https://usepaynest.com/privacy";
const githubUrl = "https://github.com/tfourj/Paynest";
const reminderDayOptions = [0, 1, 3];

function normalizeTimeInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

function isValidReminderTime(value: string) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function AboutSettings({
  c,
  openSection,
  onToast,
  onToggleSection,
}: {
  c: Colors;
  openSection: SettingsSectionId | null;
  onToast: (message: string) => void;
  onToggleSection: (section: SettingsSectionId) => void;
}) {
  async function openLink(url: string) {
    try {
      await Linking.openURL(url);
    } catch {
      onToast("Could not open link");
    }
  }

  return (
    <CollapsibleSettingsSection
      c={c}
      icon="information-circle-outline"
      id="about"
      openSection={openSection}
      title="About"
      onToggleSection={onToggleSection}
    >
      <Pressable onPress={() => void openLink(websiteUrl)} style={styles.settingRow}>
        <Ionicons name="globe-outline" size={21} color={c.primary} />
        <View style={styles.rowText}>
          <Text style={[styles.rowName, { color: c.text }]}>Website</Text>
          <Text style={[styles.rowMeta, { color: c.textMuted }]}>{websiteUrl.replace("https://", "")}</Text>
        </View>
        <Ionicons name="open-outline" size={18} color={c.textSoft} />
      </Pressable>
      <Pressable
        onPress={() => void openLink(privacyUrl)}
        style={[styles.settingRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}
      >
        <Ionicons name="shield-checkmark-outline" size={21} color={c.primary} />
        <View style={styles.rowText}>
          <Text style={[styles.rowName, { color: c.text }]}>Privacy Policy</Text>
          <Text style={[styles.rowMeta, { color: c.textMuted }]}>
            Review how Paynest stores and syncs data
          </Text>
        </View>
        <Ionicons name="open-outline" size={18} color={c.textSoft} />
      </Pressable>
      <Pressable
        onPress={() => void openLink(githubUrl)}
        style={[styles.settingRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}
      >
        <Ionicons name="logo-github" size={21} color={c.primary} />
        <View style={styles.rowText}>
          <Text style={[styles.rowName, { color: c.text }]}>GitHub</Text>
          <Text style={[styles.rowMeta, { color: c.textMuted }]}>github.com/tfourj/Paynest</Text>
        </View>
        <Ionicons name="open-outline" size={18} color={c.textSoft} />
      </Pressable>
    </CollapsibleSettingsSection>
  );
}

function DataSettings({
  c,
  openSection,
  onReset,
  onToast,
  onToggleSection,
}: {
  c: Colors;
  openSection: SettingsSectionId | null;
  onReset: () => void;
  onToast: (message: string) => void;
  onToggleSection: (section: SettingsSectionId) => void;
}) {
  async function clearCache() {
    onToast("Clearing icon cache");
    await clearIconCache();
    onToast("Icon cache cleared");
  }

  async function clearCurrencyCache() {
    onToast("Clearing currency cache");
    await clearCurrencyConversionCache();
    onToast("Currency cache cleared");
  }

  return (
    <CollapsibleSettingsSection
      c={c}
      icon="folder-open-outline"
      id="data"
      openSection={openSection}
      title="Data"
      onToggleSection={onToggleSection}
    >
      <Pressable onPress={() => void clearCache()} style={styles.settingRow}>
        <Ionicons name="image-outline" size={21} color={c.primary} />
        <View style={styles.rowText}>
          <Text style={[styles.rowName, { color: c.text }]}>Clear icon cache</Text>
          <Text style={[styles.rowMeta, { color: c.textMuted }]}>
            Remove cached custom icons from this device
          </Text>
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
      <Pressable onPress={onReset} style={[styles.settingRow, { borderTopColor: c.border }]}>
        <Ionicons name="trash-outline" size={21} color="#DC2626" />
        <View style={styles.rowText}>
          <Text style={[styles.rowName, { color: "#DC2626" }]}>Delete local data</Text>
          <Text style={[styles.rowMeta, { color: c.textMuted }]}>
            Remove local subscriptions and reset preferences
          </Text>
        </View>
      </Pressable>
    </CollapsibleSettingsSection>
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

function NotificationSettings({
  c,
  isWeb,
  openSection,
  settings,
  onApplyGlobalReminderSettings,
  onRequestNotificationPermission,
  onToggleSection,
  onUpdate,
  onToast,
}: {
  c: Colors;
  isWeb: boolean;
  openSection: SettingsSectionId | null;
  settings: Settings;
  onApplyGlobalReminderSettings: () => void;
  onRequestNotificationPermission: () => Promise<boolean>;
  onToggleSection: (section: SettingsSectionId) => void;
  onUpdate: (settings: Settings) => void;
  onToast: (message: string) => void;
}) {
  async function updateRemindersEnabled(enabled: boolean) {
    if (!enabled) {
      onUpdate({ ...settings, remindersEnabled: false });
      return;
    }

    if (isWeb) {
      onUpdate({ ...settings, remindersEnabled: true });
      return;
    }

    const hasPermission = await onRequestNotificationPermission();
    if (!hasPermission) {
      onToast("Notification permission not granted");
      return;
    }

    onUpdate({ ...settings, remindersEnabled: true });
  }

  function updateReminderTime(value: string) {
    const nextTime = normalizeTimeInput(value);
    onUpdate({ ...settings, reminderTime: nextTime });
  }

  function applyReminderDefaults() {
    if (settings.remindersEnabled && !isValidReminderTime(settings.reminderTime)) {
      onToast("Enter a reminder time between 00:00 and 23:59");
      return;
    }

    onApplyGlobalReminderSettings();
    onToast("Reminder defaults applied to all subscriptions");
  }

  return (
    <CollapsibleSettingsSection
      c={c}
      icon="notifications-outline"
      id="notifications"
      openSection={openSection}
      title="Mobile notifications"
      onToggleSection={onToggleSection}
    >
      <View style={styles.settingRow}>
        <Ionicons name="notifications-circle-outline" size={21} color={c.primary} />
        <View style={styles.rowText}>
          <Text style={[styles.rowName, { color: c.text }]}>Global reminder defaults</Text>
          <Text style={[styles.rowMeta, { color: c.textMuted }]}>
            Manage reminder settings that sync to the mobile app
          </Text>
        </View>
        <Switch
          value={settings.remindersEnabled}
          onValueChange={(enabled) => void updateRemindersEnabled(enabled)}
          trackColor={{ false: "#9CA3AF", true: c.primary }}
        />
      </View>
      <View style={[styles.settingOption, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border }]}>
        <Text style={[styles.rowName, { color: c.text }]}>Defaults to apply</Text>
        {settings.remindersEnabled ? (
          <>
            <Text style={[styles.rowMeta, { color: c.textMuted }]}>When to remind</Text>
            <View style={styles.chips}>
              {reminderDayOptions.map((days) => (
                <Chip
                  key={days}
                  c={c}
                  label={days === 0 ? "Same day" : `${days} day${days > 1 ? "s" : ""} before`}
                  selected={settings.reminderDays === days}
                  onPress={() => onUpdate({ ...settings, reminderDays: days })}
                />
              ))}
            </View>
            <Text style={[styles.rowMeta, { color: c.textMuted }]}>Time</Text>
            <View style={[styles.reminderTimeRow, { backgroundColor: c.surfaceMuted }]}>
              <Ionicons name="time-outline" size={18} color={c.textMuted} />
              <TextInput
                value={settings.reminderTime}
                onChangeText={updateReminderTime}
                placeholder="09:00"
                placeholderTextColor={c.textSoft}
                keyboardType={Platform.select({ ios: "number-pad", default: "numeric" })}
                maxLength={5}
                style={[styles.reminderTimeInput, { color: c.text }]}
              />
            </View>
          </>
        ) : (
          <Text style={[styles.rowMeta, { color: c.textMuted }]}>
            Applying now will turn reminders off for every subscription.
          </Text>
        )}
        <Pressable onPress={applyReminderDefaults} style={[styles.syncButton, { backgroundColor: c.primary }]}>
          <Ionicons name="copy-outline" size={18} color="#FFFFFF" />
          <Text style={[styles.syncButtonText, { color: "#FFFFFF" }]}>Apply to all subscriptions</Text>
        </Pressable>
        <Text style={[styles.rowMeta, { color: c.textMuted }]}>
          Replaces each subscription reminder setting with these global defaults.
        </Text>
      </View>
    </CollapsibleSettingsSection>
  );
}

function CurrencySettings({
  c,
  settings,
  openSection,
  onToggleSection,
  onUpdate,
}: {
  c: Colors;
  settings: Settings;
  openSection: SettingsSectionId | null;
  onToggleSection: (section: SettingsSectionId) => void;
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
    if (!settings.enabledCurrencies.includes(code)) return;
    onUpdate({ ...settings, currency: code });
  }

  const enabledCurrencyOptions = currencies.filter((currency) => (
    settings.enabledCurrencies.includes(currency.code)
  ));

  return (
    <CollapsibleSettingsSection
      c={c}
      icon="cash-outline"
      id="currencies"
      openSection={openSection}
      title="Currencies"
      onToggleSection={onToggleSection}
    >
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
        <Text style={[styles.rowName, { color: c.text }]}>Default display currency</Text>
        <View style={styles.currencyGrid}>
          {enabledCurrencyOptions.map((currency) => (
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
  openSection,
  onToggleSection,
  onUpdate,
}: {
  c: Colors;
  settings: Settings;
  openSection: SettingsSectionId | null;
  onToggleSection: (section: SettingsSectionId) => void;
  onUpdate: (settings: Settings) => void;
}) {
  function updatePayday(value: string) {
    const parsed = Number.parseInt(value.replace(/\D/g, ""), 10);
    if (Number.isNaN(parsed)) return;
    onUpdate({ ...settings, payday: Math.max(1, Math.min(parsed, 31)) });
  }

  return (
    <CollapsibleSettingsSection
      c={c}
      icon="wallet-outline"
      id="payday"
      openSection={openSection}
      title="Payday"
      onToggleSection={onToggleSection}
    >
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
  openSection,
  onToggleSection,
  onUpdate,
}: {
  c: Colors;
  settings: Settings;
  openSection: SettingsSectionId | null;
  onToggleSection: (section: SettingsSectionId) => void;
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
      <CollapsibleSettingsSection
        c={c}
        icon="moon-outline"
        id="appearance"
        openSection={openSection}
        title="Appearance"
        onToggleSection={onToggleSection}
      >
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
  openSection,
  onForceSync,
  onToggleSection,
  onToast,
}: {
  c: Colors;
  session: PocketBaseSession | null;
  pocketBaseConfig: PocketBaseResolvedConfig;
  syncStatus: string;
  openSection: SettingsSectionId | null;
  onForceSync: () => Promise<void>;
  onToggleSection: (section: SettingsSectionId) => void;
  onToast: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const canSync = pocketBaseConfig.isConfigured && Boolean(session) && !busy;

  async function forceSync() {
    if (!canSync) return;

    setBusy(true);
    onToast("Syncing");
    try {
      await onForceSync();
      onToast("Sync complete");
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <CollapsibleSettingsSection
      c={c}
      icon="cloud-outline"
      id="sync"
      openSection={openSection}
      title="Sync"
      onToggleSection={onToggleSection}
    >
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
      </View>
    </CollapsibleSettingsSection>
  );
}

function CollapsibleSettingsSection({
  c,
  icon,
  id,
  openSection,
  title,
  onToggleSection,
  children,
}: {
  c: Colors;
  icon: keyof typeof Ionicons.glyphMap;
  id: SettingsSectionId;
  openSection: SettingsSectionId | null;
  title: string;
  onToggleSection: (section: SettingsSectionId) => void;
  children: ReactNode;
}) {
  const open = openSection === id;

  return (
    <View style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}>
      <Pressable onPress={() => onToggleSection(id)} style={styles.settingsSectionHeader}>
        <Ionicons name={icon} size={20} color={c.primary} />
        <Text style={[styles.settingsSectionTitle, { color: c.text }]}>{title}</Text>
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={18} color={c.textSoft} />
      </Pressable>
      {open ? <View style={[styles.settingsSectionBody, { borderTopColor: c.border }]}>{children}</View> : null}
    </View>
  );
}

function Toast({
  c,
  message,
  onDone,
}: {
  c: Colors;
  message: string;
  onDone: () => void;
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(12)).current;
  const [displayMessage, setDisplayMessage] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!message) return undefined;

    if (timer.current) clearTimeout(timer.current);
    setDisplayMessage(message);
    opacity.setValue(0);
    translateY.setValue(12);

    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    timer.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 12,
          duration: 220,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setDisplayMessage("");
        onDone();
      });
    }, 2200);

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [message, onDone, opacity, translateY]);

  if (!displayMessage) return null;

  return (
    <View pointerEvents="none" style={styles.toastOverlay}>
      <Animated.View
        style={[
          styles.toast,
          {
            backgroundColor: c.text,
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Text style={[styles.toastText, { color: c.background }]}>{displayMessage}</Text>
      </Animated.View>
    </View>
  );
}
