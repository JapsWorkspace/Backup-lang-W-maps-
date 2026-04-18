import { Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import styles from "../../Designs/StepPersonal";

export default function StepPersonal({
  fName,
  lName,
  username,
  onFNameChange,
  onLNameChange,
  onUsernameChange,
  onNext,

  /* ✅ GEO DEBUG PROPS */
  geoDebug,
  onToggleGeoDebug,
}) {
  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 120 : 0}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Image
          source={require("../../stores/assets/application1.png")}
          style={styles.image}
          resizeMode="contain"
        />

        <Text style={styles.title}>Personal Information</Text>

        <TextInput
          style={styles.input}
          placeholder="First Name"
          value={fName}
          onChangeText={onFNameChange}
        />

        <TextInput
          style={styles.input}
          placeholder="Last Name"
          value={lName}
          onChangeText={onLNameChange}
        />

        <TextInput
          style={styles.input}
          placeholder="Username"
          value={username}
          onChangeText={onUsernameChange}
          autoCapitalize="none"
        />

        {/* ✅ GEO DEBUG TOGGLE */}
        <TouchableOpacity
          onPress={onToggleGeoDebug}
          style={{ marginTop: 12, alignSelf: "center" }}
        >
          <Text
            style={{
              color: geoDebug ? "#16A34A" : "#DC2626",
              fontSize: 12,
              fontWeight: "600",
            }}
          >
            Geo Check: {geoDebug ? "OFF (Debug)" : "ON"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={onNext}>
          <Text style={styles.buttonText}>NEXT</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}