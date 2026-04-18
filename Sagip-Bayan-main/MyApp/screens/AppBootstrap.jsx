import { useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function AppBootstrap({ navigation }) {
  useEffect(() => {
    const boot = async () => {
      const privacyAccepted = await AsyncStorage.getItem("privacyAccepted");
      const getStartedSeen = await AsyncStorage.getItem("getStartedSeen");

      if (privacyAccepted !== "true") {
        navigation.replace("PrivacyGate");
        return;
      }

      if (getStartedSeen !== "true") {
        navigation.replace("GetStarted");
        return;
      }

      // ✅ Already onboarded → start directly on Map
      navigation.replace("Map");
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