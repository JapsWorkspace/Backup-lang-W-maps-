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
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import MapView, { Marker, Polygon, PROVIDER_GOOGLE } from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";

import api from "../lib/api";
import { UserContext } from "./UserContext";
import { NotificationContext } from "./contexts/NotificationContext";
import jaenGeoJSON from "./data/jaen.json";
import { isPointInsideJaen } from "./utils/jaenBounds";
import {
  normalizeCoordinate,
  sanitizeConnectionCode,
  safeDisplayText,
} from "./utils/validation";

const BASE_URL = "http://192.168.1.4:8000";
const DEFAULT_AVATAR =
  "https://ui-avatars.com/api/?background=365314&color=fff&rounded=true&name=User";
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const JAEN_INITIAL_REGION = {
  latitude: 15.32,
  longitude: 120.92,
  latitudeDelta: 0.12,
  longitudeDelta: 0.12,
};

const OUTSIDE_JAEN_MASK = [
  { latitude: 16.2, longitude: 119.8 },
  { latitude: 16.2, longitude: 122.0 },
  { latitude: 14.4, longitude: 122.0 },
  { latitude: 14.4, longitude: 119.8 },
];

const safeArray = (value) => (Array.isArray(value) ? value : []);
const hasCoords = (location) =>
  typeof location?.lat === "number" && typeof location?.lng === "number";

const toCoords = (ring) =>
  safeArray(ring)
    .filter((point) => Array.isArray(point) && point.length >= 2)
    .map(([lng, lat]) => ({
      latitude: Number(lat),
      longitude: Number(lng),
    }))
    .filter((point) => !Number.isNaN(point.latitude) && !Number.isNaN(point.longitude));

