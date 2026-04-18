// screens/IncidentReportingScreen.jsx
import React, { useState, useRef, useEffect, useContext } from "react";
import * as Location from "expo-location";
import { Alert } from "react-native";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
  Animated,
  PanResponder,
  Image,
  KeyboardAvoidingView,
  Dimensions,
  StatusBar,
  ScrollView,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import api from "../lib/api";
import { UserContext } from "./UserContext";
import AppLayout from "./AppLayout";
import useJaenPlaceSearch from "./hooks/useJaenPlaceSearch";
import styles, { METRICS } from "../Designs/IncidentReporting";
import WebMap from "./WebMap";
import { socket } from "../lib/socket";
import AppShell from "./AppShell";

export default function IncidentReportScreen({ navigation }) {
  const { user } = useContext(UserContext);

  /* =========================
     FORM STATE
  ========================= */
  const [incidentReports, setIncidentReports] = useState({
    type: "",
    level: "",
    location: "",
    latitude: null,
    longitude: null,
    description: "",
    usernames: user.username || "",
    phone: user.phone || "",
  });

  const { query, suggestions, search, clear } = useJaenPlaceSearch();

  const handleSelectSuggestion = (place) => {
    setIncidentReports((prev) => ({
      ...prev,
      location: place.label,
      latitude: place.latitude,
      longitude: place.longitude,
    }));
    clear();
  };

  const [image, setImage] = useState(null);
  const [debuger, setDebuger] = useState(false);
  const [userLocation, setUserLocation] = useState(null);

  /* Sync image refresh */
  useEffect(() => {
    if (!image?.uri) return;
    setImage((prev) => (prev ? { ...prev } : prev));
  }, [image?.uri]);

  /* Auto‑select single suggestion */
  useEffect(() => {
    if (suggestions.length === 1) {
      const place = suggestions[0];
      setIncidentReports((prev) => ({
        ...prev,
        location: place.display_name,
        latitude: parseFloat(place.lat),
        longitude: parseFloat(place.lon),
      }));
      clear();
    }
  }, [suggestions]);

  /* Default Jaen */
  useEffect(() => {
    if (incidentReports.latitude == null || incidentReports.longitude == null) {
      setIncidentReports((prev) => ({
        ...prev,
        location: prev.location || "Jaen, Nueva Ecija",
        latitude: 15.3383,
        longitude: 120.9141,
      }));
    }
  }, []);

  /* =========================
     GEO FENCING
  ========================= */
  const JAEN_CENTER = { lat: 15.3383, lng: 120.9141 };
  const MAX_DISTANCE_KM = 5;

  const getDistanceKm = (lat1, lon1, lat2, lon2) => {
    const toRad = (v) => (v * Math.PI) / 180;
    const R = 6371;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    return R * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  /* =========================
     REALTIME GPS
  ========================= */
  useEffect(() => {
    socket.connect();
    let subscription;

    const startTracking = async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== "granted") {
        Alert.alert("Location Required", "Enable location to proceed.");
        return;
      }

      subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        (loc) => {
          const coords = {
            lat: loc.coords.latitude,
            lng: loc.coords.longitude,
          };
          setUserLocation(coords);
          socket.emit("send-location", coords);
        }
      );
    };

    startTracking();

    return () => {
      if (subscription) subscription.remove();
      socket.disconnect();
    };
  }, []);

  /* =========================
     IMAGE PICKER
  ========================= */
  const pickImage = async (event) => {
    if (Platform.OS === "web") {
      const files = event.target.files;
      if (files.length) {
        const file = files[0];
        setImage({
          uri: URL.createObjectURL(file),
          name: file.name,
          type: file.type,
        });
      }
    } else {
      const ImagePicker = await import("expo-image-picker");
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: false,
        quality: 1,
      });
      if (!result.canceled) {
        const asset = result.assets[0];
        setImage({
          uri: asset.uri,
          name: asset.fileName || asset.uri.split("/").pop(),
          type: "image/jpeg",
        });
      }
    }
  };

  /* =========================
     SUBMIT REPORT
  ========================= */
  const submitReport = async () => {
    const { latitude, longitude } = incidentReports;

    if (!latitude || !longitude) {
      alert("Please select a location on the map!");
      return;
    }

    // ✅ IMAGE REQUIRED
    if (!image || !image.uri) {
      Alert.alert(
        "Image Required",
        "You must upload an image before submitting the report."
      );
      return;
    }

    const userLat = userLocation?.lat;
    const userLng = userLocation?.lng;

    if (!userLat || !userLng) {
      Alert.alert("Location Error", "Unable to get current location.");
      return;
    }

    if (!debuger) {
      const distance = getDistanceKm(
        userLat,
        userLng,
        JAEN_CENTER.lat,
        JAEN_CENTER.lng
      );
      if (distance > MAX_DISTANCE_KM) {
        Alert.alert(
          "Outside Service Area",
          "You must be within Jaen, Nueva Ecija to report an incident."
        );
        return;
      }
    }

    try {
      const formData = new FormData();
      Object.entries(incidentReports).forEach(([k, v]) =>
        formData.append(k, v ?? "")
      );

      formData.append("image", {
        uri: image.uri,
        name: image.name,
        type: image.type,
      });

      await api.post("/incident/register", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      alert("Incident submitted successfully!");
      setIncidentReports({
        type: "",
        level: "",
        location: "",
        latitude: null,
        longitude: null,
        description: "",
        usernames: "",
        phone: "",
      });
      setImage(null);
    } catch (err) {
      alert("Error submitting incident");
    }
  };

  /* =========================
     DRAGGABLE PANEL (SMOOTH + NO SNAP)
  ========================= */
  const panelTop = styles.centerWrapper.top || METRICS.panelTop;
  const { height: WIN_H } = Dimensions.get("window");
  const ANDROID_SB = StatusBar?.currentHeight || 0;
  const TOP_MARGIN = Platform.OS === "ios" ? 12 : 8;

  const MAX_UP = -Math.max(0, panelTop - ANDROID_SB - TOP_MARGIN);
  const MAX_DOWN = 0;

  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const startY = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,

      // ⭐ THESE TWO LINES FIX THE “HARD TO DRAG” PROBLEM
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,

      onPanResponderGrant: () => {
        startY.current = pan.y._value;
      },
      onPanResponderMove: (_, g) => {
        let newY = startY.current + g.dy;
        if (newY < MAX_UP) newY = MAX_UP;
        if (newY > MAX_DOWN) newY = MAX_DOWN;
        pan.setValue({ x: 0, y: newY });
      },
      onPanResponderRelease: () => {
        // ✅ Stay where released
        startY.current = pan.y._value;
      },
    })
  ).current;

  /* =========================
     RENDER (UNCHANGED)
  ========================= */
  return (
    <AppLayout
      onSearch={search}
      suggestions={suggestions}
      onSelectSuggestion={handleSelectSuggestion}
    >
      <View style={styles.webFrame}>
        <View style={styles.phone}>
          <View style={[styles.mapContainer, { flex: 1 }]}>
            <WebMap
              selected={{
                lat: incidentReports.latitude,
                lng: incidentReports.longitude,
                label: incidentReports.location,
              }}
              userLocation={userLocation}
              onSelect={(obj) => {
                setIncidentReports((prev) => ({
                  ...prev,
                  location: obj.text,
                  latitude: obj.lat,
                  longitude: obj.lng,
                }));
              }}
              onIncidentPress={(incident) => {
                setIncidentReports((prev) => ({
                  ...prev,
                  type: incident.type || "",
                  level: incident.level || "",
                  location: incident.location || "",
                  latitude: Number(incident.latitude),
                  longitude: Number(incident.longitude),
                  description: incident.description || "",
                  usernames: incident.usernames || "",
                  phone: incident.phone || "",
                }));

                if (incident?.image?.fileUrl) {
                  const cleanUrl = String(incident.image.fileUrl);
                  setImage({
                    uri: cleanUrl.includes("?")
                      ? cleanUrl + "&t=" + Date.now()
                      : cleanUrl + "?t=" + Date.now(),
                  });
                } else {
                  setImage(null);
                }
              }}
            />
          </View>

          <Animated.View
            style={[
              styles.centerWrapper,
              { transform: pan.getTranslateTransform() },
            ]}
          >
            <KeyboardAvoidingView
              behavior={Platform.OS === "ios" ? "padding" : undefined}
              keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
            >
              <View
                style={[
                  styles.card,
                  { minHeight: WIN_H - (panelTop + MAX_UP) },
                ]}
              >
                <View {...panResponder.panHandlers} style={styles.dragHandle} />

                <ScrollView
                  contentContainerStyle={{ paddingBottom: 8 }}
                  keyboardShouldPersistTaps="handled"
                >
                  <Text style={styles.title}>Incident Tagging</Text>

                  {/* Incident Type */}
                  <Picker
                    selectedValue={incidentReports.type}
                    onValueChange={(val) =>
                      setIncidentReports((prev) => ({
                        ...prev,
                        type: val,
                      }))
                    }
                    style={styles.picker}
                  >
                    <Picker.Item label="Select Incident" value="" />
                    <Picker.Item label="Flood" value="flood" />
                    <Picker.Item label="Typhoon" value="typhoon" />
                    <Picker.Item label="Fire" value="fire" />
                    <Picker.Item label="Earthquake" value="earthquake" />
                  </Picker>

                  {/* Severity */}
                  <Picker
                    selectedValue={incidentReports.level}
                    onValueChange={(val) =>
                      setIncidentReports((prev) => ({
                        ...prev,
                        level: val,
                      }))
                    }
                    style={styles.picker}
                  >
                    <Picker.Item label="Select Severity" value="" />
                    <Picker.Item label="Low" value="low" />
                    <Picker.Item label="Medium" value="medium" />
                    <Picker.Item label="High" value="high" />
                    <Picker.Item label="Critical" value="critical" />
                  </Picker>

                  <TextInput
                    style={styles.input}
                    placeholder="Where it takes place"
                    value={incidentReports.location}
                    onChangeText={(val) =>
                      setIncidentReports((prev) => ({
                        ...prev,
                        location: val,
                      }))
                    }
                  />

                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Extra notes"
                    multiline
                    value={incidentReports.description}
                    onChangeText={(val) =>
                      setIncidentReports((prev) => ({
                        ...prev,
                        description: val,
                      }))
                    }
                  />

                  {/* Add Image */}
                  {Platform.OS === "web" ? (
                    <label style={styles.webUploadButton}>
                      Add Image
                      <input
                        type="file"
                        accept="image/*"
                        onChange={pickImage}
                        style={{ display: "none" }}
                      />
                    </label>
                  ) : (
                    <TouchableOpacity
                      style={styles.button}
                      onPress={pickImage}
                    >
                      <Text style={styles.buttonText}>Add Image</Text>
                    </TouchableOpacity>
                  )}

                  {image?.uri && (
                    <Image
                      source={{ uri: image.uri }}
                      style={{
                        width: 60,
                        height: 60,
                        marginTop: 6,
                        borderRadius: 6,
                      }}
                    />
                  )}

                  <TouchableOpacity
                    style={styles.button}
                    onPress={submitReport}
                  >
                    <Text style={styles.buttonText}>SUBMIT</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => setDebuger((prev) => !prev)}
                    style={{ marginBottom: 8 }}
                  >
                    <Text
                      style={{
                        color: debuger ? "green" : "red",
                        fontSize: 12,
                      }}
                    >
                      {debuger
                        ? "Geo Check: OFF (Debug)"
                        : "Geo Check: ON"}
                    </Text>
                  </TouchableOpacity>
                </ScrollView>
              </View>
            </KeyboardAvoidingView>
          </Animated.View>
        </View>
      </View>
    </AppLayout>
  );
}