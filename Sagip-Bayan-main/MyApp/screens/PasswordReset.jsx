import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import api from "../lib/api";
import useFormAutoScroll from "./hooks/useFormAutoScroll";
import { getPasswordError } from "./utils/validation";

export default function PasswordReset({ route, navigation }) {
  const userId = route?.params?.userId;
  const email = route?.params?.email;

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { scrollRef, registerInput, scrollToInput } = useFormAutoScroll(36);

  const passwordError = getPasswordError(newPassword);
  const confirmError =
    confirmPassword && newPassword !== confirmPassword ? "Passwords do not match." : "";
  const canSubmit =
    Boolean(userId) &&
    !passwordError &&
    !confirmError &&
    Boolean(confirmPassword) &&
    !submitting;

  const updatePassword = async () => {
    if (!userId) {
      Alert.alert("Reset unavailable", "Missing account information. Please verify again.");
      navigation.replace("EmailVerifyer");
      return;
    }

    if (!canSubmit) {
      Alert.alert("Check password", passwordError || confirmError || "Complete all fields.");
      return;
    }

    try {
      setSubmitting(true);
      await api.put(`/user/update/${userId}`, { password: newPassword });
      Alert.alert("Password updated", "You can now log in with your new password.", [
        { text: "Log in", onPress: () => navigation.replace("LogIn") },
      ]);
    } catch (error) {
      Alert.alert(
        "Reset failed",
        error.response?.data?.message || "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.container}
        >
          <View style={styles.card}>
            <View style={styles.iconCircle}>
              <Ionicons name="lock-closed-outline" size={24} color="#14532D" />
            </View>
            <Text style={styles.title}>Set new password</Text>
            <Text style={styles.subtitle}>
              {email ? `For ${email}` : "Create a new password for your account."}
            </Text>

            <TextInput
              placeholder="New password"
              secureTextEntry={!showPassword}
              value={newPassword}
              onChangeText={setNewPassword}
              onFocus={() => scrollToInput("newPassword")}
              onLayout={registerInput("newPassword")}
              maxLength={64}
              style={styles.input}
              placeholderTextColor="#7b867f"
            />
            {!!newPassword && !!passwordError && (
              <Text style={styles.error}>{passwordError}</Text>
            )}

            <TextInput
              placeholder="Confirm password"
              secureTextEntry={!showPassword}
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              onFocus={() => scrollToInput("confirmPassword")}
              onLayout={registerInput("confirmPassword")}
              maxLength={64}
              style={styles.input}
              placeholderTextColor="#7b867f"
            />
            {!!confirmError && <Text style={styles.error}>{confirmError}</Text>}

            <TouchableOpacity
              style={styles.toggle}
              onPress={() => setShowPassword((value) => !value)}
            >
              <Ionicons
                name={showPassword ? "eye-off-outline" : "eye-outline"}
                size={17}
                color="#14532D"
              />
              <Text style={styles.toggleText}>
                {showPassword ? "Hide passwords" : "Show passwords"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, !canSubmit && styles.buttonDisabled]}
              onPress={updatePassword}
              disabled={!canSubmit}
            >
              <Text style={styles.buttonText}>
                {submitting ? "Updating..." : "Reset password"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#F4F8F2",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  card: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 22,
    borderWidth: 1,
    borderColor: "#E1EAE4",
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7F0E2",
    marginBottom: 14,
  },
  title: {
    color: "#10251B",
    fontSize: 24,
    fontWeight: "900",
  },
  subtitle: {
    marginTop: 8,
    marginBottom: 20,
    color: "#647067",
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "700",
  },
  input: {
    borderWidth: 1,
    borderColor: "#CBD8CF",
    borderRadius: 16,
    padding: 14,
    backgroundColor: "#FBFDFC",
    marginBottom: 10,
  },
  error: {
    marginBottom: 10,
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: "800",
  },
  toggle: {
    alignSelf: "flex-end",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 16,
  },
  toggleText: {
    color: "#14532D",
    fontSize: 12,
    fontWeight: "900",
  },
  button: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#14532D",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});
