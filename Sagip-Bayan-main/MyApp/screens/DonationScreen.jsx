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
import { Picker } from "@react-native-picker/picker";

import { getMyDonations, submitDonation as submitDonationApi } from "../lib/donationApi";
import { UserContext } from "./UserContext";
import { ThemeContext } from "./contexts/ThemeContext";
import useFormAutoScroll from "./hooks/useFormAutoScroll";
import {
  DONATION_DESCRIPTION_MAX_LENGTH,
  getPhoneError,
  sanitizeAlphaNumericText,
  sanitizeAmount,
  sanitizeIncidentText,
  sanitizeName,
  sanitizePhoneLocal,
  sanitizeQuantity,
  sanitizeReferenceText,
  sanitizeTextInput,
} from "./utils/validation";

const OFFLINE_QUEUE_KEY = "sagip_bayan_donation_queue_v2";

const ITEM_CATEGORIES = [
  ["clothes", "Clothes"],
  ["food", "Food"],
  ["appliances", "Appliances"],
  ["furniture", "Furniture"],
  ["medicine", "Medicine"],
  ["essentials", "Essentials"],
  ["other", "Other"],
];

const PAYMENT_METHODS = [
  "GCash",
  "Bank Transfer",
  "Cash",
  "Others",
];

const STATUS_META = {
  pending: { label: "Pending", color: "#B45309", bg: "#FEF3C7" },
  accepted: { label: "Accepted", color: "#166534", bg: "#DCFCE7" },
  in_transit: { label: "In Transit", color: "#1D4ED8", bg: "#DBEAFE" },
  delivered: { label: "Delivered", color: "#14532D", bg: "#BBF7D0" },
  rejected: { label: "Rejected", color: "#991B1B", bg: "#FEE2E2" },
};

const INITIAL_FORM = {
  amount: "",
  paymentMethod: "GCash",
  gcashReferenceNumber: "",
  gcashSender: "",
  bankName: "",
  bankAccountNumber: "",
  transferReferenceNumber: "",
  cashInstructions: "",
  category: "food",
  itemName: "",
  quantity: "",
  description: "",
  fulfillmentMethod: "drop_off",
  donorName: "",
  donorPhone: "",
  location: "",
  barangay: "",
};

