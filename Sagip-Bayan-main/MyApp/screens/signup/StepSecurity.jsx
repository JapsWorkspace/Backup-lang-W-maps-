import { View, Text, TextInput, TouchableOpacity, Image } from "react-native";
import styles from "../../Designs/StepSecurity";

export default function StepSecurity({
  password,
  confirmPassword,
  passwordError,
  confirmPasswordError,
  onPasswordChange,
  onConfirmChange,
  onNext,
  onBack,
}) {
  return (
    <View style={styles.container}>

      {/* Image */}
      <Image
        source={require("../../stores/assets/application2.png")}
        style={styles.image}
        resizeMode="contain"
      />

      {/* Title */}
      <Text style={styles.title}>Security Setup</Text>
      <Text style={styles.description}>
        Create a strong password to keep your account secure.
      </Text>

      {/* Password */}
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={onPasswordChange}
      />
      {passwordError ? (
        <Text style={styles.error}>{passwordError}</Text>
      ) : null}

      {/* Confirm */}
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={onConfirmChange}
      />
      {confirmPasswordError ? (
        <Text style={styles.error}>{confirmPasswordError}</Text>
      ) : null}

      {/* Next */}
      <TouchableOpacity style={styles.button} onPress={onNext}>
        <Text style={styles.buttonText}>NEXT</Text>
      </TouchableOpacity>
    </View>
  );
}