import React, { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { Ionicons } from "@expo/vector-icons";

import { getMyDonations, submitDonation as submitDonationApi } from "../lib/donationApi";
import { UserContext } from "./UserContext";
import { ThemeContext } from "./contexts/ThemeContext";
import useFormAutoScroll from "./hooks/useFormAutoScroll";
import {
  sanitizeAmount,
  sanitizeReferenceText,
} from "./utils/validation";

const OFFLINE_QUEUE_KEY = "sagip_bayan_donation_queue_v2";

const STATUS_META = {
  pending: { label: "Pending", color: "#B45309", bg: "#FEF3C7" },
  accepted: { label: "Accepted", color: "#166534", bg: "#DCFCE7" },
  in_transit: { label: "In Transit", color: "#1D4ED8", bg: "#DBEAFE" },
  delivered: { label: "Delivered", color: "#14532D", bg: "#BBF7D0" },
  rejected: { label: "Rejected", color: "#991B1B", bg: "#FEE2E2" },
};

const INITIAL_FORM = {
  amount: "",
  gcashReferenceNumber: "",
};

export default function DonationScreen({ navigation }) {
  const { user } = useContext(UserContext) || {};
  const { theme } = useContext(ThemeContext);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [activeTab, setActiveTab] = useState("form");
  const [form, setForm] = useState(INITIAL_FORM);
  const [photo, setPhoto] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [queuedCount, setQueuedCount] = useState(0);
  const [errors, setErrors] = useState({});
  const { scrollRef, registerInput, scrollToInput } = useFormAutoScroll(36);

  const updateField = (key, value) => {
    setErrors((prev) => ({ ...prev, [key]: "" }));
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const fetchHistory = useCallback(async () => {
    if (!user?._id) {
      setHistory([]);
      return;
    }

    setHistoryLoading(true);
    setHistoryError("");
    try {
      const donations = await getMyDonations(user._id);
      setHistory(donations);
    } catch (err) {
      console.log("[donations] history failed:", err?.message);
      setHistoryError("Unable to load donation history.");
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [user?._id]);

  const syncQueuedDonations = useCallback(async () => {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    setQueuedCount(queue.length);
    if (!queue.length) return;

    const remaining = [];
    for (const queued of queue) {
      try {
        await submitDonationPayload(queued.payload, queued.photo);
      } catch (_) {
        remaining.push(queued);
      }
    }

    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(remaining));
    setQueuedCount(remaining.length);
    if (remaining.length !== queue.length) fetchHistory();
  }, [fetchHistory]);

  useEffect(() => {
    fetchHistory();
    syncQueuedDonations();
  }, [fetchHistory, syncQueuedDonations]);

  const resetForm = () => {
    setForm(INITIAL_FORM);
    setPhoto(null);
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      quality: 0.72,
    });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setPhoto({
      uri: asset.uri,
      name: asset.fileName || asset.uri?.split("/")?.pop() || `donation-${Date.now()}.jpg`,
      type: asset.mimeType || "image/jpeg",
    });
  };

  const buildPayload = () => {
    const nextErrors = {};
    const cleanAmount = sanitizeAmount(form.amount);
    const amount = Number(cleanAmount);
    const gcashReferenceNumber = sanitizeReferenceText(form.gcashReferenceNumber);

    if (!Number.isFinite(amount) || amount <= 0) {
      nextErrors.amount = "Enter a valid donation amount.";
    }
    if (!gcashReferenceNumber) {
      nextErrors.gcashReferenceNumber = "Reference number is required.";
    }
    if (!photo?.uri) {
      nextErrors.photo = "Upload your GCash receipt or screenshot.";
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      throw new Error(Object.values(nextErrors)[0]);
    }

    return {
      donationType: "monetary",
      donorUserId: user?._id || "",
      amount: String(amount),
      paymentMethod: "GCash",
      gcashReferenceNumber,
      referenceNumber: gcashReferenceNumber,
      description: "GCash monetary donation.",
    };
  };

  const queueDonation = async (payload, selectedPhoto) => {
    const raw = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    const queue = raw ? JSON.parse(raw) : [];
    const next = [
      ...queue,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        payload,
        photo: selectedPhoto,
        queuedAt: new Date().toISOString(),
      },
    ];
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(next));
    setQueuedCount(next.length);
  };

  const submitDonation = async () => {
    try {
      setSubmitting(true);
      const payload = buildPayload();
      setErrors({});

      try {
        await submitDonationPayload(payload, photo);
      } catch (networkErr) {
        await queueDonation(payload, photo);
        Alert.alert(
          "Saved offline",
          "Your donation was saved and will sync when the server is reachable."
        );
        resetForm();
        return;
      }

      Alert.alert("Donation submitted", "Your donation is pending MDRRMO review.");
      resetForm();
      setActiveTab("history");
      fetchHistory();
    } catch (err) {
      Alert.alert("Donation details needed", err?.message || "Please check the form.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
      >
        <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={21} color={theme.primary} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>Donations</Text>
            <Text style={styles.subtitle}>Send support to MDRRMO for disaster response.</Text>
          </View>
        </View>

        {queuedCount > 0 && (
          <TouchableOpacity style={styles.offlineBanner} onPress={syncQueuedDonations}>
            <Ionicons name="cloud-upload-outline" size={17} color="#92400E" />
            <Text style={styles.offlineText}>{queuedCount} donation(s) waiting to sync</Text>
          </TouchableOpacity>
        )}

        <View style={styles.mainTabs}>
          <MainTabButton
            icon="wallet-outline"
            label="GCash Donation"
            active={activeTab === "form"}
            onPress={() => {
              setActiveTab("form");
            }}
            styles={styles}
          />
          <MainTabButton
            icon="time-outline"
            label="My Donation History"
            active={activeTab === "history"}
            onPress={() => {
              setActiveTab("history");
              fetchHistory();
            }}
            styles={styles}
          />
        </View>

        {activeTab === "form" ? (
          <View style={styles.panel}>
            <Text style={styles.panelTitle}>GCash Donation</Text>
            <Text style={styles.panelSubtitle}>
              Submit the amount, GCash reference number, and receipt screenshot.
            </Text>

            <MonetaryFields
              form={form}
              updateField={updateField}
              errors={errors}
              registerInput={registerInput}
              scrollToInput={scrollToInput}
              photo={photo}
              pickImage={pickImage}
              styles={styles}
            />

            <TouchableOpacity
              style={[styles.submitButton, submitting && styles.disabled]}
              onPress={submitDonation}
              disabled={submitting}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="send" size={18} color="#FFFFFF" />
                  <Text style={styles.submitText}>Submit Donation</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <HistoryPanel
            history={history}
            loading={historyLoading}
            error={historyError}
            onRetry={fetchHistory}
            styles={styles}
          />
        )}
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

async function submitDonationPayload(payload, photo) {
  return submitDonationApi(payload, photo);
}

function MainTabButton({ icon, label, active, onPress, styles }) {
  return (
    <TouchableOpacity style={[styles.mainTabButton, active && styles.mainTabButtonActive]} onPress={onPress}>
      <Ionicons name={icon} size={17} color={active ? "#FFFFFF" : styles.iconColor} />
      <Text style={[styles.mainTabText, active && styles.mainTabTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function FieldError({ message, styles }) {
  return message ? <Text style={styles.fieldError}>{message}</Text> : null;
}

function MonetaryFields({ form, updateField, errors, registerInput, scrollToInput, photo, pickImage, styles }) {
  return (
    <>
      <Field label="Amount" styles={styles}>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="0.00"
          placeholderTextColor={styles.placeholderColor}
          value={form.amount}
          onFocus={() => scrollToInput("amount")}
          onLayout={registerInput("amount")}
          onChangeText={(value) => updateField("amount", sanitizeAmount(value))}
          maxLength={11}
        />
        <FieldError message={errors.amount} styles={styles} />
      </Field>
      <Field label="GCash reference number" styles={styles}>
        <TextInput
          style={styles.input}
          placeholder="Reference number"
          placeholderTextColor={styles.placeholderColor}
          value={form.gcashReferenceNumber}
          onFocus={() => scrollToInput("gcashReferenceNumber")}
          onLayout={registerInput("gcashReferenceNumber")}
          onChangeText={(value) => updateField("gcashReferenceNumber", sanitizeReferenceText(value))}
          maxLength={80}
        />
        <FieldError message={errors.gcashReferenceNumber} styles={styles} />
      </Field>

      <TouchableOpacity style={styles.uploadBox} onPress={pickImage} activeOpacity={0.85}>
        {photo?.uri ? (
          <>
            <Image source={{ uri: photo.uri }} style={styles.previewImage} />
            <Text style={styles.uploadText}>Change proof</Text>
          </>
        ) : (
          <>
            <Ionicons name="image-outline" size={24} color={styles.iconColor} />
            <Text style={styles.uploadTitle}>Upload GCash proof</Text>
            <Text style={styles.uploadHint}>Receipt or screenshot is required</Text>
          </>
        )}
      </TouchableOpacity>
      <FieldError message={errors.photo} styles={styles} />
    </>
  );
}

function Field({ label, children, styles }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>{children}</View>
    </View>
  );
}

function HistoryPanel({ history, loading, error, onRetry, styles }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.panelTitle}>My Donation History</Text>
      <Text style={styles.panelSubtitle}>Track status updates and where donations are assigned.</Text>

      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator />
          <Text style={styles.stateText}>Loading donations...</Text>
        </View>
      ) : error ? (
        <TouchableOpacity style={styles.stateBox} onPress={onRetry}>
          <Ionicons name="refresh-outline" size={22} color={styles.iconColor} />
          <Text style={styles.stateText}>{error}</Text>
          <Text style={styles.retryText}>Tap to retry</Text>
        </TouchableOpacity>
      ) : history.length === 0 ? (
        <View style={styles.stateBox}>
          <Ionicons name="gift-outline" size={24} color={styles.iconColor} />
          <Text style={styles.stateTitle}>No donations yet</Text>
          <Text style={styles.stateText}>Your submitted donations will appear here.</Text>
        </View>
      ) : (
        history.map((item) => <DonationHistoryCard key={item._id} item={item} styles={styles} />)
      )}
    </View>
  );
}

function DonationHistoryCard({ item, styles }) {
  const status = STATUS_META[item.status] || STATUS_META.pending;
  const date = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString()
    : "Date unavailable";
  const summary = `PHP ${Number(item.amount || 0).toLocaleString("en-PH")} via GCash`;

  return (
    <View style={styles.historyCard}>
      <View style={styles.historyTop}>
        <View style={styles.historyIcon}>
          <Ionicons name="wallet-outline" size={18} color="#FFFFFF" />
        </View>
        <View style={styles.historyCopy}>
          <Text style={styles.historyTitle}>GCash Donation</Text>
          <Text style={styles.historyDate}>{date}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>
      <Text style={styles.historySummary}>{summary}</Text>
      {item.referenceNumber ? (
        <Text style={styles.assignmentText}>Reference: {item.referenceNumber}</Text>
      ) : null}
      {item.photos?.[0]?.fileUrl ? (
        <Image source={{ uri: item.photos[0].fileUrl }} style={styles.historyProofImage} />
      ) : null}
    </View>
  );
}

function createStyles(theme) {
  const isDark = theme.mode === "dark";
  const placeholderColor = isDark ? "#7C8A82" : "#87958C";

  const sheet = StyleSheet.create({
    safe: {
      flex: 1,
      backgroundColor: theme.background,
    },
    keyboardWrap: {
      flex: 1,
    },
    content: {
      padding: 16,
      paddingBottom: 34,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      marginBottom: 16,
    },
    backButton: {
      width: 42,
      height: 42,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      marginRight: 12,
    },
    headerCopy: {
      flex: 1,
    },
    title: {
      color: theme.text,
      fontSize: 24,
      fontWeight: "900",
    },
    subtitle: {
      marginTop: 3,
      color: theme.muted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
    },
    offlineBanner: {
      minHeight: 42,
      borderRadius: 14,
      paddingHorizontal: 12,
      marginBottom: 14,
      backgroundColor: "#FEF3C7",
      borderWidth: 1,
      borderColor: "#FDE68A",
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
    },
    offlineText: {
      flex: 1,
      color: "#92400E",
      fontSize: 12,
      fontWeight: "900",
    },
    mainTabs: {
      flexDirection: "row",
      gap: 8,
      marginBottom: 14,
    },
    mainTabButton: {
      flex: 1,
      minHeight: 62,
      borderRadius: 16,
      paddingHorizontal: 8,
      paddingVertical: 9,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
      gap: 5,
    },
    mainTabButtonActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    mainTabText: {
      color: theme.primary,
      fontSize: 10,
      lineHeight: 13,
      fontWeight: "900",
      textAlign: "center",
    },
    mainTabTextActive: {
      color: "#FFFFFF",
    },
    typeGrid: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 14,
    },
    typeCard: {
      flex: 1,
      minHeight: 142,
      borderRadius: 20,
      padding: 14,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: "space-between",
    },
    typeCardActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    typeIcon: {
      width: 42,
      height: 42,
      borderRadius: 15,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.primarySoft,
    },
    typeIconActive: {
      backgroundColor: "rgba(255,255,255,0.18)",
    },
    typeTitle: {
      color: theme.text,
      fontSize: 15,
      fontWeight: "900",
    },
    typeSubtitle: {
      color: theme.muted,
      fontSize: 11,
      lineHeight: 15,
      fontWeight: "700",
    },
    typeTextActive: {
      color: "#FFFFFF",
    },
    typeSubActive: {
      color: "rgba(255,255,255,0.82)",
    },
    segment: {
      minHeight: 48,
      borderRadius: 16,
      padding: 4,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
      flexDirection: "row",
      marginBottom: 14,
    },
    segmentButton: {
      flex: 1,
      borderRadius: 13,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 8,
    },
    segmentButtonActive: {
      backgroundColor: theme.surface,
      shadowColor: "#000",
      shadowOpacity: isDark ? 0 : 0.06,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
      elevation: 1,
    },
    segmentText: {
      color: theme.muted,
      fontSize: 12,
      fontWeight: "900",
      textAlign: "center",
    },
    segmentTextActive: {
      color: theme.primary,
    },
    panel: {
      borderRadius: 22,
      padding: 16,
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
    },
    panelTitle: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "900",
    },
    panelSubtitle: {
      marginTop: 4,
      marginBottom: 10,
      color: theme.muted,
      fontSize: 12,
      lineHeight: 17,
      fontWeight: "700",
    },
    field: {
      marginTop: 12,
    },
    label: {
      marginBottom: 7,
      color: theme.muted,
      fontSize: 12,
      fontWeight: "900",
    },
    inputShell: {
      minHeight: 50,
      borderRadius: 15,
      paddingHorizontal: 12,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
      justifyContent: "center",
    },
    input: {
      color: theme.text,
      paddingVertical: 11,
      fontSize: 14,
      fontWeight: "800",
    },
    fieldError: {
      marginTop: 6,
      color: theme.danger || "#DC2626",
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "800",
    },
    picker: {
      color: theme.text,
      minHeight: 48,
    },
    textArea: {
      minHeight: 86,
      textAlignVertical: "top",
    },
    categoryGrid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 2,
    },
    categoryChip: {
      minHeight: 36,
      paddingHorizontal: 12,
      borderRadius: 999,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    categoryChipActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    categoryText: {
      color: theme.primary,
      fontSize: 11,
      fontWeight: "900",
    },
    categoryTextActive: {
      color: "#FFFFFF",
    },
    optionRow: {
      flexDirection: "row",
      gap: 10,
      marginBottom: 12,
    },
    optionButton: {
      flex: 1,
      minHeight: 42,
      borderRadius: 14,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
    },
    optionButtonActive: {
      backgroundColor: theme.primary,
      borderColor: theme.primary,
    },
    optionText: {
      color: theme.primary,
      fontSize: 12,
      fontWeight: "900",
    },
    optionTextActive: {
      color: "#FFFFFF",
    },
    uploadBox: {
      minHeight: 138,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: theme.border,
      backgroundColor: theme.surfaceAlt,
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      marginTop: 12,
    },
    uploadTitle: {
      marginTop: 8,
      color: theme.text,
      fontWeight: "900",
    },
    uploadHint: {
      marginTop: 3,
      color: theme.muted,
      fontSize: 11,
      fontWeight: "700",
      textAlign: "center",
      paddingHorizontal: 14,
    },
    uploadText: {
      position: "absolute",
      bottom: 10,
      right: 10,
      minHeight: 30,
      borderRadius: 999,
      paddingHorizontal: 12,
      paddingVertical: 7,
      overflow: "hidden",
      backgroundColor: "rgba(20,83,45,0.92)",
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "900",
    },
    previewImage: {
      width: "100%",
      height: 190,
    },
    contactBlock: {
      marginTop: 16,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: theme.border,
    },
    blockTitle: {
      color: theme.text,
      fontSize: 14,
      fontWeight: "900",
    },
    submitButton: {
      minHeight: 52,
      borderRadius: 16,
      marginTop: 18,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      flexDirection: "row",
      gap: 8,
    },
    disabled: {
      opacity: 0.62,
    },
    submitText: {
      color: "#FFFFFF",
      fontSize: 14,
      fontWeight: "900",
    },
    stateBox: {
      minHeight: 150,
      borderRadius: 18,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
      alignItems: "center",
      justifyContent: "center",
      padding: 18,
      marginTop: 12,
    },
    stateTitle: {
      marginTop: 8,
      color: theme.text,
      fontSize: 14,
      fontWeight: "900",
    },
    stateText: {
      marginTop: 6,
      color: theme.muted,
      fontSize: 12,
      lineHeight: 17,
      textAlign: "center",
      fontWeight: "700",
    },
    retryText: {
      marginTop: 8,
      color: theme.primary,
      fontSize: 12,
      fontWeight: "900",
    },
    historyCard: {
      marginTop: 12,
      borderRadius: 18,
      padding: 13,
      backgroundColor: theme.surfaceAlt,
      borderWidth: 1,
      borderColor: theme.border,
    },
    historyTop: {
      flexDirection: "row",
      alignItems: "center",
    },
    historyIcon: {
      width: 38,
      height: 38,
      borderRadius: 14,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 10,
    },
    historyCopy: {
      flex: 1,
      minWidth: 0,
    },
    historyTitle: {
      color: theme.text,
      fontSize: 13,
      fontWeight: "900",
    },
    historyDate: {
      marginTop: 2,
      color: theme.muted,
      fontSize: 11,
      fontWeight: "700",
    },
    statusBadge: {
      minHeight: 28,
      borderRadius: 999,
      paddingHorizontal: 9,
      alignItems: "center",
      justifyContent: "center",
      marginLeft: 8,
    },
    statusText: {
      fontSize: 10,
      fontWeight: "900",
      textTransform: "uppercase",
    },
    historySummary: {
      marginTop: 10,
      color: theme.text,
      fontSize: 13,
      fontWeight: "800",
    },
    assignmentText: {
      marginTop: 5,
      color: theme.muted,
      fontSize: 11,
      fontWeight: "700",
    },
    historyProofImage: {
      width: "100%",
      height: 150,
      borderRadius: 14,
      marginTop: 10,
      backgroundColor: theme.surface,
    },
  });

  return {
    ...sheet,
    placeholderColor,
    iconColor: theme.primary,
  };
}
