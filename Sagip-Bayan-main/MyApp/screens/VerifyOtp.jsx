// screens/VerifyOtp.jsx
import React, { useState, useRef, useContext, useEffect } from "react";
import { View, Text, TextInput, Button, StyleSheet, Alert } from "react-native";
import api from "../lib/api";
import { UserContext } from "./UserContext";

export default function VerifyOtp({ route, navigation }) {
  const [otp, setOtp] = useState(new Array(6).fill("")); // array of 6 digits
  const { email } = route.params; // use email to identify user
  const { setUser } = useContext(UserContext);

  const inputsRef = useRef([]); // store refs to TextInputs

  // 🔹 OTP TIMER (15 MINUTES)
  const [timeLeft, setTimeLeft] = useState(15 * 60);
  const timerRef = useRef(null);

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

  const handleChange = (text, index) => {
    if (/^\d*$/.test(text)) {
      const newOtp = [...otp];
      newOtp[index] = text;
      setOtp(newOtp);

      if (text.length === 1 && index < 5) {
        inputsRef.current[index + 1].focus();
      }
    }
  };

  const handleSubmit = () => {
    const enteredOtp = otp.join("");
    if (enteredOtp.length < 6) {
      Alert.alert("Error", "Please enter all 6 digits");
      return;
    }

    api
      .post("/user/verify-otp", { email, otp: enteredOtp })
      .then(() => {
        Alert.alert("Success", "OTP verified!");

        // Fetch user by email and set context
        api
          .get("/user/users")
          .then((res) => {
            const user = res.data.find((u) => u.email === email);
            if (user) {
              setUser(user);
              navigation.replace("AppShell");
            } else {
              Alert.alert("Error", "User not found after OTP verification");
            }
          })
          .catch((err) => {
            console.error("Error fetching users:", err);
            Alert.alert("Error", "Could not log in. Try again.");
          });
      })
      .catch((err) => {
        console.error(err);
        Alert.alert("Error", err.response?.data?.message || "Invalid OTP");
      });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter OTP</Text>

      <View style={styles.otpContainer}>
        {otp.map((digit, index) => (
          <TextInput
            key={index}
            ref={(el) => (inputsRef.current[index] = el)}
            style={styles.otpBox}
            keyboardType="numeric"
            maxLength={1}
            value={digit}
            onChangeText={(text) => handleChange(text, index)}
          />
        ))}
      </View>

      {/* 🔹 TIMER DISPLAY */}
      <Text style={{ marginBottom: 10 }}>
        OTP will expire in {formatTime(timeLeft)}
      </Text>

      <Button title="Verify OTP" onPress={handleSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 24,
    marginBottom: 20,
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
});
