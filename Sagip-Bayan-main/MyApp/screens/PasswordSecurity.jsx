// screens/PasswordSecurity.jsx
import React, { useContext, useState } from "react";
import {
  TextInput,
  View,
  Text,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  Switch,
  ScrollView,
  StyleSheet,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../lib/api";
import { UserContext } from "./UserContext";
import styles, { COLORS } from "../Designs/PasswordSecurity";
import { getPasswordError } from "./utils/validation";

export default function PasswordSecurity({ navigation }) {
  const { user, setUser } = useContext(UserContext);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPasswordError, setNewPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.twoFactorEnabled || false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleNewPassword = (text) => {
    const cleanText = text.trim();
    setNewPassword(cleanText);
    setSubmitError("");
    setNewPasswordError(getPasswordError(cleanText));

    if (confirmPassword && cleanText !== confirmPassword) {
      setConfirmPasswordError("Passwords do not match.");
    }
    else setConfirmPasswordError("");
  };

  const handleConfirmPassword = (text) => {
    const cleanText = text.trim();
    setConfirmPassword(cleanText);
    setSubmitError("");
    if (cleanText.length === 0) setConfirmPasswordError("Confirm password is required.");
    else if (cleanText !== newPassword) setConfirmPasswordError("Passwords do not match.");
    else setConfirmPasswordError("");
  };

  const updatePassword = () => {
    const cleanCurrentPassword = currentPassword.trim();

    if (!cleanCurrentPassword) {
      setSubmitError("Current password is required.");
      return;
    }
    if (newPasswordError || confirmPasswordError) {
      setSubmitError("Please fix the password errors first.");
      return;
    }
    if (!newPassword || !confirmPassword) {
      setSubmitError("Password fields cannot be empty.");
      return;
    }
    if (newPassword === cleanCurrentPassword) {
      setSubmitError("New password must be different from the current password.");
      return;
    }
    if (isSaving) return;

    setIsSaving(true);
    setSubmitError("");

    api
      .put(`/user/update/${user.id}`, { password: newPassword })
      .then(() => {
        setUser({ ...user, password: newPassword });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setSubmitError("");
      })
      .catch((error) => {
        console.error(error);
        setSubmitError(
          error?.response?.data?.message || "Failed to update password."
        );
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

  const toggle2FA = (value) => {
    setTwoFactorEnabled(value);
    api
      .put(`/user/twofactor/${user._id}`, { enabled: value })
      .then(() => setUser({ ...user, twoFactorEnabled: value }))
      .catch((err) => console.error(err));
  };

  if (!user) return <Text>No user logged in</Text>;

  const matches = confirmPassword && !confirmPasswordError;

  return (
    <KeyboardAvoidingView
      style={styles.webFrame}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
    >
      <ScrollView
        style={styles.phone}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={COLORS.green} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Password & Security</Text>
            <Text style={styles.subText}>Protect account access and sign-in recovery.</Text>
          </View>
        </View>

        <View style={styles.securityHero}>
          <View style={styles.heroIcon}>
            <Ionicons name="shield-checkmark-outline" size={28} color={COLORS.green} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Security center</Text>
            <Text style={styles.heroText}>Use a unique password and keep two-factor authentication ready for sensitive changes.</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Change password</Text>
          <PasswordField
            label="Current Password"
            value={currentPassword}
            onChangeText={(value) => {
              setCurrentPassword(value.trim());
              if (submitError) setSubmitError("");
            }}
            visible={showCurrentPassword}
            onToggleVisibility={() => setShowCurrentPassword((prev) => !prev)}
          />
          <PasswordField
            label="New Password"
            value={newPassword}
            onChangeText={handleNewPassword}
            visible={showNewPassword}
            onToggleVisibility={() => setShowNewPassword((prev) => !prev)}
          />
          {newPasswordError ? <Text style={styles.error}>{newPasswordError}</Text> : null}
          <PasswordField
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={handleConfirmPassword}
            visible={showConfirmPassword}
            onToggleVisibility={() => setShowConfirmPassword((prev) => !prev)}
          />
          {confirmPasswordError ? <Text style={styles.error}>{confirmPasswordError}</Text> : null}
          {submitError ? <Text style={styles.error}>{submitError}</Text> : null}

          <View style={styles.ruleGrid}>
            <Rule checked={newPassword.length >= 8} text="8+ characters" />
            <Rule checked={/[A-Za-z]/.test(newPassword)} text="Letter" />
            <Rule checked={/[0-9]/.test(newPassword)} text="Number" />
            <Rule checked={!!matches} text="Matches" />
          </View>

          <TouchableOpacity
            style={styles.button}
            onPress={updatePassword}
            disabled={isSaving}
          >
            <Text style={styles.buttonText}>
              {isSaving ? "Saving..." : "Save Security Settings"}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.twoFAWrapper}>
          <View style={styles.twoFATop}>
            <View style={styles.twoFAIcon}>
              <Ionicons name="key-outline" size={20} color={COLORS.green} />
            </View>
            <View style={styles.twoFACopy}>
              <Text style={styles.sectionTitle}>Two-Factor Authentication</Text>
              <Text style={styles.subInfo}>Require a verification code when signing in.</Text>
            </View>
            <Switch value={twoFactorEnabled} onValueChange={toggle2FA} />
          </View>
          <Text style={[styles.status, twoFactorEnabled && styles.statusEnabled]}>
            {twoFactorEnabled ? "Enabled" : "Disabled"}
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function PasswordField({ label, value, onChangeText, visible, onToggleVisibility }) {
  return (
    <View style={styles.inputWrap}>
      <Text style={styles.inputLabel}>{label}</Text>
      <View style={localStyles.passwordFieldShell}>
        <TextInput
          style={[styles.input, localStyles.passwordInput]}
          placeholder={label}
          placeholderTextColor={COLORS.placeholder}
          secureTextEntry={!visible}
          value={value}
          onChangeText={onChangeText}
        />
        <TouchableOpacity
          style={localStyles.passwordToggle}
          onPress={onToggleVisibility}
          activeOpacity={0.82}
        >
          <Ionicons
            name={visible ? "eye-off-outline" : "eye-outline"}
            size={18}
            color="#4D5D54"
          />
          <Text style={localStyles.passwordToggleText}>
            {visible ? "Hide" : "Show"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function Rule({ checked, text }) {
  return (
    <View style={[styles.rulePill, checked && styles.rulePillOk]}>
      <Ionicons
        name={checked ? "checkmark-circle" : "ellipse-outline"}
        size={14}
        color={checked ? "#166534" : "#94A3B8"}
      />
      <Text style={[styles.ruleText, checked && styles.ruleTextOk]}>{text}</Text>
    </View>
  );
}

const localStyles = StyleSheet.create({
  passwordFieldShell: {
    position: "relative",
    justifyContent: "center",
  },
  passwordInput: {
    paddingRight: 76,
  },
  passwordToggle: {
    position: "absolute",
    right: 12,
    height: 34,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#EFF5EF",
    borderWidth: 1,
    borderColor: "#DCE7DD",
    flexDirection: "row",
    alignItems: "center",
  },
  passwordToggleText: {
    marginLeft: 4,
    color: "#355A2C",
    fontSize: 12,
    fontWeight: "800",
  },
});
