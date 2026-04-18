import React from "react";
import { View, Text, ScrollView, Pressable, Image } from "react-native";
import styles from "../Designs/privacyStyles";

export default function TermsCondition({ accepted, setAccepted }) {
  return (
    <View style={styles.slide}>

      {/* IMAGE */}
      <Image
        source={require("../stores/assets/terms.png")}
        style={styles.image}
      />

      {/* TITLE */}
      <Text style={styles.title}>Terms & Conditions</Text>

      {/* SHORT DESCRIPTION */}
      <Text style={styles.subtitle}>
        Please read carefully before using the SagipBayan platform.
      </Text>

      {/* SCROLLABLE PANEL */}
      <View style={styles.panel}>
        <ScrollView showsVerticalScrollIndicator={true}>
          
          {/* ✅ YOUR TEXT — UNCHANGED */}
          <Text style={styles.paragraph}>
            By accessing or using SagipBayan, users acknowledge that they have read,
            understood, and agreed to be bound by these Terms and Conditions.
          </Text>

          <Text style={styles.sectionHeader}>User Responsibilities</Text>

          <Text style={styles.bullet}>
            • Provide accurate and truthful information when registering and using the system.
          </Text>

          <Text style={styles.bullet}>
            • Use the platform strictly for disaster-related purposes only.
          </Text>

          <Text style={styles.bullet}>
            • Maintain confidentiality of account credentials.
          </Text>

          <Text style={styles.bullet}>
            • Do not engage in activities that may harm, disrupt, or exploit the system.
          </Text>

          <Text style={styles.paragraph}>
            Users are strictly prohibited from submitting false disaster reports,
            uploading malicious content, impersonating individuals or officials,
            or attempting to hack or manipulate the system.
          </Text>

          <Text style={styles.sectionHeader}>Intellectual Property</Text>

          <Text style={styles.paragraph}>
            All system components, including design, features, Digital Twin and
            Virtual Twin modules, are the intellectual property of the developers.
            Unauthorized reproduction or modification is strictly prohibited.
          </Text>

          <Text style={styles.sectionHeader}>Disclaimer</Text>

          <Text style={styles.paragraph}>
            SagipBayan is developed as a Capstone Project prototype and is provided
            on an “as-is” basis.
          </Text>

          {/* ✅ ACCEPT CHECKBOX */}
          <Pressable
            style={styles.acceptRow}
            onPress={() => setAccepted(!accepted)}
          >
            <View
              style={[
                styles.checkbox,
                accepted && styles.checkboxChecked,
              ]}
            />
            <Text style={styles.acceptText}>
              I have read and agree to the Terms & Conditions and Data Privacy Policy
            </Text>
          </Pressable>

        </ScrollView>
      </View>
    </View>
  );
}