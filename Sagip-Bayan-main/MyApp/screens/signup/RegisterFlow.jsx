import {
  View,
  FlatList,
  Dimensions,
  StyleSheet,
  Text,
  TouchableOpacity,
  Modal,
} from "react-native";

import { useRef, useState } from "react";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import api from "../../lib/api";
import StepPersonal from "./StepPersonal";
import StepAddress from "./StepAddress";
import StepSecurity from "./StepSecurity";
import StepMobile from "./StepMobile";
import SignUpHeader from "./SignUpHeader";

const { width } = Dimensions.get("window");

function buildFullAddress({ barangay, street }) {
  return [street, barangay, "Jaen, Nueva Ecija"].filter(Boolean).join(", ");
}

export default function RegisterFlow() {
  const listRef = useRef(null);
  const navigation = useNavigation();

  const [step, setStep] = useState(0);
  const [unlockedSteps, setUnlockedSteps] = useState([0]);

  const [form, setForm] = useState({
    fname: "",
    lname: "",
    username: "",
    password: "",
    phone: "",
    email: "",
    barangay: "",
    street: "",
    address: "",
  });

  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");

  const [serverError, setServerError] = useState({
    email: "",
    phone: "",
    username: "",
  });

  const steps = ["personal", "address", "security", "mobile"];

  const updateForm = (data) => {
    setForm((prev) => ({ ...prev, ...data }));
  };

  const goNext = () => {
    if (step < steps.length - 1) {
      const next = step + 1;

      setStep(next);

      setUnlockedSteps((prev) =>
        prev.includes(next) ? prev : [...prev, next]
      );

      listRef.current?.scrollToIndex({
        index: next,
        animated: true,
      });
    }
  };

  const goBack = () => {
    if (step > 0) {
      const prev = step - 1;

      setStep(prev);

      listRef.current?.scrollToIndex({
        index: prev,
        animated: true,
      });
    }
  };

  const handleSwipe = (index) => {
    const direction = index - step;

    if (direction < 0) {
      setStep(index);
      return;
    }

    if (direction > 0 && !unlockedSteps.includes(index)) {
      listRef.current?.scrollToIndex({
        index: step,
        animated: true,
      });
      return;
    }

    setStep(index);
  };

  const handleSubmit = async (mobileData) => {
    try {
      const rebuiltAddress = buildFullAddress({
        barangay: form.barangay,
        street: form.street,
      });

      const payload = {
        fname: form.fname,
        lname: form.lname,
        username: form.username,
        password: form.password,
        email: mobileData.email,
        phone: mobileData.phone,
        barangay: form.barangay,
        street: form.street,
        streetAddress: form.street,
        address: rebuiltAddress,
      };

      console.log("📦 FINAL CLEAN PAYLOAD:", payload);

      const res = await api.post("/user/register", payload);
      const result = res?.data || {};
      await AsyncStorage.multiSet([
        ["hasSeenGetStarted", "true"],
        ["getStartedSeen", "true"],
        ["hasAcceptedPrivacy", "true"],
        ["hasAcceptedDataPrivacy", "true"],
        ["privacyAccepted", "true"],
        ["hasAcceptedTerms", "true"],
        ["termsAccepted", "true"],
        ["hasAccount", "true"],
        ["hasCreatedAccount", "true"],
        ["onboardingComplete", "true"],
      ]);

      console.log("📨 SERVER RESPONSE:", result);

      setServerError({ email: "", phone: "", username: "" });

      setModalMessage(
        result?.message ||
          (result?.emailSent === false
            ? "Registration successful, but verification email could not be sent yet."
            : "Registration successful! Please verify your email.")
      );
      setShowModal(true);

      setTimeout(() => {
        setShowModal(false);
        navigation.navigate("LogIn");
      }, 1500);
    } catch (err) {
      const message =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        "Registration failed";

      console.log("❌ REGISTER ERROR:", message);

      const lower = String(message).toLowerCase();

      const errors = {
        email: lower.includes("email") ? "Email already exists" : "",
        phone: lower.includes("phone") ? "Phone number already exists" : "",
        username: lower.includes("username") ? "Username already exists" : "",
      };

      setServerError(errors);

      const modalMsg =
        errors.email ||
        errors.phone ||
        errors.username ||
        message;

      setModalMessage(modalMsg);
      setShowModal(true);
    }
  };

  return (
    <View style={styles.container}>
      <SignUpHeader step={step} onBack={goBack} />

      <Modal visible={showModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>Notice</Text>

            <Text style={styles.modalText}>{modalMessage}</Text>

            <TouchableOpacity
              onPress={() => setShowModal(false)}
              style={styles.modalButton}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <FlatList
        ref={listRef}
        data={steps}
        keyExtractor={(item) => item}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        style={{ flex: 1 }}
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index,
        })}
        onMomentumScrollEnd={(e) => {
          const index = Math.round(
            e.nativeEvent.contentOffset.x / width
          );
          handleSwipe(index);
        }}
        renderItem={({ item }) => (
          <View style={styles.page}>
            {item === "personal" && (
              <StepPersonal
                fName={form.fname}
                lName={form.lname}
                username={form.username}
                onFNameChange={(v) => updateForm({ fname: v })}
                onLNameChange={(v) => updateForm({ lname: v })}
                onUsernameChange={(v) => updateForm({ username: v })}
                onNext={(data) => {
                  updateForm({
                    fname: data.fName,
                    lname: data.lName,
                    username: data.username,
                  });
                  goNext();
                }}
              />
            )}

            {item === "address" && (
              <StepAddress
                barangay={form.barangay}
                street={form.street}
                onBarangayChange={(v) => updateForm({ barangay: v })}
                onStreetChange={(v) => updateForm({ street: v })}
                onNext={(data) => {
                  updateForm({
                    barangay: data.barangay,
                    street: data.street,
                    address: buildFullAddress({
                      barangay: data.barangay,
                      street: data.street,
                    }),
                  });
                  goNext();
                }}
              />
            )}

            {item === "security" && (
              <StepSecurity
                onNext={(data) => {
                  updateForm({
                    password: data.password,
                  });
                  goNext();
                }}
              />
            )}

            {item === "mobile" && (
              <StepMobile
                phone={form.phone}
                email={form.email}
                onPhoneChange={(v) => updateForm({ phone: v })}
                onEmailChange={(v) => updateForm({ email: v })}
                onSubmit={handleSubmit}
                emailError={serverError.email}
                phoneError={serverError.phone}
              />
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  page: { width, flex: 1 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalBox: {
    width: "85%",
    backgroundColor: "#fff",
    padding: 22,
    borderRadius: 16,
    alignItems: "center",
  },

  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
  },

  modalText: {
    textAlign: "center",
    marginTop: 10,
  },

  modalButton: {
    marginTop: 20,
    backgroundColor: "#166534",
    paddingVertical: 12,
    width: "100%",
    borderRadius: 10,
  },

  modalButtonText: {
    color: "#fff",
    textAlign: "center",
    fontWeight: "600",
  },
});
