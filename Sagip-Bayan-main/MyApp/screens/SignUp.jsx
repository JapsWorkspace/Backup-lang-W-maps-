// screens/SignUp.jsx

import { useState, useEffect } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import api from "../lib/api";

import StepPersonal from "./signup/StepPersonal";
import StepSecurity from "./signup/StepSecurity";
import StepMobile from "./signup/StepMobile";
import SignUpHeader from "./signup/SignUpHeader";

/* ================= CONSTANTS ================= */

const JAEN_CENTER = { lat: 15.3383, lng: 120.9141 };
const MAX_DISTANCE_KM = 5;

/* ================= COMPONENT ================= */

export default function SignUp({ navigation }) {
  const [step, setStep] = useState(0);

  /* ===== FORM DATA ===== */
  const [fName, setFName] = useState("");
  const [lName, setLName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [birthdate, setBirthdate] = useState("");

  /* ===== GEO DEBUG (✅ PERSISTS ACROSS STEPS) ===== */
  const [geoDebug, setGeoDebug] = useState(false);

  /* ===== LOCATION ===== */
  const [location, setLocation] = useState(null);
  const [permission, setPermission] = useState(null);

  /* ================= HELPERS ================= */

  const toRad = (v) => (v * Math.PI) / 180;
  const getDistanceKm = (a, b) => {
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const x =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) *
        Math.cos(toRad(b.lat)) *
        Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  };

  /* ================= LOCATION ================= */

  useEffect(() => {
    (async () => {
      const { status } =
        await Location.requestForegroundPermissionsAsync();
      setPermission(status);

      if (status === "granted") {
        const pos = await Location.getCurrentPositionAsync({});
        setLocation({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      }
    })();
  }, []);

  /* ================= NAV ================= */

  const next = () => setStep((s) => s + 1);
  const back = () =>
    step === 0 ? navigation.goBack() : setStep((s) => s - 1);

  /* ================= FINAL SUBMIT ================= */

  const submit = async () => {
    // ✅ Location check ONLY if debug OFF
    if (!geoDebug) {
      if (permission !== "granted" || !location) {
        Alert.alert("Location Required");
        return;
      }

      const dist = getDistanceKm(location, JAEN_CENTER);
      if (dist > MAX_DISTANCE_KM) {
        Alert.alert(
          "Outside Service Area",
          "Registration is only allowed in Jaen."
        );
        return;
      }
    }

    try {
      await api.post("/user/register", {
        fname: fName,
        lname: lName,
        username,
        password,
        birthdate,
        phone,
        email,
        address,
        location,
      });

      Alert.alert("Success", "Check your email to verify.");
      navigation.replace("LogIn");
    } catch {
      Alert.alert("Signup failed");
    }
  };

  /* ================= STEPS ================= */

  const pages = [
    <StepPersonal
      key="personal"
      fName={fName}
      lName={lName}
      username={username}
      onFNameChange={setFName}
      onLNameChange={setLName}
      onUsernameChange={setUsername}
      geoDebug={geoDebug}
      onToggleGeoDebug={() => setGeoDebug((v) => !v)}
      onNext={next}
    />,

    <StepSecurity
      key="security"
      password={password}
      confirmPassword={confirmPassword}
      onPasswordChange={setPassword}
      onConfirmChange={setConfirmPassword}
      onNext={next}
      onBack={back}
    />,

    <StepMobile
      key="mobile"
      phone={phone}
      email={email}
      address={address}
      birthdate={birthdate}
      onPhoneChange={setPhone}
      onEmailChange={setEmail}
      onAddressChange={setAddress}
      onBirthdateChange={setBirthdate}
      onSubmit={submit}
      onBack={back}
    />,
  ];

  /* ================= RENDER ================= */

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <SignUpHeader step={step} onBack={back} />
        {pages[step]}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}