import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import * as FileSystem from "expo-file-system/legacy";
import type { DocumentPickerAsset } from "expo-document-picker";
import {
  ActivityIndicator,
  Animated,
  Linking,
  type LayoutChangeEvent,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { strFromU8 } from "fflate";

import { AuthModal, type AuthMode } from "../components/AuthModal";
import { appBuildLabel } from "../buildInfo";
import { ColorPickerSheet } from "../components/ColorPickerSheet";
import { Chip, ScreenTitle, StatusPill } from "../components/common";
import { clearCurrencyConversionCache } from "../currencyConversion";
import {
  createSubscriptionExportJson,
  createSubscriptionExportZip,
  parseSubscriptionImportText,
  parseSubscriptionImportZip,
  subscriptionExportFileName,
  subscriptionExportMimeType,
  type SubscriptionExportFormat,
} from "../dataTransfer";
import { clearIconCache } from "../iconCache";
import {
  type PocketBaseClient,
  type PocketBaseConnectionSettings,
  type PocketBaseResolvedConfig,
  type PocketBaseSession,
} from "../pocketbase";
import { sendDebugNotification } from "../notifications";
import { styles } from "../styles";
import type { Colors } from "../theme";
import type { Settings, Subscription } from "../types";
import { currencies } from "../constants";
import { normalizeHexColor, readableTextColor } from "../utils/colors";

type SettingsScreenProps = {
  c: Colors;
  subscriptions: Subscription[];
  settings: Settings;
  session: PocketBaseSession | null;
  pocketBase: PocketBaseClient | null;
  pocketBaseConfig: PocketBaseResolvedConfig;
  pocketBaseConnection: PocketBaseConnectionSettings;
  cloudEncryptionState: "off" | "locked" | "unlocked";
  onUpdate: (settings: Settings) => void;
  onUpdatePocketBaseConnection: (settings: PocketBaseConnectionSettings) => void;
  onAuthSuccess: (settings: PocketBaseConnectionSettings, session: PocketBaseSession) => void;
  onSignOut: () => void;
  onForceSync: () => Promise<void>;
  onEnableCloudEncryption: (password: string, rememberPassword: boolean) => Promise<void>;
  onUnlockCloudEncryption: (password: string, rememberPassword: boolean) => Promise<void>;
  onForgetCloudEncryptionPassword: () => Promise<void>;
  onChangeCloudEncryptionPassword: (
    currentPassword: string,
    nextPassword: string,
    rememberPassword: boolean,
  ) => Promise<void>;
  onDisableCloudEncryption: () => Promise<void>;
  onReset: () => void;
  onImportSubscriptions: (subscriptions: Subscription[]) => Promise<number>;
  onApplyGlobalReminderSettings: () => void;
  onRequestNotificationPermission: () => Promise<boolean>;
};

type SettingsSectionId =
  | "notifications"
  | "currencies"
  | "payday"
  | "appearance"
  | "categories"
  | "paymentMethods"
  | "sync"
  | "data"
  | "about";

type DocumentPickerModule = typeof import("expo-document-picker");
type SettingsSectionLayoutHandler = (section: SettingsSectionId, sectionRef: RefObject<View | null>) => void;

export function SettingsScreen({
  c,
  subscriptions,
  settings,
  session,
  pocketBase,
  pocketBaseConfig,
  pocketBaseConnection,
  cloudEncryptionState,
  onUpdate,
  onUpdatePocketBaseConnection,
  onAuthSuccess,
  onSignOut,
  onForceSync,
  onEnableCloudEncryption,
  onUnlockCloudEncryption,
  onForgetCloudEncryptionPassword,
  onChangeCloudEncryptionPassword,
  onDisableCloudEncryption,
  onReset,
  onImportSubscriptions,
  onApplyGlobalReminderSettings,
  onRequestNotificationPermission,
}: SettingsScreenProps) {
  const [toastMessage, setToastMessage] = useState("");
  const [openSection, setOpenSection] = useState<SettingsSectionId | null>(null);
  const scrollHostRef = useRef<View>(null);
  const scrollViewRef = useRef<ScrollView>(null);
  const pendingScrollSectionRef = useRef<SettingsSectionId | null>(null);
  const scrollYRef = useRef(0);
  const scrollViewportHeightRef = useRef(0);
  const clearToast = useCallback(() => setToastMessage(""), []);
  const toggleSection = useCallback((section: SettingsSectionId) => {
    setOpenSection((current) => {
      const nextSection = current === section ? null : section;
      pendingScrollSectionRef.current = nextSection;
      return nextSection;
    });
  }, []);
  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollYRef.current = event.nativeEvent.contentOffset.y;
  }, []);
  const handleScrollLayout = useCallback((event: LayoutChangeEvent) => {
    scrollViewportHeightRef.current = event.nativeEvent.layout.height;
  }, []);
  const handleSectionLayout = useCallback((section: SettingsSectionId, sectionRef: RefObject<View | null>) => {
    if (pendingScrollSectionRef.current !== section) return;

    const requestFrame = globalThis.requestAnimationFrame ?? ((callback: FrameRequestCallback) => {
      return globalThis.setTimeout(() => callback(Date.now()), 0);
    });

    requestFrame(() => {
      sectionRef.current?.measureInWindow((_sectionX, sectionY, _sectionWidth, sectionHeight) => {
        scrollHostRef.current?.measureInWindow((_scrollX, scrollY, _scrollWidth, scrollHeight) => {
          if (pendingScrollSectionRef.current !== section) return;

          const viewportHeight = scrollHeight || scrollViewportHeightRef.current;
          if (viewportHeight <= 0) return;

          const sectionBottom = sectionY + sectionHeight;
          const viewportBottom = scrollY + viewportHeight;
          const scrollPadding = 20;
          const clippedDistance = sectionBottom - viewportBottom + scrollPadding;

          if (clippedDistance > 0) {
            scrollViewRef.current?.scrollTo({
              y: Math.max(0, scrollYRef.current + clippedDistance),
              animated: true,
            });
          }

          pendingScrollSectionRef.current = null;
        });
      });
    });
  }, []);
  const shouldShowNotificationSettings = Platform.OS !== "web" || (Boolean(session) && settings.usesMobile);
  const syncStatus = pocketBaseConfig.isConfigured
    ? session ? "Syncing with PocketBase" : "Log in to enable sync"
    : "Add your PocketBase URL";

  return (
    <View ref={scrollHostRef} style={styles.screenHost}>
      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.screen}
        onLayout={handleScrollLayout}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        <ScreenTitle c={c} title="Settings" />

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
            onSectionLayout={handleSectionLayout}
            onToggleSection={toggleSection}
            onUpdate={onUpdate}
            onToast={setToastMessage}
          />
        ) : null}
        <CurrencySettings
          c={c}
          settings={settings}
          openSection={openSection}
          onSectionLayout={handleSectionLayout}
          onToggleSection={toggleSection}
          onUpdate={onUpdate}
        />
        <PaydaySettings
          c={c}
          settings={settings}
          openSection={openSection}
          onSectionLayout={handleSectionLayout}
          onToggleSection={toggleSection}
          onUpdate={onUpdate}
        />
        <AppearanceSettings
          c={c}
          settings={settings}
          openSection={openSection}
          onSectionLayout={handleSectionLayout}
          onToggleSection={toggleSection}
          onUpdate={onUpdate}
        />
        <EditableListSettings
          c={c}
          id="categories"
          icon="pricetags-outline"
          title="Categories"
          itemNoun="category"
          placeholder="Add a category"
          values={settings.categories}
          openSection={openSection}
          onSectionLayout={handleSectionLayout}
          onToggleSection={toggleSection}
          onChange={(categories) => onUpdate({ ...settings, categories })}
        />
        <EditableListSettings
          c={c}
          id="paymentMethods"
          icon="card-outline"
          title="Payment methods"
          itemNoun="payment method"
          placeholder="Add a payment method"
          values={settings.paymentMethods}
          openSection={openSection}
          onSectionLayout={handleSectionLayout}
          onToggleSection={toggleSection}
          onChange={(paymentMethods) => onUpdate({ ...settings, paymentMethods })}
        />
        <SyncSettings
          c={c}
          session={session}
          pocketBaseConfig={pocketBaseConfig}
          syncStatus={syncStatus}
          cloudEncryptionState={cloudEncryptionState}
          openSection={openSection}
          onChangeCloudEncryptionPassword={onChangeCloudEncryptionPassword}
          onDisableCloudEncryption={onDisableCloudEncryption}
          onEnableCloudEncryption={onEnableCloudEncryption}
          onForgetCloudEncryptionPassword={onForgetCloudEncryptionPassword}
          onForceSync={onForceSync}
          onSectionLayout={handleSectionLayout}
          onToggleSection={toggleSection}
          onToast={setToastMessage}
          onUnlockCloudEncryption={onUnlockCloudEncryption}
        />
        <DataSettings
          c={c}
          openSection={openSection}
          subscriptions={subscriptions}
          onImportSubscriptions={onImportSubscriptions}
          onReset={onReset}
          onSectionLayout={handleSectionLayout}
          onToast={setToastMessage}
          onToggleSection={toggleSection}
        />
        <AboutSettings
          c={c}
          openSection={openSection}
          onSectionLayout={handleSectionLayout}
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
  onSectionLayout,
  onToast,
  onToggleSection,
}: {
  c: Colors;
  openSection: SettingsSectionId | null;
  onSectionLayout: SettingsSectionLayoutHandler;
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
      onSectionLayout={onSectionLayout}
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
  subscriptions,
  onImportSubscriptions,
  onReset,
  onSectionLayout,
  onToast,
  onToggleSection,
}: {
  c: Colors;
  openSection: SettingsSectionId | null;
  subscriptions: Subscription[];
  onImportSubscriptions: (subscriptions: Subscription[]) => Promise<number>;
  onReset: () => void;
  onSectionLayout: SettingsSectionLayoutHandler;
  onToast: (message: string) => void;
  onToggleSection: (section: SettingsSectionId) => void;
}) {
  const [dataBusy, setDataBusy] = useState<SubscriptionExportFormat | "import" | null>(null);

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

  async function exportSubscriptions(format: SubscriptionExportFormat) {
    if (dataBusy) return;

    setDataBusy(format);
    try {
      const fileName = subscriptionExportFileName(format);
      const mimeType = subscriptionExportMimeType(format);

      if (Platform.OS === "web") {
        await downloadWebExport(format, subscriptions, fileName, mimeType);
      } else if (Platform.OS === "android") {
        onToast("Choose a folder for the export");
        await saveAndroidSubscriptionExportFile(format, subscriptions, fileName, mimeType);
      } else {
        const uri = await writeSubscriptionExportFile(format, subscriptions, fileName);
        await Share.share({
          title: fileName,
          url: uri,
        });
      }

      onToast(`Exported ${subscriptions.length} subscription${subscriptions.length === 1 ? "" : "s"}`);
    } catch (error) {
      console.warn("Subscription export failed", error);
      onToast(error instanceof Error ? error.message : "Could not export subscriptions");
    } finally {
      setDataBusy(null);
    }
  }

  async function importSubscriptions() {
    if (dataBusy) return;

    setDataBusy("import");
    try {
      const DocumentPicker = await loadDocumentPicker();
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/json",
          "application/zip",
          "application/x-zip-compressed",
          "text/json",
          "text/plain",
        ],
        copyToCacheDirectory: true,
        base64: true,
      });

      if (result.canceled || result.assets.length === 0) {
        setDataBusy(null);
        return;
      }

      const imported = await readSubscriptionImport(result.assets[0]);
      const count = await onImportSubscriptions(imported.subscriptions);
      onToast(`Imported ${count} subscription${count === 1 ? "" : "s"}`);
    } catch (error) {
      console.warn("Subscription import failed", error);
      onToast(error instanceof Error ? error.message : "Could not import subscriptions");
    } finally {
      setDataBusy(null);
    }
  }

  return (
    <CollapsibleSettingsSection
      c={c}
      icon="folder-open-outline"
      id="data"
      openSection={openSection}
      title="Data"
      onSectionLayout={onSectionLayout}
      onToggleSection={onToggleSection}
    >
      <Pressable
        disabled={dataBusy !== null}
        onPress={() => void exportSubscriptions("json")}
        style={styles.settingRow}
      >
        <Ionicons name="download-outline" size={21} color={c.primary} />
        <View style={styles.rowText}>
          <Text style={[styles.rowName, { color: c.text }]}>Export JSON</Text>
          <Text style={[styles.rowMeta, { color: c.textMuted }]}>
            Save your subscriptions as a readable Paynest backup
          </Text>
        </View>
        {dataBusy === "json" ? <Text style={[styles.rowMeta, { color: c.textMuted }]}>Working</Text> : null}
      </Pressable>
      <Pressable
        disabled={dataBusy !== null}
        onPress={() => void exportSubscriptions("zip")}
        style={[styles.settingRow, { borderTopColor: c.border }]}
      >
        <Ionicons name="archive-outline" size={21} color={c.primary} />
        <View style={styles.rowText}>
          <Text style={[styles.rowName, { color: c.text }]}>Export ZIP</Text>
          <Text style={[styles.rowMeta, { color: c.textMuted }]}>
            Save your subscriptions in a compressed backup file
          </Text>
        </View>
        {dataBusy === "zip" ? <Text style={[styles.rowMeta, { color: c.textMuted }]}>Working</Text> : null}
      </Pressable>
      <Pressable
        disabled={dataBusy !== null}
        onPress={() => void importSubscriptions()}
        style={[styles.settingRow, { borderTopColor: c.border }]}
      >
        <Ionicons name="cloud-upload-outline" size={21} color={c.primary} />
        <View style={styles.rowText}>
          <Text style={[styles.rowName, { color: c.text }]}>Import backup</Text>
          <Text style={[styles.rowMeta, { color: c.textMuted }]}>
            Add or update subscriptions from a Paynest JSON or ZIP file
          </Text>
        </View>
        {dataBusy === "import" ? <Text style={[styles.rowMeta, { color: c.textMuted }]}>Working</Text> : null}
      </Pressable>
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

async function loadDocumentPicker(): Promise<DocumentPickerModule> {
  try {
    return await import("expo-document-picker");
  } catch (error) {
    console.warn("Document picker module failed to load", error);
    throw new Error("Rebuild the app to enable backup import.");
  }
}

async function writeSubscriptionExportFile(
  format: SubscriptionExportFormat,
  subscriptions: Subscription[],
  fileName: string,
) {
  if (!FileSystem.cacheDirectory) throw new Error("File storage is not available.");

  const uri = `${FileSystem.cacheDirectory}${fileName}`;
  if (format === "zip") {
    await FileSystem.writeAsStringAsync(uri, bytesToBase64(createSubscriptionExportZip(subscriptions)), {
      encoding: FileSystem.EncodingType.Base64,
    });
    return uri;
  }

  await FileSystem.writeAsStringAsync(uri, createSubscriptionExportJson(subscriptions), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  return uri;
}

async function saveAndroidSubscriptionExportFile(
  format: SubscriptionExportFormat,
  subscriptions: Subscription[],
  fileName: string,
  mimeType: string,
) {
  const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!permissions.granted) throw new Error("Choose a folder to export subscriptions.");

  const uri = await FileSystem.StorageAccessFramework.createFileAsync(
    permissions.directoryUri,
    fileName,
    mimeType,
  );

  if (format === "zip") {
    await FileSystem.StorageAccessFramework.writeAsStringAsync(
      uri,
      bytesToBase64(createSubscriptionExportZip(subscriptions)),
      { encoding: FileSystem.EncodingType.Base64 },
    );
    return uri;
  }

  await FileSystem.StorageAccessFramework.writeAsStringAsync(
    uri,
    createSubscriptionExportJson(subscriptions),
    { encoding: FileSystem.EncodingType.UTF8 },
  );
  return uri;
}

async function downloadWebExport(
  format: SubscriptionExportFormat,
  subscriptions: Subscription[],
  fileName: string,
  mimeType: string,
) {
  const runtime = globalThis as {
    Blob?: typeof Blob;
    URL?: typeof URL;
    document?: Document;
  };

  if (!runtime.Blob || !runtime.URL || !runtime.document) return;

  const content = format === "zip"
    ? createSubscriptionExportZip(subscriptions)
    : createSubscriptionExportJson(subscriptions);
  const url = runtime.URL.createObjectURL(new runtime.Blob([content], { type: mimeType }));
  const anchor = runtime.document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.style.display = "none";
  runtime.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  runtime.URL.revokeObjectURL(url);
}

async function readSubscriptionImport(asset: DocumentPickerAsset) {
  const name = asset.name.toLowerCase();
  const isZip = name.endsWith(".zip")
    || asset.mimeType === "application/zip"
    || asset.mimeType === "application/x-zip-compressed";

  if (isZip) {
    const data = await readPickedBytes(asset);
    return parseSubscriptionImportZip(data);
  }

  return parseSubscriptionImportText(await readPickedText(asset));
}

async function readPickedText(asset: DocumentPickerAsset) {
  if (Platform.OS === "web" && asset.file) return asset.file.text();
  if (asset.base64) return strFromU8(base64ToBytes(asset.base64));
  return FileSystem.readAsStringAsync(asset.uri, { encoding: FileSystem.EncodingType.UTF8 });
}

async function readPickedBytes(asset: DocumentPickerAsset) {
  if (Platform.OS === "web" && asset.file) {
    return new Uint8Array(await asset.file.arrayBuffer());
  }

  const base64 = asset.base64 ?? await FileSystem.readAsStringAsync(asset.uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64ToBytes(base64);
}

function bytesToBase64(bytes: Uint8Array) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let output = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const second = bytes[index + 1];
    const third = bytes[index + 2];
    output += alphabet[first >> 2];
    output += alphabet[((first & 3) << 4) | ((second ?? 0) >> 4)];
    output += index + 1 < bytes.length ? alphabet[((second & 15) << 2) | ((third ?? 0) >> 6)] : "=";
    output += index + 2 < bytes.length ? alphabet[third & 63] : "=";
  }

  return output;
}