export default function DonationScreen({ navigation }) {
  const { user } = useContext(UserContext) || {};
  const { theme } = useContext(ThemeContext);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [donationType, setDonationType] = useState("monetary");
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
    const donorName = sanitizeName(form.donorName) || user?.name || user?.username || "";
    const donorPhone = sanitizePhoneLocal(form.donorPhone || user?.phone || "");
    const barangay = sanitizeAlphaNumericText(form.barangay || user?.barangay || "", 80);
    const location = sanitizeIncidentText(form.location, 160);

    if (form.donorPhone && getPhoneError(form.donorPhone)) {
      nextErrors.donorPhone = getPhoneError(form.donorPhone);
    }

    const base = {
      donationType,
      donorUserId: user?._id || "",
      donorName,
      donorPhone: donorPhone ? `0${donorPhone}` : "",
      barangay,
      location,
    };

    if (donationType === "monetary") {
      const cleanAmount = sanitizeAmount(form.amount);
      const amount = Number(cleanAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        nextErrors.amount = "Enter a valid donation amount.";
      }
      if (!sanitizeTextInput(form.paymentMethod, { maxLength: 40 })) {
        nextErrors.paymentMethod = "Payment method is required.";
      }

      const gcashReferenceNumber = sanitizeReferenceText(form.gcashReferenceNumber);
      const gcashSender = sanitizeAlphaNumericText(form.gcashSender, 80);
      const bankName = sanitizeAlphaNumericText(form.bankName, 80);
      const bankAccountNumber = sanitizeReferenceText(form.bankAccountNumber);
      const transferReferenceNumber = sanitizeReferenceText(form.transferReferenceNumber);
      const cashInstructions = sanitizeIncidentText(form.cashInstructions, 180);

      if (form.paymentMethod === "GCash") {
        if (!gcashReferenceNumber) nextErrors.gcashReferenceNumber = "Reference number is required.";
        if (!gcashSender) nextErrors.gcashSender = "Sender name or number is required.";
      }

      if (form.paymentMethod === "Bank Transfer") {
        if (!bankName) nextErrors.bankName = "Bank name is required.";
        if (!bankAccountNumber) nextErrors.bankAccountNumber = "Account/reference number is required.";
        if (!transferReferenceNumber) nextErrors.transferReferenceNumber = "Transfer reference is required.";
      }

      if (form.paymentMethod === "Cash" && !cashInstructions) {
        nextErrors.cashInstructions = "Pickup/drop-off instruction is required.";
      }

      if (Object.keys(nextErrors).length) {
        setErrors(nextErrors);
        throw new Error(Object.values(nextErrors)[0]);
      }

      return {
        ...base,
        amount: String(amount),
        paymentMethod: sanitizeTextInput(form.paymentMethod, { maxLength: 40 }),
        gcashReferenceNumber,
        gcashSender,
        bankName,
        bankAccountNumber,
        transferReferenceNumber,
        cashInstructions,
        referenceNumber:
          gcashReferenceNumber ||
          transferReferenceNumber ||
          bankAccountNumber ||
          "",
        description: `Monetary donation via ${sanitizeTextInput(form.paymentMethod, { maxLength: 40 })}.`,
      };
    }

    const quantity = Number(sanitizeQuantity(form.quantity));
    const itemName = sanitizeAlphaNumericText(form.itemName, 80);
    const description = sanitizeIncidentText(form.description, DONATION_DESCRIPTION_MAX_LENGTH);
    if (!itemName) nextErrors.itemName = "Item name is required.";
    if (!Number.isFinite(quantity) || quantity <= 0) {
      nextErrors.quantity = "Enter a valid item quantity.";
    }

    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      throw new Error(Object.values(nextErrors)[0]);
    }

    return {
      ...base,
      category: form.category,
      itemName,
      quantity: String(quantity),
      description,
      fulfillmentMethod: form.fulfillmentMethod,
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
            label="Monetary Donation"
            active={activeTab === "form" && donationType === "monetary"}
            onPress={() => {
              setDonationType("monetary");
              setActiveTab("form");
              setPhoto(null);
            }}
            styles={styles}
          />
          <MainTabButton
            icon="cube-outline"
            label="Non-Monetary Donation"
            active={activeTab === "form" && donationType === "non_monetary"}
            onPress={() => {
              setDonationType("non_monetary");
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
            <Text style={styles.panelTitle}>
              {donationType === "monetary" ? "Monetary Donation" : "Item Donation"}
            </Text>
            <Text style={styles.panelSubtitle}>
              {donationType === "monetary"
                ? "Enter the amount and payment channel used."
                : "Describe the item and how MDRRMO can receive it."}
            </Text>

            {donationType === "monetary" ? (
            <MonetaryFields form={form} updateField={updateField} errors={errors} registerInput={registerInput} scrollToInput={scrollToInput} styles={styles} />
          ) : (
            <ItemFields
              form={form}
              updateField={updateField}
              errors={errors}
              registerInput={registerInput}
              scrollToInput={scrollToInput}
              photo={photo}
                pickImage={pickImage}
                styles={styles}
              />
            )}

            <ContactFields form={form} updateField={updateField} errors={errors} registerInput={registerInput} scrollToInput={scrollToInput} styles={styles} />

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

function MonetaryFields({ form, updateField, errors, registerInput, scrollToInput, styles }) {
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
      <Field label="Payment method" styles={styles}>
        <Picker
          selectedValue={form.paymentMethod}
          onValueChange={(value) => updateField("paymentMethod", value)}
          style={styles.picker}
          dropdownIconColor={styles.iconColor}
        >
          {PAYMENT_METHODS.map((method) => (
            <Picker.Item key={method} label={method} value={method} />
          ))}
        </Picker>
      </Field>
      {form.paymentMethod === "GCash" && (
        <>
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
          <Field label="GCash sender name or number" styles={styles}>
            <TextInput
              style={styles.input}
              placeholder="Sender name / mobile number"
              placeholderTextColor={styles.placeholderColor}
              value={form.gcashSender}
              onFocus={() => scrollToInput("gcashSender")}
              onLayout={registerInput("gcashSender")}
              onChangeText={(value) => updateField("gcashSender", sanitizeAlphaNumericText(value, 80))}
              maxLength={80}
            />
            <FieldError message={errors.gcashSender} styles={styles} />
          </Field>
        </>
      )}
      {form.paymentMethod === "Bank Transfer" && (
        <>
          <Field label="Bank name" styles={styles}>
            <TextInput
              style={styles.input}
              placeholder="Bank name"
              placeholderTextColor={styles.placeholderColor}
              value={form.bankName}
              onFocus={() => scrollToInput("bankName")}
              onLayout={registerInput("bankName")}
              onChangeText={(value) => updateField("bankName", sanitizeAlphaNumericText(value, 80))}
              maxLength={80}
            />
            <FieldError message={errors.bankName} styles={styles} />
          </Field>
          <Field label="Account / reference number" styles={styles}>
            <TextInput
              style={styles.input}
              placeholder="Account or reference number"
              placeholderTextColor={styles.placeholderColor}
              value={form.bankAccountNumber}
              onFocus={() => scrollToInput("bankAccountNumber")}
              onLayout={registerInput("bankAccountNumber")}
              onChangeText={(value) => updateField("bankAccountNumber", sanitizeReferenceText(value))}
              maxLength={80}
            />
            <FieldError message={errors.bankAccountNumber} styles={styles} />
          </Field>
          <Field label="Transfer reference number" styles={styles}>
            <TextInput
              style={styles.input}
              placeholder="Transfer reference"
              placeholderTextColor={styles.placeholderColor}
              value={form.transferReferenceNumber}
              onFocus={() => scrollToInput("transferReferenceNumber")}
              onLayout={registerInput("transferReferenceNumber")}
              onChangeText={(value) => updateField("transferReferenceNumber", sanitizeReferenceText(value))}
              maxLength={80}
            />
            <FieldError message={errors.transferReferenceNumber} styles={styles} />
          </Field>
        </>
      )}
      {form.paymentMethod === "Cash" && (
        <Field label="Cash pickup/drop-off instruction" styles={styles}>
          <TextInput
            style={[styles.input, styles.textArea]}
            multiline
            placeholder="Preferred pickup/drop-off instructions"
            placeholderTextColor={styles.placeholderColor}
            value={form.cashInstructions}
            onFocus={() => scrollToInput("cashInstructions")}
            onLayout={registerInput("cashInstructions")}
            onChangeText={(value) => updateField("cashInstructions", sanitizeIncidentText(value, 180))}
            maxLength={180}
          />
          <FieldError message={errors.cashInstructions} styles={styles} />
        </Field>
      )}
    </>
  );
}

function ItemFields({ form, updateField, errors, registerInput, scrollToInput, photo, pickImage, styles }) {
  return (
    <>
      <Field label="Category" styles={styles}>
        <Picker
          selectedValue={form.category}
          onValueChange={(value) => updateField("category", value)}
          style={styles.picker}
          dropdownIconColor={styles.iconColor}
        >
          {ITEM_CATEGORIES.map(([key, label]) => (
            <Picker.Item key={key} label={label} value={key} />
          ))}
        </Picker>
      </Field>

      <Field label="Item name" styles={styles}>
        <TextInput
          style={styles.input}
          placeholder="Blankets, canned goods, clothes..."
          placeholderTextColor={styles.placeholderColor}
          value={form.itemName}
          onFocus={() => scrollToInput("itemName")}
          onLayout={registerInput("itemName")}
          onChangeText={(value) => updateField("itemName", sanitizeAlphaNumericText(value, 80))}
          maxLength={80}
        />
        <FieldError message={errors.itemName} styles={styles} />
      </Field>

      <Field label="Quantity" styles={styles}>
        <TextInput
          style={styles.input}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={styles.placeholderColor}
          value={form.quantity}
          onFocus={() => scrollToInput("quantity")}
          onLayout={registerInput("quantity")}
          onChangeText={(value) => updateField("quantity", sanitizeQuantity(value))}
          maxLength={6}
        />
        <FieldError message={errors.quantity} styles={styles} />
      </Field>

      <Field label="Description" styles={styles}>
        <TextInput
          style={[styles.input, styles.textArea]}
          multiline
          placeholder="Condition, size, expiry date, or other details"
          placeholderTextColor={styles.placeholderColor}
          value={form.description}
          onFocus={() => scrollToInput("description")}
          onLayout={registerInput("description")}
          onChangeText={(value) => updateField("description", sanitizeIncidentText(value, DONATION_DESCRIPTION_MAX_LENGTH))}
          maxLength={DONATION_DESCRIPTION_MAX_LENGTH}
        />
      </Field>

      <Text style={styles.label}>Pickup or drop-off</Text>
      <View style={styles.optionRow}>
        <OptionButton
          label="Drop-off"
          active={form.fulfillmentMethod === "drop_off"}
          onPress={() => updateField("fulfillmentMethod", "drop_off")}
          styles={styles}
        />
        <OptionButton
          label="Pickup"
          active={form.fulfillmentMethod === "pickup"}
          onPress={() => updateField("fulfillmentMethod", "pickup")}
          styles={styles}
        />
      </View>

      <TouchableOpacity style={styles.uploadBox} onPress={pickImage} activeOpacity={0.85}>
        {photo?.uri ? (
          <>
            <Image source={{ uri: photo.uri }} style={styles.previewImage} />
            <Text style={styles.uploadText}>Change image</Text>
          </>
        ) : (
          <>
            <Ionicons name="image-outline" size={24} color={styles.iconColor} />
            <Text style={styles.uploadTitle}>Upload image</Text>
            <Text style={styles.uploadHint}>Optional, but helps MDRRMO verify the item</Text>
          </>
        )}
      </TouchableOpacity>
    </>
  );
}

function ContactFields({ form, updateField, errors, registerInput, scrollToInput, styles }) {
  return (
    <View style={styles.contactBlock}>
      <Text style={styles.blockTitle}>Contact and Location</Text>
      <Field label="Donor name" styles={styles}>
        <TextInput
          style={styles.input}
          placeholder="Optional"
          placeholderTextColor={styles.placeholderColor}
          value={form.donorName}
          onFocus={() => scrollToInput("donorName")}
          onLayout={registerInput("donorName")}
          onChangeText={(value) => updateField("donorName", sanitizeName(value))}
          maxLength={50}
        />
      </Field>
      <Field label="Contact number" styles={styles}>
        <TextInput
          style={styles.input}
          keyboardType="phone-pad"
          placeholder="Mobile number"
          placeholderTextColor={styles.placeholderColor}
          value={form.donorPhone}
          onFocus={() => scrollToInput("donorPhone")}
          onLayout={registerInput("donorPhone")}
          onChangeText={(value) => updateField("donorPhone", sanitizePhoneLocal(value))}
          maxLength={10}
        />
        <FieldError message={errors.donorPhone} styles={styles} />
      </Field>
      <Field label="Location" styles={styles}>
        <TextInput
          style={styles.input}
          placeholder="Address or pickup/drop-off point"
          placeholderTextColor={styles.placeholderColor}
          value={form.location}
          onFocus={() => scrollToInput("location")}
          onLayout={registerInput("location")}
          onChangeText={(value) => updateField("location", sanitizeIncidentText(value, 160))}
          maxLength={160}
        />
      </Field>
      <Field label="Barangay" styles={styles}>
        <TextInput
          style={styles.input}
          placeholder="Barangay"
          placeholderTextColor={styles.placeholderColor}
          value={form.barangay}
          onFocus={() => scrollToInput("barangay")}
          onLayout={registerInput("barangay")}
          onChangeText={(value) => updateField("barangay", sanitizeAlphaNumericText(value, 80))}
          maxLength={80}
        />
      </Field>
    </View>
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

function OptionButton({ label, active, onPress, styles }) {
  return (
    <TouchableOpacity style={[styles.optionButton, active && styles.optionButtonActive]} onPress={onPress}>
      <Text style={[styles.optionText, active && styles.optionTextActive]}>{label}</Text>
    </TouchableOpacity>
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
  const isMoney = item.donationType === "monetary";
  const summary = isMoney
    ? `PHP ${Number(item.amount || 0).toLocaleString("en-PH")} via ${
        item.paymentMethod || "payment method"
      }`
    : `${item.itemName || item.category || "Item"} x ${item.quantity || 0}`;

  return (
    <View style={styles.historyCard}>
      <View style={styles.historyTop}>
        <View style={styles.historyIcon}>
          <Ionicons name={isMoney ? "wallet-outline" : "cube-outline"} size={18} color="#FFFFFF" />
        </View>
        <View style={styles.historyCopy}>
          <Text style={styles.historyTitle}>{isMoney ? "Monetary Donation" : "Item Donation"}</Text>
          <Text style={styles.historyDate}>{date}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
          <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
        </View>
      </View>
      <Text style={styles.historySummary}>{summary}</Text>
      {item.paymentMethod ? (
        <Text style={styles.assignmentText}>Mode: {item.paymentMethod}</Text>
      ) : null}
      {item.referenceNumber ? (
        <Text style={styles.assignmentText}>Reference: {item.referenceNumber}</Text>
      ) : null}
      {item.assignment?.targetName ? (
        <Text style={styles.assignmentText}>Assigned to {item.assignment.targetName}</Text>
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
  });

  return {
    ...sheet,
    placeholderColor,
    iconColor: theme.primary,
  };
}
