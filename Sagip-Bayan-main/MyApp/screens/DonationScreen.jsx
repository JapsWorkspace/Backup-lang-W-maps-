import React, { useMemo, useState } from "react";
import {
  Alert,
  Image,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

import api from "../lib/api";

const QUICK_AMOUNTS = ["50", "100", "250", "500"];

export default function DonationScreen({ navigation }) {
  const [amount, setAmount] = useState("");
  const [reference, setReference] = useState("");
  const [donorName, setDonorName] = useState("");
  const [proof, setProof] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const displayAmount = useMemo(() => {
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) return "0.00";
    return value.toLocaleString("en-PH", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [amount]);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets?.[0]) {
      setProof(result.assets[0]);
    }
  };

  const handleDonate = async () => {
    const cleanAmount = Number(amount);

    if (!Number.isFinite(cleanAmount) || cleanAmount <= 0) {
      Alert.alert("Invalid amount", "Enter a valid donation amount.");
      return;
    }

    if (!reference.trim() || !proof?.uri) {
      Alert.alert("Missing fields", "Reference number and proof of payment are required.");
      return;
    }

    try {
      setSubmitting(true);
      const formData = new FormData();
      formData.append("type", "monetary");
      formData.append("name", donorName.trim() || "Mobile monetary donation");
      formData.append("amount", String(cleanAmount));
      formData.append("sourceType", "external");
      formData.append("sourceName", reference.trim());
      formData.append("description", `Mobile donation reference: ${reference.trim()}`);
      formData.append("proofFiles", {
        uri: Platform.OS === "ios" ? proof.uri.replace("file://", "") : proof.uri,
        name: proof.fileName || `donation-proof-${Date.now()}.jpg`,
        type: proof.mimeType || "image/jpeg",
      });

      await api.post("/api/inventory", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      Alert.alert("Donation submitted", "Thank you. Your donation proof was recorded.");
      setAmount("");
      setReference("");
      setDonorName("");
      setProof(null);
    } catch (error) {
      Alert.alert(
        "Submission failed",
        error.response?.data?.message || "Network error. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.walletHero}>
          <View style={styles.heroTop}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={21} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.heroBrand}>
              <Text style={styles.heroBrandText}>SagipPay</Text>
              <Text style={styles.heroBrandSub}>Secure donation intake</Text>
            </View>
            <View style={styles.walletIcon}>
              <Ionicons name="wallet-outline" size={21} color="#FFFFFF" />
            </View>
          </View>

          <Text style={styles.heroLabel}>Donation amount</Text>
          <View style={styles.amountRow}>
            <Text style={styles.currency}>PHP</Text>
            <Text style={styles.amountValue}>{displayAmount}</Text>
          </View>
          <Text style={styles.heroFootnote}>For Jaen emergency response resources</Text>
        </View>

        <View style={styles.quickRow}>
          {QUICK_AMOUNTS.map((item) => {
            const active = amount === item;
            return (
              <TouchableOpacity
                key={item}
                style={[styles.quickChip, active && styles.quickChipActive]}
                onPress={() => setAmount(item)}
                activeOpacity={0.82}
              >
                <Text style={[styles.quickText, active && styles.quickTextActive]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Payment details</Text>
              <Text style={styles.sectionSubtitle}>Reference and proof are required.</Text>
            </View>
            <View style={styles.secureBadge}>
              <Ionicons name="shield-checkmark" size={14} color="#14532D" />
              <Text style={styles.secureText}>Review</Text>
            </View>
          </View>

          <Text style={styles.label}>Amount</Text>
          <View style={styles.moneyInputShell}>
            <Text style={styles.moneyPrefix}>PHP</Text>
            <TextInput
              style={styles.moneyInput}
              placeholder="0.00"
              keyboardType="numeric"
              value={amount}
              onChangeText={(value) => setAmount(value.replace(/[^0-9.]/g, ""))}
              placeholderTextColor="#7C8B82"
            />
          </View>

          <Text style={styles.label}>Reference number</Text>
          <View style={styles.inputShell}>
            <Ionicons name="receipt-outline" size={18} color="#14532D" />
            <TextInput
              style={styles.input}
              placeholder="GCash / bank reference"
              value={reference}
              onChangeText={setReference}
              autoCapitalize="characters"
              placeholderTextColor="#7C8B82"
            />
          </View>

          <Text style={styles.label}>Donor name</Text>
          <View style={styles.inputShell}>
            <Ionicons name="person-outline" size={18} color="#14532D" />
            <TextInput
              style={styles.input}
              placeholder="Optional"
              value={donorName}
              onChangeText={setDonorName}
              placeholderTextColor="#7C8B82"
            />
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>Proof of payment</Text>
              <Text style={styles.sectionSubtitle}>Upload a clear receipt screenshot.</Text>
            </View>
            {proof?.uri ? (
              <View style={styles.doneBadge}>
                <Ionicons name="checkmark" size={14} color="#065F46" />
              </View>
            ) : null}
          </View>

          <TouchableOpacity style={styles.uploadCard} onPress={pickImage} activeOpacity={0.84}>
            {proof?.uri ? (
              <>
                <Image source={{ uri: proof.uri }} style={styles.image} />
                <View style={styles.changeProof}>
                  <Ionicons name="image-outline" size={15} color="#FFFFFF" />
                  <Text style={styles.changeProofText}>Change proof</Text>
                </View>
              </>
            ) : (
              <View style={styles.uploadEmpty}>
                <View style={styles.uploadIcon}>
                  <Ionicons name="cloud-upload-outline" size={26} color="#14532D" />
                </View>
                <Text style={styles.uploadTitle}>Upload receipt</Text>
                <Text style={styles.uploadHint}>JPG or PNG from your payment app</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, submitting && styles.buttonDisabled]}
          onPress={handleDonate}
          disabled={submitting}
          activeOpacity={0.86}
        >
          <Ionicons name="send" size={18} color="#FFFFFF" />
          <Text style={styles.buttonText}>
            {submitting ? "Submitting..." : "Submit donation"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: "#ECF7EF",
  },
  content: {
    padding: 16,
    paddingBottom: 30,
  },
  walletHero: {
    borderRadius: 28,
    padding: 18,
    minHeight: 210,
    backgroundColor: "#14532D",
    shadowColor: "#0F3D25",
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 26,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  heroBrand: {
    flex: 1,
    marginLeft: 12,
  },
  heroBrandText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "900",
  },
  heroBrandSub: {
    marginTop: 2,
    color: "#CDEDD7",
    fontSize: 11,
    fontWeight: "800",
  },
  walletIcon: {
    width: 42,
    height: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.16)",
  },
  heroLabel: {
    color: "#CDEDD7",
    fontSize: 12,
    fontWeight: "900",
    textTransform: "uppercase",
  },
  amountRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "flex-end",
  },
  currency: {
    color: "#BFE9CA",
    fontSize: 14,
    fontWeight: "900",
    marginRight: 8,
    marginBottom: 8,
  },
  amountValue: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "900",
  },
  heroFootnote: {
    marginTop: 8,
    color: "#E5F8EA",
    fontSize: 12,
    fontWeight: "800",
  },
  quickRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 14,
    marginBottom: 14,
  },
  quickChip: {
    flex: 1,
    minHeight: 42,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#CFE5D4",
  },
  quickChipActive: {
    backgroundColor: "#E7F5ED",
    borderColor: "#14532D",
  },
  quickText: {
    color: "#294A35",
    fontSize: 13,
    fontWeight: "900",
  },
  quickTextActive: {
    color: "#14532D",
  },
  card: {
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    padding: 16,
    borderWidth: 1,
    borderColor: "#DCE9D6",
    marginBottom: 14,
    shadowColor: "#0F3D25",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  sectionTitle: {
    color: "#10251B",
    fontSize: 16,
    fontWeight: "900",
  },
  sectionSubtitle: {
    marginTop: 3,
    color: "#647067",
    fontSize: 11,
    fontWeight: "800",
  },
  secureBadge: {
    minHeight: 28,
    borderRadius: 999,
    paddingHorizontal: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E7F5ED",
  },
  secureText: {
    color: "#14532D",
    fontSize: 10,
    fontWeight: "900",
  },
  label: {
    marginTop: 12,
    marginBottom: 7,
    color: "#516353",
    fontSize: 12,
    fontWeight: "900",
  },
  moneyInputShell: {
    minHeight: 54,
    borderRadius: 18,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FBF7",
    borderWidth: 1,
    borderColor: "#CFE5D4",
  },
  moneyPrefix: {
    color: "#14532D",
    fontSize: 12,
    fontWeight: "900",
    marginRight: 10,
  },
  moneyInput: {
    flex: 1,
    color: "#10251B",
    fontSize: 20,
    fontWeight: "900",
    paddingVertical: 10,
  },
  inputShell: {
    minHeight: 52,
    borderRadius: 18,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FBF7",
    borderWidth: 1,
    borderColor: "#CFE5D4",
  },
  input: {
    flex: 1,
    color: "#10251B",
    paddingVertical: 12,
    marginLeft: 9,
    fontWeight: "800",
  },
  doneBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DDF8EA",
  },
  uploadCard: {
    minHeight: 166,
    borderRadius: 20,
    backgroundColor: "#F8FBF7",
    borderWidth: 1,
    borderColor: "#CFE5D4",
    overflow: "hidden",
  },
  uploadEmpty: {
    flex: 1,
    minHeight: 166,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  uploadIcon: {
    width: 50,
    height: 50,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7F5ED",
  },
  uploadTitle: {
    marginTop: 10,
    color: "#10251B",
    fontWeight: "900",
  },
  uploadHint: {
    marginTop: 3,
    color: "#647067",
    fontSize: 12,
    fontWeight: "700",
  },
  image: {
    width: "100%",
    height: 190,
  },
  changeProof: {
    position: "absolute",
    right: 12,
    bottom: 12,
    minHeight: 34,
    borderRadius: 999,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(20,83,45,0.92)",
  },
  changeProofText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  button: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "#14532D",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    shadowColor: "#0F3D25",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 7 },
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.65,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
  },
});
