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
  Animated,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  PanResponder,
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
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";

import api from "../lib/api";
import JaenWeatherForecast from "./components/JaenWeatherForecast";
import { UserContext } from "./UserContext";
import { MapContext } from "./contexts/MapContext";
import useRouting from "./hooks/useRouting";
import useHazardLayers, { FLOOD_STYLES } from "./hooks/useHazardLayers";
import { PillMarker } from "./MapIcon";
import jaenGeoJSON from "./data/jaen.json";
import areasData from "./data/area.json";
import {
  INCIDENT_DESCRIPTION_MAX_LENGTH,
  INCIDENT_LOCATION_MAX_LENGTH,
  isValidCoordinate,
  normalizeCoordinate,
  sanitizeIncidentDescription,
  sanitizeIncidentLocation,
  safeDisplayText,
  toNumber,
} from "./utils/validation";

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

const SCREEN_HEIGHT = Dimensions.get("window").height;
const PANEL_MIN_OFFSET = -SCREEN_HEIGHT * 0.05;
const PANEL_DEFAULT_OFFSET = 128;
const PANEL_MAX_OFFSET = 148;

const MODULES = [
  { key: "incident", label: "Incident" },
  { key: "flood", label: "Flood" },
  { key: "earthquake", label: "Earthquake" },
  { key: "barangay", label: "Barangay" },
  { key: "evac", label: "Evac Place" },
];

const INCIDENT_LEVEL_COLOR = {
  critical: "#dc2626",
  high: "#ea580c",
  medium: "#ca8a04",
  low: "#16a34a",
};

const EVAC_STATUS_COLORS = {
  available: "#16a34a",
  limited: "#facc15",
  full: "#dc2626",
};

const FLOOD_LEGEND_ITEMS = [
  {
    key: "susceptible",
    label: "Susceptible zone",
    color: FLOOD_STYLES.susceptible.fillColor,
  },
  {
    key: "medium",
    label: "Medium flood zone",
    color: FLOOD_STYLES.medium.fillColor,
  },
  {
    key: "safe",
    label: "Lower flood exposure",
    color: FLOOD_STYLES.safe.fillColor,
  },
];

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

const formatCoordinateAddress = (latitude, longitude, prefix = "Map pin") =>
  `${prefix}: ${Number(latitude).toFixed(5)}, ${Number(longitude).toFixed(5)}`;

const formatReverseGeocodeAddress = (place, latitude, longitude) => {
  const parts = [
    place?.name,
    place?.street,
    place?.district,
    place?.city,
    place?.subregion,
    place?.region,
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean);

  return parts.length
    ? parts.join(", ")
    : formatCoordinateAddress(latitude, longitude, "Current location");
};

const safeArray = (arr) => (Array.isArray(arr) ? arr : []);
const safeFeatures = (data) => safeArray(data?.features);

function getBarangayColorParts(index = 0) {
  const hue = Math.round((index * 137.508 + 24) % 360);
  const saturationCycle = [78, 64, 86, 58];
  const lightnessCycle = [48, 60, 42, 66];
  const saturation = saturationCycle[index % saturationCycle.length];
  const lightness = lightnessCycle[index % lightnessCycle.length];

  return { hue, saturation, lightness };
}

function getBarangayColor(index = 0) {
  const { hue, saturation, lightness } = getBarangayColorParts(index);
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

function getBarangayFillColor(index = 0) {
  const { hue, saturation, lightness } = getBarangayColorParts(index);
  return `hsla(${hue}, ${saturation}%, ${lightness}%, 0.54)`;
}

function getBarangayOutlineColor(index = 0) {
  const { hue, saturation, lightness } = getBarangayColorParts(index);
  return `hsl(${hue}, ${Math.min(88, saturation + 8)}%, ${Math.max(34, lightness - 8)}%)`;
}

function getBarangaySoftFillColor(index = 0) {
  const { hue, saturation, lightness } = getBarangayColorParts(index);
  return `hsla(${hue}, ${saturation}%, ${Math.min(82, lightness + 10)}%, 0.1)`;
}

const getBarangayLabel = (feature, index) =>
  feature?.properties?.name ||
  feature?.properties?.barangay ||
  feature?.properties?.barangayName ||
  feature?.properties?.NAME_3 ||
  feature?.properties?.adm4_en ||
  `Barangay ${index + 1}`;

const OUTSIDE_JAEN_MASK = [
  { latitude: 16.2, longitude: 119.8 },
  { latitude: 16.2, longitude: 122.0 },
  { latitude: 14.4, longitude: 122.0 },
  { latitude: 14.4, longitude: 119.8 },
];

const toCoords = (ring) =>
  safeArray(ring)
    .filter((c) => Array.isArray(c) && c.length >= 2)
    .map(([lng, lat]) => ({
      latitude: Number(lat),
      longitude: Number(lng),
    }))
    .filter((c) => !Number.isNaN(c.latitude) && !Number.isNaN(c.longitude));

function getFeaturePolygons(feature) {
  const geom = feature?.geometry;
  if (!geom?.coordinates) return [];

  if (geom.type === "Polygon") return [geom.coordinates];
  if (geom.type === "MultiPolygon") return geom.coordinates;
  return [];
}

function getFeatureRings(feature) {
  return getFeaturePolygons(feature)
    .flatMap((polygon) => safeArray(polygon).map((ring) => toCoords(ring)))
    .filter((ring) => ring.length > 2);
}

function getFeatureMainRing(feature) {
  const rings = getFeatureRings(feature);
  if (!rings.length) return [];

  return rings.reduce(
    (largest, ring) =>
      getRingAreaMagnitude(ring) > getRingAreaMagnitude(largest) ? ring : largest,
    rings[0]
  );
}

function getRingAreaMagnitude(ring) {
  if (!ring?.length) return 0;

  let area = 0;
  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    area += current.longitude * next.latitude - next.longitude * current.latitude;
  }

  return Math.abs(area / 2);
}

function getCoordinatesCenter(coords) {
  if (!coords.length) return null;

  const bounds = coords.reduce(
    (acc, coord) => ({
      minLat: Math.min(acc.minLat, coord.latitude),
      maxLat: Math.max(acc.maxLat, coord.latitude),
      minLng: Math.min(acc.minLng, coord.longitude),
      maxLng: Math.max(acc.maxLng, coord.longitude),
    }),
    {
      minLat: coords[0].latitude,
      maxLat: coords[0].latitude,
      minLng: coords[0].longitude,
      maxLng: coords[0].longitude,
    }
  );

  return {
    latitude: (bounds.minLat + bounds.maxLat) / 2,
    longitude: (bounds.minLng + bounds.maxLng) / 2,
  };
}

function getRingCentroid(ring) {
  if (!ring?.length) return null;

  let areaFactor = 0;
  let longitudeSum = 0;
  let latitudeSum = 0;

  for (let index = 0; index < ring.length; index += 1) {
    const current = ring[index];
    const next = ring[(index + 1) % ring.length];
    const cross =
      current.longitude * next.latitude - next.longitude * current.latitude;

    areaFactor += cross;
    longitudeSum += (current.longitude + next.longitude) * cross;
    latitudeSum += (current.latitude + next.latitude) * cross;
  }

  if (Math.abs(areaFactor) < 1e-12) {
    return getCoordinatesCenter(ring);
  }

  return {
    latitude: latitudeSum / (3 * areaFactor),
    longitude: longitudeSum / (3 * areaFactor),
  };
}

function isPointInRing(point, ring) {
  if (!point || ring.length < 3) return false;

  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i].longitude;
    const yi = ring[i].latitude;
    const xj = ring[j].longitude;
    const yj = ring[j].latitude;
    const intersects =
      yi > point.latitude !== yj > point.latitude &&
      point.longitude < ((xj - xi) * (point.latitude - yi)) / (yj - yi + 1e-12) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

function isPointInBarangay(point, feature) {
  return getFeatureRings(feature).some((ring) => isPointInRing(point, ring));
}

