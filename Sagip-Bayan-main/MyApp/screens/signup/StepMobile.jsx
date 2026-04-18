import { View, Text, TextInput, TouchableOpacity, Image } from "react-native";
import styles from "../../Designs/StepMobile";

export default function StepMobile({
  phone,
  email,
  phoneError,
  emailError,
  onPhoneChange,
  onEmailChange,
  onBack,
  onSubmit,
}) {
  return (
    <View style={styles.container}>
      {/* Image */}
      <Image
        source={require("../../stores/assets/application3.png")}
        style={styles.image}
        resizeMode="contain"
      />

      {/* Title */}
      <Text style={styles.title}>Mobile Registration</Text>
      <Text style={styles.description}>
        Provide contact details so we can verify your account.
      </Text>

      {/* Phone */}
      <TextInput
        style={styles.input}
        placeholder="Phone Number"
        keyboardType="phone-pad"
        value={phone}
        onChangeText={onPhoneChange}
      />
      {phoneError ? <Text style={styles.error}>{phoneError}</Text> : null}

      {/* Email */}
      <TextInput
        style={styles.input}
        placeholder="Email Address"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={onEmailChange}
      />
      {emailError ? <Text style={styles.error}>{emailError}</Text> : null}

      {/* Submit */}
      <TouchableOpacity style={styles.button} onPress={onSubmit}>
        <Text style={styles.buttonText}>SUBMIT</Text>
      </TouchableOpacity>
    </View>
  );
}