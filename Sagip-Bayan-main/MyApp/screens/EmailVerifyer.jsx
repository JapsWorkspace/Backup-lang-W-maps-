import React, { useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import api from "../lib/api";
import {
  isValidEmail,
  normalizeEmail,
  sanitizeEmailInput,
} from "./utils/validation";

export default function EmailVerifyer({ navigation }) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerifyEmail = async () => {
    const cleanEmail = normalizeEmail(email);

    if (!isValidEmail(cleanEmail)) {
      Alert.alert("Invalid email", "Enter the email address linked to your account.");
      return;
    }

    try {
      setLoading(true);
      await api.post("/user/send-otp", { email: cleanEmail });

      Alert.alert("OTP sent", "Check your email for the verification code.", [
        {
          text: "Continue",
          onPress: () =>
            navigation.navigate("VerifyOtp", {
              email: cleanEmail,
              purpose: "passwordReset",
            }),
        },
      ]);
    } catch (err) {
      Alert.alert(
        "Verification failed",
        err.response?.data?.message || "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.container}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>

          <View style={styles.card}>
            <Text style={styles.eyebrow}>Account Recovery</Text>
            <Text style={styles.title}>Verify your email</Text>
            <Text style={styles.subtitle}>
              We will send a one-time code before allowing a password reset.
            </Text>

            <TextInput
              placeholder="Email address"
              value={email}
              onChangeText={(value) => setEmail(sanitizeEmailInput(value))}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
              style={styles.input}
              placeholderTextColor="#7b867f"
            />

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleVerifyEmail}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? "Checking..." : "Send verification code"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
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
  backButton: {
    position: "absolute",
    top: 18,
    left: 20,
    minHeight: 40,
    borderRadius: 14,
    paddingHorizontal: 14,
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EAE4",
  },
  backText: {
    color: "#14532D",
    fontWeight: "900",
  },
  card: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 22,
    borderWidth: 1,
    borderColor: "#E1EAE4",
  },
  eyebrow: {
    color: "#1D6B41",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  title: {
    marginTop: 6,
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
    marginBottom: 14,
  },
  button: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "#14532D",
    alignItems: "center",
    justifyContent: "center",
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },
});