function getBarangayLabelCoordinate(feature, mainRing) {
  if (!mainRing?.length) return null;

  const centroid = getRingCentroid(mainRing);
  if (centroid && isPointInBarangay(centroid, feature)) return centroid;

  const boundsCenter = getCoordinatesCenter(mainRing);
  if (boundsCenter && isPointInBarangay(boundsCenter, feature)) return boundsCenter;

  return mainRing[Math.floor(mainRing.length / 2)] || boundsCenter;
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

function normalizePlace(place) {
  if (!place || typeof place !== "object") return null;
  if (
    place._id &&
    place.capacityStatus !== undefined &&
    isValidCoordinate(place.latitude, place.longitude)
  ) {
    return {
      ...place,
      name: safeDisplayText(place.name || place.barangayName, "Selected place"),
      latitude: Number(place.latitude),
      longitude: Number(place.longitude),
    };
  }

  if (
    place._id &&
    place.barangayName &&
    isValidCoordinate(place.latitude, place.longitude)
  ) {
    return {
      ...place,
      name: safeDisplayText(place.name || place.barangayName, "Selected place"),
      capacityStatus: "barangay",
      latitude: Number(place.latitude),
      longitude: Number(place.longitude),
    };
  }

  if (isValidCoordinate(place.latitude, place.longitude)) {
    return {
      _id: `search-${Number(place.latitude)}-${Number(place.longitude)}`,
      name: safeDisplayText(place.label, "Selected location"),
      latitude: Number(place.latitude),
      longitude: Number(place.longitude),
      capacityStatus: "location",
    };
  }

  return null;
}

function toMarkerCoordinate(value) {
  return normalizeCoordinate(value);
}

function SafeMarker({ coordinate, children, ...props }) {
  const safeCoordinate = toMarkerCoordinate(coordinate);
  if (!safeCoordinate) return null;

  return (
    <Marker coordinate={safeCoordinate} {...props}>
      {children}
    </Marker>
  );
}

function getForecastAtmosphere(weather) {
  const hour = new Date().getHours();
  const condition = String(weather?.current?.condition || "").toLowerCase();
  const feelsLike = Number(weather?.current?.feelsLike);
  const isFoggyCondition = condition.includes("fog") || condition.includes("mist");
  const isRainyCondition =
    condition.includes("rain") ||
    condition.includes("drizzle") ||
    condition.includes("shower") ||
    condition.includes("thunder");
  const isMorning = hour >= 5 && hour < 10;
  const isAfternoon = hour >= 12 && hour < 17;
  const isEvening = hour >= 17 && hour < 19;
  const isNight = hour >= 19 || hour < 5;
  const isCoolMorning = !Number.isFinite(feelsLike) || feelsLike <= 27;

  if (isNight) {
    return {
      key: "night",
      insideTint: "rgba(8, 18, 33, 0.2)",
      fogOpacity: 0.08,
      showFog: isFoggyCondition || isRainyCondition,
    };
  }

  if (isEvening) {
    return {
      key: "evening",
      insideTint: "rgba(39, 48, 62, 0.12)",
      fogOpacity: 0.07,
      showFog: isRainyCondition || isFoggyCondition,
    };
  }

  if (isAfternoon) {
    return {
      key: "afternoon",
      insideTint: "rgba(255, 244, 214, 0.13)",
      fogOpacity: 0.06,
      showFog: isRainyCondition || isFoggyCondition,
    };
  }

  if (isMorning || isFoggyCondition) {
    return {
      key: "morning-fog",
      insideTint: "rgba(236, 253, 245, 0.16)",
      fogOpacity: isCoolMorning || isFoggyCondition ? 0.18 : 0.1,
      showFog: true,
    };
  }

  return {
    key: "daylight",
    insideTint: "rgba(255,255,255,0.04)",
    fogOpacity: 0.04,
    showFog: false,
  };
}

function getEvacStatusColor(status) {
  return EVAC_STATUS_COLORS[String(status || "").toLowerCase()] || "#16a34a";
}

function getEvacStatusCopy(status) {
  const normalized = String(status || "available").toLowerCase();
  if (normalized === "limited") {
    return {
      label: "LIMITED",
      tint: "#FEF3C7",
      border: "#FCD34D",
      text: "#92400E",
    };
  }

  if (normalized === "full") {
    return {
      label: "FULL",
      tint: "#FEE2E2",
      border: "#FCA5A5",
      text: "#991B1B",
    };
  }

  return {
    label: "AVAILABLE",
    tint: "#ECFDF5",
    border: "#86EFAC",
    text: "#166534",
  };
}

function EvacuationPlaceMarker({ color, selected = false, label }) {
  return (
    <View style={styles.evacMarkerShell} collapsable={false}>
      {selected ? (
        <View style={styles.evacMarkerLabelWrap}>
          <View style={styles.evacMarkerLabel}>
            <Text style={styles.evacMarkerLabelText} numberOfLines={1}>
              {label}
            </Text>
          </View>
        </View>
      ) : null}

      <View
        style={[
          styles.evacMarkerPin,
          selected && styles.evacMarkerPinSelected,
          { borderColor: color },
        ]}
      >
        <View style={[styles.evacMarkerCore, { backgroundColor: color }]}>
          <Ionicons name="business-outline" size={14} color="#ffffff" />
        </View>
      </View>

      <View style={[styles.evacMarkerPointer, { borderTopColor: color }]} />
    </View>
  );
}function BarangayNameMarker({
  label,
  color,
  selected = false,
  incidentCount = 0,
  onPress,
}) {
  return (
    <View style={styles.barangayMarkerShell} collapsable={false}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={onPress}
        style={[
          styles.barangayMarker,
          selected && styles.barangayMarkerSelected,
          { borderColor: selected ? "#FACC15" : `${color}55` },
        ]}
      >
        <View
          style={[
            styles.barangayMarkerIcon,
            {
              backgroundColor: selected ? "#FFF7D6" : "#FFFFFF",
              borderColor: selected ? "#FACC15" : `${color}45`,
            },
          ]}
        >
          <View
            style={[
              styles.barangayMarkerDot,
              { backgroundColor: selected ? "#FACC15" : color },
            ]}
          />
        </View>

        <Text
          style={[
            styles.barangayMarkerText,
            selected && styles.barangayMarkerTextSelected,
          ]}
          numberOfLines={2}
        >
          {label}
        </Text>

        {incidentCount > 0 ? (
          <View style={styles.barangayIncidentBadge}>
            <Text style={styles.barangayIncidentBadgeText}>{incidentCount}</Text>
          </View>
        ) : null}
      </TouchableOpacity>
    </View>
  );
}

function IncidentListItem({ incident }) {
  const level = String(incident?.level || "low").toLowerCase();
  const levelColor = INCIDENT_LEVEL_COLOR[level] || "#16a34a";

  return (
    <View style={styles.incidentListItem}>
      <View style={[styles.incidentSeverityDot, { backgroundColor: levelColor }]} />
      <View style={styles.incidentListCopy}>
        <Text style={styles.incidentListTitle} numberOfLines={1}>
          {safeDisplayText(incident?.type, "Incident")}
        </Text>
        <Text style={styles.incidentListMeta} numberOfLines={1}>
          {safeDisplayText(incident?.location, "Location not provided")}
        </Text>
        {!!incident?.description && (
          <Text style={styles.incidentListDescription} numberOfLines={2}>
            {safeDisplayText(incident.description, "No description")}
          </Text>
        )}
      </View>
      <View style={[styles.incidentLevelChip, { borderColor: levelColor }]}>
        <Text style={[styles.incidentLevelText, { color: levelColor }]}>
          {level.toUpperCase()}
        </Text>
      </View>
    </View>
  );
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
            zIndex={stylePrefix === "jaen" ? 30 : undefined}
          />
        );
      })
    );
  });
}

function renderInsideJaenAtmosphere(data, atmosphere, fogAlpha = 0) {
  const baseLayer = safeFeatures(data).flatMap((feature, idx) => {
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
            key={`jaen-atmosphere-${idx}-${pIdx}-${rIdx}`}
            coordinates={coords}
            strokeColor="rgba(15,23,42,0)"
            strokeWidth={0}
            fillColor={atmosphere.insideTint}
            tappable={false}
            zIndex={12}
          />
        );
      })
    );
  });

  if (!atmosphere.showFog || fogAlpha <= 0) {
    return baseLayer;
  }

  const fogLayer = safeFeatures(data).flatMap((feature, idx) => {
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
            key={`jaen-fog-${idx}-${pIdx}-${rIdx}`}
            coordinates={coords}
            strokeColor="rgba(15,23,42,0)"
            strokeWidth={0}
            fillColor={`rgba(255,255,255,${fogAlpha})`}
            tappable={false}
            zIndex={14}
          />
        );
      })
    );
  });

  return [...baseLayer, ...fogLayer];
}

function getBoundsFromData(data) {
  const coords = safeFeatures(data).flatMap((feature) => {
    const geom = feature?.geometry;
    if (!geom?.coordinates) return [];

    const polygons =
      geom.type === "Polygon"
        ? [geom.coordinates]
        : geom.type === "MultiPolygon"
          ? geom.coordinates
          : [];

    return polygons.flatMap((poly) =>
      safeArray(poly).flatMap((ring) => toCoords(ring))
    );
  });

  if (!coords.length) return null;

  return coords.reduce(
    (acc, coord) => ({
      minLat: Math.min(acc.minLat, coord.latitude),
      maxLat: Math.max(acc.maxLat, coord.latitude),
      minLng: Math.min(acc.minLng, coord.longitude),
      maxLng: Math.max(acc.maxLng, coord.longitude),
    }),
    {
      minLat: coords[0].latitude,
      maxLat: coords[0].latitude,
      minLng: coords[0].longitude,
      maxLng: coords[0].longitude,
    }
  );
}

