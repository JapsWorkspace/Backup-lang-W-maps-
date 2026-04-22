import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";

import styles from "../../Designs/StepSecurity";

export default function StepSecurity({
  password: initialPassword = "",
  confirmPassword: initialConfirmPassword = "",
  onPasswordChange = () => {},
  onConfirmChange = () => {},
  onNext = () => {},
  onValidChange = () => {},
  onBack = () => {},
}) {
  const navigation = useNavigation();

  /* ================= LOCAL STATE ================= */
  const [password, setPassword] = useState(initialPassword);
  const [confirmPassword, setConfirmPassword] = useState(
    initialConfirmPassword
  );

  const [focused, setFocused] = useState({
    password: false,
    confirm: false,
  });

  const setFocus = (field, value) =>
    setFocused((prev) => ({ ...prev, [field]: value }));

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  /* ================= CLEAN VALUES ================= */
  const cleanPassword = password.replace(/\s/g, "");
  const cleanConfirm = confirmPassword.replace(/\s/g, "");

  /* ================= SYNC TO PARENT ================= */
  useEffect(() => {
    onPasswordChange(cleanPassword);
  }, [cleanPassword, onPasswordChange]);

  useEffect(() => {
    onConfirmChange(cleanConfirm);
  }, [cleanConfirm, onConfirmChange]);

  /* ================= VALIDATION ================= */
  const passwordError = useMemo(() => {
    if (!cleanPassword) return "Password is required";

    if (cleanPassword.length < 8)
      return "Must be at least 8 characters";

    if (!/[A-Za-z]/.test(cleanPassword) || !/[0-9]/.test(cleanPassword))
      return "Must include letters and numbers";

    return "";
  }, [cleanPassword]);

  const confirmError = useMemo(() => {
    if (!cleanConfirm) return "";
    if (cleanConfirm !== cleanPassword)
      return "Passwords do not match";
    return "";
  }, [cleanConfirm, cleanPassword]);

  const canProceed =
    cleanPassword.length >= 8 &&
    !passwordError &&
    !confirmError &&
    cleanConfirm === cleanPassword;

  /* ================= SYNC VALID STATE (FIXED) ================= */
  useEffect(() => {
    if (typeof onValidChange === "function") {
      onValidChange(canProceed);
    }
  }, [canProceed, onValidChange]);

  /* ================= NEXT ================= */
  const handleNext = () => {
    if (!canProceed) return;

    onNext({
      password: cleanPassword,
      confirmPassword: cleanConfirm,
    });
  };

  const handleBack = () => {
    if (onBack) return onBack();
    navigation.goBack();
  };

  /* ================= UI ================= */
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          padding: 24,
          paddingBottom: 100,
          backgroundColor: "#fff",
        }}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={require("../../stores/assets/application2.png")}
          style={styles.image}
          resizeMode="contain"
        />

        <Text style={styles.title}>Security Setup</Text>

        {/* PASSWORD ERROR */}
        {focused.password && passwordError ? (
          <Text style={styles.error}>{passwordError}</Text>
        ) : null}

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Password"
            secureTextEntry={!showPassword}
            value={password}
            onFocus={() => setFocus("password", true)}
            onBlur={() => setFocus("password", false)}
            onChangeText={setPassword}
          />

          <TouchableOpacity
            onPress={() => setShowPassword((p) => !p)}
            style={styles.eyeIcon}
          >
            <Ionicons
              name={showPassword ? "eye-off" : "eye"}
              size={22}
              color="#6B7280"
            />
          </TouchableOpacity>
        </View>

        {/* CONFIRM ERROR */}
        {focused.confirm && confirmError ? (
          <Text style={styles.error}>{confirmError}</Text>
        ) : null}

        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            secureTextEntry={!showConfirm}
            value={confirmPassword}
            onFocus={() => setFocus("confirm", true)}
            onBlur={() => setFocus("confirm", false)}
            onChangeText={setConfirmPassword}
          />

          <TouchableOpacity
            onPress={() => setShowConfirm((p) => !p)}
            style={styles.eyeIcon}
          >
            <Ionicons
              name={showConfirm ? "eye-off" : "eye"}
              size={22}
              color="#6B7280"
            />
          </TouchableOpacity>
        </View>

        {/* NEXT */}
        <TouchableOpacity
          disabled={!canProceed}
          onPress={handleNext}
          style={[
            styles.button,
            !canProceed && { opacity: 0.5 },
          ]}
        >
          <Text style={styles.buttonText}>NEXT</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}