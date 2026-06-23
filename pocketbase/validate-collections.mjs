import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const defaultPath = join(fileURLToPath(new URL(".", import.meta.url)), "paynest.collections.json");
const filePath = process.argv[2] ?? defaultPath;
const expectedRule = "user = @request.auth.id";
const expectedUserCollectionId = "_pb_users_auth_";

const expectations = {
  subscriptions: {
    fields: {
      user: { type: "relation", required: true, collectionId: expectedUserCollectionId },
      local_id: { type: "text", required: true },
      name: { type: "text", required: true },
      category: { type: "text", required: true },
      price: { type: "number", required: true },
      currency: { type: "text", required: true },
      billing_period: { type: "select", required: true },
      pay_day: { type: "number" },
      next_renewal_date: { type: "date", required: true },
      reminder_enabled: { type: "bool" },
      reminder_days: { type: "number" },
      reminder_time: { type: "text" },
      icon_name: { type: "text" },
      icon_label: { type: "text" },
      icon_color: { type: "text" },
      background_color: { type: "text" },
      icon_background_color: { type: "text" },
      simple_icon_slug: { type: "text" },
      icon_provider: { type: "text" },
      icon_url: { type: "url" },
      icon_source_title: { type: "text" },
      created_at: { type: "text", required: true },
      updated_at: { type: "text", required: true },
    },
    indexIncludes: ["idx_subscriptions_user_local_id", "`user`", "`local_id`"],
  },
  settings: {
    fields: {
      user: { type: "relation", required: true, collectionId: expectedUserCollectionId },
      reminders_enabled: { type: "bool" },
      reminder_days: { type: "number" },
      currency: { type: "text", required: true },
      payday_enabled: { type: "bool" },
      payday: { type: "number" },
      updated_at: { type: "text", required: true },
    },
    indexIncludes: ["idx_settings_user", "`user`"],
  },
};

const collections = JSON.parse(readFileSync(filePath, "utf8"));
const failures = [];

for (const [name, expectation] of Object.entries(expectations)) {
  const collection = collections.find((item) => item.name === name);
  if (!collection) {
    failures.push(`${name}: missing collection`);
    continue;
  }

  for (const ruleName of ["listRule", "viewRule", "createRule", "updateRule", "deleteRule"]) {
    if (collection[ruleName] !== expectedRule) {
      failures.push(`${name}: ${ruleName} must be "${expectedRule}"`);
    }
  }

  for (const [fieldName, fieldExpectation] of Object.entries(expectation.fields)) {
    const field = collection.fields?.find((item) => item.name === fieldName);
    if (!field) {
      failures.push(`${name}: missing field "${fieldName}"`);
      continue;
    }

    if (field.type !== fieldExpectation.type) {
      failures.push(`${name}.${fieldName}: type must be "${fieldExpectation.type}"`);
    }
    if ("required" in fieldExpectation && field.required !== fieldExpectation.required) {
      failures.push(`${name}.${fieldName}: required must be ${fieldExpectation.required}`);
    }
    if ("collectionId" in fieldExpectation && field.collectionId !== fieldExpectation.collectionId) {
      failures.push(`${name}.${fieldName}: collectionId must be "${fieldExpectation.collectionId}"`);
    }
  }

  const indexes = collection.indexes ?? [];
  const hasIndex = indexes.some((index) => (
    expectation.indexIncludes.every((part) => index.includes(part))
  ));
  if (!hasIndex) {
    failures.push(`${name}: missing expected unique user index`);
  }
}

if (failures.length > 0) {
  console.error(`PocketBase collection validation failed for ${filePath}`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`PocketBase collection validation passed for ${filePath}`);
