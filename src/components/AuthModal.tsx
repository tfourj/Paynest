import { useEffect, useRef, useState } from "react";
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
  const emailInputRef = useRef<TextInput>(null);
  const passwordInputRef = useRef<TextInput>(null);
  const confirmPasswordInputRef = useRef<TextInput>(null);
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
  const modalTopPadding = Platform.OS === "android" ? insets.top : 0;
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
    if (busy) return;

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
    if (busy) return;

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
      presentationStyle="pageSheet"
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
            <Text style={[styles.modalTitle, { color: c.text }]}>{title}</Text>
            <Pressable
              onPress={close}
              style={[styles.modalCloseButton, { backgroundColor: c.surfaceMuted }]}
              hitSlop={8}
            >
              <Ionicons name="close" size={18} color={c.textMuted} />
            </Pressable>
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
                  returnKeyType="next"
                  onSubmitEditing={() => emailInputRef.current?.focus()}
                  blurOnSubmit={false}
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
                ref={emailInputRef}
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
                returnKeyType={mode === "forgot" ? "send" : "next"}
                onSubmitEditing={() => {
                  if (mode === "forgot") {
                    void submit();
                    return;
                  }

                  passwordInputRef.current?.focus();
                }}
                blurOnSubmit={mode === "forgot"}
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
                    ref={passwordInputRef}
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
                    returnKeyType={mode === "create" ? "next" : "go"}
                    onSubmitEditing={() => {
                      if (mode === "create") {
                        confirmPasswordInputRef.current?.focus();
                        return;
                      }

                      void submit();
                    }}
                    blurOnSubmit={mode !== "create"}
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
                    ref={confirmPasswordInputRef}
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
                    returnKeyType="go"
                    onSubmitEditing={() => void submit()}
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
                {
                  backgroundColor: c.primary,
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
