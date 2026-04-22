// screens/TermsCondition.jsx
import React from "react";
import { View, Text, ScrollView, Pressable, Image, StyleSheet } from "react-native";

export default function TermsCondition({ accepted, setAccepted }) {
  return (
    <View style={styles.screen}>
      {/* ILLUSTRATION */}
      <View style={styles.illustrationContainer}>
        <Image
          source={require("../stores/assets/terms.png")}
          style={styles.image}
        />
      </View>

      {/* GRAY CARD */}
      <View style={styles.card}>
        <ScrollView
          showsVerticalScrollIndicator
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.cardContent}
        >
          <Text style={styles.paragraph}>
            SagipBayan collects the following personal and operational data,
            each tied to a specific purpose:
          </Text>

          <Text style={styles.bullet}>
            • <Text style={styles.bold}>User Responsibility</Text> – Provide
            accurate and truthful information when registering and using the
            system.
          </Text>

          <Text style={styles.bullet}>
            • <Text style={styles.bold}>Proper Usage</Text> – Use the platform
            strictly for disaster‑related purposes only.
          </Text>

          <Text style={styles.bullet}>
            • <Text style={styles.bold}>Account Security</Text> – Maintain
            confidentiality of account credentials.
          </Text>

          <Text style={styles.bullet}>
            • <Text style={styles.bold}>System Integrity</Text> – Do not submit
            false reports, upload malicious content, or attempt to manipulate
            the system.
          </Text>

          <Text style={styles.paragraph}>
            All system components, including features and simulation modules,
            are the intellectual property of the developers.
          </Text>

          <Text style={styles.paragraph}>
            SagipBayan is provided on an “as‑is” basis as a capstone project
            prototype.
          </Text>

          {/* ACCEPT CHECKBOX */}
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
              I accept the Terms and Conditions and Data Privacy Policy
            </Text>
          </Pressable>

          {/* space so scroll never hits button */}
          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  illustrationContainer: {
    alignItems: "center",
    paddingTop: 24,
    paddingBottom: 12,
  },

  image: {
    width: 220,
    height: 200,
    resizeMode: "contain",
  },

  card: {
    flex: 1,
    marginHorizontal: 20,
    marginBottom: 8,
    backgroundColor: "#E5E7EB", // ✅ matches screenshot
    borderRadius: 16,
  },

  cardContent: {
    padding: 16,
    paddingBottom: 24,
  },

  paragraph: {
    fontSize: 13,
    lineHeight: 18,
    color: "#111827",
    marginBottom: 12,
  },

  bullet: {
    fontSize: 13,
    lineHeight: 18,
    color: "#111827",
    marginBottom: 10,
  },

  bold: {
    fontWeight: "700",
  },

  acceptRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 12,
  },

  checkbox: {
    width: 18,
    height: 18,
    borderWidth: 2,
    borderColor: "#166534",
    borderRadius: 4,
    marginRight: 10,
    marginTop: 2,
  },

  checkboxChecked: {
    backgroundColor: "#166534",
  },

  acceptText: {
    fontSize: 13,
    color: "#111827",
    flex: 1,
  },
});
