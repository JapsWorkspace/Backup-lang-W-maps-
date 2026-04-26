import React, { useMemo, useState, useEffect } from "react";
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

import styles from "../../Designs/StepPersonal";
import {
  ADDRESS_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  getUsernameError,
  sanitizeName,
  sanitizeTextInput,
  sanitizeUsername,
} from "../utils/validation";

export default function StepPersonal({
  fName = "",
  lName = "",
  username = "",
  address = "",

  onFNameChange = () => {},
  onLNameChange = () => {},
  onUsernameChange = () => {},
  onAddressChange = () => {},
  onNext = () => {},

  onValidChange = () => {},
}) {
  /* ================= LOCAL STATE ================= */
  const [localFName, setLocalFName] = useState(fName);
  const [localLName, setLocalLName] = useState(lName);
  const [localUsername, setLocalUsername] = useState(username);
  const [localAddress, setLocalAddress] = useState(address);

  const [focused, setFocused] = useState({});

  const setFocus = (key, value) =>
    setFocused((prev) => ({ ...prev, [key]: value }));

  /* ================= SYNC TO PARENT ================= */
  useEffect(() => onFNameChange(localFName), [localFName]);
  useEffect(() => onLNameChange(localLName), [localLName]);
  useEffect(() => onUsernameChange(localUsername), [localUsername]);
  useEffect(() => onAddressChange(localAddress), [localAddress]);

  /* ================= VALIDATION ================= */
  const fNameError =
    localFName.trim().length >= 2
      ? ""
      : "First name must be at least 2 characters.";

  const lNameError =
    localLName.trim().length >= 2
      ? ""
      : "Last name must be at least 2 characters.";

  const usernameError = useMemo(
    () => getUsernameError(localUsername),
    [localUsername]
  );

  const addressError =
    sanitizeTextInput(localAddress, { maxLength: ADDRESS_MAX_LENGTH }).length >= 5
      ? ""
      : "Address must be at least 5 characters.";

  const canProceed =
    !fNameError &&
    !lNameError &&
    !usernameError &&
    !addressError;

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
      fName: localFName,
      lName: localLName,
      username: localUsername,
      address: sanitizeTextInput(localAddress, {
        maxLength: ADDRESS_MAX_LENGTH,
      }),
    });
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={[
          styles.container,
          { paddingBottom: 64 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Image
          source={require("../../stores/assets/application1.png")}
          style={styles.image}
          resizeMode="contain"
        />

        <Text style={styles.title}>Personal Information</Text>

        {/* FIRST NAME */}
        {focused.fName && fNameError ? (
          <Text style={styles.error}>{fNameError}</Text>
        ) : null}
        <TextInput
          style={styles.input}
          placeholder="First Name"
          value={localFName}
          onFocus={() => setFocus("fName", true)}
          onBlur={() => setFocus("fName", false)}
          onChangeText={(t) => setLocalFName(sanitizeName(t))}
          maxLength={50}
        />

        {/* LAST NAME */}
        {focused.lName && lNameError ? (
          <Text style={styles.error}>{lNameError}</Text>
        ) : null}
        <TextInput
          style={styles.input}
          placeholder="Last Name"
          value={localLName}
          onFocus={() => setFocus("lName", true)}
          onBlur={() => setFocus("lName", false)}
          onChangeText={(t) => setLocalLName(sanitizeName(t))}
          maxLength={50}
        />

        {/* USERNAME */}
        {focused.username && usernameError ? (
          <Text style={styles.error}>{usernameError}</Text>
        ) : null}
        <TextInput
          style={styles.input}
          placeholder="Username"
          value={localUsername}
          autoCapitalize="none"
          onFocus={() => setFocus("username", true)}
          onBlur={() => setFocus("username", false)}
          onChangeText={(t) => setLocalUsername(sanitizeUsername(t))}
          maxLength={USERNAME_MAX_LENGTH}
        />

        {/* ADDRESS */}
        {focused.address && addressError ? (
          <Text style={styles.error}>{addressError}</Text>
        ) : null}
        <TextInput
          style={styles.input}
          placeholder="Address"
          value={localAddress}
          onFocus={() => setFocus("address", true)}
          onBlur={() => setFocus("address", false)}
          onChangeText={(t) =>
            setLocalAddress(
              sanitizeTextInput(t, { maxLength: ADDRESS_MAX_LENGTH })
            )
          }
          maxLength={ADDRESS_MAX_LENGTH}
        />

        {/* NEXT */}
        <TouchableOpacity
          style={[
            styles.button,
            !canProceed && { opacity: 0.5 },
          ]}
          disabled={!canProceed}
          onPress={handleNext}
        >
          <Text style={styles.buttonText}>NEXT</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
