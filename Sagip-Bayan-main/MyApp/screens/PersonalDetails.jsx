// screens/PersonalDetails.jsx
import React, { useContext, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../lib/api";
import { UserContext } from "./UserContext";
import styles, { COLORS } from "../Designs/PersonalDetails";
import {
  getPhoneError,
  getUsernameError,
  safeDisplayText,
  sanitizePhoneLocal,
  sanitizeUsername,
} from "./utils/validation";

export default function PersonalDetails({ navigation }) {
  const { user, setUser } = useContext(UserContext);
  const [username, setUsername] = useState(user?.username || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  if (!user) return <Text>No user logged in</Text>;

  const saveUsername = () => {
    setError("");
    const cleanUsername = sanitizeUsername(username);
    const usernameError = getUsernameError(cleanUsername);
    if (usernameError) {
      setError(usernameError);
      return;
    }

    const cleanPhone = sanitizePhoneLocal(phone);
    const phoneError = getPhoneError(cleanPhone);
    if (phoneError) {
      setError(phoneError);
      return;
    }

    if (isSaving) return;
    setIsSaving(true);

    api
      .put(`/user/update/${user.id}`, {
        username: cleanUsername,
        phoneNumber: cleanPhone,
      })
      .then(() => {
        setUser({
          ...user,
          username: cleanUsername,
          phone: cleanPhone,
          phoneNumber: cleanPhone,
        });
      })
      .catch((updateError) => {
        console.error(updateError);
        setError("Failed to update username or phone number.");
      })
      .finally(() => {
        setIsSaving(false);
      });
  };

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
            <Text style={styles.headerTitle}>Personal Details</Text>
            <Text style={styles.subText}>Keep contact details accurate for alerts and recovery.</Text>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.summaryIcon}>
            <Ionicons name="id-card-outline" size={23} color={COLORS.green} />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={styles.summaryTitle}>
              {user.fname} {user.lname}
            </Text>
            <Text style={styles.summaryMeta}>{user.email}</Text>
          </View>
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Identity</Text>
          <Field label="First Name" value={user.fname} editable={false} />
          <Field label="Last Name" value={user.lname} editable={false} />
          <Field label="Email" value={user.email} editable={false} />
        </View>

        <View style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Editable details</Text>
          <Text style={styles.label}>Username</Text>
          <Text style={styles.helper}>Used as your resident identifier inside Sagip Bayan.</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={(text) => {
              setUsername(sanitizeUsername(text));
              if (error) setError("");
            }}
            placeholder="Username"
            placeholderTextColor={COLORS.placeholder}
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Phone Number</Text>
          <Text style={styles.helper}>Used for urgent messages and account recovery.</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={(text) => {
              setPhone(sanitizePhoneLocal(text));
              if (error) setError("");
            }}
            editable
            keyboardType="phone-pad"
            placeholder="Phone Number"
            placeholderTextColor={COLORS.placeholder}
            maxLength={10}
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.button}
            onPress={saveUsername}
            disabled={isSaving}
          >
            <Text style={styles.buttonText}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, editable }) {
  return (
    <View style={styles.readOnlyField}>
      <Text style={styles.readOnlyLabel}>{label}</Text>
      <Text style={styles.readOnlyValue} numberOfLines={1}>
        {safeDisplayText(value, "Not set")}
      </Text>
      {!editable && <Ionicons name="lock-closed-outline" size={15} color="#94A3B8" />}
    </View>
  );
}
