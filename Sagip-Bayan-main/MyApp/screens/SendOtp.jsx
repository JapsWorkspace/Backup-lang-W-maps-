// screens/SendOtp.jsx
import { useState } from "react";
import { TextInput, View, Text, Button } from "react-native";
import api from "../lib/api";
import {
  isValidEmail,
  normalizeEmail,
  sanitizeEmailInput,
} from "./utils/validation";

export default function SendOtp({ navigation }) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmail = (text) => {
    const rawEmail = sanitizeEmailInput(text);
    const cleanEmail = normalizeEmail(rawEmail);
    setEmail(rawEmail);
    setMessage("");

    if (!rawEmail) {
      setEmailError("Email is required.");
    } else if (!isValidEmail(cleanEmail)) {
      setEmailError("Enter a valid email address.");
    } else {
      setEmailError("");
    }
  };

  const handleEnter = () => {
    if (!email || emailError) {
      setMessage("Please enter a valid email.");
      return;
    }

    setLoading(true);
    setMessage("");

    api
      .post("/user/send-otp", { email: normalizeEmail(email) })
      .then((response) => {
        setMessage(response.data.message);
        navigation.navigate("VerifyOtp", { email: normalizeEmail(email) });
      })
      .catch((error) => {
        setMessage(error.response?.data?.message || "Server error");
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Enter Email</Text>

      <TextInput
        style={{
          height: 40,
          borderWidth: 1,
          borderColor: emailError ? "red" : "#ccc",
          marginBottom: 5,
          padding: 8,
        }}
        placeholder="Email"
        value={email}
        onChangeText={handleEmail}
        autoCapitalize="none"
      />

      {emailError ? (
        <Text style={{ color: "red", marginBottom: 10 }}>
          {emailError}
        </Text>
      ) : null}

      <Button
        title={loading ? "Sending..." : "Send OTP"}
        onPress={handleEnter}
        disabled={loading || !!emailError || !email}
      />

      {message ? (
        <Text style={{ marginTop: 10 }}>{message}</Text>
      ) : null}
    </View>
  );
}