const getBoundaryHoles = (data) =>
  safeArray(data?.features).flatMap((feature) => {
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

const renderBoundary = (data, strokeColor, strokeWidth, fillColor) =>
  safeArray(data?.features).flatMap((feature, index) => {
    const geom = feature?.geometry;
    if (!geom?.coordinates) return [];

    const polygons =
      geom.type === "Polygon"
        ? [geom.coordinates]
        : geom.type === "MultiPolygon"
          ? geom.coordinates
          : [];

    return polygons.flatMap((poly, polyIndex) => {
      const coords = toCoords(poly?.[0]);
      if (!coords.length) return [];

      return [
        <Polygon
          key={`jaen-boundary-${index}-${polyIndex}`}
          coordinates={coords}
          strokeColor={strokeColor}
          strokeWidth={strokeWidth}
          fillColor={fillColor}
        />,
      ];
    });
  });

const getBoundsFromData = (data) => {
  const coords = safeArray(data?.features).flatMap((feature) => {
    const geom = feature?.geometry;
    if (!geom?.coordinates) return [];

    const polygons =
      geom.type === "Polygon"
        ? [geom.coordinates]
        : geom.type === "MultiPolygon"
          ? geom.coordinates
          : [];

    return polygons.flatMap((poly) => toCoords(poly?.[0]));
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
};

const clamp = (value, min, max) => {
  if (min > max) return (min + max) / 2;
  return Math.max(min, Math.min(max, value));
};

const timeAgo = (date) => {
  if (!date) return "Last update unavailable";
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return "Last updated just now";
  if (mins < 60) return `Last updated ${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Last updated ${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  return `Last updated ${days} day ago`;
};

const getSafetyColor = (status) => {
  if (status === "SAFE") return "#2F855A";
  if (status === "NOT_SAFE") return "#B91C1C";
  return "#A16207";
};

const getSafetyLabel = (status) => {
  if (status === "SAFE") return "Safe";
  if (status === "NOT_SAFE") return "Not Safe";
  return "Unknown";
};

function resolveAvatarPath(avatar) {
  if (!avatar) return DEFAULT_AVATAR;
  if (avatar.startsWith("http")) return avatar;
  return `${BASE_URL}${avatar}`;
}

function normalizeConnection(connection, currentUserId) {
  if (!connection?._id) return null;

  const creatorId = connection?.creator?._id || connection?.creator || null;

  const members = safeArray(connection.members)
    .filter((member) => member?._id)
    .map((member) => ({
      id: member._id,
      name:
        [member?.fname, member?.lname].filter(Boolean).join(" ").trim() ||
        safeDisplayText(member.username, "Unknown member"),
      username: safeDisplayText(member.username, "Unknown member"),
      avatar: resolveAvatarPath(member.avatar),
      safetyStatus: member.safetyStatus || "UNKNOWN",
      safetyLabel: getSafetyLabel(member.safetyStatus),
      safetyColor: getSafetyColor(member.safetyStatus),
      updatedLabel: timeAgo(member?.location?.updatedAt),
      location: hasCoords(member.location)
        ? { latitude: member.location.lat, longitude: member.location.lng }
        : null,
      insideJaen: hasCoords(member.location)
        ? isPointInsideJaen(member.location.lat, member.location.lng)
        : false,
      canKick: creatorId === currentUserId && member._id !== currentUserId,
    }));

  const pendingMembers = safeArray(connection.pendingMembers)
    .filter((member) => member?._id)
    .map((member) => ({
      id: member._id,
      name:
        [member?.fname, member?.lname].filter(Boolean).join(" ").trim() ||
        safeDisplayText(member.username, "Unknown member"),
      username: safeDisplayText(member.username, "Unknown member"),
      avatar: resolveAvatarPath(member.avatar),
    }));

  return {
    id: connection._id,
    code: safeDisplayText(connection.code, "No code"),
    isCreator: creatorId === currentUserId,
    members,
    pendingMembers,
  };
}

function MetricCard({ label, value, tone = "neutral" }) {
  return (
    <View
      style={[
        styles.metricCard,
        tone === "safe" && styles.metricCardSafe,
        tone === "danger" && styles.metricCardDanger,
      ]}
    >
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

export default function SafetyMark() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useContext(UserContext);
  const { refreshNotifications, notificationsVersion } = useContext(NotificationContext);
  const mapRef = useRef(null);
  const isClampingRegionRef = useRef(false);

  const [connections, setConnections] = useState([]);
  const [joinCode, setJoinCode] = useState("");
  const [selectedConnectionId, setSelectedConnectionId] = useState(null);
  const [activeTab, setActiveTab] = useState("status");
  const [localSafetyStatus, setLocalSafetyStatus] = useState(
    user?.safetyStatus || "SAFE"
  );
  const [loading, setLoading] = useState(false);
  const [joinRequestModalVisible, setJoinRequestModalVisible] = useState(false);
  const [joinRequestModalMessage, setJoinRequestModalMessage] = useState(
    "Wait for the approval of the admin."
  );

  const panelExpandedTop = SCREEN_HEIGHT * 0.44;
  const panelCollapsedTop = SCREEN_HEIGHT * 0.74;
  const panelTop = useRef(new Animated.Value(panelCollapsedTop)).current;
  const panelTopValue = useRef(panelCollapsedTop);
  const dragStartTop = useRef(panelCollapsedTop);

  useEffect(() => {
    const id = panelTop.addListener(({ value }) => {
      panelTopValue.current = value;
    });
    return () => panelTop.removeListener(id);
  }, [panelTop]);

  const snapPanel = useCallback(
    (toValue) => {
      Animated.spring(panelTop, {
        toValue,
        useNativeDriver: false,
        damping: 24,
        stiffness: 180,
        mass: 0.8,
      }).start();
    },
    [panelTop]
  );

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 6,
      onPanResponderGrant: () => {
        panelTop.stopAnimation((value) => {
          panelTopValue.current = value;
          dragStartTop.current = value;
        });
      },
      onPanResponderMove: (_, g) => {
        const nextTop = clamp(
          dragStartTop.current + g.dy,
          panelExpandedTop,
          panelCollapsedTop
        );
        panelTopValue.current = nextTop;
        panelTop.setValue(nextTop);
      },
      onPanResponderRelease: (_, g) => {
        const currentTop = clamp(
          dragStartTop.current + g.dy,
          panelExpandedTop,
          panelCollapsedTop
        );
        panelTopValue.current = currentTop;
        panelTop.setValue(currentTop);
      },
      onPanResponderTerminate: () => {
        const currentTop = clamp(panelTopValue.current, panelExpandedTop, panelCollapsedTop);
        panelTopValue.current = currentTop;
        panelTop.setValue(currentTop);
      },
    })
  ).current;

  useEffect(() => {
    setLocalSafetyStatus(user?.safetyStatus || "SAFE");
  }, [user?.safetyStatus]);

  useEffect(() => {
    const initialTab = route?.params?.initialTab;
    const targetConnectionId = route?.params?.connectionId;
    const shouldOpenPendingRequests = Boolean(route?.params?.openPendingRequests);
    const notificationId = route?.params?.notificationId;

    if (!initialTab && !targetConnectionId && !shouldOpenPendingRequests && !notificationId) {
      return;
    }

    if (initialTab) {
      setActiveTab(initialTab);
    }

    if (targetConnectionId) {
      setSelectedConnectionId(targetConnectionId);
    }

    snapPanel(panelExpandedTop);

    navigation.setParams({
      initialTab: undefined,
      connectionId: undefined,
      openPendingRequests: undefined,
      notificationId: undefined,
    });
  }, [
    navigation,
    panelExpandedTop,
    route?.params?.connectionId,
    route?.params?.initialTab,
    route?.params?.notificationId,
    route?.params?.openPendingRequests,
    snapPanel,
  ]);

  const fetchConnections = useCallback(async () => {
    if (!user?._id) {
      setConnections([]);
      return;
    }

    const res = await api.get(`/connection/user/${user._id}`);
    setConnections(
      safeArray(res.data)
        .map((item) => normalizeConnection(item, user._id))
        .filter(Boolean)
    );
  }, [user?._id]);

  const refreshAll = useCallback(async () => {
    if (!user?._id) return;
    setLoading(true);
    try {
      await fetchConnections();
    } catch (err) {
      console.log("[SafetyMark] refresh failed:", err?.message);
    } finally {
      setLoading(false);
    }
  }, [fetchConnections, user?._id]);

  useFocusEffect(
    useCallback(() => {
      refreshAll();
    }, [refreshAll])
  );

  useEffect(() => {
    if (!user?._id) return;
    refreshAll();
  }, [notificationsVersion, refreshAll, user?._id]);

  const selectedConnection =
    connections.find((item) => item.id === selectedConnectionId) || connections[0] || null;

  useEffect(() => {
    if (!connections.length) {
      setSelectedConnectionId(null);
      return;
    }

    if (!selectedConnectionId || !connections.some((item) => item.id === selectedConnectionId)) {
      setSelectedConnectionId(connections[0].id);
    }
  }, [connections, selectedConnectionId]);

  const pendingRequests = useMemo(
    () =>
      connections.flatMap((connection) =>
        connection.isCreator
          ? connection.pendingMembers.map((member) => ({
              connectionId: connection.id,
              connectionCode: connection.code,
              member,
            }))
          : []
      ),
    [connections]
  );

  const allPeople = useMemo(() => {
    const seen = new Map();

    connections.forEach((connection) => {
      connection.members.forEach((member) => {
        if (!seen.has(member.id)) {
          seen.set(member.id, {
            ...member,
            connectionCodes: [connection.code],
          });
        } else {
          seen.get(member.id).connectionCodes.push(connection.code);
        }
      });
    });

    return Array.from(seen.values());
  }, [connections]);

  const memberCount = useMemo(() => {
    const ids = new Set([user?._id].filter(Boolean));
    allPeople.forEach((member) => ids.add(member.id));
    return ids.size;
  }, [allPeople, user?._id]);

  const safeCount = useMemo(() => {
    const others = allPeople.filter(
      (member) => member.id !== user?._id && member.safetyStatus === "SAFE"
    ).length;
    return others + (localSafetyStatus === "SAFE" ? 1 : 0);
  }, [allPeople, localSafetyStatus, user?._id]);

  const notSafeCount = useMemo(() => {
    const others = allPeople.filter(
      (member) => member.id !== user?._id && member.safetyStatus === "NOT_SAFE"
    ).length;
    return others + (localSafetyStatus === "NOT_SAFE" ? 1 : 0);
  }, [allPeople, localSafetyStatus, user?._id]);

  const jaenBoundary = useMemo(
    () => renderBoundary(jaenGeoJSON, "#365314", 2.2, "transparent"),
    []
  );

  const jaenFocusMask = useMemo(() => {
    const holes = getBoundaryHoles(jaenGeoJSON);
    return (
      <Polygon
        coordinates={OUTSIDE_JAEN_MASK}
        holes={holes}
        strokeColor="rgba(15,23,42,0)"
        fillColor="rgba(15,23,42,0.26)"
      />
    );
  }, []);

  const jaenBounds = useMemo(() => getBoundsFromData(jaenGeoJSON), []);

  const visibleMembersOnMap = useMemo(() => {
    const insideMembers = allPeople
      .map((member) => {
        const coordinate = normalizeCoordinate(member.location);
        if (!coordinate || !member.insideJaen) return null;

        return {
          ...member,
          coordinate,
        };
      })
      .filter(Boolean);
    if (insideMembers.length) return insideMembers;

    const userCoordinate = normalizeCoordinate(user?.location);
    if (
      userCoordinate &&
      isPointInsideJaen(userCoordinate.latitude, userCoordinate.longitude)
    ) {
      return [
        {
          id: user._id || "me",
          username: user?.username || "You",
          safetyColor: getSafetyColor(localSafetyStatus),
          safetyLabel: getSafetyLabel(localSafetyStatus),
          coordinate: userCoordinate,
        },
      ];
    }

    return [];
  }, [allPeople, localSafetyStatus, user]);

  const outsideCount = useMemo(
    () => allPeople.filter((member) => member.location && !member.insideJaen).length,
    [allPeople]
  );

  const selectedConnectionMembers = useMemo(
    () => safeArray(selectedConnection?.members),
    [selectedConnection]
  );

  const activeTabMeta = useMemo(() => {
    if (activeTab === "manage") {
      return {
        title: "Manage Connections",
        subtitle: "Switch groups, handle requests, and manage membership.",
      };
    }

    if (activeTab === "join") {
      return {
        title: "Join or Create",
        subtitle: "Use a code to join another group or start a new one.",
      };
    }

    return {
      title: selectedConnection ? `Connection ${selectedConnection.code}` : "Connection Status",
      subtitle: selectedConnection
        ? `${selectedConnectionMembers.length} members in this group`
        : "Choose a group to inspect safety updates.",
    };
  }, [activeTab, selectedConnection, selectedConnectionMembers.length]);

  const handleRegionChangeComplete = useCallback(
    (region) => {
      if (isClampingRegionRef.current) {
        isClampingRegionRef.current = false;
        return;
      }

      const latitudeDelta = Math.min(region.latitudeDelta, JAEN_INITIAL_REGION.latitudeDelta);
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
          140
        );
      }
    },
    [jaenBounds]
  );

  const handleCreateConnection = async () => {
    if (!user?._id) return;

    try {
      const res = await api.post(`/connection/create/${user._id}`);
      await refreshAll();
      await refreshNotifications();
      Alert.alert(
        "Connection Created",
        res?.data?.code
          ? `Connection code: ${res.data.code}`
          : res?.data?.message || "Connection created successfully."
      );
    } catch (err) {
      Alert.alert("Error", err?.response?.data?.message || "Failed to create connection.");
    }
  };

  const handleJoinConnection = async () => {
    if (!user?._id) return;
    const code = sanitizeConnectionCode(joinCode);

    if (!code || code.length < 4) {
      Alert.alert("Missing Info", "Enter a connection code.");
      return;
    }

    try {
      const res = await api.post(`/connection/join/${user._id}`, {
        code,
      });
      setJoinCode("");
      await refreshAll();
      await refreshNotifications();
      setJoinRequestModalMessage(
        res?.data?.message || "Wait for the approval of the admin."
      );
      setJoinRequestModalVisible(true);
    } catch (err) {
      const message =
        err?.response?.data?.message || "Invalid or expired connection code.";

      if (
        message === "Your join request is already pending approval." ||
        message === "You are already a member of this connection."
      ) {
        setJoinRequestModalMessage(message);
        setJoinRequestModalVisible(true);
        await refreshAll();
        await refreshNotifications();
        return;
      }

      Alert.alert(
        "Join Failed",
        message
      );
    }
  };

  const handleSafetyUpdate = async (nextStatus, endpoint, errorMessage) => {
    if (!user?._id) return;

    const previousStatus = localSafetyStatus;
    setLocalSafetyStatus(nextStatus);

    try {
      await api.put(endpoint, {
        message: nextStatus === "SAFE" ? "I am safe" : "Need help",
      });
      await refreshAll();
      await refreshNotifications();
    } catch (err) {
      setLocalSafetyStatus(previousStatus);
      Alert.alert("Error", errorMessage);
    }
  };

  const handleLeaveConnection = async (connectionId) => {
    if (!user?._id) return;
    try {
      const res = await api.delete(`/connection/leave/${user._id}/${connectionId}`);
      await refreshAll();
      await refreshNotifications();
      Alert.alert("Connection Updated", res?.data?.message || "You left the connection.");
    } catch (err) {
      Alert.alert("Error", "Failed to leave connection.");
    }
  };

  const handleDeleteConnection = (connectionId) => {
    if (!user?._id) return;

    Alert.alert(
      "Delete Connection",
      "This will permanently remove the connection and all members.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const res = await api.delete(`/connection/delete/${connectionId}/${user._id}`);
              await refreshAll();
              await refreshNotifications();
              Alert.alert(
                "Connection Deleted",
                res?.data?.message || "Connection deleted successfully."
              );
            } catch (err) {
              Alert.alert("Error", "Failed to delete connection.");
            }
          },
        },
      ]
    );
  };

  const handleKickMember = (connectionId, memberId, username) => {
    if (!user?._id) return;

    Alert.alert("Remove Member", `Remove ${username} from this connection?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Kick",
        style: "destructive",
        onPress: async () => {
          try {
            const res = await api.put(`/connection/kick/${connectionId}/${memberId}/${user._id}`);
            await refreshAll();
            await refreshNotifications();
            Alert.alert(
              "Member Removed",
              res?.data?.message || "Member has been removed from the connection."
            );
          } catch (err) {
            Alert.alert("Error", "Failed to remove member.");
          }
        },
      },
    ]);
  };

  const handleApproveRequest = async (connectionId, memberId) => {
    if (!user?._id) return;
    try {
      const res = await api.put(`/connection/approve/${connectionId}/${memberId}/${user._id}`);
      await refreshAll();
      await refreshNotifications();
      Alert.alert("Request Approved", res?.data?.message || "Member approved.");
    } catch (err) {
      Alert.alert("Error", err?.response?.data?.message || "Failed to approve request.");
    }
  };

  const handleRejectRequest = async (connectionId, memberId) => {
    if (!user?._id) return;
    try {
      const res = await api.put(`/connection/reject/${connectionId}/${memberId}/${user._id}`);
      await refreshAll();
      await refreshNotifications();
      Alert.alert("Request Rejected", res?.data?.message || "Member rejected.");
    } catch (err) {
      Alert.alert("Error", err?.response?.data?.message || "Failed to reject request.");
    }
  };

  return (
    <View style={styles.screen}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={JAEN_INITIAL_REGION}
        minZoomLevel={11}
        toolbarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        showsCompass={false}
        onRegionChangeComplete={handleRegionChangeComplete}
      >
        {jaenFocusMask}
        {jaenBoundary}
        {visibleMembersOnMap.map((member) => (
          member.coordinate ? (
            <Marker
              key={member.id}
              coordinate={member.coordinate}
              title={member.username}
              description={member.safetyLabel}
              pinColor={member.safetyColor}
            />
          ) : null
        ))}
      </MapView>

      <View style={styles.mapLegend}>
        <View style={styles.legendBadge}>
          <Text style={styles.legendBadgeText}>Jaen Safety Map</Text>
        </View>
        <Text style={styles.legendNote}>
          {outsideCount > 0 ? `${outsideCount} outside Jaen` : "Inside-Jaen markers only"}
        </Text>
      </View>

      <View style={styles.panelLayer} pointerEvents="box-none">
        <Animated.View style={[styles.floatingTabWrap, { top: Animated.add(panelTop, -76) }]}>
          <View style={styles.floatingTabRow}>
            <Pressable
              style={[styles.floatingTabButton, activeTab === "status" && styles.floatingTabButtonActive]}
              onPress={() => setActiveTab("status")}
            >
              <Ionicons
                name="people-outline"
                size={16}
                color={activeTab === "status" ? "#FFFFFF" : "#516353"}
              />
              <Text
                style={[
                  styles.floatingTabText,
                  activeTab === "status" && styles.floatingTabTextActive,
                ]}
              >
                Status
              </Text>
            </Pressable>

            <Pressable
              style={[styles.floatingTabButton, activeTab === "manage" && styles.floatingTabButtonActive]}
              onPress={() => setActiveTab("manage")}
            >
              <Ionicons
                name="git-network-outline"
                size={16}
                color={activeTab === "manage" ? "#FFFFFF" : "#516353"}
              />
              <Text
                style={[
                  styles.floatingTabText,
                  activeTab === "manage" && styles.floatingTabTextActive,
                ]}
              >
                Manage
              </Text>
            </Pressable>

            <Pressable
              style={[styles.floatingTabButton, activeTab === "join" && styles.floatingTabButtonActive]}
              onPress={() => setActiveTab("join")}
            >
              <Ionicons
                name="add-circle-outline"
                size={16}
                color={activeTab === "join" ? "#FFFFFF" : "#516353"}
              />
              <Text
                style={[
                  styles.floatingTabText,
                  activeTab === "join" && styles.floatingTabTextActive,
                ]}
              >
                Join + Create
              </Text>
            </Pressable>
          </View>
        </Animated.View>

        <Animated.View style={[styles.panel, { top: panelTop }]}>
          <View style={styles.panelDragZone} {...panResponder.panHandlers}>
            <View style={styles.dragHandleWrap}>
              <View style={styles.dragHandle} />
            </View>

            <View style={styles.sheetIntro}>
              <View style={styles.sheetIntroCopy}>
                <Text style={styles.sheetIntroTitle}>{activeTabMeta.title}</Text>
                <Text style={styles.sheetIntroSubtitle}>{activeTabMeta.subtitle}</Text>
              </View>
              <View
                style={[
                  styles.sheetIntroChip,
                  { backgroundColor: `${getSafetyColor(localSafetyStatus)}18` },
                ]}
              >
                <Text
                  style={[
                    styles.sheetIntroChipText,
                    { color: getSafetyColor(localSafetyStatus) },
                  ]}
                >
                  {getSafetyLabel(localSafetyStatus)}
                </Text>
              </View>
            </View>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.panelContent}
          >
            <View style={styles.profileCard}>
              <Image
                source={{ uri: resolveAvatarPath(user?.avatar) }}
                style={styles.profileAvatar}
              />
              <View style={styles.profileCopy}>
                <Text style={styles.profileName}>{user?.username || "Resident"}</Text>
                <Text style={styles.profileMeta}>
                  {connections.length} connection{connections.length === 1 ? "" : "s"}
                </Text>
              </View>
              <View
                style={[
                  styles.profileStatus,
                  { backgroundColor: `${getSafetyColor(localSafetyStatus)}18` },
                ]}
              >
                <Text
                  style={[
                    styles.profileStatusText,
                    { color: getSafetyColor(localSafetyStatus) },
                  ]}
                >
                  {getSafetyLabel(localSafetyStatus)}
                </Text>
              </View>
            </View>

            <View style={styles.metricsRow}>
              <MetricCard label="Members" value={memberCount} />
              <MetricCard label="Safe" value={safeCount} tone="safe" />
              <MetricCard label="Not Safe" value={notSafeCount} tone="danger" />
            </View>

            {activeTab === "status" && (
              <View style={styles.section}>
                {connections.length === 0 ? (
                  <View style={styles.emptyStateCard}>
                    <Text style={styles.emptyStateTitle}>No active connections yet</Text>
                    <Text style={styles.emptyText}>
                      Join or create a group to start seeing your people here.
                    </Text>
                  </View>
                ) : (
                  <>
                    <View style={styles.pickerShell}>
                      <Picker
                        selectedValue={selectedConnection?.id || ""}
                        onValueChange={(value) => setSelectedConnectionId(value)}
                        style={styles.picker}
                        dropdownIconColor="#365314"
                      >
                        {connections.map((connection) => (
                          <Picker.Item
                            key={connection.id}
                            label={`Connection ${connection.code}`}
                            value={connection.id}
                          />
                        ))}
                      </Picker>
                    </View>

                    <View style={styles.statusSummary}>
                      <View style={styles.statusSummaryTop}>
                        <Text style={styles.statusSummaryEyebrow}>Selected group</Text>
                        <View style={styles.statusSummaryCount}>
                          <Text style={styles.statusSummaryCountValue}>
                            {selectedConnectionMembers.length}
                          </Text>
                          <Text style={styles.statusSummaryCountLabel}>people</Text>
                        </View>
                      </View>
                      <Text style={styles.statusSummaryTitle}>
                        {selectedConnection?.code || "Connection"}
                      </Text>
                      <Text style={styles.statusSummaryMeta}>
                        {selectedConnectionMembers.length} members in this group
                      </Text>
                    </View>

                    <View style={styles.memberListCard}>
                      <View style={styles.listSectionHeader}>
                        <Text style={styles.listSectionTitle}>People in this group</Text>
                        <Text style={styles.listSectionMeta}>
                          Live safety and location updates
                        </Text>
                      </View>
                      {selectedConnectionMembers.map((member) => (
                        <View key={member.id} style={styles.personRow}>
                          <View style={styles.personCopy}>
                            <Text style={styles.personName}>{member.username}</Text>
                            <View style={styles.personStatusRow}>
                              <View
                                style={[
                                  styles.personStatusDotInline,
                                  { backgroundColor: member.safetyColor },
                                ]}
                              />
                              <View style={styles.personStatus}>
                                <Text
                                  style={[styles.personStatusText, { color: member.safetyColor }]}
                                >
                                  {member.safetyLabel}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.personMeta}>
                              {member.insideJaen || !member.location
                                ? member.updatedLabel
                                : "Outside the boundary of Jaen"}
                            </Text>
                          </View>
                          <View style={styles.personAvatarWrap}>
                            <Image source={{ uri: member.avatar }} style={styles.personAvatar} />
                            <View
                              style={[
                                styles.personAvatarDot,
                                { backgroundColor: member.safetyColor },
                              ]}
                            />
                          </View>
                        </View>
                      ))}
                    </View>

                    <View style={styles.safetyPanel}>
                      <View style={styles.safetyPanelHeader}>
                        <Text style={styles.safetyPanelTitle}>Update your status</Text>
                        <Text style={styles.safetyPanelSubtitle}>
                          Let your connection know how you are doing right now.
                        </Text>
                      </View>
                      <View style={styles.safetyActions}>
                        <Pressable
                          style={styles.safeButton}
                          onPress={() =>
                            handleSafetyUpdate(
                              "SAFE",
                              `/connection/safe/${user?._id}`,
                              "Failed to mark SAFE."
                            )
                          }
                        >
                          <Text style={styles.safeButtonText}>SAFE</Text>
                        </Pressable>
                        <Pressable
                          style={styles.notSafeButton}
                          onPress={() =>
                            handleSafetyUpdate(
                              "NOT_SAFE",
                              `/connection/not-safe/${user?._id}`,
                              "Failed to mark NOT SAFE."
                            )
                          }
                        >
                          <Text style={styles.notSafeButtonText}>UNSAFE</Text>
                        </Pressable>
                      </View>
                    </View>
                  </>
                )}
              </View>
            )}

            {activeTab === "manage" && (
              <View style={styles.section}>
                <View style={styles.sectionLead}>
                  <Text style={styles.sectionTitle}>Manage Connections</Text>
                  <Text style={styles.sectionHint}>
                    Browse your groups and manage leave or delete actions.
                  </Text>
                </View>

                {connections.length === 0 ? (
                  <View style={styles.emptyStateCard}>
                    <Text style={styles.emptyStateTitle}>No active connections yet</Text>
                    <Text style={styles.emptyText}>
                      Your connection list will appear here once you join or create one.
                    </Text>
                  </View>
                ) : (
                  connections.map((connection) => {
                    const active = selectedConnection?.id === connection.id;
                    return (
                      <View key={connection.id} style={styles.connectionCard}>
                        <View style={styles.connectionCardHead}>
                          <View style={styles.connectionCardCopy}>
                            <Text style={styles.connectionCardTitle}>
                              Connection {connection.code}
                            </Text>
                            <Text style={styles.connectionCardMeta}>
                              {connection.members.length} members
                            </Text>
                          </View>
                          {active && (
                            <View style={styles.currentChip}>
                              <Text style={styles.currentChipText}>Current</Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.connectionCardActions}>
                          <Pressable
                            style={styles.connectionActionPrimary}
                            onPress={() => {
                              setSelectedConnectionId(connection.id);
                              setActiveTab("status");
                            }}
                          >
                            <Text style={styles.connectionActionPrimaryText}>View</Text>
                          </Pressable>

                          {connection.isCreator ? (
                            <Pressable
                              style={styles.connectionActionDanger}
                              onPress={() => handleDeleteConnection(connection.id)}
                            >
                              <Text style={styles.connectionActionDangerText}>Delete</Text>
                            </Pressable>
                          ) : (
                            <Pressable
                              style={styles.connectionActionNeutral}
                              onPress={() => handleLeaveConnection(connection.id)}
                            >
                              <Text style={styles.connectionActionNeutralText}>Leave</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    );
                  })
                )}

                {pendingRequests.length > 0 && (
                  <View style={styles.pendingList}>
                    <View style={styles.sectionLead}>
                      <Text style={styles.subsectionTitle}>Pending Requests</Text>
                      <Text style={styles.sectionHint}>
                        Approve or reject people waiting to join your connection.
                      </Text>
                    </View>
                    {pendingRequests.map(({ connectionId, connectionCode, member }) => (
                      <View key={`${connectionId}-${member.id}`} style={styles.pendingRow}>
                        <Image source={{ uri: member.avatar }} style={styles.pendingAvatar} />
                        <View style={styles.pendingCopy}>
                          <Text style={styles.pendingName}>{member.name}</Text>
                          <Text style={styles.pendingMeta}>
                            @{member.username} • Request for {connectionCode}
                          </Text>
                        </View>
                        <Pressable
                          style={styles.approveButton}
                          onPress={() => handleApproveRequest(connectionId, member.id)}
                        >
                          <Text style={styles.approveButtonText}>Approve</Text>
                        </Pressable>
                        <Pressable
                          style={styles.rejectButton}
                          onPress={() => handleRejectRequest(connectionId, member.id)}
                        >
                          <Text style={styles.rejectButtonText}>Reject</Text>
                        </Pressable>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {activeTab === "join" && (
              <View style={styles.section}>
                <View style={styles.sectionLead}>
                  <Text style={styles.sectionTitle}>Join / Create</Text>
                  <Text style={styles.sectionHint}>
                    Use a code to join another group or create a new one.
                  </Text>
                </View>

                <View style={styles.formCard}>
                  <Text style={styles.formLabel}>Connection code</Text>
                  <TextInput
                    style={styles.input}
                    value={joinCode}
                    onChangeText={(value) =>
                      setJoinCode(sanitizeConnectionCode(value))
                    }
                    placeholder="Enter connection code"
                    placeholderTextColor="#7C8A7E"
                    autoCapitalize="characters"
                    autoCorrect={false}
                    maxLength={12}
                  />
                  <Pressable style={styles.joinButton} onPress={handleJoinConnection}>
                    <Text style={styles.joinButtonText}>Join Connection</Text>
                  </Pressable>
                </View>

                <View style={styles.formCard}>
                  <Text style={styles.formLabel}>Start a new group</Text>
                  <Text style={styles.formHint}>
                    Create a connection and invite people using the generated code.
                  </Text>
                  <Pressable style={styles.createWideButton} onPress={handleCreateConnection}>
                    <Text style={styles.createWideButtonText}>Create New Connection</Text>
                  </Pressable>
                </View>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </View>

      <Modal
        visible={joinRequestModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setJoinRequestModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <Ionicons name="checkmark-circle" size={34} color="#1D6B41" />
            </View>
            <Text style={styles.modalTitle}>Request Sent</Text>
            <Text style={styles.modalMessage}>
              {joinRequestModalMessage}
            </Text>
            <Pressable
              style={styles.modalButton}
              onPress={() => setJoinRequestModalVisible(false)}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#E9EFE8",
  },

  map: {
    ...StyleSheet.absoluteFillObject,
  },

  mapLegend: {
    position: "absolute",
    top: Platform.OS === "ios" ? 126 : 96,
    left: 16,
    right: 16,
    zIndex: 10,
    pointerEvents: "none",
  },

  legendBadge: {
    alignSelf: "flex-start",
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: "rgba(255,255,255,0.94)",
    justifyContent: "center",
  },

  legendBadgeText: {
    color: "#26412F",
    fontSize: 12,
    fontWeight: "800",
  },

  legendNote: {
    marginTop: 6,
    color: "#F8FAF8",
    fontSize: 11,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.18)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  panelLayer: {
    ...StyleSheet.absoluteFillObject,
  },

  floatingTabWrap: {
    position: "absolute",
    left: 30,
    right: 30,
    zIndex: 12,
  },

  floatingTabRow: {
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },

  floatingTabButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 18,
    backgroundColor: "rgba(251,253,250,0.98)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    shadowColor: "#12281A",
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },

  floatingTabButtonActive: {
    backgroundColor: "#486742",
  },

  floatingTabText: {
    color: "#536755",
    fontSize: 12,
    fontWeight: "800",
  },

  floatingTabTextActive: {
    color: "#FFFFFF",
  },

  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#F9FCF8",
    shadowColor: "#12281A",
    shadowOpacity: 0.06,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },

  panelDragZone: {
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 6,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: "#F9FCF8",
  },

  dragHandleWrap: {
    minHeight: 26,
    alignItems: "center",
    justifyContent: "center",
  },

  dragHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#BFCBB7",
  },

  panelContent: {
    paddingHorizontal: 18,
    paddingBottom: 28,
    paddingTop: 8,
  },

  sheetIntro: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 4,
    marginBottom: 10,
  },

  sheetIntroCopy: {
    flex: 1,
  },

  sheetIntroTitle: {
    color: "#1C2B1F",
    fontSize: 18,
    fontWeight: "800",
  },

  sheetIntroSubtitle: {
    marginTop: 4,
    color: "#738174",
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
  },

  sheetIntroChip: {
    minHeight: 30,
    paddingHorizontal: 10,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
  },

  sheetIntroChipText: {
    fontSize: 11,
    fontWeight: "800",
  },

  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 22,
    backgroundColor: "#F3F8F1",
    borderWidth: 1,
    borderColor: "#DCE9D6",
  },

  profileAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#DCE7D8",
  },

  profileCopy: {
    flex: 1,
  },

  profileName: {
    color: "#1E2D22",
    fontSize: 16,
    fontWeight: "800",
  },

  profileMeta: {
    marginTop: 3,
    color: "#66756B",
    fontSize: 11,
    fontWeight: "600",
  },

  profileStatus: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },

  profileStatusText: {
    fontSize: 12,
    fontWeight: "800",
  },

  section: {
    marginTop: 14,
    paddingVertical: 4,
  },

  sectionLead: {
    marginBottom: 14,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginBottom: 10,
  },

  sectionTitle: {
    color: "#203125",
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
  },

  sectionHint: {
    marginTop: 2,
    color: "#66756B",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },

  metricsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },

  metricCard: {
    flex: 1,
    minHeight: 66,
    borderRadius: 18,
    backgroundColor: "#F8FAF7",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#EEF2EC",
  },

  metricCardSafe: {
    backgroundColor: "#E2F2E4",
  },

  metricCardDanger: {
    backgroundColor: "#FCE7E7",
  },

  metricValue: {
    color: "#1E2D22",
    fontSize: 16,
    fontWeight: "800",
  },

  metricLabel: {
    marginTop: 4,
    color: "#66756B",
    fontSize: 10,
    fontWeight: "700",
  },

  createPill: {
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    backgroundColor: "#365314",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },

  createPillText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },

  pickerShell: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F8FAF7",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#EEF2EC",
  },

  picker: {
    color: "#203125",
  },

  statusSummary: {
    marginBottom: 16,
    padding: 18,
    borderRadius: 22,
    backgroundColor: "#426838",
  },

  statusSummaryTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
  },

  statusSummaryEyebrow: {
    color: "rgba(248,251,247,0.72)",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0,
  },

  statusSummaryCount: {
    minWidth: 62,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
  },

  statusSummaryCountValue: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "800",
  },

  statusSummaryCountLabel: {
    marginTop: 2,
    color: "rgba(248,251,247,0.78)",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },

  statusSummaryTitle: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },

  statusSummaryMeta: {
    marginTop: 5,
    color: "rgba(248,251,247,0.8)",
    fontSize: 11,
    fontWeight: "600",
  },

  connectionCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#F8FBF7",
    borderWidth: 1,
    borderColor: "#E1EADF",
  },

  connectionCardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  connectionCardCopy: {
    flex: 1,
  },

  connectionCardTitle: {
    color: "#203125",
    fontSize: 14,
    fontWeight: "800",
  },

  connectionCardMeta: {
    marginTop: 3,
    color: "#66756B",
    fontSize: 12,
  },

  currentChip: {
    minHeight: 26,
    paddingHorizontal: 10,
    borderRadius: 13,
    backgroundColor: "#DCEBDC",
    alignItems: "center",
    justifyContent: "center",
  },

  currentChipText: {
    color: "#315943",
    fontSize: 11,
    fontWeight: "800",
  },

  connectionCardActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },

  connectionActionPrimary: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: "#3D5C36",
    alignItems: "center",
    justifyContent: "center",
  },

  connectionActionPrimaryText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },

  connectionActionDanger: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: "#FBEEEE",
    alignItems: "center",
    justifyContent: "center",
  },

  connectionActionDangerText: {
    color: "#991B1B",
    fontWeight: "800",
  },

  connectionActionNeutral: {
    flex: 1,
    minHeight: 40,
    borderRadius: 12,
    backgroundColor: "#F3F6F1",
    alignItems: "center",
    justifyContent: "center",
  },

  connectionActionNeutralText: {
    color: "#385040",
    fontWeight: "800",
  },

  connectionTabs: {
    gap: 10,
    paddingBottom: 8,
  },

  connectionChip: {
    minHeight: 38,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: "#EEF4EB",
    borderWidth: 1,
    borderColor: "#D7E2D3",
    alignItems: "center",
    justifyContent: "center",
  },

  connectionChipActive: {
    backgroundColor: "#365314",
    borderColor: "#365314",
  },

  connectionChipText: {
    color: "#365314",
    fontWeight: "700",
  },

  connectionChipTextActive: {
    color: "#FFFFFF",
  },

  pendingList: {
    marginTop: 10,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#F8FBF7",
    borderWidth: 1,
    borderColor: "#E1EADF",
  },

  pendingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
  },

  pendingAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#DCE7D8",
  },

  pendingCopy: {
    flex: 1,
  },

  pendingName: {
    color: "#203125",
    fontWeight: "800",
  },

  pendingMeta: {
    marginTop: 2,
    color: "#66756B",
    fontSize: 12,
  },

  approveButton: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#EDF6EE",
    alignItems: "center",
    justifyContent: "center",
  },

  approveButtonText: {
    color: "#1D6B41",
    fontSize: 12,
    fontWeight: "800",
  },

  rejectButton: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#FBEEEE",
    alignItems: "center",
    justifyContent: "center",
  },

  rejectButtonText: {
    color: "#991B1B",
    fontSize: 12,
    fontWeight: "800",
  },

  input: {
    borderWidth: 1,
    borderColor: "#E3EAE0",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: "#FFFFFF",
    color: "#203125",
  },

  joinButton: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#3D5C36",
    alignItems: "center",
    justifyContent: "center",
  },

  joinButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },

  createWideButton: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: "#F3F6F1",
    alignItems: "center",
    justifyContent: "center",
  },

  createWideButtonText: {
    color: "#365314",
    fontWeight: "800",
  },

  subsectionTitle: {
    color: "#203125",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 2,
  },

  listSectionHeader: {
    marginBottom: 12,
    paddingHorizontal: 4,
  },

  listSectionTitle: {
    color: "#203125",
    fontSize: 16,
    fontWeight: "800",
  },

  listSectionMeta: {
    marginTop: 4,
    color: "#708071",
    fontSize: 11,
    fontWeight: "600",
  },

  personRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 18,
    backgroundColor: "#F7FBF6",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#DFE9DC",
  },

  personAvatarWrap: {
    position: "relative",
    marginLeft: 8,
  },

  personAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#DCE7D8",
  },

  personAvatarDot: {
    position: "absolute",
    right: 1,
    bottom: 1,
    width: 12,
    height: 12,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },

  personCopy: {
    flex: 1,
    alignItems: "flex-start",
  },

  personName: {
    color: "#203125",
    fontSize: 14,
    fontWeight: "800",
  },

  personMeta: {
    marginTop: 6,
    color: "#738174",
    fontSize: 11,
    lineHeight: 16,
  },

  personStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 8,
  },

  personStatusDotInline: {
    width: 7,
    height: 7,
    borderRadius: 999,
  },

  personStatus: {
    minHeight: 26,
    paddingHorizontal: 10,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF3E7",
  },

  personStatusText: {
    fontSize: 10,
    fontWeight: "800",
  },

  personKick: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },

  personKickText: {
    color: "#991B1B",
    fontSize: 12,
    fontWeight: "800",
  },

  safetyActions: {
    flexDirection: "row",
    gap: 10,
  },

  memberListCard: {
    paddingHorizontal: 0,
    borderRadius: 0,
    backgroundColor: "transparent",
  },

  safetyPanel: {
    marginTop: 14,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#F8FBF7",
    borderWidth: 1,
    borderColor: "#E1EADF",
  },

  safetyPanelHeader: {
    marginBottom: 12,
  },

  safetyPanelTitle: {
    color: "#1F2E22",
    fontSize: 15,
    fontWeight: "800",
  },

  safetyPanelSubtitle: {
    marginTop: 4,
    color: "#6F7E72",
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
  },

  safeButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "#2F7F47",
    alignItems: "center",
    justifyContent: "center",
  },

  safeButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  notSafeButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 12,
    backgroundColor: "#C25151",
    alignItems: "center",
    justifyContent: "center",
  },

  notSafeButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    letterSpacing: 0.2,
  },

  connectionControls: {
    marginTop: 12,
  },

  formCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 20,
    backgroundColor: "#F8FBF7",
    borderWidth: 1,
    borderColor: "#E1EADF",
  },

  formLabel: {
    color: "#1F2E22",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 10,
  },

  formHint: {
    color: "#6F7E72",
    fontSize: 11,
    lineHeight: 17,
    fontWeight: "600",
    marginBottom: 12,
  },

  emptyStateCard: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#F8FBF7",
    borderWidth: 1,
    borderColor: "#E1EADF",
  },

  emptyStateTitle: {
    color: "#203125",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 6,
  },

  secondaryDanger: {
    minHeight: 46,
    borderRadius: 18,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryDangerText: {
    color: "#991B1B",
    fontWeight: "800",
  },

  secondaryNeutral: {
    minHeight: 46,
    borderRadius: 18,
    backgroundColor: "#F6F8F5",
    borderWidth: 1,
    borderColor: "#D7E2D3",
    alignItems: "center",
    justifyContent: "center",
  },

  secondaryNeutralText: {
    color: "#385040",
    fontWeight: "800",
  },

  emptyText: {
    color: "#738176",
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.34)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },

  modalCard: {
    width: "100%",
    maxWidth: 320,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 22,
    paddingTop: 22,
    paddingBottom: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#DCE9D6",
  },

  modalIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: "#EDF8F0",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 14,
  },

  modalTitle: {
    color: "#203125",
    fontSize: 20,
    fontWeight: "800",
  },

  modalMessage: {
    marginTop: 8,
    marginBottom: 18,
    color: "#66756B",
    fontSize: 13,
    lineHeight: 20,
    fontWeight: "600",
    textAlign: "center",
  },

  modalButton: {
    minWidth: 120,
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 14,
    backgroundColor: "#365314",
    alignItems: "center",
    justifyContent: "center",
  },

  modalButtonText: {
    color: "#FFFFFF",
    fontWeight: "800",
  },
});
