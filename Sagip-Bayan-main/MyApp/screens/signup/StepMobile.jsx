import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  ScrollView,
  Platform,
} from "react-native";

import { useMemo, useState, useCallback } from "react";
import styles from "../../Designs/StepMobile";

export default function StepMobile({
  phone = "",
  email = "",
  phoneError,
  emailError,
  onPhoneChange = () => {},
  onEmailChange = () => {},
  onBack,
  onSubmit,
}) {
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  /* ================= PHONE VALIDATION ================= */
  const phoneErrorLocal = useMemo(() => {
    const cleaned = phone.replace(/[^0-9]/g, "");

    if (!cleaned) return "Phone number is required";

    const valid = /^9\d{9}$/.test(cleaned);

    return valid
      ? ""
      : "Must be 10 digits starting with 9 (e.g. 9171234567)";
  }, [phone]);

  /* ================= EMAIL VALIDATION ================= */
  const emailErrorLocal = useMemo(() => {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) return "Email is required";

    const valid = /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(cleanEmail);

    return valid ? "" : "Only Gmail accounts are allowed (@gmail.com)";
  }, [email]);

  /* ================= CAN SUBMIT ================= */
  const canSubmit =
    phone &&
    email &&
    !phoneErrorLocal &&
    !emailErrorLocal &&
    !isSubmitting;

  /* ================= HANDLERS ================= */

  const handlePhoneChange = useCallback(
    (text) => {
      setSubmitError("");

      const cleaned = text.replace(/[^0-9]/g, "").slice(0, 10);
      onPhoneChange(cleaned);
    },
    [onPhoneChange]
  );

  const handleEmailChange = useCallback(
    (text) => {
      setSubmitError("");
      onEmailChange(text.trim().toLowerCase());
    },
    [onEmailChange]
  );

  /* ================= SUBMIT ================= */
  const handleSubmit = async () => {
    if (!canSubmit) {
      setSubmitError("Please complete all fields correctly.");
      return;
    }

    if (!onSubmit) return;

    setIsSubmitting(true);
    setSubmitError("");

    try {
      await onSubmit({
        phone: `63${phone.replace(/[^0-9]/g, "")}`,
        email: email.trim().toLowerCase(),
      });
    } catch (err) {
      console.log("❌ RAW REGISTER ERROR:", err);

      const message =
        err?.message ||
        err?.response?.data?.message ||
        "Registration failed";

      const lower = message.toLowerCase();

      // 🔥 SMART FRONTEND ERROR DISPLAY (THIS IS WHAT YOU WANTED)
      if (lower.includes("email")) {
        setSubmitError("❌ This email is already registered.");
      } else if (lower.includes("phone")) {
        setSubmitError("❌ This phone number is already registered.");
      } else if (lower.includes("username")) {
        setSubmitError("❌ This username is already taken.");
      } else {
        setSubmitError("❌ Registration failed. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          padding: 20,
          paddingBottom: 120,
        }}
      >
        <View style={styles.container}>
          {/* IMAGE */}
          <Image
            source={require("../../stores/assets/application3.png")}
            style={styles.image}
            resizeMode="contain"
          />

          <Text style={styles.title}>Contact Information</Text>

          {/* GLOBAL ERROR */}
          {!!submitError && (
            <Text
              style={[
                styles.error,
                { textAlign: "center", fontWeight: "600" },
              ]}
            >
              {submitError}
            </Text>
          )}

          {/* ================= PHONE ================= */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Mobile Number</Text>

            <View style={styles.inputCard}>
              <View style={styles.prefixBox}>
                <Text style={styles.prefixText}>+63</Text>
              </View>

              <TextInput
                style={styles.input}
                placeholder="9171234567"
                keyboardType="phone-pad"
                value={phone}
                onChangeText={handlePhoneChange}
                maxLength={10}
              />
            </View>

            {!!phoneErrorLocal && (
              <Text style={styles.error}>{phoneErrorLocal}</Text>
            )}

            {!phoneErrorLocal && !!phoneError && (
              <Text style={styles.error}>{phoneError}</Text>
            )}
          </View>

          {/* ================= EMAIL ================= */}
          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Email</Text>

            <View style={styles.inputCard}>
              <TextInput
                style={styles.input}
                placeholder="example@gmail.com"
                keyboardType="email-address"
                autoCapitalize="none"
                value={email}
                onChangeText={handleEmailChange}
              />
            </View>

            {!!emailErrorLocal && (
              <Text style={styles.error}>{emailErrorLocal}</Text>
            )}

            {!emailErrorLocal && !!emailError && (
              <Text style={styles.error}>{emailError}</Text>
            )}
          </View>

          {/* ================= SUBMIT ================= */}
          <TouchableOpacity
            style={[
              styles.button,
              !canSubmit && { opacity: 0.5 },
            ]}
            disabled={!canSubmit}
            onPress={handleSubmit}
          >
            <Text style={styles.buttonText}>
              {isSubmitting ? "SUBMITTING..." : "SUBMIT"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}