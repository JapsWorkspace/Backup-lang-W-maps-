import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, {
  Marker,
  Polygon,
  Polyline,
  PROVIDER_GOOGLE,
} from "react-native-maps";
import { Picker } from "@react-native-picker/picker";
import { useFocusEffect, useRoute } from "@react-navigation/native";

import api from "../lib/api";
import { UserContext } from "./UserContext";
import { MapContext } from "./contexts/MapContext";
import useRouting from "./hooks/useRouting";
import useHazardLayers from "./hooks/useHazardLayers";
import { PillMarker } from "./MapIcon";
import jaenGeoJSON from "./data/jaen.json";
import areasData from "./data/area.json";

const EDGE_PADDING = {
  top: 120,
  bottom: 420,
  left: 60,
  right: 60,
};

const NAV_ZOOM = 18.5;
const NAV_PITCH = 55;

const JAEN_INITIAL_REGION = {
  latitude: 15.32,
  longitude: 120.92,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

const USER_POS = {
  latitude: 15.38,
  longitude: 120.91,
};

const MODULES = [
  { key: "incident", label: "Incident" },
  { key: "flood", label: "Flood" },
  { key: "earthquake", label: "Earthquake" },
  { key: "barangay", label: "Barangay" },
  { key: "evac", label: "Evac Place" },
];

const BARANGAY_COLORS = [
  "#60A5FA",
  "#34D399",
  "#FBBF24",
  "#F87171",
  "#A78BFA",
  "#FB7185",
  "#38BDF8",
  "#4ADE80",
  "#FACC15",
];

const INCIDENT_LEVEL_COLOR = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#ca8a04",
  low: "#16a34a",
};

const EMPTY_INCIDENT = {
  type: "",
  level: "",
  location: "",
  latitude: null,
  longitude: null,
  description: "",
  usernames: "",
  phone: "",
};

const safeArray = (arr) => (Array.isArray(arr) ? arr : []);
const safeFeatures = (data) => safeArray(data?.features);
const getBarangayColor = (index = 0) =>
  BARANGAY_COLORS[index % BARANGAY_COLORS.length];

const toCoords = (ring) =>
  safeArray(ring)
    .filter((c) => Array.isArray(c) && c.length >= 2)
    .map(([lng, lat]) => ({
      latitude: Number(lat),
      longitude: Number(lng),
    }))
    .filter((c) => !Number.isNaN(c.latitude) && !Number.isNaN(c.longitude));

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

function renderBoundary(data, stylePrefix, strokeColor, strokeWidth, fillColor) {
  return safeFeatures(data).flatMap((feature, idx) => {
    const geom = feature?.geometry;
    if (!geom?.coordinates) return [];

    const polygons =
      geom.type === "Polygon"
        ? [geom.coordinates]
        : geom.type === "MultiPolygon"
          ? geom.coordinates
          : [];

    return polygons.flatMap((poly, pIdx) =>
      safeArray(poly).map((ring, rIdx) => {
        const coords = toCoords(ring);
        if (!coords.length) return null;

        return (
          <Polygon
            key={`${stylePrefix}-${idx}-${pIdx}-${rIdx}`}
            coordinates={coords}
            strokeColor={strokeColor}
            strokeWidth={strokeWidth}
            fillColor={fillColor}
          />
        );
      })
    );
  });
}