function clamp(value, min, max) {
  if (min > max) return (min + max) / 2;
  return Math.max(min, Math.min(max, value));
}

function getBoundaryHoles(data) {
  return safeFeatures(data).flatMap((feature) => {
    const geom = feature?.geometry;
    if (!geom?.coordinates) return [];

    const polygons =
      geom.type === "Polygon"
        ? [geom.coordinates]
        : geom.type === "MultiPolygon"
          ? geom.coordinates
          : [];

    return polygons
      .map((poly) => toCoords(poly?.[0]))
      .filter((coords) => coords.length > 2);
  });
}

export default function Map() {
  const mapRef = useRef(null);
  const navigation = useNavigation();
  const navRoute = useRoute();
  const lastPlaceKeyRef = useRef(null);
  const { user } = useContext(UserContext) || {};

  const [mongoBarangays, setMongoBarangays] = useState(null);
  const [incidentDraft, setIncidentDraft] = useState(EMPTY_INCIDENT);
  const [incidentImage, setIncidentImage] = useState(null);
  const [incidentImageError, setIncidentImageError] = useState("");
  const [incidentBusy, setIncidentBusy] = useState(false);
  const [incidentLocating, setIncidentLocating] = useState(false);
  const [mapWeather, setMapWeather] = useState(null);
  const [fogPulseLevel, setFogPulseLevel] = useState(0.65);
  const [selectedBarangay, setSelectedBarangay] = useState(null);

  const {
    activeMapModule,
    setActiveMapModule,
    panelState,
    setPanelState,
    panelY,
    setPanelY,
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
  const isClampingRegionRef = useRef(false);

  const requestedModule = MODULES.some((item) => item.key === navRoute.params?.module)
    ? navRoute.params.module
    : null;
  const activeModule = activeMapModule;
  const showMapWeather = !activeModule && panelState !== "NAVIGATION";
  const isEvac = activeModule === "evac";
  const isIncident = activeModule === "incident";
  const isFlood = activeModule === "flood";
  const isEarthquake = activeModule === "earthquake";
  const isBarangay = activeModule === "barangay";
  const showHomepageBarangays = !activeModule || isIncident;
  const showBarangayNameMarkers = showHomepageBarangays || isBarangay;

  const normalizedEvacPlaces = useMemo(
    () =>
      safeArray(evacPlaces)
        .map(normalizePlace)
        .filter(Boolean)
        .map((place) => ({
          ...place,
          coordinate: toMarkerCoordinate(place),
        }))
        .filter((place) => place.coordinate),
    [evacPlaces]
  );

  const normalizedSelectedEvac = useMemo(() => normalizePlace(evac), [evac]);

  const normalizedIncidents = useMemo(
    () =>
      safeArray(incidents)
        .map((incident) => {
          const latitude = toNumber(
            incident?.latitude ?? incident?.lat ?? incident?.location?.lat
          );
          const longitude = toNumber(
            incident?.longitude ?? incident?.lng ?? incident?.location?.lng
          );

          if (!isValidCoordinate(latitude, longitude)) {
            return null;
          }

          return {
            ...incident,
            latitude,
            longitude,
          };
        })
        .filter(Boolean),
    [incidents]
  );

  const { floodLayers, earthquakeLayer } = useHazardLayers({
    showFloodMap: isFlood,
    showEarthquakeHazard: isEarthquake,
    showJaenBoundary: false,
  });

  useEffect(() => {
    setShowFloodMap(isFlood);
    setShowEarthquakeHazard(isEarthquake);
  }, [isEarthquake, isFlood, setShowEarthquakeHazard, setShowFloodMap]);

  useEffect(() => {
    if (requestedModule && requestedModule !== activeMapModule) {
      setActiveMapModule(requestedModule);
    }
  }, [activeMapModule, requestedModule, setActiveMapModule]);

  useFocusEffect(
    useCallback(() => {
      return () => {
        setRouteRequested(false);
        setRoutes([]);
        setActiveRoute(null);
      };
    }, [setActiveRoute, setRouteRequested, setRoutes])
  );

  useEffect(() => {
    let mounted = true;

    api
      .get("/api/barangays/collection")
      .then((res) => {
        if (!mounted) return;

        setMongoBarangays({
          type: "FeatureCollection",
          features: safeArray(res.data).flatMap((collection) =>
            safeArray(collection?.features)
          ),
        });
      })
      .catch((err) => {
        console.error("Barangay fetch failed:", err?.message);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!normalizedSelectedEvac && evac != null) {
      setEvac(null);
    }
  }, [evac, normalizedSelectedEvac, setEvac]);

  useEffect(() => {
    const rawPlace =
      navRoute.params?.evacPlace ?? navRoute.params?.barangay ?? navRoute.params?.place;
    const nextPlace = rawPlace?.raw ? normalizePlace(rawPlace.raw) : normalizePlace(rawPlace);

    if (!nextPlace) return;

    const nextKey = `${nextPlace._id}-${nextPlace.latitude}-${nextPlace.longitude}`;
    if (lastPlaceKeyRef.current === nextKey) return;
    lastPlaceKeyRef.current = nextKey;

    setActiveMapModule("evac");
    setEvac(nextPlace);
    setPanelState("PLACE_INFO");
    setPanelY(null);
    setRouteRequested(false);
    setRoutes([]);
    setActiveRoute(null);

    mapRef.current?.fitToCoordinates([USER_POS, nextPlace], {
      edgePadding: EDGE_PADDING,
      animated: true,
    });
  }, [
    navRoute.params,
    setActiveMapModule,
    setActiveRoute,
    setEvac,
    setPanelState,
    setPanelY,
    setRouteRequested,
    setRoutes,
  ]);

  useEffect(() => {
    if (!isEvac) return;

    if (!normalizedSelectedEvac && panelState !== "HIDDEN") {
      setPanelState("HIDDEN");
    } else if (normalizedSelectedEvac && panelState === "HIDDEN") {
      setPanelState("PLACE_INFO");
    }
  }, [isEvac, normalizedSelectedEvac, panelState, setPanelState]);

  const routing = useRouting({
    enabled: isEvac && routeRequested && !!normalizedSelectedEvac,
    from: [USER_POS.latitude, USER_POS.longitude],
    to: normalizedSelectedEvac
      ? {
          lat: normalizedSelectedEvac.latitude,
          lng: normalizedSelectedEvac.longitude,
        }
      : null,
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
      !isEvac ||
      panelState !== "NAVIGATION" ||
      !routes.length ||
      isBottomNavInteracting
    ) {
      return;
    }

    const primaryRoute = routes[0];
    if (!Array.isArray(primaryRoute?.coords) || primaryRoute.coords.length < 2) {
      return;
    }

    let nearestIdx = 0;
    let minDist = Infinity;

    primaryRoute.coords.forEach((coord, index) => {
      if (index >= primaryRoute.coords.length - 1) return;
      const currentDistance = distance(USER_POS, coord);
      if (currentDistance < minDist) {
        minDist = currentDistance;
        nearestIdx = index;
      }
    });

    const heading = getHeading(
      primaryRoute.coords[nearestIdx],
      primaryRoute.coords[Math.min(nearestIdx + 1, primaryRoute.coords.length - 1)]
    );

    mapRef.current?.animateCamera(
      {
        center: USER_POS,
        heading,
        zoom: NAV_ZOOM,
        pitch: NAV_PITCH,
      },
      { duration: 700 }
    );
  }, [isBottomNavInteracting, isEvac, panelState, routes]);

  const jaenBoundary = useMemo(
    () => renderBoundary(jaenGeoJSON, "jaen", "#065F46", 2.5, "transparent"),
    []
  );

  const jaenFocusMask = useMemo(() => {
    const holes = getBoundaryHoles(jaenGeoJSON);
    return (
      <Polygon
        key="outside-jaen-mask"
        coordinates={OUTSIDE_JAEN_MASK}
        holes={holes}
        strokeColor="rgba(15,23,42,0)"
        fillColor="rgba(0,0,0,0.58)"
        tappable={false}
        zIndex={5}
      />
    );
  }, []);

  const jaenBounds = useMemo(() => getBoundsFromData(jaenGeoJSON), []);
  const mapAtmosphere = useMemo(() => getForecastAtmosphere(mapWeather), [mapWeather]);

  useEffect(() => {
    if (!mapAtmosphere.showFog) {
      setFogPulseLevel(0);
      return undefined;
    }

    setFogPulseLevel(0.65);
    const intervalId = setInterval(() => {
      setFogPulseLevel((value) => (value < 0.8 ? 1 : 0.65));
    }, 2800);

    return () => clearInterval(intervalId);
  }, [mapAtmosphere.key, mapAtmosphere.showFog]);

  const jaenAtmosphereLayer = useMemo(
    () =>
      renderInsideJaenAtmosphere(
        jaenGeoJSON,
        mapAtmosphere,
        mapAtmosphere.fogOpacity * fogPulseLevel
      ),
    [fogPulseLevel, mapAtmosphere]
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

  const mongoBarangayBoundaries = useMemo(
    () => {
      const features = safeFeatures(mongoBarangays);
      const totalFeatures = features.length;

      return features.flatMap((feature, index) => {
        const geometry = feature?.geometry;
        if (!geometry?.coordinates) return [];

        const rings =
          geometry.type === "Polygon"
            ? [geometry.coordinates[0]]
            : geometry.type === "MultiPolygon"
              ? geometry.coordinates.map((polygon) => polygon[0])
              : [];

        const fillColor = getBarangayFillColor(index, totalFeatures);

        return rings.map((ring, ringIndex) => {
          const coordinates = toCoords(ring);
          if (!coordinates.length) return null;

          return (
            <Polygon
              key={`mongo-${index}-${ringIndex}`}
              coordinates={coordinates}
              strokeColor="#111827"
              strokeWidth={1.25}
              fillColor={fillColor}
              zIndex={60}
            />
          );
        });
      });
    },
    [mongoBarangays]
  );

  const barangayLegend = useMemo(() => {
    const features = safeFeatures(mongoBarangays).length
      ? safeFeatures(mongoBarangays)
      : safeFeatures(areasData);
    const totalFeatures = features.length;

    return features.map((feature, index) => ({
      label: getBarangayLabel(feature, index),
      color: getBarangayColor(index, totalFeatures),
    }));
  }, [mongoBarangays]);

  const displayedBarangayCount =
    safeFeatures(mongoBarangays).length || safeFeatures(areasData).length;

  const homepageBarangays = useMemo(() => {
    const features = safeFeatures(mongoBarangays).length
      ? safeFeatures(mongoBarangays)
      : safeFeatures(areasData);
    const totalFeatures = features.length;

    return features
      .map((feature, index) => {
        const mainRing = getFeatureMainRing(feature);
        const center = getBarangayLabelCoordinate(feature, mainRing);
        const label = getBarangayLabel(feature, index);

        if (!mainRing.length || !center) return null;

        return {
          id: String(
            feature?._id ||
            feature?.properties?._id ||
            feature?.properties?.id ||
            `${label}-${index}`
          ),
          label,
          feature,
          index,
          center,
          mainRing,
          color: getBarangayOutlineColor(index, totalFeatures),
          fillColor: getBarangaySoftFillColor(index, totalFeatures),
        };
      })
      .filter(Boolean);
  }, [mongoBarangays]);

  const incidentBarangayCounts = useMemo(() => {
    const counts = {};

    normalizedIncidents.forEach((incident) => {
      const point = { latitude: incident.latitude, longitude: incident.longitude };
      const match = homepageBarangays.find((barangay) =>
        isPointInBarangay(point, barangay.feature)
      );

      if (match) {
        counts[match.id] = (counts[match.id] || 0) + 1;
      }
    });

    return counts;
  }, [homepageBarangays, normalizedIncidents]);

  const selectedBarangayIncidents = useMemo(() => {
    if (!selectedBarangay) return normalizedIncidents;

    const normalizedLabel = String(selectedBarangay.label || "").toLowerCase();

    return normalizedIncidents.filter((incident) => {
      const point = { latitude: incident.latitude, longitude: incident.longitude };
      if (isPointInBarangay(point, selectedBarangay.feature)) return true;

      const locationText = String(incident?.location || "").toLowerCase();
      return normalizedLabel && locationText.includes(normalizedLabel);
    });
  }, [normalizedIncidents, selectedBarangay]);

  const handleWeatherChange = useCallback((nextWeather) => {
    setMapWeather(nextWeather);
  }, []);

  const handleSelectBarangay = useCallback(
    (barangay) => {
      if (!barangay?.mainRing?.length) return;

      setSelectedBarangay(barangay);
      if (!activeModule) {
        setActiveMapModule("incident");
      }
      setPanelY(null);

      mapRef.current?.fitToCoordinates(barangay.mainRing, {
        edgePadding: {
          top: 150,
          bottom: 360,
          left: 46,
          right: 46,
        },
        animated: true,
      });
    },
    [activeModule, setActiveMapModule, setPanelY]
  );

  const clearSelectedBarangay = useCallback(() => {
    setSelectedBarangay(null);
    mapRef.current?.animateToRegion(JAEN_INITIAL_REGION, 260);
  }, []);

  const selectedIncidentCoordinate = useMemo(() => {
    if (!isValidCoordinate(incidentDraft.latitude, incidentDraft.longitude)) {
      return null;
    }

    return {
      latitude: toNumber(incidentDraft.latitude),
      longitude: toNumber(incidentDraft.longitude),
    };
  }, [incidentDraft.latitude, incidentDraft.longitude]);

  const userCoordinate = useMemo(() => toMarkerCoordinate(USER_POS), []);
  const selectedEvacCoordinate = useMemo(
    () => toMarkerCoordinate(normalizedSelectedEvac),
    [normalizedSelectedEvac]
  );
  const visibleIncidentMarkers =
    isIncident && selectedBarangay ? selectedBarangayIncidents : normalizedIncidents;

  const handleBack = useCallback(() => {
    navigation.setParams({
      module: undefined,
      evacPlace: undefined,
      barangay: undefined,
      place: undefined,
    });
    setEvac(null);
    setRouteRequested(false);
    setRoutes([]);
    setActiveRoute(null);
    setActiveMapModule(null);
    setPanelState("HIDDEN");
    setPanelY(null);
    setSelectedBarangay(null);
    mapRef.current?.animateToRegion(JAEN_INITIAL_REGION, 260);
  }, [
    navigation,
    setActiveMapModule,
    setActiveRoute,
    setEvac,
    setPanelState,
    setPanelY,
    setRouteRequested,
    setRoutes,
  ]);

  const handleEvacMarkerPress = useCallback(
    (place) => {
      const normalizedPlace = normalizePlace(place);
      if (!normalizedPlace) return;

      setEvac(normalizedPlace);
      setPanelState("PLACE_INFO");
      setPanelY(null);
      setRouteRequested(false);
      setRoutes([]);
      setActiveRoute(null);

      mapRef.current?.fitToCoordinates([USER_POS, normalizedPlace], {
        edgePadding: EDGE_PADDING,
        animated: true,
      });
    },
    [setActiveRoute, setEvac, setPanelState, setPanelY, setRouteRequested, setRoutes]
  );

  const handleMapPress = useCallback(
    (event) => {
      if (!isIncident) return;

      const latitude = toNumber(event?.nativeEvent?.coordinate?.latitude);
      const longitude = toNumber(event?.nativeEvent?.coordinate?.longitude);
      if (!isValidCoordinate(latitude, longitude)) return;

      setIncidentDraft((prev) => ({
        ...prev,
        location: formatCoordinateAddress(latitude, longitude),
        latitude,
        longitude,
      }));
    },
    [isIncident]
  );

  const useCurrentIncidentLocation = useCallback(async () => {
    if (incidentLocating) return;

    if (Platform.OS === "web") {
      Alert.alert("Current Location", "Current location is not available in this app view.");
      return;
    }

    setIncidentLocating(true);

    try {
      const Location = await import("expo-location");
      const permission = await Location.requestForegroundPermissionsAsync();

      if (permission.status !== "granted") {
        Alert.alert(
          "Location Permission Needed",
          "Allow location access or manually type the incident address."
        );
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const latitude = toNumber(current?.coords?.latitude);
      const longitude = toNumber(current?.coords?.longitude);

      if (!isValidCoordinate(latitude, longitude)) {
        Alert.alert("Location Unavailable", "We could not read your current location.");
        return;
      }

      let address = formatCoordinateAddress(latitude, longitude, "Current location");
      try {
        const matches = await Location.reverseGeocodeAsync({ latitude, longitude });
        address = formatReverseGeocodeAddress(matches?.[0], latitude, longitude);
      } catch (_) {
        // Coordinates are enough if reverse geocoding is temporarily unavailable.
      }

      setIncidentDraft((prev) => ({
        ...prev,
        location: sanitizeIncidentLocation(address),
        latitude,
        longitude,
      }));

      mapRef.current?.animateToRegion(
        {
          latitude,
          longitude,
          latitudeDelta: 0.012,
          longitudeDelta: 0.012,
        },
        420
      );
    } catch (err) {
      Alert.alert(
        "Location Unavailable",
        err?.message || "Unable to get your current location right now."
      );
    } finally {
      setIncidentLocating(false);
    }
  }, [incidentLocating]);

  const pickIncidentImage = useCallback(async () => {
    if (Platform.OS === "web") return;

    const ImagePicker = await import("expo-image-picker");
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: false,
      quality: 1,
    });

    if (result.canceled || !Array.isArray(result.assets) || !result.assets[0]?.uri) {
      return;
    }

    const asset = result.assets[0];
    const mimeType = asset.mimeType || "image/jpeg";

    if (!mimeType.startsWith("image/")) {
      setIncidentImage(null);
      setIncidentImageError("Please choose a valid image file.");
      return;
    }

    setIncidentImage({
      uri: asset.uri,
      name: asset.fileName || asset.uri.split("/").pop() || "incident.jpg",
      type: mimeType,
    });
    setIncidentImageError("");
  }, []);

  const submitIncident = useCallback(async () => {
    if (incidentBusy) return;

    if (!incidentDraft.type || !incidentDraft.level) {
      Alert.alert("Missing Details", "Choose an incident type and severity level.");
      return;
    }

    const cleanLocation = sanitizeIncidentLocation(incidentDraft.location);
    const cleanDescription = sanitizeIncidentDescription(incidentDraft.description);

    if (!cleanLocation) {
      Alert.alert(
        "Incident Address Required",
        "Type the incident address, use your current location, or tap the map."
      );
      return;
    }

    const hasCoordinates = isValidCoordinate(
      incidentDraft.latitude,
      incidentDraft.longitude
    );

    if ((incidentDraft.latitude || incidentDraft.longitude) && !hasCoordinates) {
      Alert.alert(
        "Invalid Coordinates",
        "Use current location again or tap the map to refresh the incident point."
      );
      return;
    }

    if (cleanDescription.length < 5) {
      Alert.alert("More Details Needed", "Add a short incident description.");
      return;
    }

    if (!incidentImage?.uri) {
      setIncidentImageError("Attach a photo before submitting this incident.");
      Alert.alert("Image Required", "Attach an image before submitting.");
      return;
    }

    setIncidentBusy(true);

    try {
      const formData = new FormData();
      const payload = {
        ...incidentDraft,
        location: cleanLocation,
        latitude: hasCoordinates ? incidentDraft.latitude : "",
        longitude: hasCoordinates ? incidentDraft.longitude : "",
        description: cleanDescription,
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
      setIncidentImageError("");
    } catch (err) {
      Alert.alert(
        "Submit Failed",
        err?.response?.data?.message || "Error submitting incident."
      );
    } finally {
      setIncidentBusy(false);
    }
  }, [
    incidentBusy,
    incidentDraft,
    incidentImage,
    user?.phone,
    user?.username,
  ]);

  const handleRegionChangeComplete = useCallback(
    (region) => {
      if (isClampingRegionRef.current) {
        isClampingRegionRef.current = false;
        return;
      }

      const latitudeDelta = Math.min(
        region.latitudeDelta,
        JAEN_INITIAL_REGION.latitudeDelta
      );
      const longitudeDelta = Math.min(
        region.longitudeDelta,
        JAEN_INITIAL_REGION.longitudeDelta
      );

      let latitude = region.latitude;
      let longitude = region.longitude;

      if (jaenBounds) {
        const latInset = latitudeDelta / 2;
        const lngInset = longitudeDelta / 2;

        latitude = clamp(
          region.latitude,
          jaenBounds.minLat + latInset,
          jaenBounds.maxLat - latInset
        );
        longitude = clamp(
          region.longitude,
          jaenBounds.minLng + lngInset,
          jaenBounds.maxLng - lngInset
        );
      }

      if (
        latitudeDelta !== region.latitudeDelta ||
        longitudeDelta !== region.longitudeDelta ||
        latitude !== region.latitude ||
        longitude !== region.longitude
      ) {
        isClampingRegionRef.current = true;
        mapRef.current?.animateToRegion(
          {
            ...region,
            latitude,
            longitude,
            latitudeDelta,
            longitudeDelta,
          },
          160
        );
      }
    },
    [jaenBounds]
  );

  return (
    <View style={styles.container}>
      <MapView
        key={`map-${activeModule || "none"}`}
        ref={mapRef}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        style={styles.map}
        initialRegion={JAEN_INITIAL_REGION}
        minZoomLevel={11}
        showsUserLocation={false}
        showsMyLocationButton={false}
        toolbarEnabled={false}
        scrollEnabled={!isBottomNavInteracting}
        zoomEnabled={!isBottomNavInteracting}
        rotateEnabled={panelState === "NAVIGATION" && !isBottomNavInteracting}
        pitchEnabled={panelState === "NAVIGATION" && !isBottomNavInteracting}
        onPress={handleMapPress}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {jaenFocusMask}
        {jaenAtmosphereLayer}
        {showHomepageBarangays &&
          homepageBarangays.map((barangay) => {
            const isSelected = selectedBarangay?.id === barangay.id;
            return (
              <Polygon
                key={`home-brgy-${barangay.id}`}
                coordinates={barangay.mainRing}
                strokeColor={isSelected ? "#FACC15" : barangay.color}
                strokeWidth={isSelected ? 3.5 : 1.65}
                fillColor={isSelected ? "rgba(250,204,21,0.16)" : barangay.fillColor}
                tappable
                onPress={() => handleSelectBarangay(barangay)}
                zIndex={isSelected ? 28 : 18}
              />
            );
          })}
        {jaenBoundary}
        {isFlood && floodLayers}
        {isEarthquake && earthquakeLayer}
        {isBarangay && mongoBarangayBoundaries}
        {isBarangay && localBarangayBoundaries}

        {isEvac && userCoordinate && (
          <SafeMarker key="evac-user" coordinate={userCoordinate} pinColor="#2563eb" />
        )}

        {isEvac &&
          normalizedEvacPlaces.map((place) => {
            const markerCoordinate = place.coordinate || toMarkerCoordinate(place);
            if (!markerCoordinate) return null;

            const isSelected = Boolean(
              normalizedSelectedEvac?._id && normalizedSelectedEvac._id === place._id
            );

            return (
              <SafeMarker
                key={place?._id || `${place.latitude}-${place.longitude}`}
                coordinate={markerCoordinate}
                anchor={{ x: 0.5, y: 1 }}
                onPress={() => handleEvacMarkerPress(place)}
              >
                <EvacuationPlaceMarker
                  color={getEvacStatusColor(place.capacityStatus)}
                  selected={isSelected}
                  label={safeDisplayText(place?.name, "Evacuation center")}
                />
              </SafeMarker>
            );
          })}
{showBarangayNameMarkers &&
  homepageBarangays.map((barangay) => (
    <SafeMarker
      key={`home-brgy-label-${barangay.id}`}
      coordinate={barangay.center}
      anchor={{ x: 0.5, y: 0.5 }}
      centerOffset={{ x: 0, y: 0 }}
      zIndex={selectedBarangay?.id === barangay.id ? 90 : 70}
      tracksViewChanges
      onPress={() => handleSelectBarangay(barangay)}
    >
      <BarangayNameMarker
        label={barangay.label}
        color={barangay.color}
        selected={selectedBarangay?.id === barangay.id}
        incidentCount={incidentBarangayCounts[barangay.id] || 0}
        onPress={() => handleSelectBarangay(barangay)}
      />
    </SafeMarker>
  ))}
        {isIncident &&
          visibleIncidentMarkers.map((incident) => (
            <SafeMarker
              key={incident._id}
              coordinate={incident}
              pinColor={
                INCIDENT_LEVEL_COLOR[String(incident.level || "critical").toLowerCase()] ||
                "#dc2626"
              }
            />
          ))}

        {selectedIncidentCoordinate && (
          <SafeMarker coordinate={selectedIncidentCoordinate} pinColor="#111827" />
        )}

        {isEvac && selectedEvacCoordinate && !normalizedSelectedEvac?._id && (
          <SafeMarker coordinate={selectedEvacCoordinate}>
            <PillMarker
              color="#16a34a"
              label={safeDisplayText(normalizedSelectedEvac?.name, "Evacuation center")}
              compact
            />
          </SafeMarker>
        )}

        {isEvac &&
          routes.map((route, index) =>
            panelState === "NAVIGATION" && !route.isRecommended ? null : (
              <Polyline
                key={route.id ?? index}
                coordinates={safeArray(route.coords)}
                strokeColor={route.isRecommended ? "#22c55e" : "#ef4444"}
                strokeWidth={6}
              />
            )
          )}
      </MapView>

      {showMapWeather && (
        <View style={styles.mapWeatherOverlay} pointerEvents="box-none">
          <JaenWeatherForecast variant="map" onWeatherChange={handleWeatherChange} />
        </View>
      )}

      {activeModule && (
        <ModulePanel
          activeModule={activeModule}
          onBack={handleBack}
          incidentDraft={incidentDraft}
          setIncidentDraft={setIncidentDraft}
          incidentImage={incidentImage}
          incidentImageError={incidentImageError}
          pickIncidentImage={pickIncidentImage}
          selectedIncidentCoordinate={selectedIncidentCoordinate}
          useCurrentIncidentLocation={useCurrentIncidentLocation}
          incidentLocating={incidentLocating}
          submitIncident={submitIncident}
          incidentBusy={incidentBusy}
          incidentCount={selectedBarangay ? selectedBarangayIncidents.length : normalizedIncidents.length}
          incidents={selectedBarangayIncidents}
          selectedBarangay={selectedBarangay}
          onClearSelectedBarangay={clearSelectedBarangay}
          barangayCount={displayedBarangayCount}
          barangayLegend={barangayLegend}
          evac={normalizedSelectedEvac}
          setEvac={setEvac}
          evacPlaces={normalizedEvacPlaces}
          normalizedEvacPlaces={normalizedEvacPlaces}
          panelState={panelState}
          setPanelState={setPanelState}
          panelY={panelY}
          setPanelY={setPanelY}
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
  incidentImageError,
  pickIncidentImage,
  selectedIncidentCoordinate,
  useCurrentIncidentLocation,
  incidentLocating,
  submitIncident,
  incidentBusy,
  incidentCount,
  incidents,
  selectedBarangay,
  onClearSelectedBarangay,
  barangayCount,
  barangayLegend,
  evac,
  setEvac,
  evacPlaces,
  normalizedEvacPlaces,
  panelState,
  setPanelState,
  panelY,
  setPanelY,
  setRouteRequested,
  routes,
  setRoutes,
  setActiveRoute,
  travelMode,
  setTravelMode,
}) {
  const routeSummary = routes[0]?.summary;
  const evacPlacesByStatus = useMemo(
    () => ({
      limited: normalizedEvacPlaces.filter((place) => place.capacityStatus === "limited"),
      full: normalizedEvacPlaces.filter((place) => place.capacityStatus === "full"),
      available: normalizedEvacPlaces.filter((place) => place.capacityStatus === "available"),
      other: normalizedEvacPlaces.filter(
        (place) => !["available", "limited", "full"].includes(place.capacityStatus)
      ),
    }),
    [normalizedEvacPlaces]
  );
  const evacStatusSummary = [
    { key: "available", count: normalizedEvacPlaces.filter((place) => place.capacityStatus === "available").length },
    { key: "limited", count: normalizedEvacPlaces.filter((place) => place.capacityStatus === "limited").length },
    { key: "full", count: normalizedEvacPlaces.filter((place) => place.capacityStatus === "full").length },
  ];
  const initialPanelY =
    typeof panelY === "number"
      ? Math.max(PANEL_MIN_OFFSET, Math.min(PANEL_MAX_OFFSET, panelY))
      : PANEL_DEFAULT_OFFSET;
  const translateY = useRef(new Animated.Value(initialPanelY)).current;
  const lastY = useRef(initialPanelY);

  useEffect(() => {
    if (typeof panelY !== "number") return;
    const nextY = Math.max(PANEL_MIN_OFFSET, Math.min(PANEL_MAX_OFFSET, panelY));
    translateY.setValue(nextY);
    lastY.current = nextY;
  }, [panelY, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderGrant: () => {
        translateY.stopAnimation((value) => {
          lastY.current = Math.max(PANEL_MIN_OFFSET, Math.min(PANEL_MAX_OFFSET, value));
          translateY.setOffset(lastY.current);
          translateY.setValue(0);
        });
      },
      onPanResponderMove: (_, gesture) => {
        const nextY = Math.max(
          PANEL_MIN_OFFSET,
          Math.min(PANEL_MAX_OFFSET, lastY.current + gesture.dy)
        );
        translateY.setValue(nextY - lastY.current);
      },
      onPanResponderRelease: (_, gesture) => {
        translateY.flattenOffset();
        const finalY = Math.max(
          PANEL_MIN_OFFSET,
          Math.min(PANEL_MAX_OFFSET, lastY.current + gesture.dy)
        );
        lastY.current = finalY;
        setPanelY(finalY);
        Animated.spring(translateY, {
          toValue: finalY,
          stiffness: 132,
          damping: 20,
          mass: 0.9,
          useNativeDriver: true,
        }).start();
      },
      onPanResponderTerminate: () => {
        translateY.flattenOffset();
        translateY.setValue(lastY.current);
      },
    })
  ).current;

  const selectEvac = (place) => {
    const normalizedPlace = normalizePlace(place);
    setEvac(normalizedPlace);
    setPanelState("PLACE_INFO");
    setPanelY(null);
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

  const renderEvacCard = (place) => {
    const statusMeta = getEvacStatusCopy(place.capacityStatus);
    return (
      <TouchableOpacity
        key={place?._id || `${place?.latitude}-${place?.longitude}`}
        style={styles.evacCard}
        onPress={() => selectEvac(place)}
      >
        <View
          style={[
            styles.evacIconBadge,
            { backgroundColor: `${getEvacStatusColor(place.capacityStatus)}18` },
          ]}
        >
          <Text
            style={[
              styles.evacIconText,
              { color: getEvacStatusColor(place.capacityStatus) },
            ]}
          >
            E
          </Text>
        </View>
        <View style={styles.evacCardText}>
          <Text style={styles.evacName} numberOfLines={1}>
            {safeDisplayText(place?.name, "Evacuation center")}
          </Text>
          <Text style={styles.evacMeta} numberOfLines={1}>
            {place.barangayName || place.location || "Evacuation center"}
          </Text>
        </View>
        <View
          style={[
            styles.statusChip,
            {
              backgroundColor: statusMeta.tint,
              borderColor: statusMeta.border,
            },
          ]}
        >
          <Text style={[styles.statusChipText, { color: statusMeta.text }]}>
            {statusMeta.label}
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.panelWrap}
    >
      <Animated.View style={[styles.panel, { transform: [{ translateY }] }]}>
        <View style={styles.dragZone} {...panResponder.panHandlers}>
          <View style={styles.handle} />
        </View>

        {activeModule === "incident" && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <PanelHeader
              title={selectedBarangay ? selectedBarangay.label : "Incident Reporting"}
              meta={
                selectedBarangay
                  ? `${incidentCount} reports in this barangay`
                  : `${incidentCount} active reports visible`
              }
              onBack={onBack}
            />

            <View style={styles.panelSection}>
              <View style={styles.incidentBarangayHeader}>
                <View style={styles.incidentBarangayIcon}>
                  <Ionicons name="map-outline" size={17} color="#14532D" />
                </View>
                <View style={styles.incidentBarangayCopy}>
                  <Text style={styles.sectionLabel}>Barangay incident view</Text>
                  <Text style={styles.panelNote}>
                    {selectedBarangay
                      ? "The map is focused on the selected barangay. Reports below are filtered to this area."
                      : "Tap a barangay outline or name on the map to zoom in and filter reports."}
                  </Text>
                </View>
              </View>

              {selectedBarangay && (
                <TouchableOpacity
                  style={styles.clearBarangayBtn}
                  onPress={onClearSelectedBarangay}
                >
                  <Text style={styles.clearBarangayText}>Show all barangays</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={styles.panelSection}>
              <Text style={styles.sectionLabel}>
                {selectedBarangay ? "Reports in barangay" : "Recent reports"}
              </Text>
              {safeArray(incidents).length === 0 ? (
                <View style={styles.emptyIncidentState}>
                  <Ionicons name="checkmark-circle-outline" size={24} color="#14532D" />
                  <Text style={styles.emptyIncidentTitle}>No incidents found</Text>
                  <Text style={styles.emptyIncidentText}>
                    {selectedBarangay
                      ? "There are no reports inside this barangay right now."
                      : "No incident reports are currently visible."}
                  </Text>
                </View>
              ) : (
                safeArray(incidents)
                  .slice(0, 6)
                  .map((incident) => (
                    <IncidentListItem
                      key={incident?._id || `${incident.latitude}-${incident.longitude}`}
                      incident={incident}
                    />
                  ))
              )}
            </View>

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

              <View style={styles.locationCaptureBox}>
                <View style={styles.locationCaptureHeader}>
                  <View style={styles.locationIconBadge}>
                    <Ionicons name="location-outline" size={17} color="#14532D" />
                  </View>
                  <View style={styles.locationCopy}>
                    <Text style={styles.locationTitle}>Incident location</Text>
                    <Text style={styles.locationHelp}>
                      Type the address, use your current location, or tap the map.
                    </Text>
                  </View>
                </View>

                <TextInput
                  style={[styles.input, styles.locationInput]}
                  placeholder="Incident Address"
                  value={incidentDraft.location}
                  onChangeText={(value) =>
                    setIncidentDraft((prev) => ({
                      ...prev,
                      location: sanitizeIncidentLocation(value),
                      latitude: null,
                      longitude: null,
                    }))
                  }
                  maxLength={INCIDENT_LOCATION_MAX_LENGTH}
                />

                <View style={styles.locationActionRow}>
                  <TouchableOpacity
                    style={[
                      styles.locationActionBtn,
                      incidentLocating && styles.disabledBtn,
                    ]}
                    disabled={incidentLocating}
                    onPress={useCurrentIncidentLocation}
                  >
                    <Ionicons name="navigate-outline" size={15} color="#14532D" />
                    <Text style={styles.locationActionText}>
                      {incidentLocating ? "Getting location..." : "Use My Current Location"}
                    </Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.locationStatusText}>
                  {selectedIncidentCoordinate
                    ? `Map point set: ${selectedIncidentCoordinate.latitude.toFixed(5)}, ${selectedIncidentCoordinate.longitude.toFixed(5)}`
                    : "No map point yet. A typed address can still be submitted."}
                </Text>
              </View>

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Notes"
                multiline
                value={incidentDraft.description}
                onChangeText={(value) =>
                  setIncidentDraft((prev) => ({
                    ...prev,
                    description: sanitizeIncidentDescription(value),
                  }))
                }
                maxLength={INCIDENT_DESCRIPTION_MAX_LENGTH}
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
              {!!incidentImageError && (
                <Text style={styles.validationText}>{incidentImageError}</Text>
              )}
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
          <ScrollView showsVerticalScrollIndicator={false}>
            <PanelHeader
              title="Flood Map"
              meta="Flood hazard overlay active"
              onBack={onBack}
            />
            <View style={styles.panelSection}>
              <Text style={styles.sectionLabel}>Visible layers</Text>
              <LegendRow color="#065F46" label="Municipal boundary" />
              <Text style={styles.panelNote}>
                Flood layers are isolated from incidents and routes to keep the
                hazard view readable.
              </Text>
            </View>

            <View style={styles.panelSection}>
              <Text style={styles.sectionLabel}>Flood level legend</Text>
              <View style={styles.floodLegendGrid}>
                {FLOOD_LEGEND_ITEMS.map((item) => (
                  <View key={item.key} style={styles.floodLegendItem}>
                    <View
                      style={[
                        styles.floodLegendSwatch,
                        { backgroundColor: item.color },
                      ]}
                    />
                    <Text style={styles.floodLegendText}>{item.label}</Text>
                  </View>
                ))}
              </View>
              <Text style={styles.panelNote}>
                Legend colors match the current flood overlay palette used on the map.
              </Text>
            </View>
          </ScrollView>
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
          <ScrollView showsVerticalScrollIndicator={false}>
            <PanelHeader
              title="Barangay Map"
              meta={`${barangayCount} barangay boundary records loaded`}
              onBack={onBack}
            />
            <View style={styles.panelSection}>
              <Text style={styles.sectionLabel}>Administrative layers</Text>
              <LegendRow color="#111827" label="Boundary lines" />
              <Text style={styles.panelNote}>
                Barangay boundaries are shown without incident or hazard clutter
                for clearer local review.
              </Text>
            </View>

            <View style={styles.panelSection}>
              <Text style={styles.sectionLabel}>Barangay color legend</Text>
              <View style={styles.barangayLegendGrid}>
                {barangayLegend.slice(0, 18).map((item, index) => (
                  <View key={`${item.label}-${index}`} style={styles.barangayLegendItem}>
                    <View
                      style={[
                        styles.barangayLegendSwatch,
                        { backgroundColor: item.color },
                      ]}
                    />
                    <Text style={styles.barangayLegendText} numberOfLines={1}>
                      {item.label}
                    </Text>
                  </View>
                ))}
              </View>
              {barangayLegend.length > 18 && (
                <Text style={styles.panelNote}>
                  Showing the first 18 barangay colors. Zoom the map for full boundary labels.
                </Text>
              )}
            </View>
          </ScrollView>
        )}

        {activeModule === "evac" && (
          <ScrollView showsVerticalScrollIndicator={false}>
            <PanelHeader
              title="Evac Place"
              meta="Evacuation centers and dynamic pathfinding"
              onBack={onBack}
            />

            <View style={styles.panelSection}>
              <Text style={styles.sectionLabel}>Availability overview</Text>
              <View style={styles.statusSummaryRow}>
                {evacStatusSummary.map((item) => {
                  const statusMeta = getEvacStatusCopy(item.key);
                  return (
                    <View
                      key={item.key}
                      style={[
                        styles.statusSummaryCard,
                        {
                          backgroundColor: statusMeta.tint,
                          borderColor: statusMeta.border,
                        },
                      ]}
                    >
                      <Text style={[styles.statusSummaryValue, { color: statusMeta.text }]}>
                        {item.count}
                      </Text>
                      <Text style={[styles.statusSummaryLabel, { color: statusMeta.text }]}>
                        {item.key}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </View>

            {!evac && (
              <>
                <Text style={styles.sectionLabel}>Evacuation places</Text>
                <View style={styles.listSection}>
                  {evacPlacesByStatus.limited.length > 0 && (
                    <View style={styles.evacSection}>
                      <Text style={styles.evacSectionTitle}>Limited capacity</Text>
                      {evacPlacesByStatus.limited.map(renderEvacCard)}
                    </View>
                  )}

                  {evacPlacesByStatus.full.length > 0 && (
                    <View style={styles.evacSection}>
                      <Text style={styles.evacSectionTitle}>Full capacity</Text>
                      {evacPlacesByStatus.full.map(renderEvacCard)}
                    </View>
                  )}

                  {evacPlacesByStatus.available.length > 0 && (
                    <View style={styles.evacSection}>
                      <Text style={styles.evacSectionTitle}>Available</Text>
                      {evacPlacesByStatus.available.map(renderEvacCard)}
                    </View>
                  )}

                  {evacPlacesByStatus.other.length > 0 && (
                    <View style={styles.evacSection}>
                      <Text style={styles.evacSectionTitle}>Other</Text>
                      {evacPlacesByStatus.other.map(renderEvacCard)}
                    </View>
                  )}
                </View>
              </>
            )}

            {evac && (
              <>
                <View
                  style={[
                    styles.selectedPlace,
                    {
                      borderColor: getEvacStatusCopy(evac.capacityStatus).border,
                      backgroundColor: getEvacStatusCopy(evac.capacityStatus).tint,
                    },
                  ]}
                >
                  <View style={styles.selectedHeader}>
                    <View
                      style={[
                        styles.evacIconBadgeLarge,
                        { backgroundColor: `${getEvacStatusColor(evac.capacityStatus)}18` },
                      ]}
                    >
                      <Text
                        style={[
                          styles.evacIconText,
                          { color: getEvacStatusColor(evac.capacityStatus) },
                        ]}
                      >
                        E
                      </Text>
                    </View>
                    <View style={styles.evacCardText}>
                      <Text style={styles.evacName}>
                        {safeDisplayText(evac?.name, "Evacuation center")}
                      </Text>
                      <Text style={styles.evacMeta}>
                        {evac.barangayName || evac.location || "Selected evacuation place"}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={[
                      styles.statusChip,
                      styles.selectedStatusChip,
                      {
                        backgroundColor: getEvacStatusCopy(evac.capacityStatus).tint,
                        borderColor: getEvacStatusCopy(evac.capacityStatus).border,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        { color: getEvacStatusCopy(evac.capacityStatus).text },
                      ]}
                    >
                      {getEvacStatusCopy(evac.capacityStatus).label}
                    </Text>
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
      </Animated.View>
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

  mapWeatherOverlay: {
    position: "absolute",
    top: Platform.OS === "ios" ? 132 : 102,
    left: 14,
    right: 14,
    zIndex: 2200,
    elevation: 2200,
    pointerEvents: "box-none",
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
    left: 6,
    right: 6,
    bottom: 10,
    zIndex: 1000,
    elevation: 1000,
    pointerEvents: "box-none",
  },

  panel: {
    maxHeight: 492,
    backgroundColor: "rgba(255,255,255,0.99)",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(220,231,225,0.95)",
    shadowColor: "#0f2319",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 22,
    elevation: 16,
    overflow: "hidden",
  },

  dragZone: {
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    marginHorizontal: -16,
    marginBottom: 2,
  },

  handle: {
    width: 48,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#cbd5ce",
    alignSelf: "center",
  },

  panelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#e8f0eb",
  },

  panelBack: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#dce7e1",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f4faf6",
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
    fontSize: 20,
    fontWeight: "900",
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
    backgroundColor: "#fbfdfc",
    borderRadius: 14,
    marginBottom: 10,
  },

  input: {
    borderWidth: 1,
    borderColor: "#dce7e1",
    borderRadius: 14,
    padding: 12,
    backgroundColor: "#fbfdfc",
    marginBottom: 10,
    fontSize: 14,
  },

  textArea: {
    minHeight: 76,
    textAlignVertical: "top",
  },

  locationCaptureBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#dce7e1",
    backgroundColor: "#ffffff",
    padding: 12,
    marginBottom: 10,
  },

  locationCaptureHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },

  locationIconBadge: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7F5ED",
    borderWidth: 1,
    borderColor: "#CFE5D4",
    marginRight: 10,
  },

  locationCopy: {
    flex: 1,
  },

  locationTitle: {
    color: "#10251B",
    fontSize: 13,
    fontWeight: "900",
  },

  locationHelp: {
    marginTop: 3,
    color: "#647067",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
  },

  locationInput: {
    marginBottom: 8,
  },

  locationActionRow: {
    flexDirection: "row",
    marginBottom: 8,
  },

  locationActionBtn: {
    minHeight: 40,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 13,
    paddingHorizontal: 12,
    backgroundColor: "#E7F5ED",
    borderWidth: 1,
    borderColor: "#CFE5D4",
  },

  locationActionText: {
    marginLeft: 7,
    color: "#14532D",
    fontSize: 12,
    fontWeight: "900",
  },

  locationStatusText: {
    color: "#647067",
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "700",
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

  validationText: {
    marginTop: -2,
    marginBottom: 4,
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: "800",
  },

  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#edf2ef",
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

  floodLegendGrid: {
    gap: 8,
  },

  floodLegendItem: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#edf2ef",
    paddingHorizontal: 10,
    paddingVertical: 8,
  },

  floodLegendSwatch: {
    width: 18,
    height: 18,
    borderRadius: 5,
    marginRight: 10,
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.14)",
  },

  floodLegendText: {
    flex: 1,
    color: "#374151",
    fontSize: 12,
    fontWeight: "800",
  },

  evacMarkerShell: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 44,
    overflow: "visible",
  },

  evacMarkerLabelWrap: {
    marginBottom: 6,
    maxWidth: 160,
    overflow: "visible",
  },

  evacMarkerLabel: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderWidth: 1,
    borderColor: "rgba(15,23,42,0.08)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },

  evacMarkerLabelText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#14532D",
  },

  evacMarkerPin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 2.5,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.16,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },

  evacMarkerPinSelected: {
    transform: [{ scale: 1.08 }],
  },

  evacMarkerCore: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  evacMarkerPointer: {
    marginTop: -2,
    width: 0,
    height: 0,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
  },

barangayMarkerShell: {
  minWidth: 110,
  maxWidth: 176,
  alignItems: "center",
  justifyContent: "center",
  overflow: "visible",
},

barangayMarker: {
  minHeight: 38,
  maxWidth: 176,
  paddingLeft: 8,
  paddingRight: 10,
  paddingVertical: 7,
  borderRadius: 999,
  backgroundColor: "rgba(255,255,255,0.97)",
  borderWidth: 1,
  flexDirection: "row",
  alignItems: "center",
  shadowColor: "#000",
  shadowOpacity: 0.14,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
  elevation: 4,
},

barangayMarkerSelected: {
  backgroundColor: "#FFFFFF",
  borderWidth: 1.5,
  shadowOpacity: 0.2,
  shadowRadius: 8,
  elevation: 6,
},

barangayMarkerIcon: {
  width: 18,
  height: 18,
  borderRadius: 9,
  alignItems: "center",
  justifyContent: "center",
  marginRight: 6,
  borderWidth: 1,
  flexShrink: 0,
},

barangayMarkerDot: {
  width: 8,
  height: 8,
  borderRadius: 4,
},

barangayMarkerText: {
  flex: 1,
  minWidth: 0,
  fontSize: 11,
  lineHeight: 13,
  fontWeight: "800",
  color: "#1F2937",
},

barangayMarkerTextSelected: {
  color: "#111827",
},

barangayIncidentBadge: {
  minWidth: 18,
  height: 18,
  paddingHorizontal: 4,
  borderRadius: 9,
  backgroundColor: "#14532D",
  marginLeft: 6,
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
},

barangayIncidentBadgeText: {
  color: "#FFFFFF",
  fontSize: 10,
  fontWeight: "900",
},

  barangayLegendGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  barangayLegendItem: {
    width: "48%",
    minHeight: 32,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#edf2ef",
    paddingHorizontal: 8,
  },

  barangayLegendSwatch: {
    width: 13,
    height: 13,
    borderRadius: 4,
    marginRight: 8,
    borderWidth: 1,
    borderColor: "rgba(17,24,39,0.18)",
  },

  barangayLegendText: {
    flex: 1,
    color: "#374151",
    fontSize: 11,
    fontWeight: "800",
  },

  panelNote: {
    marginTop: 4,
    color: "#526158",
    lineHeight: 20,
    fontWeight: "600",
  },

  panelSection: {
    backgroundColor: "#f6faf8",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e3ece7",
    padding: 14,
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
    backgroundColor: "#f6faf8",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#e3ece7",
    padding: 9,
    marginBottom: 12,
  },

  evacSection: {
    marginBottom: 8,
  },

  evacSectionTitle: {
    marginBottom: 8,
    color: "#516353",
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  evacCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#edf2ef",
    backgroundColor: "#ffffff",
    marginBottom: 8,
    shadowColor: "#0f2319",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
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
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#d1fae5",
    backgroundColor: "#f0fdf4",
    padding: 15,
    marginBottom: 12,
    shadowColor: "#14532d",
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },

  selectedHeader: {
    flexDirection: "row",
    alignItems: "center",
  },

  statusSummaryRow: {
    flexDirection: "row",
    gap: 8,
  },

  statusSummaryCard: {
    flex: 1,
    minHeight: 70,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    justifyContent: "center",
  },

  statusSummaryValue: {
    fontSize: 20,
    fontWeight: "900",
  },

  statusSummaryLabel: {
    marginTop: 3,
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
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

  selectedStatusChip: {
    alignSelf: "flex-start",
    marginTop: 12,
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

  incidentBarangayHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },

  incidentBarangayIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFF8D8",
    borderWidth: 1,
    borderColor: "#FACC15",
    marginRight: 10,
  },

  incidentBarangayCopy: {
    flex: 1,
  },

  clearBarangayBtn: {
    marginTop: 12,
    minHeight: 38,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#E7F5ED",
    borderWidth: 1,
    borderColor: "#CFE5D4",
  },

  clearBarangayText: {
    color: "#14532D",
    fontSize: 12,
    fontWeight: "900",
  },

  incidentListItem: {
    minHeight: 78,
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#edf2ef",
    padding: 12,
    marginBottom: 8,
  },

  incidentSeverityDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
    marginRight: 10,
  },

  incidentListCopy: {
    flex: 1,
    minWidth: 0,
  },

  incidentListTitle: {
    color: "#10251B",
    fontSize: 13,
    fontWeight: "900",
    textTransform: "capitalize",
  },

  incidentListMeta: {
    marginTop: 3,
    color: "#516353",
    fontSize: 11,
    fontWeight: "800",
  },

  incidentListDescription: {
    marginTop: 5,
    color: "#647067",
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "600",
  },

  incidentLevelChip: {
    marginLeft: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 3,
    backgroundColor: "#FFFBEB",
  },

  incidentLevelText: {
    fontSize: 9,
    fontWeight: "900",
  },

  emptyIncidentState: {
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#edf2ef",
    padding: 18,
  },

  emptyIncidentTitle: {
    marginTop: 8,
    color: "#10251B",
    fontSize: 13,
    fontWeight: "900",
  },

  emptyIncidentText: {
    marginTop: 4,
    color: "#647067",
    textAlign: "center",
    fontSize: 11,
    lineHeight: 16,
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
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e3ece7",
    backgroundColor: "#ffffff",
    marginBottom: 8,
    shadowColor: "#0f2319",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
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