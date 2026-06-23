import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const outputPath = join(dirname(fileURLToPath(import.meta.url)), "paynest.collections.json");
const usersCollectionId = "_pb_users_auth_";

const systemFields = [
  {
    autogeneratePattern: "[a-z0-9]{15}",
    hidden: false,
    id: "text3208210256",
    max: 15,
    min: 15,
    name: "id",
    pattern: "^[a-z0-9]+$",
    presentable: false,
    primaryKey: true,
    required: true,
    system: true,
    type: "text",
  },
  {
    hidden: false,
    id: "autodate2990389176",
    name: "created",
    onCreate: true,
    onUpdate: false,
    presentable: false,
    system: true,
    type: "autodate",
  },
  {
    hidden: false,
    id: "autodate3332085495",
    name: "updated",
    onCreate: true,
    onUpdate: true,
    presentable: false,
    system: true,
    type: "autodate",
  },
];

function textField(id, name, options = {}) {
  return {
    autogeneratePattern: "",
    hidden: false,
    id,
    max: 0,
    min: 0,
    name,
    pattern: "",
    presentable: false,
    primaryKey: false,
    required: false,
    system: false,
    type: "text",
    ...options,
  };
}

function numberField(id, name, options = {}) {
  return {
    hidden: false,
    id,
    max: null,
    min: null,
    name,
    onlyInt: false,
    presentable: false,
    required: false,
    system: false,
    type: "number",
    ...options,
  };
}

function boolField(id, name) {
  return {
    hidden: false,
    id,
    name,
    presentable: false,
    required: false,
    system: false,
    type: "bool",
  };
}

function relationField(id) {
  return {
    cascadeDelete: true,
    collectionId: usersCollectionId,
    hidden: false,
    id,
    maxSelect: 1,
    minSelect: 0,
    name: "user",
    presentable: false,
    required: true,
    system: false,
    type: "relation",
  };
}

const collections = [
  {
    id: "pbc_paynestsub",
    listRule: "user = @request.auth.id",
    viewRule: "user = @request.auth.id",
    createRule: "user = @request.auth.id",
    updateRule: "user = @request.auth.id",
    deleteRule: "user = @request.auth.id",
    name: "subscriptions",
    type: "base",
    fields: [
      ...systemFields,
      relationField("relation_paynest_user"),
      textField("text_subscription_local_id", "local_id", { required: true }),
      textField("text_subscription_name", "name", { required: true }),
      textField("text_subscription_category", "category", { required: true }),
      numberField("number_subscription_price", "price", { required: true, min: 0 }),
      textField("text_subscription_currency", "currency", { required: true }),
      {
        hidden: false,
        id: "select_subscription_period",
        maxSelect: 1,
        name: "billing_period",
        presentable: false,
        required: true,
        system: false,
        type: "select",
        values: ["Weekly", "Monthly", "3 months", "6 months", "Yearly"],
      },
      numberField("number_subscription_pay_day", "pay_day", { max: 31, min: 1 }),
      {
        hidden: false,
        id: "date_subscription_next_renewal",
        max: "",
        min: "",
        name: "next_renewal_date",
        presentable: false,
        required: true,
        system: false,
        type: "date",
      },
      boolField("bool_subscription_paused", "paused"),
      boolField("bool_subscription_reminder_enabled", "reminder_enabled"),
      numberField("number_subscription_reminder_days", "reminder_days", { min: 0 }),
      textField("text_subscription_reminder_time", "reminder_time"),
      textField("text_subscription_icon_name", "icon_name"),
      textField("text_subscription_icon_label", "icon_label"),
      textField("text_subscription_icon_color", "icon_color"),
      textField("text_subscription_background_color", "background_color"),
      textField("text_subscription_icon_bg_color", "icon_background_color"),
      textField("text_subscription_simple_icon_slug", "simple_icon_slug"),
      textField("text_subscription_icon_provider", "icon_provider"),
      {
        exceptDomains: null,
        hidden: false,
        id: "url_subscription_icon_url",
        name: "icon_url",
        onlyDomains: null,
        presentable: false,
        required: false,
        system: false,
        type: "url",
      },
      textField("text_subscription_icon_source_title", "icon_source_title"),
      textField("text_subscription_created_at", "created_at", { required: true }),
      textField("text_subscription_updated_at", "updated_at", { required: true }),
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_subscriptions_user_local_id` ON `subscriptions` (`user`, `local_id`)",
    ],
    system: false,
  },
  {
    id: "pbc_paynestset",
    listRule: "user = @request.auth.id",
    viewRule: "user = @request.auth.id",
    createRule: "user = @request.auth.id",
    updateRule: "user = @request.auth.id",
    deleteRule: "user = @request.auth.id",
    name: "settings",
    type: "base",
    fields: [
      ...systemFields,
      relationField("relation_paynest_settings_user"),
      boolField("bool_settings_reminders_enabled", "reminders_enabled"),
      numberField("number_settings_reminder_days", "reminder_days", { min: 0 }),
      textField("text_settings_currency", "currency", { required: true }),
      boolField("bool_settings_payday_enabled", "payday_enabled"),
      numberField("number_settings_payday", "payday", { max: 31, min: 1 }),
      textField("text_settings_color_presets", "color_presets"),
      textField("text_settings_updated_at", "updated_at", { required: true }),
    ],
    indexes: [
      "CREATE UNIQUE INDEX `idx_settings_user` ON `settings` (`user`)",
    ],
    system: false,
  },
];

writeFileSync(outputPath, `${JSON.stringify(collections, null, 2)}\n`);
console.log(`Wrote ${outputPath}`);
