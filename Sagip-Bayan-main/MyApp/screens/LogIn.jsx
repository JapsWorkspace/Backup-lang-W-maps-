import React, { useContext, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

import api from "../lib/api";
import styles, { COLORS } from "../Designs/LogIn";
import { UserContext } from "./UserContext";
import { ThemeContext } from "./contexts/ThemeContext";
import { sanitizeUsername } from "./utils/validation";

export default function LogIn({ navigation }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [staySignedIn, setStaySignedIn] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const scrollRef = useRef(null);
  const inputPositions = useRef({});

  const { setUser } = useContext(UserContext);
  const { theme } = useContext(ThemeContext);
  const isDark = theme?.mode === "dark";

  const scrollToInput = (key) => {
    const y = inputPositions.current[key] || 0;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, y - 28), animated: true });
    });
  };

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

  const handleLogin = async () => {
    setError("");

    if (isSubmitting || !validate()) return;

    setIsSubmitting(true);

    try {
      const cleanUsername = sanitizeUsername(username);
      const res = await api.post("/user/login", {
        username: cleanUsername,
        password: String(password || "").trim(),
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
      }, { persist: staySignedIn });

      setUsername("");
      setPassword("");
    } catch (err) {
      setError(err.response?.data?.message || "Login failed. Please check your account.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, isDark && styles.safeDark]}>
      <View style={styles.stripeTop} />
      <View style={styles.stripeMid} />
      <View style={styles.stripeMid2} />
      <View style={styles.stripeBottom} />

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scrollRef}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.scrollContent}
        >
          <View style={styles.pageContainer}>
            <Image
              source={require("../stores/assets/sagipbayanlogowhite.png")}
              style={styles.logo}
              resizeMode="contain"
            />

            <View style={[styles.panel, isDark && styles.panelDark]}>
              <Text style={[styles.panelTitle, isDark && styles.panelTitleDark]}>
                Welcome back
              </Text>
              <Text style={[styles.panelSubtitle, isDark && styles.panelSubtitleDark]}>
                Sign in to continue to Sagip Bayan.
              </Text>

              <TextInput
                style={[styles.input, isDark && styles.inputDark]}
                placeholder="Username"
                placeholderTextColor={COLORS.placeholder}
                value={username}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                onFocus={() => scrollToInput("username")}
                onLayout={(event) => {
                  inputPositions.current.username = event.nativeEvent.layout.y;
                }}
                onChangeText={(text) => setUsername(sanitizeUsername(text))}
              />

              <View style={styles.passwordWrap}>
                <TextInput
                  style={[styles.input, styles.passwordInput, isDark && styles.inputDark]}
                  placeholder="Password"
                  placeholderTextColor={COLORS.placeholder}
                  secureTextEntry={!showPassword}
                  value={password}
                  returnKeyType="done"
                  onSubmitEditing={handleLogin}
                  onFocus={() => scrollToInput("password")}
                  onLayout={(event) => {
                    inputPositions.current.password = event.nativeEvent.layout.y;
                  }}
                  onChangeText={setPassword}
                />
                <TouchableOpacity
                  style={styles.eyeButton}
                  onPress={() => setShowPassword((value) => !value)}
                >
                  <Ionicons
                    name={showPassword ? "eye-off" : "eye"}
                    size={22}
                    color={isDark ? "#CBD5E1" : "#6B7280"}
                  />
                </TouchableOpacity>
              </View>

              {!!error && <Text style={styles.error}>{error}</Text>}

              <View style={styles.loginOptionsRow}>
                <TouchableOpacity
                  style={styles.staySignedInButton}
                  activeOpacity={0.82}
                  onPress={() => setStaySignedIn((value) => !value)}
                >
                  <Ionicons
                    name={staySignedIn ? "checkbox" : "square-outline"}
                    size={22}
                    color="#166534"
                  />
                  <Text style={[styles.staySignedInText, isDark && styles.staySignedInTextDark]}>
                    Stay signed in
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={() => navigation.navigate("EmailVerifyer")}>
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>
              </View>

              <TouchableOpacity
                style={[styles.button, isSubmitting && styles.buttonDisabled]}
                onPress={handleLogin}
                disabled={isSubmitting}
              >
                <Text style={styles.buttonText}>
                  {isSubmitting ? "Signing in..." : "Sign in"}
                </Text>
              </TouchableOpacity>

              <Text style={[styles.registerText, isDark && styles.registerTextDark]}>
                Don&apos;t have an account?{" "}
                <Text
                  style={styles.registerLink}
                  onPress={() => navigation.navigate("DataPrivacy")}
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
