// screens/SendOtp.jsx
import { useState } from "react";
import { TextInput, View, Text, Button } from "react-native";
import api from "../lib/api";

export default function SendOtp({ navigation }) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleEmail = (Text) => {
    setEmail(Text);
    setMessage("");

    if (Text.length === 0) {
      setEmailError("Email is required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(Text)) {
      setEmailError("Email is not valid");
    } else if (Text.includes(" ")) {
      setEmailError("Email must not contain spaces");
    } else {
      setEmailError("");
    }
  };

  const handleEnter = () => {
    if (!email || emailError) {
      setMessage("Please enter a valid email");
      return;
    }

    setLoading(true);
    setMessage("");

    api
      .post("/user/send-otp", { email })
      .then((response) => {
        setMessage(response.data.message);
        console.log("OTP sent to:", email);
        navigation.navigate("VerifyOtp", { email });
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