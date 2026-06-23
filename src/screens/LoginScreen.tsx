import { useState } from "react";
import { Image, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AuthModal, type AuthMode } from "../components/AuthModal";
import type { PocketBaseConnectionSettings, PocketBaseSession } from "../pocketbase";
import { styles } from "../styles";
import type { Colors } from "../theme";

type LoginScreenProps = {
  c: Colors;
  pocketBaseConnection: PocketBaseConnectionSettings;
  onAuthSuccess: (settings: PocketBaseConnectionSettings, session: PocketBaseSession) => void;
  onUpdatePocketBaseConnection: (settings: PocketBaseConnectionSettings) => void;
  onUseLocally: () => void;
};

export function LoginScreen({
  c,
  pocketBaseConnection,
  onAuthSuccess,
  onUpdatePocketBaseConnection,
  onUseLocally,
}: LoginScreenProps) {
  const [mode, setMode] = useState<AuthMode | null>(null);

  return (
    <View style={[styles.loginShell, { backgroundColor: c.background }]}>
      <ScrollView
        contentContainerStyle={styles.loginScreen}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.loginBrand}>
          <Image source={require("../../assets/paynest.png")} style={styles.loginLogo} />
          <Text style={[styles.loginTitle, { color: c.text }]}>Paynest</Text>
          <Text style={[styles.loginSubtitle, { color: c.textMuted }]}>
            Track subscriptions locally or sign in to sync across devices.
          </Text>
        </View>

        <View style={styles.loginActions}>
          <Pressable
            onPress={() => setMode("login")}
            style={[styles.loginPrimaryButton, { backgroundColor: c.primary }]}
          >
            <Ionicons name="log-in-outline" size={20} color="#FFFFFF" />
            <Text style={styles.loginPrimaryButtonText}>Log in</Text>
          </Pressable>

          <Pressable
            onPress={() => setMode("create")}
            style={[
              styles.loginSecondaryButton,
              {
                backgroundColor: c.surface,
                borderColor: c.border,
              },
            ]}
          >
            <Ionicons name="person-add-outline" size={20} color={c.text} />
            <Text style={[styles.loginSecondaryButtonText, { color: c.text }]}>Create account</Text>
          </Pressable>

          <Pressable
            onPress={onUseLocally}
            style={[
              styles.loginSecondaryButton,
              {
                backgroundColor: c.surfaceMuted,
                borderColor: c.border,
              },
            ]}
          >
            <Ionicons name="phone-portrait-outline" size={20} color={c.text} />
            <Text style={[styles.loginSecondaryButtonText, { color: c.text }]}>Use locally</Text>
          </Pressable>
        </View>
      </ScrollView>

      <AuthModal
        c={c}
        mode={mode}
        pocketBaseConnection={pocketBaseConnection}
        onModeChange={setMode}
        onUpdatePocketBaseConnection={onUpdatePocketBaseConnection}
        onAuthSuccess={onAuthSuccess}
      />
    </View>
  );
}
