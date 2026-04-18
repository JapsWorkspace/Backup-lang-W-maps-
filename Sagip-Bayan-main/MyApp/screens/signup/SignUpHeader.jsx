import { View, Text, TouchableOpacity } from "react-native";
import styles from "../../Designs/SignUpHeader";

const STEP_TITLES = [
  "Lets set up your profile",
  "Lets set up a security",
  "Mobile registration",
];

export default function SignUpHeader({ step, onBack }) {
  return (
    <View style={styles.container}>
      {/* Top row */}
      <View style={styles.topRow}>
        <TouchableOpacity onPress={onBack}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.headerTitle}>Register Account</Text>

        {/* spacer for symmetry */}
        <View style={{ width: 24 }} />
      </View>

      {/* Progress Indicators */}
      <View style={styles.progressRow}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={[
              styles.circle,
              step === i && styles.activeCircle,
            ]}
          />
        ))}
      </View>

      {/* Step Title */}
      <Text style={styles.stepTitle}>
        {STEP_TITLES[step]}
      </Text>
    </View>
  );
}