export default function Map() {
  const mapRef = useRef(null);
  const navRoute = useRoute();
  const lastPlaceKeyRef = useRef(null);
  const { user } = useContext(UserContext) || {};

  const [mongoBarangays, setMongoBarangays] = useState(null);
  const [placeSelected, setPlaceSelected] = useState(false);
  const [incidentDraft, setIncidentDraft] = useState(EMPTY_INCIDENT);
  const [incidentImage, setIncidentImage] = useState(null);
  const [incidentBusy, setIncidentBusy] = useState(false);

  const {
    activeMapModule,
    setActiveMapModule,
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
    setTravelMode,
    incidents = [],
    setShowFloodMap,
    setShowEarthquakeHazard,
    isBottomNavInteracting,
  } = useContext(MapContext);

  const moduleFromParams = navRoute.params?.module;
  const activeModule = activeMapModule;

  useEffect(() => {
    if (!moduleFromParams) return;
    const exists = MODULES.some((item) => item.key === moduleFromParams);
    if (exists) setActiveMapModule(moduleFromParams);
  }, [moduleFromParams, setActiveMapModule]);

  const isEvac = activeModule === "evac";
  const isIncident = activeModule === "incident";
  const isFlood = activeModule === "flood";
  const isEarthquake = activeModule === "earthquake";
  const isBarangay = activeModule === "barangay";

  const visibleEvacs = isEvac;
  const visibleIncidents = isIncident;

  const { floodLayers, earthquakeLayer } = useHazardLayers({
    showFloodMap: isFlood,
    showEarthquakeHazard: isEarthquake,
    showJaenBoundary: false,
  });

  useEffect(() => {
    setShowFloodMap(isFlood);
    setShowEarthquakeHazard(isEarthquake);
  }, [isFlood, isEarthquake, setShowFloodMap, setShowEarthquakeHazard]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setPanelState("PLACE_INFO");
        setRouteRequested(false);
        setRoutes([]);
      };
    }, [setPanelState, setRouteRequested, setRoutes])
  );

  useEffect(() => {
    let mounted = true;

    api
      .get("/api/barangays/collection")
      .then((res) => {
        const merged = {
          type: "FeatureCollection",
          features: safeArray(res.data).flatMap((fc) =>
            safeArray(fc?.features)
          ),
        };
        if (mounted) setMongoBarangays(merged);
      })
      .catch((err) => {
        console.error("Barangay fetch failed:", err?.message);
      });

    return () => {
      mounted = false;
    };
  }, []);

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
    setActiveMapModule("evac");
    setEvac(selectedPlace);
    setPanelState("PLACE_INFO");
    setPlaceSelected(true);
    setRouteRequested(false);
    setRoutes([]);
    setActiveRoute(null);

    mapRef.current?.fitToCoordinates([USER_POS, selectedPlace], {
      edgePadding: EDGE_PADDING,
      animated: true,
    });
  }, [
    navRoute.params,
    setActiveRoute,
    setEvac,
    setActiveMapModule,
    setPanelState,
    setRouteRequested,
    setRoutes,
  ]);

  const normalizedIncidents = useMemo(
    () =>
      incidents
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
        ),
    [incidents]
  );

  const routing = useRouting({
    enabled: isEvac && routeRequested && !!evac,
    from: [USER_POS.latitude, USER_POS.longitude],
    to: evac ? { lat: evac.latitude, lng: evac.longitude } : null,
    mode: travelMode,
    incidents: normalizedIncidents,
  });

  useEffect(() => {
    if (!routeRequested || !routing.routes?.length) return;

    setRoutes(routing.routes);
    setActiveRoute(routing.routes[0]);

    if (panelState !== "NAVIGATION") {
      mapRef.current?.fitToCoordinates(routing.routes[0].coords, {
        edgePadding: EDGE_PADDING,
        animated: true,
      });
    }
  }, [panelState, routeRequested, routing.routes, setActiveRoute, setRoutes]);

  useEffect(() => {
    if (
      panelState !== "NAVIGATION" ||
      !routes.length ||
      !isEvac ||
      isBottomNavInteracting
    ) {
      return;
    }

    const coords = routes[0].coords;
    if (coords.length < 2) return;

    let nearestIdx = 0;
    let minDist = Infinity;

    for (let i = 0; i < coords.length - 1; i += 1) {
      const d = distance(USER_POS, coords[i]);
      if (d < minDist) {
        minDist = d;
        nearestIdx = i;
      }
    }

    const heading = getHeading(coords[nearestIdx], coords[nearestIdx + 1]);

    mapRef.current?.animateCamera(
      {
        center: USER_POS,
        heading,
        zoom: NAV_ZOOM,
        pitch: NAV_PITCH,
      },
      { duration: 700 }
    );
  }, [isEvac, panelState, routes, isBottomNavInteracting]);

  const jaenBoundary = useMemo(
    () => renderBoundary(jaenGeoJSON, "jaen", "#065F46", 2.5, "transparent"),
    []
  );

  const localBarangayBoundaries = useMemo(
    () =>
      renderBoundary(
        areasData,
        "brgy-local",
        "#1f2937",
        1,
        "rgba(6,95,70,0.12)"
      ),
    []
  );

  const mongoBarangayBoundaries = useMemo(() => {
    return safeFeatures(mongoBarangays).flatMap((feature, idx) => {
      const geom = feature?.geometry;
      if (!geom?.coordinates) return [];

      const rings =
        geom.type === "Polygon"
          ? [geom.coordinates[0]]
          : geom.type === "MultiPolygon"
            ? geom.coordinates.map((p) => p[0])
            : [];

      const color = getBarangayColor(idx);

      return rings.map((ring, i) => {
        const coords = toCoords(ring);
        if (!coords.length) return null;

        return (
          <Polygon
            key={`mongo-${idx}-${i}`}
            coordinates={coords}
            strokeColor="#111827"
            strokeWidth={1.25}
            fillColor={`${color}70`}
            zIndex={60}
          />
        );
      });
    });
  }, [mongoBarangays]);

  const handleBack = () => {
    setEvac(null);
    setRouteRequested(false);
    setRoutes([]);
    setActiveRoute(null);
    setPlaceSelected(false);
    setActiveMapModule(null);
    setPanelState("HIDDEN");
  };

  const handleMapPress = (event) => {
    if (!isIncident) return;
    const { latitude, longitude } = event.nativeEvent.coordinate;
    setIncidentDraft((prev) => ({
      ...prev,
      location: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      latitude,
      longitude,
    }));
  };

  const pickIncidentImage = async () => {
    if (Platform.OS === "web") return;
    const ImagePicker = await import("expo-image-picker");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 1,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setIncidentImage({
        uri: asset.uri,
        name: asset.fileName || asset.uri.split("/").pop(),
        type: "image/jpeg",
      });
    }
  };

  const submitIncident = async () => {
    if (!incidentDraft.latitude || !incidentDraft.longitude) {
      Alert.alert("Location Required", "Tap the map to set the incident point.");
      return;
    }

    if (!incidentImage?.uri) {
      Alert.alert("Image Required", "Attach an image before submitting.");
      return;
    }

    setIncidentBusy(true);
    try {
      const formData = new FormData();
      const payload = {
        ...incidentDraft,
        usernames: incidentDraft.usernames || user?.username || "",
        phone: incidentDraft.phone || user?.phone || "",
      };

      Object.entries(payload).forEach(([key, value]) => {
        formData.append(key, value ?? "");
      });

      formData.append("image", {
        uri: incidentImage.uri,
        name: incidentImage.name,
        type: incidentImage.type,
      });

      await api.post("/incident/register", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      Alert.alert("Incident Submitted", "The report has been recorded.");
      setIncidentDraft(EMPTY_INCIDENT);
      setIncidentImage(null);
    } catch (err) {
      Alert.alert(
        "Submit Failed",
        err?.response?.data?.message || "Error submitting incident."
      );
    } finally {
      setIncidentBusy(false);
    }
  };

  const selectedIncidentCoordinate =
    incidentDraft.latitude && incidentDraft.longitude
      ? {
          latitude: incidentDraft.latitude,
          longitude: incidentDraft.longitude,
        }
      : null;

  return (
    <View style={styles.container}>
 <MapView
  ref={mapRef}
  provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
  style={styles.map}
  initialRegion={JAEN_INITIAL_REGION}
  showsUserLocation
  scrollEnabled={!isBottomNavInteracting}
  zoomEnabled={!isBottomNavInteracting}
  rotateEnabled={panelState === "NAVIGATION" && !isBottomNavInteracting}
  pitchEnabled={panelState === "NAVIGATION" && !isBottomNavInteracting}
  onPress={handleMapPress}
>
        {jaenBoundary}
        {isFlood && floodLayers}
        {isEarthquake && earthquakeLayer}
        {isBarangay && mongoBarangayBoundaries}
        {isBarangay && localBarangayBoundaries}

        {isEvac && <Marker coordinate={USER_POS} pinColor="#2563eb" />}

        {visibleIncidents &&
          normalizedIncidents.map((incident) => (
            <Marker
              key={incident._id}
              coordinate={{
                latitude: incident.latitude,
                longitude: incident.longitude,
              }}
              pinColor={
                INCIDENT_LEVEL_COLOR[
                  String(incident.level || "critical").toLowerCase()
                ] || "#dc2626"
              }
            />
          ))}

        {selectedIncidentCoordinate && (
          <Marker coordinate={selectedIncidentCoordinate} pinColor="#111827" />
        )}

        {evac && isEvac && (
          <Marker coordinate={evac}>
            <PillMarker color="#16a34a" label={evac.name} compact />
          </Marker>
        )}

        {visibleEvacs &&
          evacPlaces.map((place) => (
            <Marker
              key={place._id}
              coordinate={place}
              onPress={() => {
                setEvac(place);
                setPanelState("PLACE_INFO");
                setPlaceSelected(true);
                setRouteRequested(false);
              }}
            >
              <PillMarker color="#16a34a" label={place.name} compact />
            </Marker>
          ))}

        {isEvac &&
          routes.map((r, i) =>
            panelState === "NAVIGATION" && !r.isRecommended ? null : (
              <Polyline
                key={i}
                coordinates={r.coords}
                strokeColor={r.isRecommended ? "#22c55e" : "#ef4444"}
                strokeWidth={6}
              />
            )
          )}
      </MapView>

      {isEvac && panelState === "NAVIGATION" && (
        <TouchableOpacity
          style={styles.recenterBtn}
          onPress={() => setPanelState("NAVIGATION")}
        >
          <Text style={styles.recenterIcon}>O</Text>
        </TouchableOpacity>
      )}

      {activeModule && (
        <ModulePanel
          activeModule={activeModule}
          onBack={handleBack}
          incidentDraft={incidentDraft}
          setIncidentDraft={setIncidentDraft}
          incidentImage={incidentImage}
          pickIncidentImage={pickIncidentImage}
          submitIncident={submitIncident}
          incidentBusy={incidentBusy}
          incidentCount={normalizedIncidents.length}
          barangayCount={safeFeatures(mongoBarangays).length}
          evac={evac}
          setEvac={setEvac}
          evacPlaces={evacPlaces}
          panelState={panelState}
          setPanelState={setPanelState}
          routeRequested={routeRequested}
          setRouteRequested={setRouteRequested}
          routes={routes}
          setRoutes={setRoutes}
          setActiveRoute={setActiveRoute}
          travelMode={travelMode}
          setTravelMode={setTravelMode}
        />
      )}
    </View>
  );
}

