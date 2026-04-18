import React from "react";
import { View, Text, ScrollView, Image } from "react-native";
import styles from "../Designs/privacyStyles";

export default function DataPrivacy() {
  return (
    <View style={styles.slide}>
      
      {/* IMAGE */}
      <Image
        source={require("../stores/assets/privacy.png")}
        style={styles.image}
      />

      {/* TITLE */}
      <Text style={styles.title}>Data Privacy Policy</Text>

      {/* SHORT DESCRIPTION */}
      <Text style={styles.subtitle}>
        Your privacy matters. Below explains what data SagipBayan collects and how it is used.
      </Text>

      {/* SCROLLABLE PANEL */}
      <View style={styles.panel}>
        <ScrollView showsVerticalScrollIndicator={true}>
          
          {/* ✅ YOUR TEXT — UNCHANGED */}
          <Text style={styles.paragraph}>
            SagipBayan is committed to protecting the privacy and security of user data
            in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173).
          </Text>

          <Text style={styles.sectionHeader}>Collected Information</Text>

          <Text style={styles.bullet}>
            • Name and Email Address – Used for account creation, identification,
            communication, and notifications.
          </Text>

          <Text style={styles.bullet}>
            • Encrypted Password – Used solely for authentication and account security.
          </Text>

          <Text style={styles.bullet}>
            • Location Data – Used to display incidents, support evacuation planning,
            and enhance disaster visualization.
          </Text>

          <Text style={styles.bullet}>
            • Incident Report Data – Includes disaster type, descriptions, images,
            timestamps, and coordinates to support real-time response and planning.
          </Text>

          <Text style={styles.bullet}>
            • Safety Status Updates – Voluntarily shared to inform family members
            and authorities during disasters.
          </Text>

          <Text style={styles.bullet}>
            • Historical Data for Virtual Twin – Used exclusively for disaster
            simulations and preparedness.
          </Text>

          <Text style={styles.bullet}>
            • Evacuation Center Capacity – Displayed publicly without personal
            information of evacuees.
          </Text>

          <Text style={styles.bullet}>
            • Donation Records – Used to ensure transparency and support relief efforts.
          </Text>

          <Text style={styles.bullet}>
            • CCTV and OpenCV Data – Used for hazard recognition, monitoring, and
            disaster response support.
          </Text>

          <Text style={styles.paragraph}>
            All collected data is used strictly to support system functionality and
            improve disaster preparedness and management.
          </Text>

        </ScrollView>
      </View>
    </View>
  );
}