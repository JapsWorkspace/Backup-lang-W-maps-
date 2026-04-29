import { useContext, useEffect } from "react";
import { View, ActivityIndicator } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { UserContext } from "./UserContext";

export default function AppBootstrap({ navigation }) {
  const { user } = useContext(UserContext) || {};

  useEffect(() => {
    const boot = async () => {
      if (user?._id || user?.id) {
        return;
      }

      const getStartedSeen =
        (await AsyncStorage.getItem("hasSeenGetStarted")) ||
        (await AsyncStorage.getItem("getStartedSeen"));
      const privacyAccepted =
        (await AsyncStorage.getItem("hasAcceptedPrivacy")) ||
        (await AsyncStorage.getItem("hasAcceptedDataPrivacy")) ||
        (await AsyncStorage.getItem("privacyAccepted"));
      const termsAccepted =
        (await AsyncStorage.getItem("hasAcceptedTerms")) ||
        (await AsyncStorage.getItem("termsAccepted"));
      const hasCreatedAccount =
        (await AsyncStorage.getItem("hasAccount")) ||
        (await AsyncStorage.getItem("hasCreatedAccount"));
      const onboardingComplete = await AsyncStorage.getItem("onboardingComplete");

      if (hasCreatedAccount === "true" || onboardingComplete === "true") {
        navigation.replace("LogIn");
        return;
      }

      if (getStartedSeen !== "true") {
        navigation.replace("GetStarted");
        return;
      }

      if (privacyAccepted !== "true" || termsAccepted !== "true") {
        navigation.replace("PrivacyGate");
        return;
      }

      navigation.replace("LogIn");
    };

    boot();
  }, [navigation, user?._id, user?.id]);

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
