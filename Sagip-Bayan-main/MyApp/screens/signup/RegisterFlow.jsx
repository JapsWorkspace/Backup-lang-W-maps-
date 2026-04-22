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

import StepPersonal from "./StepPersonal";
import StepSecurity from "./StepSecurity";
import StepMobile from "./StepMobile";
import SignUpHeader from "./SignUpHeader";

const { width } = Dimensions.get("window");

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
    address: "",
  });

  const [showModal, setShowModal] = useState(false);
  const [modalMessage, setModalMessage] = useState("");

  // 🔥 structured backend errors
  const [serverError, setServerError] = useState({
    email: "",
    phone: "",
    username: "",
  });

  const steps = ["personal", "security", "mobile"];

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

  /* ================= REGISTER ================= */
  const handleSubmit = async (mobileData) => {
    try {
      const payload = {
        fname: form.fname,
        lname: form.lname,
        username: form.username,
        password: form.password,
        email: form.email,
        phone: mobileData.phone,
        address: form.address,
      };

      console.log("📦 FINAL CLEAN PAYLOAD:", payload);

      const res = await fetch("http://192.168.1.8:8000/user/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const result = await res.json();

      console.log("📨 SERVER RESPONSE:", result);

      /* ================= ERROR HANDLING ================= */
      if (!res.ok) {
        const message =
          result?.message ||
          result?.error ||
          (typeof result === "string" ? result : "Registration failed");

        console.log("❌ REGISTER ERROR:", message);

        const lower = message.toLowerCase();

        const errors = {
          email: lower.includes("email") ? "Email already exists" : "",
          phone: lower.includes("phone") ? "Phone number already exists" : "",
          username: lower.includes("username")
            ? "Username already exists"
            : "",
        };

        setServerError(errors);

        // prioritize message shown to user
        const modalMsg =
          errors.email ||
          errors.phone ||
          errors.username ||
          message;

        setModalMessage(modalMsg);
        setShowModal(true);
        return;
      }

      /* ================= SUCCESS ================= */
      console.log("✅ REGISTER SUCCESS:", result);

      setServerError({ email: "", phone: "", username: "" });

      setModalMessage("Registration successful! Please verify your email.");
      setShowModal(true);

      setTimeout(() => {
        setShowModal(false);
        navigation.navigate("LogIn");
      }, 1500);
    } catch (err) {
      console.log("❌ REGISTER ERROR:", err.message);

      setModalMessage("Network error. Please try again.");
      setShowModal(true);
    }
  };

  return (
    <View style={styles.container}>
      <SignUpHeader step={step} onBack={goBack} />

      {/* MODAL */}
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
                onNext={(data) => {
                  updateForm({
                    fname: data.fName,
                    lname: data.lName,
                    username: data.username,
                    address: data.address,
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

                // 🔥 backend field errors
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

/* ================= STYLES ================= */
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