function base64ToBytes(value: string) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const clean = value.replace(/^data:[^,]+,/, "").replace(/\s/g, "");
  const outputLength = Math.floor((clean.length * 3) / 4) - (clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0);
  const bytes = new Uint8Array(outputLength);
  let byteIndex = 0;

  for (let index = 0; index < clean.length; index += 4) {
    const first = alphabet.indexOf(clean[index]);
    const second = alphabet.indexOf(clean[index + 1]);
    const third = clean[index + 2] === "=" ? 0 : alphabet.indexOf(clean[index + 2]);
    const fourth = clean[index + 3] === "=" ? 0 : alphabet.indexOf(clean[index + 3]);
    const chunk = (first << 18) | (second << 12) | (third << 6) | fourth;

    if (byteIndex < outputLength) bytes[byteIndex] = (chunk >> 16) & 255;
    byteIndex += 1;
    if (byteIndex < outputLength) bytes[byteIndex] = (chunk >> 8) & 255;
    byteIndex += 1;
    if (byteIndex < outputLength) bytes[byteIndex] = chunk & 255;
    byteIndex += 1;
  }

  return bytes;
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
  onSectionLayout,
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
  onSectionLayout: SettingsSectionLayoutHandler;
  onToggleSection: (section: SettingsSectionId) => void;
  onUpdate: (settings: Settings) => void;
  onToast: (message: string) => void;
}) {
  const [sendingTestNotification, setSendingTestNotification] = useState(false);

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

  async function sendTestNotification() {
    if (sendingTestNotification) return;

    setSendingTestNotification(true);
    try {
      const didSchedule = await sendDebugNotification();
      onToast(didSchedule ? "Test notification scheduled" : "Notification permission not granted");
    } catch (error) {
      console.warn("Test notification failed", error);
      onToast("Could not send test notification");
    } finally {
      setSendingTestNotification(false);
    }
  }

  return (
    <CollapsibleSettingsSection
      c={c}
      icon="notifications-outline"
      id="notifications"
      openSection={openSection}
      title="Mobile notifications"
      onSectionLayout={onSectionLayout}
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
        {!isWeb ? (
          <Pressable
            disabled={sendingTestNotification}
            onPress={() => void sendTestNotification()}
            style={[
              styles.syncButton,
              {
                backgroundColor: sendingTestNotification ? c.surfaceMuted : c.primary,
              },
            ]}
          >
            <Ionicons
              name="paper-plane-outline"
              size={18}
              color={sendingTestNotification ? c.textSoft : "#FFFFFF"}
            />
            <Text style={[styles.syncButtonText, { color: sendingTestNotification ? c.textSoft : "#FFFFFF" }]}>
              {sendingTestNotification ? "Sending test" : "Send test notification"}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </CollapsibleSettingsSection>
  );
}

function CurrencySettings({
  c,
  settings,
  openSection,
  onSectionLayout,
  onToggleSection,
  onUpdate,
}: {
  c: Colors;
  settings: Settings;
  openSection: SettingsSectionId | null;
  onSectionLayout: SettingsSectionLayoutHandler;
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
      onSectionLayout={onSectionLayout}
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
  onSectionLayout,
  onToggleSection,
  onUpdate,
}: {
  c: Colors;
  settings: Settings;
  openSection: SettingsSectionId | null;
  onSectionLayout: SettingsSectionLayoutHandler;
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
      onSectionLayout={onSectionLayout}
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
  onSectionLayout,
  onToggleSection,
  onUpdate,
}: {
  c: Colors;
  settings: Settings;
  openSection: SettingsSectionId | null;
  onSectionLayout: SettingsSectionLayoutHandler;
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
        onSectionLayout={onSectionLayout}
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

function EditableListSettings({
  c,
  id,
  icon,
  title,
  itemNoun,
  placeholder,
  values,
  openSection,
  onSectionLayout,
  onToggleSection,
  onChange,
}: {
  c: Colors;
  id: SettingsSectionId;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  itemNoun: string;
  placeholder: string;
  values: string[];
  openSection: SettingsSectionId | null;
  onSectionLayout: SettingsSectionLayoutHandler;
  onToggleSection: (section: SettingsSectionId) => void;
  onChange: (values: string[]) => void;
}) {
  const [input, setInput] = useState("");
  const trimmed = input.trim();
  const canAdd = trimmed.length > 0
    && !values.some((value) => value.toLowerCase() === trimmed.toLowerCase());

  function addValue() {
    if (!canAdd) return;
    onChange([...values, trimmed]);
    setInput("");
  }

  function removeValue(value: string) {
    const next = values.filter((item) => item !== value);
    onChange(next.length > 0 ? next : values);
  }

  return (
    <CollapsibleSettingsSection
      c={c}
      icon={icon}
      id={id}
      openSection={openSection}
      title={title}
      onSectionLayout={onSectionLayout}
      onToggleSection={onToggleSection}
    >
      <View style={styles.settingOption}>
        <Text style={[styles.rowName, { color: c.text }]}>{title}</Text>
        <Text style={[styles.rowMeta, { color: c.textMuted }]}>
          Tap a {itemNoun} to remove it
        </Text>
        <View style={styles.editableListChips}>
          {values.map((value) => (
            <Pressable
              key={value}
              accessibilityLabel={`Remove ${itemNoun} ${value}`}
              onPress={() => removeValue(value)}
              style={[styles.editableListChip, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}
            >
              <Text style={[styles.editableListChipText, { color: c.text }]}>{value}</Text>
              <Ionicons name="close" size={15} color={c.textMuted} />
            </Pressable>
          ))}
        </View>
        <View style={styles.colorPresetInputRow}>
          <TextInput
            value={input}
            onChangeText={setInput}
            placeholder={placeholder}
            placeholderTextColor={c.textSoft}
            style={[
              styles.colorPresetInput,
              {
                backgroundColor: c.surfaceMuted,
                borderColor: c.border,
                color: c.text,
              },
            ]}
            autoCapitalize="words"
            autoCorrect={false}
            maxLength={32}
            onSubmitEditing={addValue}
            returnKeyType="done"
          />
          <Pressable
            disabled={!canAdd}
            accessibilityLabel={`Add ${itemNoun}`}
            onPress={addValue}
            style={[
              styles.colorPresetAddButton,
              { backgroundColor: canAdd ? c.primary : c.surfaceMuted },
            ]}
          >
            <Ionicons name="add" size={20} color={canAdd ? "#FFFFFF" : c.textSoft} />
          </Pressable>
        </View>
      </View>
    </CollapsibleSettingsSection>
  );
}

function SyncSettings({
  c,
  session,
  pocketBaseConfig,
  syncStatus,
  cloudEncryptionState,
  openSection,
  onChangeCloudEncryptionPassword,
  onDisableCloudEncryption,
  onEnableCloudEncryption,
  onForgetCloudEncryptionPassword,
  onForceSync,
  onSectionLayout,
  onToggleSection,
  onToast,
  onUnlockCloudEncryption,
}: {
  c: Colors;
  session: PocketBaseSession | null;
  pocketBaseConfig: PocketBaseResolvedConfig;
  syncStatus: string;
  cloudEncryptionState: "off" | "locked" | "unlocked";
  openSection: SettingsSectionId | null;
  onChangeCloudEncryptionPassword: (
    currentPassword: string,
    nextPassword: string,
    rememberPassword: boolean,
  ) => Promise<void>;
  onDisableCloudEncryption: () => Promise<void>;
  onEnableCloudEncryption: (password: string, rememberPassword: boolean) => Promise<void>;
  onForgetCloudEncryptionPassword: () => Promise<void>;
  onForceSync: () => Promise<void>;
  onSectionLayout: SettingsSectionLayoutHandler;
  onToggleSection: (section: SettingsSectionId) => void;
  onToast: (message: string) => void;
  onUnlockCloudEncryption: (password: string, rememberPassword: boolean) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  const [encryptionMode, setEncryptionMode] = useState<EncryptionModalMode | null>(null);
  const [confirmingDisable, setConfirmingDisable] = useState(false);
  const canSync = pocketBaseConfig.isConfigured
    && Boolean(session)
    && cloudEncryptionState !== "locked"
    && !busy;
  const encryptionStatus = cloudEncryptionState === "unlocked"
    ? "Cloud encrypted"
    : cloudEncryptionState === "locked"
      ? "Needs encryption password"
      : "Server can read synced data";

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

  async function confirmDisableEncryption() {
    setBusy(true);
    try {
      await onDisableCloudEncryption();
      onToast("Cloud encryption disabled");
      setConfirmingDisable(false);
    } catch (error) {
      onToast(error instanceof Error ? error.message : "Could not disable encryption");
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
      onSectionLayout={onSectionLayout}
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
        <View style={[styles.encryptionCard, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}>
          <View style={styles.encryptionHeader}>
            <View style={[styles.encryptionIcon, { backgroundColor: c.primarySoft }]}>
              <Ionicons name="lock-closed-outline" size={20} color={c.primary} />
            </View>
            <View style={styles.rowText}>
              <Text style={[styles.rowName, { color: c.text }]}>Cloud encryption</Text>
              <Text style={[styles.rowMeta, { color: c.textMuted }]}>{encryptionStatus}</Text>
              <StatusPill
                c={c}
                label={cloudEncryptionState === "unlocked"
                  ? "Encrypted"
                  : cloudEncryptionState === "locked" ? "Locked" : "Off"}
              />
            </View>
          </View>
          {cloudEncryptionState === "off" ? (
            <Pressable
              disabled={!session || busy}
              onPress={() => setEncryptionMode("enable")}
              style={[
                styles.encryptionButton,
                {
                  backgroundColor: session && !busy ? c.primary : c.surface,
                  borderColor: session && !busy ? c.primary : c.border,
                },
              ]}
            >
              <Text style={[styles.encryptionButtonText, { color: session && !busy ? "#FFFFFF" : c.textSoft }]}>
                Enable encryption
              </Text>
            </Pressable>
          ) : cloudEncryptionState === "locked" ? (
            <Pressable
              disabled={!session || busy}
              onPress={() => setEncryptionMode("unlock")}
              style={[
                styles.encryptionButton,
                {
                  backgroundColor: session && !busy ? c.primary : c.surface,
                  borderColor: session && !busy ? c.primary : c.border,
                },
              ]}
            >
              <Text style={[styles.encryptionButtonText, { color: session && !busy ? "#FFFFFF" : c.textSoft }]}>
                Unlock encrypted data
              </Text>
            </Pressable>
          ) : (
            <>
              <View style={styles.encryptionActions}>
                <Pressable
                  disabled={busy}
                  onPress={() => setEncryptionMode("change")}
                  style={[styles.encryptionButton, { backgroundColor: c.surface, borderColor: c.border }]}
                >
                  <Text style={[styles.encryptionButtonText, { color: c.text }]}>Change password</Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  onPress={() => {
                    void onForgetCloudEncryptionPassword().then(() => onToast("Saved encryption password forgotten"));
                  }}
                  style={[styles.encryptionButton, { backgroundColor: c.surface, borderColor: c.border }]}
                >
                  <Text style={[styles.encryptionButtonText, { color: c.text }]}>Forget device</Text>
                </Pressable>
              </View>
              <Pressable
                disabled={busy}
                onPress={() => setConfirmingDisable(true)}
                style={[styles.encryptionButton, { backgroundColor: c.surface, borderColor: "#DC2626" }]}
              >
                <Text style={[styles.encryptionButtonText, { color: "#DC2626" }]}>Disable encryption</Text>
              </Pressable>
            </>
          )}
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
      <EncryptionPasswordModal
        c={c}
        mode={encryptionMode}
        onClose={() => setEncryptionMode(null)}
        onSubmit={async (input) => {
          setBusy(true);
          try {
            if (encryptionMode === "enable") {
              await onEnableCloudEncryption(input.password, input.rememberPassword);
              onToast("Cloud encryption enabled");
            } else if (encryptionMode === "unlock") {
              await onUnlockCloudEncryption(input.password, input.rememberPassword);
              onToast("Encrypted data unlocked");
            } else if (encryptionMode === "change") {
              await onChangeCloudEncryptionPassword(
                input.currentPassword,
                input.password,
                input.rememberPassword,
              );
              onToast("Encryption password changed");
            }
            setEncryptionMode(null);
          } catch (error) {
            onToast(error instanceof Error ? error.message : "Encryption update failed");
          } finally {
            setBusy(false);
          }
        }}
      />
      <DisableEncryptionModal
        c={c}
        visible={confirmingDisable}
        busy={busy}
        onCancel={() => setConfirmingDisable(false)}
        onConfirm={() => void confirmDisableEncryption()}
      />
    </CollapsibleSettingsSection>
  );
}

function DisableEncryptionModal({
  c,
  visible,
  busy,
  onCancel,
  onConfirm,
}: {
  c: Colors;
  visible: boolean;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={styles.encryptionModalOverlay}>
        <View style={[styles.encryptionModalPanel, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.encryptionModalTitleRow}>
            <View style={[styles.encryptionIcon, { backgroundColor: "#FEF2F2" }]}>
              <Ionicons name="lock-open-outline" size={20} color="#DC2626" />
            </View>
            <Text style={[styles.encryptionModalTitle, { color: c.text }]}>Disable cloud encryption?</Text>
            <Pressable
              accessibilityLabel="Close disable encryption dialog"
              onPress={onCancel}
              style={[styles.encryptionModalClose, { backgroundColor: c.surfaceMuted }]}
            >
              <Ionicons name="close" size={20} color={c.text} />
            </Pressable>
          </View>
          <View style={[styles.encryptionWarning, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
            <Ionicons name="warning-outline" size={20} color="#DC2626" />
            <Text style={[styles.encryptionWarningText, { color: "#991B1B" }]}>
              Future synced subscription data and settings will be readable by the PocketBase server you use.
            </Text>
          </View>
          <View style={styles.encryptionModalActions}>
            <Pressable
              disabled={busy}
              onPress={onCancel}
              style={[styles.encryptionButton, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}
            >
              <Text style={[styles.encryptionButtonText, { color: c.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={onConfirm}
              style={[styles.encryptionButton, { backgroundColor: c.surface, borderColor: "#DC2626" }]}
            >
              <Text style={[styles.encryptionButtonText, { color: "#DC2626" }]}>
                {busy ? "Disabling" : "Disable encryption"}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

type EncryptionModalMode = "enable" | "unlock" | "change";

function EncryptionPasswordModal({
  c,
  mode,
  onClose,
  onSubmit,
}: {
  c: Colors;
  mode: EncryptionModalMode | null;
  onClose: () => void;
  onSubmit: (input: {
    currentPassword: string;
    password: string;
    rememberPassword: boolean;
  }) => Promise<void>;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberPassword, setRememberPassword] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const title = mode === "change"
    ? "Change encryption password"
    : mode === "unlock"
      ? "Unlock encrypted data"
      : "Enable cloud encryption";

  useEffect(() => {
    if (!mode) {
      setCurrentPassword("");
      setPassword("");
      setConfirmPassword("");
      setRememberPassword(true);
      setBusy(false);
      setMessage("");
    }
  }, [mode]);

  async function submit() {
    if (!mode || busy) return;
    const nextPassword = password.trim();
    if (mode === "change" && currentPassword.trim().length === 0) {
      setMessage("Enter your current encryption password.");
      return;
    }
    if (nextPassword.length < 8) {
      setMessage("Use an encryption password with at least 8 characters.");
      return;
    }
    if (mode !== "unlock" && nextPassword !== confirmPassword.trim()) {
      setMessage("Encryption passwords do not match.");
      return;
    }

    setBusy(true);
    setMessage("");
    await onSubmit({
      currentPassword: currentPassword.trim(),
      password: nextPassword,
      rememberPassword,
    });
    setBusy(false);
  }

  return (
    <Modal visible={Boolean(mode)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.encryptionModalOverlay}>
        <View style={[styles.encryptionModalPanel, { backgroundColor: c.surface, borderColor: c.border }]}>
          <View style={styles.encryptionModalTitleRow}>
            <View style={[styles.encryptionIcon, { backgroundColor: c.primarySoft }]}>
              <Ionicons name="lock-closed-outline" size={20} color={c.primary} />
            </View>
            <Text style={[styles.encryptionModalTitle, { color: c.text }]}>{title}</Text>
            <Pressable
              accessibilityLabel="Close encryption dialog"
              onPress={onClose}
              style={[styles.encryptionModalClose, { backgroundColor: c.surfaceMuted }]}
            >
              <Ionicons name="close" size={20} color={c.text} />
            </Pressable>
          </View>
          <View style={[styles.encryptionWarning, { backgroundColor: "#FEF2F2", borderColor: "#FECACA" }]}>
            <Ionicons name="warning-outline" size={20} color="#DC2626" />
            <Text style={[styles.encryptionWarningText, { color: "#991B1B" }]}>
              Paynest cannot recover encrypted cloud data if this password is lost.
            </Text>
          </View>
          <View style={styles.encryptionFieldStack}>
          {mode === "change" ? (
            <TextInput
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Current password"
              placeholderTextColor={c.textSoft}
              secureTextEntry
              autoCapitalize="none"
              style={[styles.encryptionInput, styles.inputNoOutline, { color: c.text, borderColor: c.border }]}
            />
          ) : null}
          <TextInput
            value={password}
            onChangeText={setPassword}
            placeholder={mode === "unlock" ? "Encryption password" : "New encryption password"}
            placeholderTextColor={c.textSoft}
            secureTextEntry
            autoCapitalize="none"
            style={[styles.encryptionInput, styles.inputNoOutline, { color: c.text, borderColor: c.border }]}
          />
          {mode !== "unlock" ? (
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Confirm encryption password"
              placeholderTextColor={c.textSoft}
              secureTextEntry
              autoCapitalize="none"
              style={[styles.encryptionInput, styles.inputNoOutline, { color: c.text, borderColor: c.border }]}
            />
          ) : null}
          </View>
          <View style={[styles.encryptionRememberRow, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}>
            <View style={styles.rowText}>
              <Text style={[styles.rowName, { color: c.text }]}>Remember on this device</Text>
              <Text style={[styles.rowMeta, { color: c.textMuted }]}>
                Turn off to require the password after restarting or signing in again.
              </Text>
            </View>
            <Switch value={rememberPassword} onValueChange={setRememberPassword} />
          </View>
          {message ? <Text style={[styles.statusText, { color: "#DC2626" }]}>{message}</Text> : null}
          <View style={styles.encryptionModalActions}>
            <Pressable
              onPress={onClose}
              style={[styles.encryptionButton, { backgroundColor: c.surfaceMuted, borderColor: c.border }]}
            >
              <Text style={[styles.encryptionButtonText, { color: c.text }]}>Cancel</Text>
            </Pressable>
            <Pressable
              disabled={busy}
              onPress={() => void submit()}
              style={[styles.encryptionButton, { backgroundColor: c.primary, borderColor: c.primary }]}
            >
              <View style={styles.encryptionButtonContent}>
                {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
                <Text style={[styles.encryptionButtonText, { color: "#FFFFFF" }]}>
                  {busy ? "Working" : "Save"}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function CollapsibleSettingsSection({
  c,
  icon,
  id,
  openSection,
  title,
  onSectionLayout,
  onToggleSection,
  children,
}: {
  c: Colors;
  icon: keyof typeof Ionicons.glyphMap;
  id: SettingsSectionId;
  openSection: SettingsSectionId | null;
  title: string;
  onSectionLayout: SettingsSectionLayoutHandler;
  onToggleSection: (section: SettingsSectionId) => void;
  children: ReactNode;
}) {
  const open = openSection === id;
  const sectionRef = useRef<View>(null);

  return (
    <View
      ref={sectionRef}
      onLayout={() => {
        if (!open) return;

        onSectionLayout(id, sectionRef);
      }}
      style={[styles.card, { backgroundColor: c.surface, borderColor: c.border }]}
    >
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
    <Modal visible transparent animationType="none" statusBarTranslucent>
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
    </Modal>
  );
}
