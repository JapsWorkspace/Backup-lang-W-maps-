// screens/LogIn.jsx
import React, { useState, useContext } from "react";
import {
  TextInput,
  View,
  Text,
  Image,
  TouchableOpacity,
  Platform,
  KeyboardAvoidingView,
  SafeAreaView,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import api from "../lib/api";
import styles, { COLORS } from "../Designs/LogIn";
import { UserContext } from "./UserContext";
import {
  sanitizeUsername,
} from "./utils/validation";

export default function LogIn({ navigation }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { setUser } = useContext(UserContext);

  /* ---------------- VALIDATION ---------------- */
  const validate = () => {
    if (!sanitizeUsername(username)) {
      setError("Username is required.");
      return false;
    }

    if (!String(password || "").trim()) {
      setError("Password is required.");
      return false;
    }

    return true;
  };

  /* ---------------- LOGIN ---------------- */
  const handleLogin = async () => {
    setError("");

    if (isSubmitting || !validate()) return;

    setIsSubmitting(true);

    try {
      const cleanUsername = sanitizeUsername(username);
      const res = await api.post("/user/login", {
        username: cleanUsername,
        password,
      });
      const data = res.data || {};

      if (data.twoFactor && data.email) {
        navigation.navigate("VerifyOtp", {
          userId: data.userId,
          email: data.email,
        });
        await api.post("/user/send-otp", { email: data.email });
        return;
      }

      if (!data.user?._id) {
        setError("We could not complete sign-in. Please try again.");
        return;
      }

      setUser({
        ...data.user,
        id: data.user._id,
      });

      setUsername("");
      setPassword("");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ---------------- SIGNUP FLOW ENTRY ---------------- */
  const handleGoToSignup = () => {
    // ✅ Sign up ALWAYS starts at DataPrivacy
    navigation.navigate("DataPrivacy");
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* BACKGROUND STRIPES */}
      <View style={styles.stripeTop} />
      <View style={styles.stripeMid} />
      <View style={styles.stripeMid2} />
      <View style={styles.stripeBottom} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
          <View style={styles.pageContainer}>
            {/* LOGO */}
            <Image
              source={require("../stores/assets/sagipbayanlogowhite.png")}
              style={styles.logo}
              resizeMode="contain"
            />

            {/* PANEL */}
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>LOG IN ACCOUNT</Text>

              {/* Username */}
              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor={COLORS.placeholder}
                value={username}
                autoCapitalize="none"
                onChangeText={(t) =>
                  setUsername(sanitizeUsername(t))
                }
              />

              {/* Password with show / hide */}
              <View style={{ position: "relative" }}>
                <TextInput
                  style={styles.input}
                  placeholder="Password"
                  placeholderTextColor={COLORS.placeholder}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  style={{
                    position: "absolute",
                    right: 16,
                    top: 14,
                  }}
                  onPress={() => setShowPassword((p) => !p)}
                >
                  <Ionicons
                    name={showPassword ? "eye-off" : "eye"}
                    size={22}
                    color="#6b7280"
                  />
                </TouchableOpacity>
              </View>

              {/* Inline error */}
              {error ? <Text style={styles.error}>{error}</Text> : null}

              {/* Forgot password */}
              <TouchableOpacity
                onPress={() => navigation.navigate("EmailVerifyer")}
              >
                <Text
                  style={{
                    color: "#166534",
                    fontWeight: "600",
                    textAlign: "right",
                    marginBottom: 14,
                  }}
                >
                  Forgot password?
                </Text>
              </TouchableOpacity>

              {/* Login button */}
              <TouchableOpacity
                style={styles.button}
                onPress={handleLogin}
                disabled={isSubmitting}
              >
                <Text style={styles.buttonText}>
                  {isSubmitting ? "LOGGING IN..." : "LOGIN"}
                </Text>
              </TouchableOpacity>

              {/* Sign up */}
              <Text
                style={{
                  marginTop: 20,
                  textAlign: "center",
                  fontSize: 16,
                }}
              >
                Don&apos;t have an account?{" "}
                <Text
                  style={{
                    color: "#166534",
                    fontWeight: "700",
                  }}
                  onPress={handleGoToSignup}
                >
                  Register
                </Text>
              </Text>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
