// screens/PrivacyGate.jsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import PrivacySwiper from "./PrivacySwiper";

export default function PrivacyGate({ navigation }) {
  const handleAccept = async () => {
    await AsyncStorage.setItem("privacyAccepted", "true");
    navigation.replace("SignUp");
  };

  return <PrivacySwiper onAccept={handleAccept} />;
}