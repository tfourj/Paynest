import type { PocketBaseClient } from "./pocketbase";
import {
  createMasterKey,
  decryptJsonPayload,
  decryptJsonPayloadWithMasterKey,
  encryptJsonPayloadWithMasterKey,
  isLegacyEncryptedEnvelope,
  parseEncryptedEnvelope,
  serializeEncryptedEnvelope,
  unwrapMasterKey,
  wrapMasterKey,
  type WrappedMasterKey,
} from "./encryption";
import {
  defaultSettings,
  type BillingPeriod,
  type Settings,
  type Subscription,
  type ThemePreference,
} from "./types";

type SubscriptionRecord = {
  id: string;
  user: string;
  local_id: string;
  name: string;
  category: string;
  price: number | string;
  currency: string;
  billing_period: BillingPeriod;
  pay_day?: number | null;
  next_renewal_date: string;
  paused?: boolean | null;
  reminder_enabled?: boolean | null;
  reminder_days?: number | null;
  reminder_time?: string | null;
  icon_name?: string | null;
  icon_label?: string | null;
  icon_color?: string | null;
  background_color?: string | null;
  icon_background_color?: string | null;
  simple_icon_slug?: string | null;
  icon_provider?: string | null;
  icon_url?: string | null;
  icon_source_title?: string | null;
  created_at: string;
  updated_at: string;
};

type SettingsRecord = {
  id: string;
  user: string;
  theme?: ThemePreference | null;
  reminders_enabled: boolean;
  reminder_days: number;
  reminder_time?: string | null;
  currency: string;
  enabled_currencies?: string | null;
  convert_to_primary_currency?: boolean | null;
  show_original_currency?: boolean | null;
  payday_enabled?: boolean | null;
  payday?: number | null;
  uses_mobile?: boolean | null;
  color_presets?: string | null;
  updated_at: string;
};

type EncryptedSubscriptionRecord = {
  id: string;
  user: string;
  local_id: string;
  payload: string;
  schema_version?: number | null;
  updated_at: string;
};

type EncryptedSettingsRecord = {
  id: string;
  user: string;
  payload: string;
  schema_version?: number | null;
  updated_at: string;
};

type UserKeyRecord = {
  id: string;
  user: string;
  kdf: WrappedMasterKey["kdf"];
  iterations: number;
  salt: string;
  encrypted_master_key: string;
  nonce: string;
  schema_version?: number | null;
  updated_at: string;
};

export type SyncStrategy = "merge" | "cloud" | "local";
export type CloudAppData = Awaited<ReturnType<typeof loadCloudAppData>>;
export type CloudEncryptionSession = {
  masterKey: Uint8Array;
  needsMigration?: boolean;
};

export type SyncEncryptionOptions = {
  enabled?: boolean;
  password?: string | null;
  session?: CloudEncryptionSession | null;
};

type LoadCloudEncryptionOptions = string | null | {
  password?: string | null;
  session?: CloudEncryptionSession | null;
};

