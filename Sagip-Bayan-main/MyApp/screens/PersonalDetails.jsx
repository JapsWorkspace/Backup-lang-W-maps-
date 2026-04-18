// screens/PersonalDetails.jsx
import React, { useContext, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
} from "react-native";
import api from "../lib/api";
import { UserContext } from "./UserContext";
import NewBottomNav from "./NewBottomNav";

// ✅ import separated design (same theme as others)
import styles, { COLORS } from "../Designs/PersonalDetails";

export default function PersonalDetails({ navigation }) {
  const { user, setUser } = useContext(UserContext);
  const [username, setUsername] = useState(user?.username || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [error, setError] = useState("");

  if (!user) return <Text>No user logged in</Text>;

  // --- keep your function unchanged (only UI moved to new styles) ---
  const saveUsername = () => {
    console.log(user);
    setError(""); // reset previous error
    if (!username.trim()) {
      setError("Username cannot be empty.");
      return;
    }

    if (!phone.trim()) {
      setError("Phone number cannot be empty.");
      return;
    }

    if (!phone.trim()) {
      setError("Phone number cannot be empty.");
      return;
    }

    api
      .put(`/user/update/${user.id}`, { username, phone })
      .then(() => {
        setUser({ ...user, username });
        setUser({ ...user,  phone });
        
        console.log("Username and phone number updated successfully");
      })
      .catch((error) => {
        console.log(user.id);
        console.error(error);
        setError("Failed to update username or phone number.");
      });
  };

  return (
    <KeyboardAvoidingView
      style={styles.webFrame}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
    >
      <View style={styles.phone}>
        {/* ---------- Header with Back (same as Profile/PasswordSecurity) ---------- */}
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <View style={styles.backGlyph} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Personal Details</Text>
        </View>
        <Text style={styles.subText}>
          Review and manage your personal information below. Keeping your details accurate
          ensures smoother communication, secure account recovery, and a more personalized
          experience across the app.
        </Text>

        {/* ---------- Form ---------- */}
        <View style={styles.formWrapper}>
          {/* First Name (read-only) */}
          <Text style={styles.label}>First Name</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={user.fname}
            editable={false}
            placeholder="First Name"
            placeholderTextColor={COLORS.placeholder}
          />

          {/* Last Name (read-only) */}
          <Text style={styles.label}>Last Name</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={user.lname}
            editable={false}
            placeholder="Last Name"
            placeholderTextColor={COLORS.placeholder}
          />

          {/* Username (editable) */}
          <Text style={styles.label}>Username</Text>
          <Text style={styles.helper}>
            This is your unique identifier. You can update this here.
          </Text>
          <TextInput
            style={styles.input}
            value={username}
            editable={true}
            onChangeText={(text) => {
              setUsername(text);
              if (error) setError(""); // clear error when typing
            }}
            placeholder="Username"
            placeholderTextColor={COLORS.placeholder}
          />
          {error ? <Text style={styles.error}>{error}</Text> : null}

          {/* Email (read-only) */}
          <Text style={styles.label}>Email</Text>
          <Text style={styles.helper}>This is the email linked to your account.</Text>
          <TextInput
            style={[styles.input, styles.inputDisabled]}
            value={user.email}
            editable={false}
            placeholder="Email"
            placeholderTextColor={COLORS.placeholder}
          />

          <Text style={styles.label}>Phone Number</Text>
          <Text style={styles.helper}>This is the phone number linked to your account.</Text>
          <TextInput
            style={styles.input}
            value={phone}
             onChangeText={(text) => {
              setPhone(text);
              if (error) setError(""); // clear error when typing
            }}
            editable={true}
            placeholder="Phone Number"
            placeholderTextColor={COLORS.placeholder}
          />

          {/* Save button */}
          <TouchableOpacity style={styles.button} onPress={saveUsername}>
            <Text style={styles.buttonText}>Save Changes</Text>
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