import React, { useState, useRef, useContext, useEffect, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  Button,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";

import api from "../lib/api";
import { UserContext } from "./UserContext";
import { isValidEmail, normalizeEmail } from "./utils/validation";

const OTP_LENGTH = 6;

export default function VerifyOtp({ route, navigation }) {
  const safeEmail = normalizeEmail(route?.params?.email);
  const purpose = route?.params?.purpose;
  const userId = route?.params?.userId;
  const [otp, setOtp] = useState(new Array(OTP_LENGTH).fill(""));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { setUser } = useContext(UserContext);
  const inputsRef = useRef([]);
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const timerRef = useRef(null);

  useEffect(() => {
    if (!isValidEmail(safeEmail)) {
      Alert.alert("Invalid Request", "A valid email is required to verify OTP.", [
        { text: "OK", onPress: () => navigation.replace("LogIn") },
      ]);
    }
  }, [navigation, safeEmail]);

  useEffect(() => {
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current);
          Alert.alert(
            "OTP Expired",
            "Your OTP has expired. Please request a new one."
          );
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerRef.current);
  }, []);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs < 10 ? "0" : ""}${secs}`;
  };

  const enteredOtp = useMemo(() => otp.join(""), [otp]);
  const canSubmit =
    enteredOtp.length === OTP_LENGTH &&
    /^\d{6}$/.test(enteredOtp) &&
    timeLeft > 0 &&
    !isSubmitting &&
    isValidEmail(safeEmail);

  const handleChange = (text, index) => {
    const digit = String(text || "").replace(/\D/g, "").slice(-1);
    const nextOtp = [...otp];
    nextOtp[index] = digit;
    setOtp(nextOtp);

    if (digit && index < OTP_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus();
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      Alert.alert("Error", "Please enter the full 6-digit OTP.");
      return;
    }

    try {
      setIsSubmitting(true);
      await api.post("/user/verify-otp", { email: safeEmail, otp: enteredOtp });

      if (purpose === "passwordReset") {
        let resetUserId = userId;

        if (!resetUserId) {
          const res = await api.get("/user/users");
          const users = Array.isArray(res.data) ? res.data : [];
          const user = users.find(
            (item) => normalizeEmail(item?.email) === safeEmail
          );
          resetUserId = user?._id || user?.id;
        }

        if (!resetUserId) {
          Alert.alert("Error", "Account not found after OTP verification.");
          return;
        }

        Alert.alert("Success", "OTP verified.");
        navigation.replace("PasswordReset", {
          email: safeEmail,
          userId: resetUserId,
        });
        return;
      }

      Alert.alert("Success", "OTP verified.");

      const res = await api.get("/user/users");
      const users = Array.isArray(res.data) ? res.data : [];
      const user = users.find(
        (item) => normalizeEmail(item?.email) === safeEmail
      );

      if (!user) {
        Alert.alert("Error", "User not found after OTP verification.");
        return;
      }

      setUser(user);
    } catch (err) {
      Alert.alert("Error", err?.response?.data?.message || "Invalid OTP.");
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
        contentContainerStyle={styles.container}
      >
        <Text style={styles.title}>Enter OTP</Text>
        <Text style={styles.subtitle} numberOfLines={2}>
          {safeEmail || "Email unavailable"}
        </Text>

        <View style={styles.otpContainer}>
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(el) => {
                inputsRef.current[index] = el;
              }}
              style={styles.otpBox}
              keyboardType="numeric"
              maxLength={1}
              value={digit}
              onChangeText={(text) => handleChange(text, index)}
            />
          ))}
        </View>

        <Text style={styles.timerText}>
          OTP will expire in {formatTime(timeLeft)}
        </Text>

        <Button
          title={isSubmitting ? "Verifying..." : "Verify OTP"}
          onPress={handleSubmit}
          disabled={!canSubmit}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 20,
    color: "#647067",
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "80%",
    marginBottom: 20,
  },
  otpBox: {
    width: 40,
    height: 50,
    borderWidth: 1,
    borderColor: "#ccc",
    textAlign: "center",
    fontSize: 20,
    borderRadius: 5,
  },
  timerText: {
    marginBottom: 10,
  },
});
