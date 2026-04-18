import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Dimensions,
  Animated,
  Image,
} from "react-native";
import MapView, { Marker, Callout, PROVIDER_GOOGLE } from "react-native-maps";
import api from "../lib/api";
import axios from "axios";
import { MarkerImages, getMarkerImageBySeverity } from "./MapIcon";

/* ---------------- JAEN BOUNDS ---------------- */
const JAEN_CENTER = { latitude: 15.3274, longitude: 120.9190 };
const PAD = 0.05;
const TOLERANCE = 0.0005;

const BOUNDS = {
  north: JAEN_CENTER.latitude + PAD,
  south: JAEN_CENTER.latitude - PAD,
  east: JAEN_CENTER.longitude + PAD,
  west: JAEN_CENTER.longitude - PAD,
};

const isInside = (lat, lng) =>
  lat <= BOUNDS.north + TOLERANCE &&
  lat >= BOUNDS.south - TOLERANCE &&
  lng <= BOUNDS.east + TOLERANCE &&
  lng >= BOUNDS.west - TOLERANCE;

/* ---------------- ZOOM ---------------- */
const zoomToDelta = (z) => 0.02 * Math.pow(2, 15 - z);

/* ---------------- COMPONENT ---------------- */
export default function WebMap({
  onSelect,
  selected,
  userLocation,
  onIncidentPress, // ✅ required
}) {
  const mapRef = useRef(null);
  const [incidents, setIncidents] = useState([]);
  const { width, height } = Dimensions.get("window");
  const aspect = width / height;

  const [region] = useState(() => {
    const d = zoomToDelta(15);
    return {
      latitude: JAEN_CENTER.latitude,
      longitude: JAEN_CENTER.longitude,
      latitudeDelta: d,
      longitudeDelta: d * aspect,
    };
  });

  /* ---------------- FETCH INCIDENTS ---------------- */
  const fetchIncidents = useCallback(async () => {
    try {
      const res = await api.get("/incident/getIncidents");

      const data = Array.isArray(res.data)
        ? res.data
        : res.data?.incidents || [];

      setIncidents(data);
    } catch (err) {
      console.error("Fetch error:", err?.message);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
    const interval = setInterval(fetchIncidents, 8000);
    return () => clearInterval(interval);
  }, [fetchIncidents]);

  /* ---------------- HELPERS ---------------- */
  const focusTo = (lat, lng, zoom = 17) => {
    if (!mapRef.current) return;

    const d = zoomToDelta(zoom);

    mapRef.current.animateToRegion({
      latitude: lat,
      longitude: lng,
      latitudeDelta: d,
      longitudeDelta: d * aspect,
    });
  };

  const reverseGeocode = async (lat, lng) => {
    try {
      const res = await axios.get(
        "https://nominatim.openstreetmap.org/reverse",
        {
          params: { lat, lon: lng, format: "json" },
        }
      );

      return (
        res?.data?.display_name ||
        `Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`
      );
    } catch {
      return `Lat ${lat.toFixed(5)}, Lng ${lng.toFixed(5)}`;
    }
  };

  /* ---------------- MAP CLICK ---------------- */
  const handlePress = async (e) => {
    const { latitude, longitude } = e.nativeEvent.coordinate;

    const label = await reverseGeocode(latitude, longitude);

    onSelect?.({
      text: label,
      lat: latitude,
      lng: longitude,
    });

    focusTo(latitude, longitude);
  };

  /* ---------------- ANIMATION ---------------- */
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (selected?.lat) {
      scale.setValue(0.3);
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
      }).start();
    }
  }, [selected?.lat]);

  /* ---------------- RENDER ---------------- */
  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={{ flex: 1 }}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={region}
        onPress={handlePress}
      >
        {/* INCIDENT MARKERS */}
        {incidents.map((incident) => {
          const lat = Number(incident?.latitude);
          const lng = Number(incident?.longitude);

          if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
          if (!isInside(lat, lng)) return null;

          const source = getMarkerImageBySeverity(incident.level);

          return (
            <Marker
              key={incident._id}
              coordinate={{ latitude: lat, longitude: lng }}
              onPress={(e) => {
                e.stopPropagation(); // ✅ prevent map click
                console.log("MARKER CLICK:", incident);
                onIncidentPress?.(incident);
              }}
            >
              <Image source={source} style={styles.marker} />

              {/* ✅ Callout also triggers (backup + UX) */}
              <Callout
                onPress={() => {
                  console.log("CALLOUT CLICK:", incident);
                  onIncidentPress?.(incident);
                }}
              >
                <View style={styles.callout}>
                  <Text style={styles.title}>
                    {incident.type?.toUpperCase()}
                  </Text>
                  <Text>Status: {incident.status}</Text>
                  <Text>Severity: {incident.level}</Text>

                  {!!incident.location && <Text>{incident.location}</Text>}
                  {!!incident.description && (
                    <Text>{incident.description}</Text>
                  )}

                  {!!incident?.image?.fileUrl && (
                    <Image
                      source={{ uri: incident.image.fileUrl }}
                      style={styles.preview}
                    />
                  )}
                </View>
              </Callout>
            </Marker>
          );
        })}

        {/* SELECTED MARKER */}
        {!!selected?.lat && (
          <Marker
            coordinate={{
              latitude: selected.lat,
              longitude: selected.lng,
            }}
          >
            <Animated.Image
              source={MarkerImages.selected}
              style={[styles.selected, { transform: [{ scale }] }]}
            />
          </Marker>
        )}

        {/* USER LOCATION */}
        {!!userLocation?.lat && (
          <Marker
            coordinate={{
              latitude: userLocation.lat,
              longitude: userLocation.lng,
            }}
          >
            <Image source={MarkerImages.default} style={styles.user} />
          </Marker>
        )}
      </MapView>
    </View>
  );
}

/* ---------------- STYLES ---------------- */
const styles = StyleSheet.create({
  container: { flex: 1 },

  marker: {
    width: 26,
    height: 26,
    resizeMode: "contain",
  },

  selected: {
    width: 60,
    height: 60,
    resizeMode: "contain",
  },

  user: {
    width: 30,
    height: 30,
  },

  callout: {
    maxWidth: 260,
    padding: 6,
  },

  title: {
    fontWeight: "700",
    marginBottom: 4,
  },

  preview: {
    width: 140,
    height: 90,
    marginTop: 6,
    borderRadius: 8,
  },
});