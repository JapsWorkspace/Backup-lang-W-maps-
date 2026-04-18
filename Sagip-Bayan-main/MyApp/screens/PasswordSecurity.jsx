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
} from "react-native";
import api from "../lib/api";
import NewBottomNav from "./NewBottomNav";
import { UserContext } from "./UserContext";

// ✅ import the separated design (green + yellow)
import styles, { COLORS } from "../Designs/PasswordSecurity";

export default function PasswordSecurity({ navigation }) {
  const { user, setUser } = useContext(UserContext);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [newPasswordError, setNewPasswordError] = useState("");
  const [confirmPasswordError, setConfirmPasswordError] = useState("");
  const [twoFactorEnabled, setTwoFactorEnabled] = useState(user?.twoFactorEnabled || false);

  // --- keep your original validation logic ---
  const handleNewPassword = (text) => {
    setNewPassword(text);
    if (text.length === 0) setNewPasswordError("Password is required");
    else if (text.length < 8) setNewPasswordError("Password must be at least 8 characters long");
    else if (text.length > 16) setNewPasswordError("Password must not exceed 16 characters");
    else if (!/[A-Z]/.test(text)) setNewPasswordError("Password must contain at least one uppercase letter");
    else if (!/[0-9]/.test(text)) setNewPasswordError("Password must contain at least one number");
    else setNewPasswordError("");

    if (confirmPassword && text !== confirmPassword) setConfirmPasswordError("Passwords do not match");
    else setConfirmPasswordError("");
  };

  const handleConfirmPassword = (text) => {
    setConfirmPassword(text);
    if (text.length === 0) setConfirmPasswordError("Confirm Password is required");
    else if (text !== newPassword) setConfirmPasswordError("Passwords do not match");
    else setConfirmPasswordError("");
  };

  const updatePassword = () => {
    if (currentPassword !== user.password) {
      console.log(user.password, currentPassword);
      console.log("Error: Current password is incorrect.");
      return;
    }
    if (newPasswordError || confirmPasswordError) {
      console.log("Error: Fix validation errors first.");
      return;
    }
    if (!newPassword || !confirmPassword) {
      console.log("Error: Password fields cannot be empty.");
      return;
    }
    if (newPassword === currentPassword) {
      console.log("Error: New password must be different from current password.");
      return;
    }

    console.log(user);
    api
      .put(`/user/update/${user.id}`, { password: newPassword })
      .then(() => {
        setUser({ ...user, password: newPassword });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        console.log("Password updated successfully");
      })
      .catch((error) => console.error(error));
  };

  const toggle2FA = (value) => {
    setTwoFactorEnabled(value);
    api
      .put(`/user/twofactor/${user._id}`, { enabled: value })
      .then(() => setUser({ ...user, twoFactorEnabled: value }))
      .catch((err) => console.error(err));
  };

  if (!user) return <Text>No user logged in</Text>;

  return (
    <KeyboardAvoidingView
      style={styles.webFrame}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
    >
      <View style={styles.phone}>
        {/* ---------- Header w/ back (same as Profile) ---------- */}
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <View style={styles.backGlyph} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Password & Security</Text>
        </View>
        <Text style={styles.subText}>
          Manage your password and enable two‑factor authentication for extra protection.
        </Text>

        {/* ---------- Form ---------- */}
        <View style={styles.formWrapper}>
          <TextInput
            style={styles.input}
            placeholder="Current Password"
            placeholderTextColor={COLORS.placeholder}
            secureTextEntry
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />

          <TextInput
            style={styles.input}
            placeholder="New Password"
            placeholderTextColor={COLORS.placeholder}
            secureTextEntry
            value={newPassword}
            onChangeText={handleNewPassword}
          />
          {newPasswordError ? <Text style={styles.error}>{newPasswordError}</Text> : null}

          <TextInput
            style={styles.input}
            placeholder="Confirm Password"
            placeholderTextColor={COLORS.placeholder}
            secureTextEntry
            value={confirmPassword}
            onChangeText={handleConfirmPassword}
          />
          {confirmPasswordError ? <Text style={styles.error}>{confirmPasswordError}</Text> : null}

          {/* Two-Factor Authentication */}
          <View style={styles.twoFAWrapper}>
            <Text style={styles.sectionTitle}>Two-Factor Authentication</Text>
            <Text style={styles.subInfo}>
              Add an extra layer of security by requiring a verification code when signing in.
            </Text>
            <Switch value={twoFactorEnabled} onValueChange={toggle2FA} />
            <Text style={styles.status}>{twoFactorEnabled ? "Enabled" : "Disabled"}</Text>
          </View>

          {/* Save */}
          <TouchableOpacity style={styles.button} onPress={updatePassword}>
            <Text style={styles.buttonText}>Save Settings</Text>
          </TouchableOpacity>
        </View>

        {/* ---------- Bottom Nav ---------- */}
        <View style={styles.bottomNavWrapper}>
          <NewBottomNav navigation={navigation} onCenterPress={() => navigation.navigate("MainCenter")} />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}