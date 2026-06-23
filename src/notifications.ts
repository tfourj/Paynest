import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import type { Subscription } from "./types";

const renewalChannelId = "renewal-reminders";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function requestNotificationPermission() {
  if (Platform.OS === "android") await ensureAndroidNotificationChannel();

  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;

  const requested = await Notifications.requestPermissionsAsync({
    ios: {
      allowAlert: true,
      allowBadge: true,
      allowSound: true,
    },
  });

  return requested.granted;
}

export async function sendDebugNotification() {
  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return false;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Paynest notification test",
      body: "Notifications are working on this device.",
      sound: "default",
      data: { source: "paynest-debug" },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 3,
      channelId: renewalChannelId,
    },
  });

  return true;
}

export async function scheduleRenewalNotifications(subscriptions: Subscription[], shouldRequestPermission = false) {
  if (Platform.OS === "web") return;

  const hasPermission = shouldRequestPermission
    ? await requestNotificationPermission()
    : await hasNotificationPermission();
  await cancelPaynestRenewalNotifications();

  if (!hasPermission) return;
  await ensureAndroidNotificationChannel();

  const now = new Date();
  await Promise.all(
    subscriptions
      .filter((item) => item.reminderEnabled)
      .map((item) => scheduleRenewalNotification(item, now)),
  );
}

async function hasNotificationPermission() {
  const current = await Notifications.getPermissionsAsync();
  return current.granted;
}

async function ensureAndroidNotificationChannel() {
  if (Platform.OS !== "android") return;

  await Notifications.setNotificationChannelAsync(renewalChannelId, {
    name: "Renewal reminders",
    importance: Notifications.AndroidImportance.HIGH,
    sound: "default",
    enableVibrate: true,
  });
}

async function cancelPaynestRenewalNotifications() {
  const scheduled = await Notifications.getAllScheduledNotificationsAsync();
  await Promise.all(
    scheduled
      .filter((notification) => notification.content.data?.source === "paynest-renewal")
      .map((notification) => Notifications.cancelScheduledNotificationAsync(notification.identifier)),
  );
}

async function scheduleRenewalNotification(item: Subscription, now: Date) {
  const triggerDate = reminderDateForSubscription(item);
  if (!triggerDate || triggerDate <= now) return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `${item.name} renews soon`,
      body: reminderBody(item),
      sound: "default",
      data: {
        source: "paynest-renewal",
        subscriptionId: item.id,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: triggerDate,
      channelId: renewalChannelId,
    },
  });
}

function reminderDateForSubscription(item: Subscription) {
  const [hour, minute] = parseReminderTime(item.reminderTime);
  const date = new Date(`${item.nextRenewalDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  date.setDate(date.getDate() - item.reminderDays);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function parseReminderTime(value: string) {
  const [rawHour, rawMinute] = value.split(":");
  const hour = Number.parseInt(rawHour, 10);
  const minute = Number.parseInt(rawMinute, 10);

  return [
    Number.isNaN(hour) ? 9 : Math.max(0, Math.min(hour, 23)),
    Number.isNaN(minute) ? 0 : Math.max(0, Math.min(minute, 59)),
  ];
}

function reminderBody(item: Subscription) {
  if (item.reminderDays === 0) return `${item.name} renews today.`;
  if (item.reminderDays === 1) return `${item.name} renews tomorrow.`;
  return `${item.name} renews in ${item.reminderDays} days.`;
}
