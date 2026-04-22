// screens/PrivacyGate.jsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import PrivacySwiper from "./PrivacySwiper";

export default function PrivacyGate({ navigation }) {
  const handleAccept = async () => {
    await AsyncStorage.setItem("privacyAccepted", "true");

    // ✅ EXIT the privacy flow permanently
    navigation.replace("RegisterFlow");
  };

  return <PrivacySwiper onAccept={handleAccept} />;
}
``