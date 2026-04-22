// screens/DataPrivacy.jsx
import React from "react";
import { View, Text, ScrollView, Image, StyleSheet } from "react-native";

export default function DataPrivacy() {
  return (
    <View style={styles.screen}>
      {/* ILLUSTRATION */}
      <View style={styles.illustrationContainer}>
        <Image
          source={require("../stores/assets/privacy.png")}
          style={styles.image}
        />
      </View>

      {/* CARD / PANEL */}
      <View style={styles.card}>
        <ScrollView
          showsVerticalScrollIndicator
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.cardContent}
        >
          <Text style={styles.paragraph}>
            SagipBayan collects the following personal and operational data, each
            tied to a specific purpose:
          </Text>

          <Text style={styles.bullet}>
            • <Text style={styles.bold}>Name and Email Address</Text> – Collected
            for account creation, identification, communication, and sending
            notifications.
          </Text>

          <Text style={styles.bullet}>
            • <Text style={styles.bold}>Encrypted Password</Text> – Used for
            authentication and maintaining account security.
          </Text>

          <Text style={styles.bullet}>
            • <Text style={styles.bold}>Location Data</Text> – Collected to
            accurately display incidents on hazard maps, support evacuation
            planning, and enhance disaster response.
          </Text>

          <Text style={styles.bullet}>
            • <Text style={styles.bold}>Incident Reports</Text> – Includes
            descriptions, images, timestamps, and coordinates for situational
            awareness.
          </Text>

          <Text style={styles.bullet}>
            • <Text style={styles.bold}>Safety Status Updates</Text> – Shared
            voluntarily to inform authorities and relatives during disasters.
          </Text>

          <Text style={styles.bullet}>
            • <Text style={styles.bold}>Historical & Simulation Data</Text> –
            Used to support analytics, preparedness, and system improvement.
          </Text>

          {/* Space so content never gets cut */}
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
    backgroundColor: "#E5E7EB", // light gray like the image
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
});
