import React, {
  useEffect,
  useRef,
  useContext,
  useState,
  useCallback,
} from "react";
import {
  View,
  StyleSheet,
  Platform,
  TouchableOpacity,
  Text,
  Modal,
} from "react-native";

import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  Polygon,
} from "react-native-maps";

import { useRoute, useFocusEffect } from "@react-navigation/native";
import { MapContext } from "./contexts/MapContext";
import useRouting from "./hooks/useRouting";
import useHazardLayers from "./hooks/useHazardLayers";
import GlobalRoutePanel from "./routing/GlobalRoutePanel";
import { PillMarker } from "./MapIcon";
import jaenGeoJSON from "./data/jaen.json";

/* =========================
   CONSTANTS
========================= */
const EDGE_PADDING = {
  top: 120,
  bottom: 420,
  left: 60,
  right: 60,
};

const NAV_ZOOM = 18.5;
const NAV_PITCH = 55;
const STOP_ZOOM = 15;

/* ✅ INITIAL MAP REGION — JAEN, NUEVA ECIJA */
const JAEN_INITIAL_REGION = {
  latitude: 15.32,
  longitude: 120.92,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

/* =========================
   INCIDENT COLORS BY LEVEL
========================= */

const INCIDENT_LEVEL_COLOR = {
  critical: "red",
  high: "orange",
  medium: "yellow",
  low: "green",
};

/* =========================
   HELPERS
========================= */

function renderJaenBoundary() {
  if (!jaenGeoJSON?.features) return null;

  return jaenGeoJSON.features.map((feature, idx) => {
    const coords = feature.geometry.coordinates;

    const polygons =
      feature.geometry.type === "MultiPolygon"
        ? coords
        : [coords];

    return polygons.map((polygon, pIdx) => (
      <Polygon
        key={`jaen-${idx}-${pIdx}`}
        coordinates={polygon[0].map((c) => ({
          latitude: c[1],
          longitude: c[0],
        }))}
        strokeColor="#065F46"
        strokeWidth={2.5}
        fillColor="transparent"
      />
    ));
  });
}

function toRad(v) {
  return (v * Math.PI) / 180;
}

function getHeading(from, to) {
  const dLng = toRad(to.longitude - from.longitude);
  const lat1 = toRad(from.latitude);
  const lat2 = toRad(to.latitude);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function distance(a, b) {
  const dx = a.latitude - b.latitude;
  const dy = a.longitude - b.longitude;
  return dx * dx + dy * dy;
}

/* =========================
   PLACE NORMALIZER
========================= */

function normalizePlace(place) {
  if (!place || typeof place !== "object") return null;

  if (place._id && place.capacityStatus !== undefined) return place;

  if (place._id && place.barangayName) {
    return {
      ...place,
      name: place.name || place.barangayName,
      capacityStatus: "barangay",
      latitude: place.latitude,
      longitude: place.longitude,
    };
  }

  if (
    typeof place.latitude === "number" &&
    typeof place.longitude === "number"
  ) {
    return {
      _id: `search-${place.latitude}-${place.longitude}`,
      name: place.label || "Selected location",
      latitude: place.latitude,
      longitude: place.longitude,
      capacityStatus: "location",
    };
  }

  return null;
}

/* =========================
   COMPONENT
========================= */

export default function Map() {
  const mapRef = useRef(null);
  const navRoute = useRoute();
  const lastPlaceKeyRef = useRef(null);

  const hasInitialZoomRef = useRef(false);
  const hasFittedEvacsRef = useRef(false);

const {
  panelState,
  setPanelState,

  evac,
  setEvac,
  evacPlaces,

  routeRequested,
  setRouteRequested,

  routes,
  setRoutes,
  setActiveRoute,

  travelMode,
  incidents = [],

  // ✅ hazard state from MapContext
  showFloodMap,
  setShowFloodMap,
  showEarthquakeHazard,
  setShowEarthquakeHazard,
} = useContext(MapContext);

  const [showConfirm, setShowConfirm] = useState(false);

  /* =========================
     ✅ HAZARD LAYER STATES
     (default OFF — UI unchanged)
  ========================= */


const { floodLayers, earthquakeLayer, jaenBoundaryLayer } =
  useHazardLayers({
    showFloodMap,
    showEarthquakeHazard,
    showJaenBoundary: false,
  });

  const userPos = {
    latitude: 15.38,
    longitude: 120.91,
  };

  useFocusEffect(
    useCallback(() => {
      return () => {
        setPanelState("PLACE_INFO");
        setRouteRequested(false);
        setRoutes([]);
      };
    }, [setPanelState, setRouteRequested, setRoutes])
  );

  /* =========================
     INITIAL CAMERA FOLLOW-UP
  ========================= */

  useEffect(() => {
    if (
      hasInitialZoomRef.current ||
      !mapRef.current ||
      evacPlaces.length === 0
    )
      return;

    hasInitialZoomRef.current = true;

    mapRef.current.animateToRegion(JAEN_INITIAL_REGION, 700);
  }, [evacPlaces]);

  /* =========================
     FIT EVAC PLACES ON LOAD
  ========================= */

  useEffect(() => {
    if (
      !mapRef.current ||
      evacPlaces.length === 0 ||
      hasFittedEvacsRef.current
    )
      return;

    hasFittedEvacsRef.current = true;

    mapRef.current.fitToCoordinates(
      evacPlaces.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
      })),
      { edgePadding: EDGE_PADDING, animated: true }
    );
  }, [evacPlaces]);

  /* =========================
     INCIDENT NORMALIZATION
  ========================= */

  const normalizedIncidents = incidents
    .map((i) => {
      const lat = i.latitude ?? i.lat ?? i.location?.lat;
      const lng = i.longitude ?? i.lng ?? i.location?.lng;
      return {
        ...i,
        latitude: typeof lat === "string" ? parseFloat(lat) : lat,
        longitude: typeof lng === "string" ? parseFloat(lng) : lng,
      };
    })
    .filter(
      (i) =>
        typeof i.latitude === "number" &&
        typeof i.longitude === "number"
    );

  /* =========================
     PLACE SELECTION
  ========================= */

  useEffect(() => {
    const rawPlace =
      navRoute.params?.evacPlace ??
      navRoute.params?.barangay ??
      navRoute.params?.place;

    const selectedPlace = rawPlace?.raw
      ? rawPlace.raw
      : normalizePlace(rawPlace);

    if (!selectedPlace) return;

    const key = `${selectedPlace._id}-${selectedPlace.latitude}-${selectedPlace.longitude}`;
    if (lastPlaceKeyRef.current === key) return;

    lastPlaceKeyRef.current = key;

    setEvac(selectedPlace);
    setPanelState("PLACE_INFO");

    mapRef.current?.fitToCoordinates(
      [userPos, selectedPlace],
      { edgePadding: EDGE_PADDING, animated: true }
    );

    setRouteRequested(false);
    setRoutes([]);
    setActiveRoute(null);
  }, [navRoute.params]);

  /* =========================
     ROUTING
  ========================= */

  const routing = useRouting({
    enabled: routeRequested && !!evac,
    from: [userPos.latitude, userPos.longitude],
    to: evac ? { lat: evac.latitude, lng: evac.longitude } : null,
    mode: travelMode,
    incidents: normalizedIncidents,
  });

  useEffect(() => {
    if (!routeRequested || !routing.routes?.length) return;

    setRoutes(routing.routes);
    setActiveRoute(routing.routes[0]);

    if (panelState !== "NAVIGATION") {
      mapRef.current?.fitToCoordinates(
        routing.routes[0].coords,
        { edgePadding: EDGE_PADDING, animated: true }
      );
    }
  }, [routing.routes, routeRequested, panelState]);

  /* =========================
     NAV CAMERA
  ========================= */

  useEffect(() => {
    if (panelState !== "NAVIGATION" || !routes.length) return;

    const coords = routes[0].coords;
    if (coords.length < 2) return;

    let nearestIdx = 0;
    let minDist = Infinity;

    for (let i = 0; i < coords.length - 1; i++) {
      const d = distance(userPos, coords[i]);
      if (d < minDist) {
        minDist = d;
        nearestIdx = i;
      }
    }

    const heading = getHeading(
      coords[nearestIdx],
      coords[nearestIdx + 1]
    );

    mapRef.current?.animateCamera(
      {
        center: userPos,
        heading,
        zoom: NAV_ZOOM,
        pitch: NAV_PITCH,
      },
      { duration: 700 }
    );
  }, [panelState, routes]);

  const recenter = () => {
    if (!routes.length) return;
    setPanelState("NAVIGATION");
  };

  /* =========================
     STOP CONFIRM
  ========================= */

  const handleStopConfirmed = () => {
    setShowConfirm(false);

    mapRef.current?.animateCamera(
      {
        center: userPos,
        zoom: STOP_ZOOM,
        pitch: 0,
        heading: 0,
      },
      { duration: 500 }
    );

    setRouteRequested(false);
    setRoutes([]);
    setActiveRoute(null);
    setPanelState("PLACE_INFO");
  };

  /* =========================
     RENDER
  ========================= */

  return (
    <View style={styles.container}>
<MapView
  ref={mapRef}
  provider={
    Platform.OS === "android" ? PROVIDER_GOOGLE : undefined
  }
  style={{ flex: 1 }}
  initialRegion={JAEN_INITIAL_REGION}
  showsUserLocation
  rotateEnabled={panelState === "NAVIGATION"}
  pitchEnabled={panelState === "NAVIGATION"}
>
  {/* ✅ JAEN MUNICIPAL BOUNDARY */}
  {renderJaenBoundary()}
  {/* ✅ HAZARD LAYERS */}
  {jaenBoundaryLayer}
  {floodLayers}
  {earthquakeLayer}

  <Marker coordinate={userPos} pinColor="#2563eb" />

  {normalizedIncidents.map((incident) => (
    <Marker
      key={incident._id}
      coordinate={{
        latitude: incident.latitude,
        longitude: incident.longitude,
      }}
      pinColor={
        INCIDENT_LEVEL_COLOR[
          String(incident.level || "critical").toLowerCase()
        ]
      }
    />
  ))}

        {evac && (
          <Marker coordinate={evac}>
            <PillMarker
              color="#16a34a"
              label={evac.name}
              compact
            />
          </Marker>
        )}

        {evacPlaces.map((place) => (
          <Marker
            key={place._id}
            coordinate={place}
            onPress={() => {
              setEvac(place);
              setPanelState("PLACE_INFO");
              setRouteRequested(false);
            }}
          >
            <PillMarker
              color="#16a34a"
              label={place.name}
              compact
            />
          </Marker>
        ))}

        {routes.map((r, i) =>
          panelState === "NAVIGATION" && !r.isRecommended ? null : (
            <Polyline
              key={i}
              coordinates={r.coords}
              strokeColor={
                r.isRecommended ? "#22c55e" : "#ef4444"
              }
              strokeWidth={6}
            />
          )
        )}
      </MapView>


{/* MAP HAZARD BUTTONS */}
<View style={styles.mapControls}>
  <TouchableOpacity
    onPress={() => setShowFloodMap(v => !v)}
    style={[
      styles.mapButton,
      showFloodMap && styles.mapButtonActiveBlue,
    ]}
    activeOpacity={0.8}
  >
    <Text
      style={[
        styles.mapButtonText,
        showFloodMap && styles.mapButtonTextActive,
      ]}
    >
      Flood
    </Text>
  </TouchableOpacity>

  <TouchableOpacity
    onPress={() => setShowEarthquakeHazard(v => !v)}
    style={[
      styles.mapButton,
      showEarthquakeHazard && styles.mapButtonActiveRed,
    ]}
    activeOpacity={0.8}
  >
    <Text
      style={[
        styles.mapButtonText,
        showEarthquakeHazard && styles.mapButtonTextActive,
      ]}
    >
      Quake
    </Text>
  </TouchableOpacity>
</View>


     
      {panelState === "NAVIGATION" && (
        <TouchableOpacity
          style={styles.recenterBtn}
          onPress={recenter}
        >
          <Text style={styles.recenterIcon}>◎</Text>
        </TouchableOpacity>
      )}

      {(panelState === "PLACE_INFO" ||
        panelState === "ROUTE_SELECTION" ||
        panelState === "NAVIGATION") && (
        <View style={styles.fabContainer}>
          {panelState === "PLACE_INFO" && evac && (
            <TouchableOpacity
              style={styles.primaryBtn}
              onPress={() => {
                setPanelState("ROUTE_SELECTION");
                setRouteRequested(true);
              }}
            >
              <Text style={styles.primaryText}>
                View routes
              </Text>
            </TouchableOpacity>
          )}

          {panelState === "ROUTE_SELECTION" && (
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => setPanelState("PLACE_INFO")}
              >
                <Text style={styles.secondaryText}>
                  Leave later
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => setPanelState("NAVIGATION")}
              >
                <Text style={styles.primaryText}>
                  Go now
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {panelState === "NAVIGATION" && (
            <TouchableOpacity
              style={styles.dangerBtn}
              onPress={() => setShowConfirm(true)}
            >
              <Text style={styles.dangerText}>Stop</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <GlobalRoutePanel visible />

      <Modal transparent visible={showConfirm} animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <Text style={styles.modalText}>
              Do you want to stop navigation?
            </Text>
            <View style={styles.modalActions}>
              <TouchableOpacity
                onPress={() => setShowConfirm(false)}
              >
                <Text>No</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleStopConfirmed}>
                <Text style={{ color: "red" }}>Yes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* =========================
   STYLES
========================= */
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  /* =========================
     MAP HAZARD BUTTONS ✅
     (Flood / Quake)
  ========================= */

  mapControls: {
    position: "absolute",
    right: 16,
    bottom: 400, // safely above GlobalRoutePanel
    gap: 10,
    zIndex: 2000,
    elevation: 2000,
  },

  mapButton: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },

  mapButtonActiveBlue: {
    backgroundColor: "#2563eb",
    borderColor: "#2563eb",
  },

  mapButtonActiveRed: {
    backgroundColor: "#dc2626",
    borderColor: "#dc2626",
  },

  mapButtonText: {
    fontSize: 12,
    fontWeight: "600",
    color: "#111827",
  },

  mapButtonTextActive: {
    color: "#ffffff",
  },

  /* =========================
     RECENTER BUTTON
  ========================= */

  recenterBtn: {
    position: "absolute",
    top: 140,
    right: 16,
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 22,
    elevation: 6,
  },

  recenterIcon: {
    fontSize: 18,
    fontWeight: "700",
  },

  /* =========================
     BOTTOM ACTION PANEL (FAB)
  ========================= */

  fabContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 115,
    backgroundColor: "#ffffff",
    padding: 14,
    zIndex: 3000,
    elevation: 3000,
  },

  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },

  primaryBtn: {
    flex: 1,
    backgroundColor: "#14532d",
    padding: 16,
    borderRadius: 24,
    alignItems: "center",
  },

  primaryText: {
    color: "#ffffff",
    fontWeight: "700",
  },

  secondaryBtn: {
    flex: 1,
    backgroundColor: "#e5e7eb",
    padding: 16,
    borderRadius: 24,
    alignItems: "center",
  },

  secondaryText: {
    color: "#111827",
    fontWeight: "600",
  },

  dangerBtn: {
    backgroundColor: "#fee2e2",
    padding: 16,
    borderRadius: 24,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#ef4444",
  },

  dangerText: {
    color: "#b91c1c",
    fontWeight: "700",
  },

  /* =========================
     MODAL
  ========================= */

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },

  modalBox: {
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
    width: "80%",
  },

  modalText: {
    marginBottom: 16,
  },

  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
});