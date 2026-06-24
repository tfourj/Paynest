import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  createPocketBaseClient,
  defaultPocketBaseConnection,
  resolvePocketBaseConfig,
  type PocketBaseConnectionSettings,
  type PocketBaseSession,
} from "../pocketbase";
import { styles } from "../styles";
import type { Colors } from "../theme";
import { Chip } from "./common";

export type AuthMode = "login" | "create" | "forgot";

type ServerChoice = "paynest" | "custom";

type AuthModalProps = {
  c: Colors;
  mode: AuthMode | null;
  pocketBaseConnection: PocketBaseConnectionSettings;
  onModeChange: (mode: AuthMode | null) => void;
  onUpdatePocketBaseConnection: (settings: PocketBaseConnectionSettings) => void;
  onAuthSuccess: (settings: PocketBaseConnectionSettings, session: PocketBaseSession) => void;
};

export function AuthModal({
  c,
  mode,
  pocketBaseConnection,
  onModeChange,
  onUpdatePocketBaseConnection,
  onAuthSuccess,
}: AuthModalProps) {
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [serverChoice, setServerChoice] = useState<ServerChoice>(
    () => initialServerChoice(pocketBaseConnection),
  );
  const [url, setUrl] = useState(pocketBaseConnection.url);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [focusedInputGroup, setFocusedInputGroup] = useState<"connection" | "account" | null>(null);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const title = mode === "create" ? "Create account" : mode === "forgot" ? "Reset password" : "Log in";
  const submitLabel = busy
    ? "Working"
    : mode === "create"
      ? "Create account"
      : mode === "forgot"
        ? "Send reset email"
        : "Log in";
  const success = message.includes("Check") || message.includes("Signed") || message.includes("sent");
  const modalTopPadding = Platform.OS === "web" ? 0 : Math.max(insets.top, Platform.OS === "ios" ? 44 : 0);
  const saveBottomPadding = Platform.OS === "web" ? 16 : Math.max(insets.bottom + 18, 30);

  useEffect(() => {
    if (!mode) return;

    setServerChoice(initialServerChoice(pocketBaseConnection));
    setUrl(pocketBaseConnection.url);
  }, [mode, pocketBaseConnection]);

  function close() {
    onModeChange(null);
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    setServerChoice(initialServerChoice(pocketBaseConnection));
    setUrl(pocketBaseConnection.url);
    setMessage("");
    setPasswordVisible(false);
    setConfirmPasswordVisible(false);
  }

  function currentConnection(): PocketBaseConnectionSettings {
    return {
      url: serverChoice === "paynest" ? defaultPocketBaseConnection.url : url,
    };
  }

  function validateConnection(connection: PocketBaseConnectionSettings) {
    const config = resolvePocketBaseConfig(connection);
    if (serverChoice === "paynest" && !defaultPocketBaseConnection.url.trim()) {
      return "Paynest sync is not configured in this build.";
    }
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
    if (password.length < 8) return setMessage("Enter a password with at least 8 characters.");
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
      setPasswordVisible(false);
      setConfirmPasswordVisible(false);
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
    <Modal
      visible={mode !== null}
      animationType="slide"
      presentationStyle={Platform.OS === "web" ? "pageSheet" : "fullScreen"}
      onRequestClose={close}
    >
      <View style={[styles.authModalOverlay, { backgroundColor: c.background }]}>
        <View
          style={[
            styles.authModalPanel,
            {
              backgroundColor: c.background,
              borderColor: c.border,
              paddingTop: modalTopPadding,
            },
          ]}
        >
          <View
            style={[
              styles.modalHeader,
              {
                borderBottomColor: c.border,
                borderBottomWidth: StyleSheet.hairlineWidth,
              },
            ]}
          >
            <Pressable onPress={close}>
              <Text style={[styles.cancel, { color: c.primary }]}>Cancel</Text>
            </Pressable>
            <Text style={[styles.modalTitle, { color: c.text }]}>{title}</Text>
            <View style={{ width: 48 }} />
          </View>

          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <View style={styles.authBrand}>
              <Image source={require("../../assets/paynest.png")} style={styles.authLogo} />
              <Text style={[styles.authBrandTitle, { color: c.text }]}>Paynest</Text>
            </View>

            <Text style={[styles.formLabel, { color: c.textMuted }]}>SERVER</Text>
            <View style={styles.chips}>
              <Chip
                c={c}
                label="Paynest"
                bordered
                selected={serverChoice === "paynest"}
                onPress={() => setServerChoice("paynest")}
              />
              <Chip
                c={c}
                label="Custom"
                bordered
                selected={serverChoice === "custom"}
                onPress={() => setServerChoice("custom")}
              />
            </View>

            {serverChoice === "custom" && (
              <View
                style={[
                  styles.inputGroup,
                  {
                    backgroundColor: c.surface,
                    borderColor: focusedInputGroup === "connection" ? c.primary : c.border,
                  },
                ]}
              >
                <TextInput
                  id="paynest-pocketbase-url"
                  nativeID="paynest-pocketbase-url"
                  value={url}
                  onChangeText={setUrl}
                  placeholder="PocketBase URL"
                  placeholderTextColor={c.textSoft}
                  style={[styles.input, styles.inputNoOutline, { color: c.text }]}
                  onFocus={() => setFocusedInputGroup("connection")}
                  onBlur={() => setFocusedInputGroup(null)}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  autoComplete="url"
                  importantForAutofill="yes"
                  textContentType="URL"
                />
              </View>
            )}

            <Text style={[styles.formLabel, { color: c.textMuted }]}>ACCOUNT</Text>
            <View
              style={[
                styles.inputGroup,
                {
                  backgroundColor: c.surface,
                  borderColor: focusedInputGroup === "account" ? c.primary : c.border,
                },
              ]}
            >
              <TextInput
                id="paynest-auth-email"
                nativeID="paynest-auth-email"
                value={email}
                onChangeText={setEmail}
                placeholder="Email"
                placeholderTextColor={c.textSoft}
                style={[
                  styles.input,
                  styles.inputNoOutline,
                  {
                    color: c.text,
                    borderBottomColor: mode === "forgot" ? "transparent" : c.border,
                    borderBottomWidth: mode === "forgot" ? 0 : StyleSheet.hairlineWidth,
                  },
                ]}
                onFocus={() => setFocusedInputGroup("account")}
                onBlur={() => setFocusedInputGroup(null)}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                importantForAutofill="yes"
                textContentType="emailAddress"
              />

              {mode !== "forgot" && (
                <View
                  style={[
                    styles.passwordInputRow,
                    {
                      borderBottomColor: mode === "create" ? c.border : "transparent",
                      borderBottomWidth: mode === "create" ? StyleSheet.hairlineWidth : 0,
                    },
                  ]}
                >
                  <TextInput
                    id={mode === "create" ? "paynest-auth-new-password" : "paynest-auth-password"}
                    nativeID={mode === "create" ? "paynest-auth-new-password" : "paynest-auth-password"}
                    value={password}
                    onChangeText={setPassword}
                    placeholder="Password"
                    placeholderTextColor={c.textSoft}
                    style={[styles.input, styles.inputNoOutline, styles.passwordInput, { color: c.text }]}
                    onFocus={() => setFocusedInputGroup("account")}
                    onBlur={() => setFocusedInputGroup(null)}
                    secureTextEntry={!passwordVisible}
                    autoComplete={mode === "create" ? "new-password" : "current-password"}
                    importantForAutofill="yes"
                    textContentType={mode === "create" ? "newPassword" : "password"}
                  />
                  <Pressable
                    accessibilityLabel={passwordVisible ? "Hide password" : "Show password"}
                    onPress={() => setPasswordVisible((visible) => !visible)}
                    style={styles.passwordToggle}
                  >
                    <Ionicons
                      name={passwordVisible ? "eye-off-outline" : "eye-outline"}
                      size={21}
                      color={c.textMuted}
                    />
                  </Pressable>
                </View>
              )}

              {mode === "create" && (
                <View style={styles.passwordInputRow}>
                  <TextInput
                    id="paynest-auth-confirm-password"
                    nativeID="paynest-auth-confirm-password"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    placeholder="Confirm password"
                    placeholderTextColor={c.textSoft}
                    style={[styles.input, styles.inputNoOutline, styles.passwordInput, { color: c.text }]}
                    onFocus={() => setFocusedInputGroup("account")}
                    onBlur={() => setFocusedInputGroup(null)}
                    secureTextEntry={!confirmPasswordVisible}
                    autoComplete="new-password"
                    importantForAutofill="yes"
                    textContentType="newPassword"
                  />
                  <Pressable
                    accessibilityLabel={confirmPasswordVisible ? "Hide confirm password" : "Show confirm password"}
                    onPress={() => setConfirmPasswordVisible((visible) => !visible)}
                    style={styles.passwordToggle}
                  >
                    <Ionicons
                      name={confirmPasswordVisible ? "eye-off-outline" : "eye-outline"}
                      size={21}
                      color={c.textMuted}
                    />
                  </Pressable>
                </View>
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

          <View
            style={[
              styles.saveArea,
              {
                borderTopColor: c.border,
                backgroundColor: c.background,
                paddingBottom: saveBottomPadding,
              },
            ]}
          >
            <Pressable
              disabled={busy}
              onPress={() => void submit()}
              style={[
                styles.saveButton,
                styles.authSaveButton,
                {
                  backgroundColor: c.primary,
                  borderColor: c.border,
                },
              ]}
            >
              <Text style={styles.saveText}>{submitLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function initialServerChoice(connection: PocketBaseConnectionSettings): ServerChoice {
  const defaultConfig = resolvePocketBaseConfig(defaultPocketBaseConnection);
  const connectionConfig = resolvePocketBaseConfig(connection);
  if (!connectionConfig.url || connectionConfig.url === defaultConfig.url) return "paynest";
  return "custom";
}
