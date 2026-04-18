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

import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "../lib/api";
import styles, { COLORS } from "../Designs/LogIn";
import { UserContext } from "./UserContext";

export default function LogIn({ navigation }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const { setUser } = useContext(UserContext);

  const sanitizeInput = (text) =>
    text.replace(/[^a-zA-Z0-9]/g, "");

  /* ================= LOGIN ================= */
  const handleLogin = () => {
    setError("");

    api
      .post("/user/login", { username, password })
      .then((res) => {
        const data = res.data;

        if (data.twoFactor) {
          // ✅ Two-factor flow
          navigation.navigate("VerifyOtp", {
            userId: data.userId,
            email: data.email,
          });
          api.post("/user/send-otp", { email: data.email });
        } else {
          // ✅ Store FULL backend user object (includes avatar)
          setUser({
            ...data.user,
            id: data.user._id, // normalize ID once
          });

          navigation.replace("AppShell");
          setUsername("");
          setPassword("");
        }
      })
      .catch((err) => {
        setError(err.response?.data?.message || "Login failed");
      });
  };

  /* ================= NAV ================= */
  const handleGoToSignup = async () => {
    try {
      const accepted = await AsyncStorage.getItem("privacyAccepted");
      accepted === "true"
        ? navigation.navigate("SignUp")
        : navigation.navigate("PrivacyGate");
    } catch {
      navigation.navigate("PrivacyGate");
    }
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

            {/* WHITE LOGO */}
            <Image
              source={require("../stores/assets/sagipbayanlogowhite.png")}
              style={styles.logo}
              resizeMode="contain"
            />

            {/* FULL-WIDTH PANEL */}
            <View style={styles.panel}>
              <Text style={styles.panelTitle}>LOG IN ACCOUNT</Text>

              <TextInput
                style={styles.input}
                placeholder="Username"
                placeholderTextColor={COLORS.placeholder}
                value={username}
                autoCapitalize="none"
                onChangeText={(t) =>
                  setUsername(sanitizeInput(t.trimStart()))
                }
              />

              <TextInput
                style={styles.input}
                placeholder="Password"
                placeholderTextColor={COLORS.placeholder}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={styles.button}
                onPress={handleLogin}
              >
                <Text style={styles.buttonText}>LOGIN</Text>
              </TouchableOpacity>

              <Text style={styles.helperText}>
                don’t have an account?
              </Text>

              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={handleGoToSignup}
              >
                <Text style={styles.secondaryButtonText}>
                  SIGN UP
                </Text>
              </TouchableOpacity>
            </View>

          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}