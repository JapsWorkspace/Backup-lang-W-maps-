import { View, Text, TouchableOpacity } from "react-native";
import styles from "../../Designs/SignUpHeader";

const STEP_TITLES = [
  "Let’s set up your profile",
  "Let’s set up your address",
  "Let’s set up your security",
  "Mobile registration",
];

const STEP_COUNT = 4;

export default function SignUpHeader({ step, onBack }) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Register Account</Text>

        <View style={{ width: 24 }} />
      </View>

      <View style={styles.progressRow}>
        {Array.from({ length: STEP_COUNT }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.circle,
              step === i && styles.activeCircle,
            ]}
          />
        ))}
      </View>

      <Text style={styles.stepTitle}>
        {STEP_TITLES[step] || STEP_TITLES[0]}
      </Text>
    </View>
  );
}