function toSubscription(row: SubscriptionRecord): Subscription {
  return {
    id: row.local_id || row.id,
    name: row.name,
    category: row.category,
    price: Number(row.price),
    currency: row.currency,
    billingPeriod: row.billing_period,
    payDay: row.pay_day ?? undefined,
    nextRenewalDate: dateOnly(row.next_renewal_date),
    paused: row.paused ?? false,
    reminderEnabled: row.reminder_enabled ?? false,
    reminderDays: row.reminder_days ?? 0,
    reminderTime: row.reminder_time ?? "09:00",
    iconName: row.icon_name ?? undefined,
    iconLabel: row.icon_label ?? undefined,
    iconColor: row.icon_color ?? undefined,
    backgroundColor: row.background_color ?? undefined,
    iconBackgroundColor: row.icon_background_color ?? undefined,
    simpleIconSlug: row.simple_icon_slug ?? undefined,
    iconProvider: row.icon_provider ?? undefined,
    iconUrl: row.icon_url ?? undefined,
    iconSourceTitle: row.icon_source_title ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function toSubscriptionRecord(userId: string, item: Subscription) {
  return {
    user: userId,
    local_id: item.id,
    name: item.name,
    category: item.category,
    price: item.price,
    currency: item.currency,
    billing_period: item.billingPeriod,
    pay_day: item.payDay,
    next_renewal_date: item.nextRenewalDate,
    paused: item.paused,
    reminder_enabled: item.reminderEnabled,
    reminder_days: item.reminderDays,
    reminder_time: item.reminderTime,
    icon_name: item.iconName,
    icon_label: item.iconLabel,
    icon_color: item.iconColor,
    background_color: item.backgroundColor,
    icon_background_color: item.iconBackgroundColor,
    simple_icon_slug: item.simpleIconSlug,
    icon_provider: item.iconProvider,
    icon_url: item.iconUrl,
    icon_source_title: item.iconSourceTitle,
    created_at: item.createdAt,
    updated_at: item.updatedAt,
  };
}

function toSettings(row: SettingsRecord): Settings {
  return {
    ...defaultSettings,
    theme: defaultSettings.theme,
    remindersEnabled: row.reminders_enabled,
    reminderDays: row.reminder_days,
    reminderTime: row.reminder_time ?? defaultSettings.reminderTime,
    currency: row.currency,
    enabledCurrencies: parseEnabledCurrencies(row.enabled_currencies, row.currency),
    convertToPrimaryCurrency: row.convert_to_primary_currency ?? defaultSettings.convertToPrimaryCurrency,
    showOriginalCurrency: row.show_original_currency ?? defaultSettings.showOriginalCurrency,
    paydayEnabled: row.payday_enabled ?? defaultSettings.paydayEnabled,
    payday: row.payday ?? defaultSettings.payday,
    usesMobile: row.uses_mobile ?? defaultSettings.usesMobile,
    colorPresets: parseColorPresets(row.color_presets),
  };
}

function toSettingsRecord(userId: string, settings: Settings) {
  return {
    user: userId,
    reminders_enabled: settings.remindersEnabled,
    reminder_days: settings.reminderDays,
    reminder_time: settings.reminderTime,
    currency: settings.currency,
    enabled_currencies: JSON.stringify(settings.enabledCurrencies),
    convert_to_primary_currency: settings.convertToPrimaryCurrency,
    show_original_currency: settings.showOriginalCurrency,
    payday_enabled: settings.paydayEnabled,
    payday: settings.payday,
    uses_mobile: settings.usesMobile,
    color_presets: JSON.stringify(settings.colorPresets),
    updated_at: new Date().toISOString(),
  };
}

function newerSubscription(a: Subscription, b: Subscription) {
  return new Date(a.updatedAt).getTime() >= new Date(b.updatedAt).getTime() ? a : b;
}

function normalizeLoadCloudEncryptionOptions(encryption?: LoadCloudEncryptionOptions) {
  if (typeof encryption === "string" || encryption === null) {
    return { password: encryption ?? null, session: null };
  }
  return {
    password: encryption?.password ?? null,
    session: encryption?.session ?? null,
  };
}

async function decryptEncryptedPayload<T>(
  envelope: ReturnType<typeof parseEncryptedEnvelope>,
  session: CloudEncryptionSession,
  password?: string | null,
) {
  if (isLegacyEncryptedEnvelope(envelope)) {
    if (!password) throw new Error("Enter your encryption password to sync encrypted data.");
    return decryptJsonPayload<T>(envelope, password);
  }
  return decryptJsonPayloadWithMasterKey<T>(envelope, session.masterKey);
}

export async function loadCloudAppData(
  client: PocketBaseClient | null,
  token: string,
  userId: string,
  encryption?: LoadCloudEncryptionOptions,
) {
  const encryptionOptions = normalizeLoadCloudEncryptionOptions(encryption);
  if (!client) {
    return {
      subscriptions: [],
      settings: null,
      settingsHasCurrencySettings: false,
      encrypted: false,
      locked: false,
      encryptionSession: null,
    };
  }

  const userKey = await getUserKeyIfAvailable(client, token, userId);
  if (userKey) {
    if (!encryptionOptions.session && !encryptionOptions.password) {
      return {
        subscriptions: [],
        settings: null,
        settingsHasCurrencySettings: false,
        encrypted: true,
        locked: true,
        encryptionSession: null,
      };
    }

    const session = encryptionOptions.session ?? {
      masterKey: await unwrapUserKeyRecord(userKey, encryptionOptions.password ?? ""),
    };
    const encryptedRows = await listEncryptedRecordDataIfAvailable(client, token, userId);
    const subscriptions: Subscription[] = [];
    let needsMigration = false;
    for (const record of encryptedRows.subscriptions) {
      const envelope = parseEncryptedEnvelope(record.payload);
      if (isLegacyEncryptedEnvelope(envelope)) needsMigration = true;
      subscriptions.push(await decryptEncryptedPayload<Subscription>(envelope, session, encryptionOptions.password));
    }

    const settingsRecord = encryptedRows.settings[0];
    const settingsEnvelope = settingsRecord ? parseEncryptedEnvelope(settingsRecord.payload) : null;
    if (settingsEnvelope && isLegacyEncryptedEnvelope(settingsEnvelope)) needsMigration = true;
    const settings = settingsEnvelope
      ? await decryptEncryptedPayload<Settings>(settingsEnvelope, session, encryptionOptions.password)
      : null;

    return {
      subscriptions: subscriptions.sort((a, b) => a.name.localeCompare(b.name)),
      settings,
      settingsHasCurrencySettings: true,
      encrypted: true,
      locked: false,
      encryptionSession: {
        masterKey: session.masterKey,
        needsMigration: session.needsMigration || needsMigration,
      },
    };
  }

  const encryptedRows = await listEncryptedRecordDataIfAvailable(client, token, userId);
  if (encryptedRows.settings.length > 0 || encryptedRows.subscriptions.length > 0) {
    if (!encryptionOptions.password) {
      return {
        subscriptions: [],
        settings: null,
        settingsHasCurrencySettings: false,
        encrypted: true,
        locked: true,
        encryptionSession: null,
      };
    }

    const subscriptions: Subscription[] = [];
    for (const record of encryptedRows.subscriptions) {
      subscriptions.push(await decryptJsonPayload<Subscription>(
        parseEncryptedEnvelope(record.payload),
        encryptionOptions.password,
      ));
    }
    const settingsRecord = encryptedRows.settings[0];
    const settings = settingsRecord
      ? await decryptJsonPayload<Settings>(parseEncryptedEnvelope(settingsRecord.payload), encryptionOptions.password)
      : null;
    const legacySession = {
      masterKey: createMasterKey(),
      needsMigration: true,
    };

    return {
      subscriptions: subscriptions.sort((a, b) => a.name.localeCompare(b.name)),
      settings,
      settingsHasCurrencySettings: true,
      encrypted: true,
      locked: false,
      encryptionSession: legacySession,
    };
  }

  return loadPlaintextCloudAppData(client, token, userId);
}

export async function syncAppData(
  client: PocketBaseClient | null,
  token: string,
  userId: string,
  localSubscriptions: Subscription[],
  localSettings: Settings,
  strategy: SyncStrategy = "merge",
  initialCloud?: CloudAppData,
  encryption?: SyncEncryptionOptions,
) {
  if (!client) return { subscriptions: localSubscriptions, settings: localSettings, encryptionSession: null };

  const cloud = initialCloud ?? await loadCloudAppData(client, token, userId, {
    password: encryption?.password,
    session: encryption?.session,
  });
  const shouldEncrypt = Boolean(encryption?.enabled || cloud.encrypted);
  if (shouldEncrypt) {
    if (!encryption?.password) throw new Error("Enter your encryption password to sync encrypted data.");
    if (cloud.locked) throw new Error("Unlock encrypted cloud data before syncing.");
    const session = encryption.session ?? cloud.encryptionSession ?? { masterKey: createMasterKey() };
    const shouldWriteUserKey = !cloud.encrypted || session.needsMigration || !cloud.encryptionSession;
    if (shouldWriteUserKey) {
      try {
        await upsertUserKey(client, token, userId, encryption.password, session.masterKey);
      } catch (error) {
        if (isMissingEncryptedCollectionError(error)) {
          throw new Error(
            "Update your PocketBase server. The user_keys, encrypted_subscriptions, and encrypted_settings collections are missing.",
          );
        }
        throw error;
      }
    }
    return syncEncryptedRecords(
      client,
      token,
      userId,
      localSubscriptions,
      localSettings,
      strategy,
      cloud,
      session,
    );
  }

  if (strategy === "cloud") {
    const settings = mergeCloudSettings(cloud, localSettings);
    if (!cloud.settings || !cloud.settingsHasCurrencySettings) {
      await upsertSettings(client, token, userId, settings);
    }
    return { subscriptions: cloud.subscriptions, settings, encryptionSession: null };
  }

  if (strategy === "local") {
    await deleteUserSubscriptions(client, token, userId);

    const subscriptions = [...localSubscriptions].sort((a, b) => a.name.localeCompare(b.name));
    await Promise.all([
      upsertSubscriptions(client, token, userId, subscriptions),
      upsertSettings(client, token, userId, localSettings),
    ]);
    return { subscriptions, settings: localSettings, encryptionSession: null };
  }

  const merged = new Map<string, Subscription>();
  for (const item of localSubscriptions) merged.set(item.id, item);
  for (const cloudItem of cloud.subscriptions) {
    const localItem = merged.get(cloudItem.id);
    merged.set(cloudItem.id, localItem ? newerSubscription(localItem, cloudItem) : cloudItem);
  }

  const subscriptions = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
  const settings = mergeCloudSettings(cloud, localSettings);

  await Promise.all([
    upsertSubscriptions(client, token, userId, subscriptions),
    upsertSettings(client, token, userId, settings),
  ]);

  return { subscriptions, settings, encryptionSession: null };
}

export async function upsertSubscriptions(
  client: PocketBaseClient | null,
  token: string,
  userId: string,
  subscriptions: Subscription[],
) {
  if (!client || subscriptions.length === 0) return;

  const existingRecords = await listUserSubscriptions(client, token, userId);
  const recordsByLocalId = new Map(existingRecords.map((record) => [record.local_id, record]));

  await Promise.all(subscriptions.map((item) => {
    const existing = recordsByLocalId.get(item.id);
    const body = toSubscriptionRecord(userId, item);
    return existing
      ? client.updateRecord("subscriptions", existing.id, token, body)
      : client.createRecord("subscriptions", token, body);
  }));
}

export async function deleteSubscriptionFromCloud(
  client: PocketBaseClient | null,
  token: string,
  userId: string,
  localId: string,
) {
  if (!client) return;

  const records = await listUserSubscriptions(client, token, userId, localId);
  await Promise.all(records.map((record) => client.deleteRecord("subscriptions", record.id, token)));
}

export async function upsertEncryptedSubscriptionChanges(
  client: PocketBaseClient | null,
  token: string,
  userId: string,
  session: CloudEncryptionSession,
  subscriptions: Subscription[],
) {
  if (!client || subscriptions.length === 0) return;
  await upsertEncryptedSubscriptions(client, token, userId, session, subscriptions, false);
}

export async function deleteEncryptedSubscriptionFromCloud(
  client: PocketBaseClient | null,
  token: string,
  userId: string,
  localId: string,
) {
  if (!client) return;

  const records = await listEncryptedSubscriptions(client, token, userId, 500, localId);
  await Promise.all(records.map((record) => client.deleteRecord("encrypted_subscriptions", record.id, token)));
}

export async function upsertSettings(
  client: PocketBaseClient | null,
  token: string,
  userId: string,
  settings: Settings,
) {
  if (!client) return;

  const existing = await listUserSettings(client, token, userId);
  const body = toSettingsRecord(userId, settings);
  if (existing[0]) {
    await client.updateRecord("settings", existing[0].id, token, body);
    return;
  }

  await client.createRecord("settings", token, body);
}

export async function upsertEncryptedSettingsChange(
  client: PocketBaseClient | null,
  token: string,
  userId: string,
  session: CloudEncryptionSession,
  settings: Settings,
) {
  if (!client) return;
  await upsertEncryptedSettings(client, token, userId, session, settings);
}

export async function upsertEncryptedCloudData(
  client: PocketBaseClient | null,
  token: string,
  userId: string,
  session: CloudEncryptionSession,
  subscriptions: Subscription[],
  settings: Settings,
) {
  if (!client) return;

  try {
    await Promise.all([
      upsertEncryptedSubscriptions(client, token, userId, session, subscriptions),
      upsertEncryptedSettings(client, token, userId, session, settings),
    ]);
  } catch (error) {
    if (isMissingEncryptedCollectionError(error)) {
      throw new Error(
        "Update your PocketBase server. The user_keys, encrypted_subscriptions, and encrypted_settings collections are missing.",
      );
    }
    throw error;
  }
}

export async function deleteEncryptedCloudData(client: PocketBaseClient | null, token: string, userId: string) {
  if (!client) return;
  const [subscriptions, settings, userKeys] = await Promise.all([
    listEncryptedSubscriptionsIfAvailable(client, token, userId),
    listEncryptedSettingsIfAvailable(client, token, userId),
    listUserKeysIfAvailable(client, token, userId),
  ]);
  await Promise.all([
    ...subscriptions.map((record) => client.deleteRecord("encrypted_subscriptions", record.id, token)),
    ...settings.map((record) => client.deleteRecord("encrypted_settings", record.id, token)),
    ...userKeys.map((record) => client.deleteRecord("user_keys", record.id, token)),
  ]);
}

export async function deletePlaintextCloudData(client: PocketBaseClient | null, token: string, userId: string) {
  if (!client) return;
  await Promise.all([
    deleteUserSubscriptions(client, token, userId),
    deleteUserSettings(client, token, userId),
  ]);
}

async function syncEncryptedRecords(
  client: PocketBaseClient,
  token: string,
  userId: string,
  localSubscriptions: Subscription[],
  localSettings: Settings,
  strategy: SyncStrategy,
  cloud: CloudAppData,
  session: CloudEncryptionSession,
) {
  let subscriptions = localSubscriptions;
  let settings = localSettings;

  if (strategy === "cloud") {
    settings = mergeCloudSettings(cloud, localSettings);
    subscriptions = cloud.subscriptions;
  } else if (strategy === "local") {
    subscriptions = [...localSubscriptions].sort((a, b) => a.name.localeCompare(b.name));
  } else {
    const merged = new Map<string, Subscription>();
    for (const item of localSubscriptions) merged.set(item.id, item);
    for (const cloudItem of cloud.subscriptions) {
      const localItem = merged.get(cloudItem.id);
      merged.set(cloudItem.id, localItem ? newerSubscription(localItem, cloudItem) : cloudItem);
    }
    subscriptions = [...merged.values()].sort((a, b) => a.name.localeCompare(b.name));
    settings = mergeCloudSettings(cloud, localSettings);
  }

  await upsertEncryptedCloudData(client, token, userId, session, subscriptions, settings);
  await deletePlaintextCloudData(client, token, userId);
  return { subscriptions, settings, encryptionSession: session };
}

async function listUserSubscriptions(
  client: PocketBaseClient,
  token: string,
  userId: string,
  localId?: string,
) {
  const localIdFilter = localId ? ` && local_id="${escapeFilterValue(localId)}"` : "";
  return client.listRecords<SubscriptionRecord>("subscriptions", token, {
    filter: `user="${escapeFilterValue(userId)}"${localIdFilter}`,
    perPage: 500,
    sort: "name",
  });
}

function listUserSettings(client: PocketBaseClient, token: string, userId: string) {
  return client.listRecords<SettingsRecord>("settings", token, {
    filter: `user="${escapeFilterValue(userId)}"`,
    perPage: 1,
  });
}

async function loadPlaintextCloudAppData(client: PocketBaseClient, token: string, userId: string) {
  const [cloudSubscriptions, cloudSettings] = await Promise.all([
    listUserSubscriptions(client, token, userId),
    listUserSettings(client, token, userId),
  ]);
  const settingsRecord = cloudSettings[0];

  return {
    subscriptions: cloudSubscriptions
      .map(toSubscription)
      .sort((a, b) => a.name.localeCompare(b.name)),
    settings: settingsRecord ? toSettings(settingsRecord) : null,
    settingsHasCurrencySettings: hasCurrencySettings(settingsRecord),
    encrypted: false,
    locked: false,
    encryptionSession: null,
  };
}

function listEncryptedSubscriptions(
  client: PocketBaseClient,
  token: string,
  userId: string,
  perPage = 500,
  localId?: string,
) {
  const localIdFilter = localId ? ` && local_id="${escapeFilterValue(localId)}"` : "";
  return client.listRecords<EncryptedSubscriptionRecord>("encrypted_subscriptions", token, {
    filter: `user="${escapeFilterValue(userId)}"${localIdFilter}`,
    perPage,
    sort: "local_id",
  });
}

function listEncryptedSettings(client: PocketBaseClient, token: string, userId: string) {
  return client.listRecords<EncryptedSettingsRecord>("encrypted_settings", token, {
    filter: `user="${escapeFilterValue(userId)}"`,
    perPage: 1,
    sort: "-updated_at",
  });
}

function listUserKeys(client: PocketBaseClient, token: string, userId: string) {
  return client.listRecords<UserKeyRecord>("user_keys", token, {
    filter: `user="${escapeFilterValue(userId)}"`,
    perPage: 1,
    sort: "-updated_at",
  });
}

async function getUserKeyIfAvailable(client: PocketBaseClient, token: string, userId: string) {
  const records = await listUserKeysIfAvailable(client, token, userId);
  return records[0] ?? null;
}

async function listUserKeysIfAvailable(client: PocketBaseClient, token: string, userId: string) {
  try {
    return await listUserKeys(client, token, userId);
  } catch (error) {
    if (isMissingEncryptedCollectionError(error)) return [];
    throw error;
  }
}

async function unwrapUserKeyRecord(record: UserKeyRecord, password: string) {
  return unwrapMasterKey({
    kdf: record.kdf,
    iterations: record.iterations,
    salt: record.salt,
    encryptedMasterKey: record.encrypted_master_key,
    nonce: record.nonce,
  }, password);
}

export async function upsertUserKey(
  client: PocketBaseClient | null,
  token: string,
  userId: string,
  password: string,
  masterKey: Uint8Array,
) {
  if (!client) return;

  const wrapped = await wrapMasterKey(masterKey, password);
  const existing = await listUserKeys(client, token, userId);
  const body = {
    user: userId,
    kdf: wrapped.kdf,
    iterations: wrapped.iterations,
    salt: wrapped.salt,
    encrypted_master_key: wrapped.encryptedMasterKey,
    nonce: wrapped.nonce,
    schema_version: 1,
    updated_at: new Date().toISOString(),
  };

  if (existing[0]) {
    await client.updateRecord("user_keys", existing[0].id, token, body);
    return;
  }

  await client.createRecord("user_keys", token, body);
}

async function listEncryptedRecordDataIfAvailable(client: PocketBaseClient, token: string, userId: string) {
  const [subscriptions, settings] = await Promise.all([
    listEncryptedSubscriptionsIfAvailable(client, token, userId),
    listEncryptedSettingsIfAvailable(client, token, userId),
  ]);
  return { subscriptions, settings };
}

async function hasEncryptedRecordDataIfAvailable(client: PocketBaseClient, token: string, userId: string) {
  const settings = await listEncryptedSettingsIfAvailable(client, token, userId);
  if (settings.length > 0) return true;

  const subscriptions = await listEncryptedSubscriptionsIfAvailable(client, token, userId, 1);
  return subscriptions.length > 0;
}

async function listEncryptedSubscriptionsIfAvailable(
  client: PocketBaseClient,
  token: string,
  userId: string,
  perPage?: number,
) {
  try {
    return await listEncryptedSubscriptions(client, token, userId, perPage);
  } catch (error) {
    if (isMissingEncryptedCollectionError(error)) return [];
    throw error;
  }
}

async function listEncryptedSettingsIfAvailable(client: PocketBaseClient, token: string, userId: string) {
  try {
    return await listEncryptedSettings(client, token, userId);
  } catch (error) {
    if (isMissingEncryptedCollectionError(error)) return [];
    throw error;
  }
}

async function upsertEncryptedSubscriptions(
  client: PocketBaseClient,
  token: string,
  userId: string,
  session: CloudEncryptionSession,
  subscriptions: Subscription[],
  deleteMissing = true,
) {
  const existingRecords = await listEncryptedSubscriptions(client, token, userId);
  const recordsByLocalId = new Map(existingRecords.map((record) => [record.local_id, record]));
  const localIds = new Set(subscriptions.map((item) => item.id));

  await Promise.all(subscriptions.map(async (item) => {
    const existing = recordsByLocalId.get(item.id);
    const envelope = encryptJsonPayloadWithMasterKey(item, session.masterKey);
    const body = {
      user: userId,
      local_id: item.id,
      payload: serializeEncryptedEnvelope(envelope),
      schema_version: 1,
      updated_at: item.updatedAt,
    };
    return existing
      ? client.updateRecord("encrypted_subscriptions", existing.id, token, body)
      : client.createRecord("encrypted_subscriptions", token, body);
  }));

  if (deleteMissing) {
    await Promise.all(existingRecords
      .filter((record) => !localIds.has(record.local_id))
      .map((record) => client.deleteRecord("encrypted_subscriptions", record.id, token)));
  }
}

async function upsertEncryptedSettings(
  client: PocketBaseClient,
  token: string,
  userId: string,
  session: CloudEncryptionSession,
  settings: Settings,
) {
  const existing = await listEncryptedSettings(client, token, userId);
  const envelope = encryptJsonPayloadWithMasterKey(settings, session.masterKey);
  const body = {
    user: userId,
    payload: serializeEncryptedEnvelope(envelope),
    schema_version: 1,
    updated_at: new Date().toISOString(),
  };
  if (existing[0]) {
    await client.updateRecord("encrypted_settings", existing[0].id, token, body);
    return;
  }

  await client.createRecord("encrypted_settings", token, body);
}

function isMissingEncryptedCollectionError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return /missing collection context|collection.*not found|requested resource.*not found/i.test(error.message);
}

async function deleteUserSubscriptions(client: PocketBaseClient, token: string, userId: string) {
  const records = await listUserSubscriptions(client, token, userId);
  await Promise.all(records.map((record) => client.deleteRecord("subscriptions", record.id, token)));
}

async function deleteUserSettings(client: PocketBaseClient, token: string, userId: string) {
  const records = await listUserSettings(client, token, userId);
  await Promise.all(records.map((record) => client.deleteRecord("settings", record.id, token)));
}

function escapeFilterValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function dateOnly(value: string) {
  return value.slice(0, 10);
}

function parseColorPresets(value?: string | null) {
  if (!value) return defaultSettings.colorPresets;

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return defaultSettings.colorPresets;
    const colors = parsed.filter((color) => typeof color === "string" && /^#[0-9A-F]{6}$/i.test(color));
    return colors.length > 0 ? colors : defaultSettings.colorPresets;
  } catch {
    return defaultSettings.colorPresets;
  }
}

function parseEnabledCurrencies(value: string | null | undefined, displayCurrency: string) {
  if (!value) return [displayCurrency];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [displayCurrency];
    const currencies = parsed.filter((currency) => typeof currency === "string");
    return Array.from(new Set([displayCurrency, ...currencies]));
  } catch {
    return [displayCurrency];
  }
}

function hasCurrencySettings(row: SettingsRecord | undefined) {
  return Boolean(row?.enabled_currencies);
}

function mergeCloudSettings(cloud: CloudAppData, localSettings: Settings) {
  const settings = { ...(cloud.settings ?? localSettings), theme: localSettings.theme };
  if (!cloud.settings || cloud.settingsHasCurrencySettings) return settings;

  return {
    ...settings,
    currency: localSettings.currency,
    enabledCurrencies: localSettings.enabledCurrencies,
    convertToPrimaryCurrency: localSettings.convertToPrimaryCurrency,
    showOriginalCurrency: localSettings.showOriginalCurrency,
  };
}
