import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { styles } from "../styles";
import type { Colors } from "../theme";

type PrivacyPolicyProps = {
  c: Colors;
  onBack: () => void;
};

const sections = [
  {
    title: "Information Paynest Stores",
    body: [
      "Paynest stores the subscriptions, prices, renewal dates, categories, icons, notification preferences, " +
        "app theme, currency, and payday settings you enter in the app.",
      "When you use Paynest locally, this information stays on your device unless your device backup provider " +
        "includes app data in a backup.",
    ],
  },
  {
    title: "Account and Sync Data",
    body: [
      "If you connect a PocketBase account, Paynest sends your account email, subscriptions, and synced settings " +
        "to the PocketBase server you configure.",
      "If you enable cloud encryption, Paynest encrypts subscriptions and synced settings on your device before " +
        "uploading them. The server stores an encrypted payload and cannot recover the contents without your " +
        "encryption password.",
      "Paynest cannot recover encrypted cloud data if you lose the encryption password.",
      "Paynest uses that server to keep your data available across devices. The operator of that PocketBase server " +
        "is responsible for how server-side data is hosted and protected.",
    ],
  },
  {
    title: "Notifications",
    body: [
      "Paynest can schedule local renewal reminders on your device. Notification permissions are handled by " +
        "your operating system.",
      "Reminder content is generated from subscription data you saved in the app.",
    ],
  },
  {
    title: "Network Requests",
    body: [
      "Paynest may request subscription icons from icon providers and may contact your configured PocketBase server " +
        "for authentication and sync.",
      "Paynest does not sell your personal information or use advertising trackers.",
    ],
  },
  {
    title: "Data Control",
    body: [
      "You can delete local Paynest data from Settings. You can clear cached icons from Settings.",
      "If you use PocketBase sync, sign in to your PocketBase server or contact its operator to manage or delete " +
        "server-side account data.",
    ],
  },
  {
    title: "Changes",
    body: [
      "This policy may be updated as Paynest changes. The current version is effective June 24, 2026.",
    ],
  },
];

export function PrivacyPolicy({ c, onBack }: PrivacyPolicyProps) {
  return (
    <ScrollView contentContainerStyle={styles.screen} showsVerticalScrollIndicator={false}>
      <View style={styles.privacyHeader}>
        <Pressable
          accessibilityLabel="Back"
          onPress={onBack}
          style={[styles.privacyBackButton, { backgroundColor: c.surfaceMuted }]}
        >
          <Ionicons name="chevron-back" size={22} color={c.text} />
        </Pressable>
        <View style={[styles.rowText, styles.titleLockup]}>
          <Image source={require("../../assets/paynest.png")} style={styles.headerLogo} />
          <Text style={[styles.title, { color: c.text }]}>Privacy Policy</Text>
        </View>
      </View>

      <View
        style={[
          styles.card,
          styles.privacyIntro,
          { backgroundColor: c.surface, borderColor: c.border },
        ]}
      >
        <Text style={[styles.privacyBody, { color: c.textMuted }]}>
          Paynest is designed to keep subscription tracking private and understandable. This policy explains what data
          the app stores, when it syncs data, and how you can control it.
        </Text>
      </View>

      {sections.map((section) => (
        <View key={section.title} style={styles.privacySection}>
          <Text style={[styles.sectionTitle, { color: c.text }]}>{section.title}</Text>
          {section.body.map((paragraph) => (
            <Text key={paragraph} style={[styles.privacyBody, { color: c.textMuted }]}>
              {paragraph}
            </Text>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
