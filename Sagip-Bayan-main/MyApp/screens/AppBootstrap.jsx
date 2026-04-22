import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function AppBootstrap({ navigation }) {
  useEffect(() => {
    const boot = async () => {
      const getStartedSeen = await AsyncStorage.getItem("getStartedSeen");
      const privacyAccepted = await AsyncStorage.getItem("privacyAccepted");

      // ✅ First time ever → GetStarted
      if (getStartedSeen !== "true") {
        navigation.replace("GetStarted");
        return;
      }

      // ✅ Seen GetStarted but has NOT accepted privacy
      if (privacyAccepted !== "true") {
        navigation.replace("PrivacyGate");
        return;
      }

      // ✅ Privacy already accepted → always go to Login
      // Registration will start from Login → Sign Up
      navigation.replace("Login");
    };

    boot();
  }, []);

  return (
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <ActivityIndicator size="large" color="#166534" />
    </View>
  );
}