function ModulePanel({
  activeModule,
  onBack,
  incidentDraft,
  setIncidentDraft,
  incidentImage,
  pickIncidentImage,
  submitIncident,
  incidentBusy,
  incidentCount,
  barangayCount,
  evac,
  setEvac,
  evacPlaces,
  panelState,
  setPanelState,
  setRouteRequested,
  routes,
  setRoutes,
  setActiveRoute,
  travelMode,
  setTravelMode,
}) {
  const routeSummary = routes[0]?.summary;

  const selectEvac = (place) => {
    setEvac(place);
    setPanelState("PLACE_INFO");
    setRouteRequested(false);
    setRoutes([]);
    setActiveRoute(null);
  };

  const requestRoutes = () => {
    if (!evac) return;
    setPanelState("ROUTE_SELECTION");
    setRouteRequested(true);
  };

  const changeMode = (mode) => {
    setTravelMode(mode);
    if (!evac) return;
    setRouteRequested(false);
    setRoutes([]);
    setActiveRoute(null);
    setTimeout(() => setRouteRequested(true), 0);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.panelWrap}
    >
      <View style={styles.panel}>
        <View style={styles.handle} />

        {activeModule === "incident" && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <PanelHeader
              title="Incident Reporting"
              meta={`${incidentCount} active reports visible`}
              onBack={onBack}
            />

            <View style={styles.panelSection}>
              <Text style={styles.sectionLabel}>Report details</Text>
              <Picker
                selectedValue={incidentDraft.type}
                onValueChange={(value) =>
                  setIncidentDraft((prev) => ({ ...prev, type: value }))
                }
                style={styles.picker}
              >
                <Picker.Item label="Select incident type" value="" />
                <Picker.Item label="Flood" value="flood" />
                <Picker.Item label="Typhoon" value="typhoon" />
                <Picker.Item label="Fire" value="fire" />
                <Picker.Item label="Earthquake" value="earthquake" />
              </Picker>

              <Picker
                selectedValue={incidentDraft.level}
                onValueChange={(value) =>
                  setIncidentDraft((prev) => ({ ...prev, level: value }))
                }
                style={styles.picker}
              >
                <Picker.Item label="Select severity" value="" />
                <Picker.Item label="Low" value="low" />
                <Picker.Item label="Medium" value="medium" />
                <Picker.Item label="High" value="high" />
                <Picker.Item label="Critical" value="critical" />
              </Picker>

              <TextInput
                style={styles.input}
                placeholder="Tap map or enter location"
                value={incidentDraft.location}
                onChangeText={(value) =>
                  setIncidentDraft((prev) => ({ ...prev, location: value }))
                }
              />

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Notes"
                multiline
                value={incidentDraft.description}
                onChangeText={(value) =>
                  setIncidentDraft((prev) => ({
                    ...prev,
                    description: value,
                  }))
                }
              />

              <View style={styles.formRow}>
                <TouchableOpacity
                  style={styles.secondaryBtn}
                  onPress={pickIncidentImage}
                >
                  <Text style={styles.secondaryText}>
                    {incidentImage?.uri ? "Change image" : "Add image"}
                  </Text>
                </TouchableOpacity>

                {incidentImage?.uri && (
                  <Image source={{ uri: incidentImage.uri }} style={styles.thumb} />
                )}
              </View>
            </View>

            <TouchableOpacity
              style={[styles.primaryBtn, incidentBusy && styles.disabledBtn]}
              disabled={incidentBusy}
              onPress={submitIncident}
            >
              <Text style={styles.primaryText}>
                {incidentBusy ? "Submitting..." : "Submit incident"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}

        {activeModule === "flood" && (
          <>
            <PanelHeader
              title="Flood Map"
              meta="Flood hazard overlay active"
              onBack={onBack}
            />
            <View style={styles.panelSection}>
              <Text style={styles.sectionLabel}>Visible layers</Text>
              <LegendRow color="#2563eb" label="Mapped flood-prone zones" />
              <LegendRow color="#065F46" label="Municipal boundary" />
              <Text style={styles.panelNote}>
                Flood layers are isolated from incidents and routes to keep the
                hazard view readable.
              </Text>
            </View>
          </>
        )}

        {activeModule === "earthquake" && (
          <>
            <PanelHeader
              title="Earthquake Map"
              meta="Earthquake hazard overlay active"
              onBack={onBack}
            />
            <View style={styles.panelSection}>
              <Text style={styles.sectionLabel}>Risk overlay</Text>
              <LegendRow color="#dc2626" label="High-risk earthquake zone" />
              <LegendRow color="#065F46" label="Municipal boundary" />
              <Text style={styles.panelNote}>
                Use this view for risk review. Route, report, and barangay
                layers stay hidden unless their module is selected.
              </Text>
            </View>
          </>
        )}

        {activeModule === "barangay" && (
          <>
            <PanelHeader
              title="Barangay Map"
              meta={`${barangayCount} barangay boundary records loaded`}
              onBack={onBack}
            />
            <View style={styles.panelSection}>
              <Text style={styles.sectionLabel}>Administrative layers</Text>
              <LegendRow color="#34D399" label="Barangay coverage" />
              <LegendRow color="#111827" label="Boundary lines" />
              <Text style={styles.panelNote}>
                Barangay boundaries are shown without incident or hazard clutter
                for clearer local review.
              </Text>
            </View>
          </>
        )}

        {activeModule === "evac" && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <PanelHeader
              title="Evac Place"
              meta="Evacuation centers and dynamic pathfinding"
              onBack={onBack}
            />

            {!evac && (
              <>
                <Text style={styles.sectionLabel}>Nearby evacuation places</Text>
                <View style={styles.listSection}>
                  {evacPlaces.slice(0, 6).map((place) => (
                    <TouchableOpacity
                      key={place._id}
                      style={styles.evacCard}
                      onPress={() => selectEvac(place)}
                    >
                      <View style={styles.evacIconBadge}>
                        <Text style={styles.evacIconText}>E</Text>
                      </View>
                      <View style={styles.evacCardText}>
                        <Text style={styles.evacName} numberOfLines={1}>
                          {place.name}
                        </Text>
                        <Text style={styles.evacMeta} numberOfLines={1}>
                          {place.barangayName || place.location || "Evacuation center"}
                        </Text>
                      </View>
                      <View style={styles.statusChip}>
                        <Text style={styles.statusChipText}>
                          {String(place.capacityStatus || "open").toUpperCase()}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {evac && (
              <>
                <View style={styles.selectedPlace}>
                  <View style={styles.selectedHeader}>
                    <View style={styles.evacIconBadgeLarge}>
                      <Text style={styles.evacIconText}>E</Text>
                    </View>
                    <View style={styles.evacCardText}>
                      <Text style={styles.evacName}>{evac.name}</Text>
                      <Text style={styles.evacMeta}>
                        {evac.barangayName || evac.location || "Selected evacuation place"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.warningChip}>
                    <Text style={styles.warningChipText}>
                      Dynamic pathfinding uses the selected evac place
                    </Text>
                  </View>
                </View>

                {panelState === "PLACE_INFO" && (
                  <View style={styles.buttonRow}>
                    <TouchableOpacity
                      style={styles.secondaryBtn}
                      onPress={() => selectEvac(null)}
                    >
                      <Text style={styles.secondaryText}>Change</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.primaryBtn} onPress={requestRoutes}>
                      <Text style={styles.primaryText}>Find route</Text>
                    </TouchableOpacity>
                  </View>
                )}

                {panelState === "ROUTE_SELECTION" && (
                  <>
                    <Text style={styles.sectionLabel}>Travel mode</Text>
                    <View style={styles.modeRow}>
                      {["walking", "cycling", "driving"].map((mode) => {
                        const active = travelMode === mode;
                        return (
                          <TouchableOpacity
                            key={mode}
                            style={[styles.modeBtn, active && styles.modeBtnActive]}
                            onPress={() => changeMode(mode)}
                          >
                            <Text
                              style={[
                                styles.modeText,
                                active && styles.modeTextActive,
                              ]}
                            >
                              {mode}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>

                    {routes.length === 0 ? (
                      <View style={styles.loadingCard}>
                        <Text style={styles.panelNote}>Finding available routes...</Text>
                      </View>
                    ) : (
                      routes.map((route, index) => (
                        <TouchableOpacity
                          key={route.id ?? index}
                          style={[
                            styles.routeCard,
                            route.isRecommended && styles.routeRecommended,
                          ]}
                          onPress={() => setActiveRoute(route)}
                        >
                          <Text style={styles.routeMain}>
                            {route.summary.displayTime} - {route.summary.km} km
                          </Text>
                          <Text style={styles.evacMeta}>
                            {route.isRecommended
                              ? "Recommended route"
                              : "Alternate route"}
                          </Text>
                        </TouchableOpacity>
                      ))
                    )}

                    <View style={styles.buttonRow}>
                      <TouchableOpacity
                        style={styles.secondaryBtn}
                        onPress={() => setPanelState("PLACE_INFO")}
                      >
                        <Text style={styles.secondaryText}>Back</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.primaryBtn}
                        disabled={!routes.length}
                        onPress={() => setPanelState("NAVIGATION")}
                      >
                        <Text style={styles.primaryText}>Go now</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}

                {panelState === "NAVIGATION" && (
                  <>
                    <View style={styles.routeCard}>
                      <Text style={styles.routeMain}>
                        {routeSummary
                          ? `${routeSummary.displayTime} - ${routeSummary.km} km`
                          : "Navigation active"}
                      </Text>
                      <Text style={styles.evacMeta}>
                        Follow the active route to the selected evacuation place.
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.dangerBtn}
                      onPress={() => {
                        setRouteRequested(false);
                        setRoutes([]);
                        setActiveRoute(null);
                        setPanelState("PLACE_INFO");
                      }}
                    >
                      <Text style={styles.dangerText}>Stop navigation</Text>
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function PanelHeader({ title, meta, onBack }) {
  return (
    <View style={styles.panelHeader}>
      <TouchableOpacity style={styles.panelBack} onPress={onBack}>
        <Text style={styles.panelBackText}>Back</Text>
      </TouchableOpacity>
      <View style={styles.panelTitleBlock}>
        <Text style={styles.panelTitle}>{title}</Text>
        <Text style={styles.panelMeta}>{meta}</Text>
      </View>
    </View>
  );
}

function LegendRow({ color, label }) {
  return (
    <View style={styles.legendRow}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },

  map: {
    flex: 1,
  },

  switcher: {
    position: "absolute",
    top: 14,
    left: 0,
    right: 0,
    zIndex: 2000,
    elevation: 2000,
    paddingHorizontal: 12,
  },

  switcherContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingRight: 24,
  },

  moduleButton: {
    minHeight: 38,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
    backgroundColor: "#ffffff",
  },

  moduleActive: {
    backgroundColor: "#14532d",
    borderColor: "#14532d",
  },

  moduleText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },

  moduleTextActive: {
    color: "#ffffff",
  },

  backButton: {
    backgroundColor: "#111827",
    borderColor: "#111827",
  },

  backText: {
    color: "#ffffff",
  },

  recenterBtn: {
    position: "absolute",
    top: 68,
    right: 16,
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 8,
    elevation: 6,
  },

  recenterIcon: {
    fontSize: 18,
    fontWeight: "700",
  },

  actionBar: {
    position: "absolute",
    left: 12,
    right: 12,
    bottom: 112,
    backgroundColor: "#ffffff",
    padding: 12,
    borderRadius: 8,
    zIndex: 1500,
    elevation: 1500,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
  },

  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },

  primaryBtn: {
    flex: 1,
    backgroundColor: "#14532d",
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
  },

  primaryText: {
    color: "#ffffff",
    fontWeight: "800",
  },

  secondaryBtn: {
    flex: 1,
    backgroundColor: "#f8fbf9",
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#dce7e1",
  },

  secondaryText: {
    color: "#111827",
    fontWeight: "700",
  },

  dangerBtn: {
    backgroundColor: "#fee2e2",
    padding: 15,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fca5a5",
  },

  dangerText: {
    color: "#991b1b",
    fontWeight: "800",
  },

  disabledBtn: {
    opacity: 0.6,
  },

  panelWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    elevation: 1000,
  },

  panel: {
    maxHeight: 430,
    backgroundColor: "rgba(255,255,255,0.98)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.75)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 16,
  },

  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#d1d5db",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 12,
  },

  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eef2ef",
  },

  panelBack: {
    minHeight: 38,
    paddingHorizontal: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#dce7e1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8fbf9",
  },

  panelBackText: {
    color: "#111827",
    fontSize: 12,
    fontWeight: "800",
  },

  panelTitleBlock: {
    flex: 1,
    minWidth: 0,
  },

  panelTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#10251b",
  },

  panelMeta: {
    marginTop: 3,
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
  },

  picker: {
    minHeight: 46,
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    marginBottom: 10,
  },

  input: {
    borderWidth: 1,
    borderColor: "#dce7e1",
    borderRadius: 12,
    padding: 12,
    backgroundColor: "#fbfdfc",
    marginBottom: 10,
    fontSize: 14,
  },

  textArea: {
    minHeight: 76,
    textAlignVertical: "top",
  },

  formRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 10,
  },

  thumb: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: "#e5e7eb",
  },

  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingVertical: 2,
  },

  legendSwatch: {
    width: 14,
    height: 14,
    borderRadius: 4,
    marginRight: 10,
  },

  legendText: {
    color: "#374151",
    fontWeight: "600",
  },

  panelNote: {
    marginTop: 4,
    color: "#526158",
    lineHeight: 20,
    fontWeight: "600",
  },

  panelSection: {
    backgroundColor: "#f8fbf9",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e3ece7",
    padding: 12,
    marginBottom: 12,
  },

  sectionLabel: {
    marginBottom: 8,
    fontSize: 12,
    fontWeight: "800",
    color: "#374151",
    textTransform: "uppercase",
  },

  listSection: {
    backgroundColor: "#f8fbf9",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e3ece7",
    padding: 8,
    marginBottom: 12,
  },

  evacCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 11,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#edf2ef",
    backgroundColor: "#ffffff",
    marginBottom: 8,
  },

  evacIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#e7f5ed",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },

  evacIconBadgeLarge: {
    width: 42,
    height: 42,
    borderRadius: 15,
    backgroundColor: "#dff2e8",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  evacIconText: {
    color: "#14532d",
    fontSize: 13,
    fontWeight: "900",
  },

  evacCardText: {
    flex: 1,
    minWidth: 0,
    marginRight: 10,
  },

  evacName: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },

  evacMeta: {
    marginTop: 3,
    color: "#6b7280",
    fontSize: 12,
    fontWeight: "600",
  },

  selectedPlace: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#d1fae5",
    backgroundColor: "#f0fdf4",
    padding: 14,
    marginBottom: 12,
  },

  selectedHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  statusChip: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#ecfdf5",
    borderWidth: 1,
    borderColor: "#bbf7d0",
  },

  statusChipText: {
    color: "#166534",
    fontSize: 10,
    fontWeight: "900",
  },

  warningChip: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
  },

  warningChipText: {
    color: "#92400e",
    fontSize: 11,
    fontWeight: "700",
  },

  modeRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
  },

  modeBtn: {
    flex: 1,
    minHeight: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#d1d5db",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#ffffff",
  },

  modeBtnActive: {
    backgroundColor: "#14532d",
    borderColor: "#14532d",
  },

  modeText: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "800",
    textTransform: "capitalize",
  },

  modeTextActive: {
    color: "#ffffff",
  },

  routeCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e3ece7",
    backgroundColor: "#ffffff",
    marginBottom: 8,
  },

  loadingCard: {
    padding: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#e3ece7",
    backgroundColor: "#ffffff",
    marginBottom: 8,
  },

  routeRecommended: {
    borderColor: "#86efac",
    backgroundColor: "#f0fdf4",
  },

  routeMain: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "800",
  },

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
    fontSize: 16,
    fontWeight: "700",
  },

  modalActions: {
    flexDirection: "row",
    justifyContent: "space-between",
  },

  modalNo: {
    color: "#374151",
    fontWeight: "700",
  },

  modalYes: {
    color: "#dc2626",
    fontWeight: "800",
  },
});