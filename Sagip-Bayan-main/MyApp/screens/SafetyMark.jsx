
import {
  useState,
  useContext,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  View,
  Text,
  TextInput,
  Alert,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  PanResponder,
  Dimensions,
  Image,
} from "react-native";
import { UserContext } from "./UserContext";
import api from "../lib/api";
import * as Location from "expo-location";
import MapView, { Marker } from "react-native-maps";
import { useFocusEffect } from "@react-navigation/native";
import AppLayout from "./AppLayout";
import useJaenPlaceSearch from "./hooks/useJaenPlaceSearch";

/* ================= CONSTANTS ================= */
const BASE_URL = "http://192.168.1.4:8000";
const { height } = Dimensions.get("window");
const PANEL_COLLAPSED = height * 0.55;
const PANEL_EXPANDED = 80;

const DEFAULT_AVATAR =
  "https://ui-avatars.com/api/?background=065F46&color=fff&rounded=true&name=User";

/* ================= HELPERS ================= */
const timeAgo = (date) => {
  if (!date) return null;
  const diffMs = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  const days = Math.floor(hrs / 24);
  if (days <= 7) return `${days} day ago`;
  return "Over a week ago";
};

const getDistanceMeters = (from, to) => {
  const R = 6371e3;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(to.lat - from.latitude);
  const dLon = toRad(to.lng - from.longitude);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(from.latitude)) *
      Math.cos(toRad(to.lat)) *
      Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
};

/* ================= COMPONENT ================= */
export default function SafetyMark() {
  const { user, setUser } = useContext(UserContext);
  
  
  console.log("[SafetyMark] user from context:", user)
  const { suggestions, search, clear } = useJaenPlaceSearch();
  const mapRef = useRef(null);

  const [connections, setConnections] = useState([]);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [personalNotifications, setPersonalNotifications] = useState([]);

  const [showRequests, setShowRequests] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [panelView, setPanelView] = useState("main");

  const [myLocation, setMyLocation] = useState(null);
  const [myAddress, setMyAddress] = useState(null);
  const [memberAddresses, setMemberAddresses] = useState({});

  /* ================= DERIVED STATE ================= */
  const hasActiveConnection = connections.length > 0;
  const isAnyConnectionFull = false;

  const totalNotifications =
    pendingRequests.length + personalNotifications.length;
 
  const resolveAvatar = (avatar) => {
  if (!avatar) return DEFAULT_AVATAR;
  if (avatar.startsWith("http")) return avatar;
  return `${BASE_URL}${avatar}`;
};
  
const mySafetyStatus = user?.safetyStatus || "SAFE";

  /* ================= SLIDE PANEL ================= */
  const translateY = useRef(new Animated.Value(PANEL_COLLAPSED)).current;
  const lastY = useRef(PANEL_COLLAPSED);

const panResponder = useRef(
  PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dy) > 8,

    // ✅ ADD THESE TWO LINES
    onMoveShouldSetPanResponderCapture: () => true,
    onPanResponderTerminationRequest: () => false,

    onPanResponderGrant: () => {
      lastY.current = translateY.__getValue();
    },

    onPanResponderMove: (_, g) => {
      let next = lastY.current + g.dy;
      next = Math.max(PANEL_EXPANDED, Math.min(next, PANEL_COLLAPSED));
      translateY.setValue(next);
    },

    // ✅ REPLACED RELEASE HANDLER
    onPanResponderRelease: () => {
      lastY.current = translateY.__getValue();
    },
  })
).current;

  /* ================= CONNECTIONS ================= */
  const fetchConnections = async () => {
    if (!user?._id) return;
    try {
      const res = await api.get(`/connection/user/${user._id}`);
      setConnections(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Fetch connections failed:", err?.message);
    }
  };
useFocusEffect(
  useCallback(() => {
    if (!user?._id) return;

    // ✅ refresh my own profile (avatar + safetyStatus)
    api.get(`/user/${user._id}`)
      .then((res) => setUser(res.data))
      .catch(() => {});

    fetchConnections();

    api.get(`/user/${user._id}`)
      .then((res) => {
        setPersonalNotifications(
          (res.data.notifications || []).filter((n) => !n.read)
        );
      })
      .catch(() => {});
  }, [user?._id])
);

  /* ================= PENDING REQUESTS ================= */
  useEffect(() => {
    if (!user?._id) return;

    const pending = [];
    connections.forEach((connection) => {
      if (
        connection.creator?.toString() === user._id &&
        Array.isArray(connection.pendingMembers)
      ) {
        connection.pendingMembers.forEach((member) => {
          pending.push({ connectionId: connection._id, member });
        });
      }
    });

    setPendingRequests(pending);
  }, [connections, !user?._id]);

  /* ================= LOCATION ================= */
  useEffect(() => {
    if (!user?._id) return;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Highest,
      });

      const coords = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      };

      // ✅ set immediately (old working behavior)
      setMyLocation(coords);

      try {
        const [place] = await Location.reverseGeocodeAsync(coords);
        if (place) {
          const street = place.street || place.name || "";
          const city = place.city || place.region || "";
          setMyAddress(
            `${street}${street && city ? ", " : ""}${city}` ||
              "Approximate area"
          );
        }
      } catch {}

      try {
        await api.put(`/user/location/${user._id}`, {
          lat: coords.latitude,
          lng: coords.longitude,
        });
      } catch {}
    })();
  }, [user?._id]);



const handleDeleteConnection = (connectionId) => {
  Alert.alert(
    "Delete Connection",
    "This will permanently remove the connection and all members.\n\nAre you sure?",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          api
            .delete(`/connection/delete/${connectionId}/${user._id}`)
            .then(() => {
              fetchConnections();
              setPanelView("main");
            })
            .catch((err) => {
              Alert.alert(
                "Delete Failed",
                err?.response?.data?.message ||
                  "Failed to delete connection"
              );
            });
        },
      },
    ]
  );
};
  /* ================= FAMILY ADDRESS RESOLVE ================= */
  useEffect(() => {
    const resolveFamilyLocations = async () => {
      if (!connections.length) return;

      const updates = {};

      for (const connection of connections) {
        for (const member of connection.members || []) {
          if (
            member.location?.lat &&
            member.location?.lng &&
            !memberAddresses[member._id]
          ) {
            try {
              const [place] = await Location.reverseGeocodeAsync({
                latitude: member.location.lat,
                longitude: member.location.lng,
              });
              if (place) {
                const street = place.street || place.name || "";
                const city = place.city || place.region || "";
                updates[member._id] =
                  `${street}${street && city ? ", " : ""}${city}` ||
                  "Approximate area";
              }
            } catch {}
          }
        }
      }

      if (Object.keys(updates).length > 0) {
        setMemberAddresses((prev) => ({ ...prev, ...updates }));
      }
    };

    resolveFamilyLocations();
  }, [connections]);

  /* ================= SEARCH ================= */
  const handleSelectSuggestion = (place) => {
    if (!mapRef.current) return;
    mapRef.current.animateToRegion(
      {
        latitude: place.latitude,
        longitude: place.longitude,
        latitudeDelta: 0.03,
        longitudeDelta: 0.03,
      },
      350
    );
    clear();
  };

  /* ================= ACTIONS ================= */
const handleCreateConnection = () => {
  if (hasActiveConnection) {
    Alert.alert(
      "Already Connected",
      "You can only have one family connection at a time.\n\nPlease leave your current connection first."
    );
    return;
  }

  api.post(`/connection/create/${user._id}`)
    .then(fetchConnections)
    .catch(() =>
      Alert.alert("Error", "Failed to create connection")
    );
};
  const handleJoinConnection = () => {
    if (hasActiveConnection) {
      Alert.alert(
        "Already Connected",
        "You can only join one family connection."
      );
      return;
    }
    if (!joinCode.trim()) {
      Alert.alert("Missing Info", "Enter a connection code");
      return;
    }
    api.post(`/connection/join/${user._id}`, {
      code: joinCode.trim().toUpperCase(),
    })
      .then(() => {
        setJoinCode("");
        fetchConnections();
      })
      .catch((err) => {
        Alert.alert(
          "Join Failed",
          err?.response?.data?.message ||
            "Invalid or expired connection code"
        );
      });
  };

  const handleMarkSafe = () => {
    if (!hasActiveConnection)
      return Alert.alert("No Connection", "You are not connected.");
    api.put(`/connection/safe/${user._id}`, { message: "I am safe" })
      .then(fetchConnections)
      .catch(() => Alert.alert("Error", "Failed to mark SAFE"));
  };

  const handleMarkNotSafe = () => {
    if (!hasActiveConnection)
      return Alert.alert("No Connection", "You are not connected.");
    api.put(`/connection/not-safe/${user._id}`, { message: "Need help" })
      .then(fetchConnections)
      .catch(() => Alert.alert("Error", "Failed to mark NOT SAFE"));
  };
const handleLeaveConnection = (id) => {
  api.delete(`/connection/leave/${user._id}/${id}`)
    .then(fetchConnections)
    .catch(() =>
      Alert.alert("Error", "Failed to leave connection")
    );
};
/* ================= RENDER ================= */
return (
<AppLayout
  onSearch={search}
  suggestions={suggestions}
  onSelectSuggestion={handleSelectSuggestion}
>
  <View style={styles.container}>
    <MapView
      ref={mapRef} 
      style={StyleSheet.absoluteFillObject}
      initialRegion={{
        latitude: myLocation?.latitude || 14.5995,
        longitude: myLocation?.longitude || 120.9842,
        latitudeDelta: 0.05,
        longitudeDelta: 0.05,
      }}
    >
      {myLocation && (
        <Marker coordinate={myLocation}>
         <Image
  source={{ uri: resolveAvatar(user?.avatar) }}
  style={[
    styles.markerAvatar,
    {
      borderColor:
        mySafetyStatus === "SAFE"
          ? "#22C55E"
          : "#EF4444",
      borderWidth: 3,
    },
  ]}
/>
        </Marker>
      )}
    </MapView>

    <TouchableOpacity
      style={styles.notificationBtn}
      onPress={() => setShowRequests(true)}
    >
      <Text style={styles.notificationIcon}>🔔</Text>

      {totalNotifications > 0 && (
        <View style={styles.notificationBadge}>
          <Text style={styles.notificationCount}>
            {totalNotifications}
          </Text>
        </View>
      )}
    </TouchableOpacity>

    {showRequests && (
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowRequests(false)}>
              <Text style={styles.modalBack}>←</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Request</Text>
            <View style={{ width: 20 }} />
          </View>

          {/* pending requests */}
          {pendingRequests.length === 0 ? (
            <Text style={styles.emptyText}>No pending requests</Text>
          ) : (
            pendingRequests.map(({ connectionId, member }) => (
              <View key={member._id} style={styles.requestRow}>
                <Image
                  source={{
                    uri: member.avatar
                      ? `${BASE_URL}${member.avatar}`
                      : DEFAULT_AVATAR,
                  }}
                  style={styles.requestAvatar}
                />

                <Text style={styles.requestName}>
                  {member.username}
                </Text>

                <View style={styles.requestActions}>
                  {/* ✅ Approve */}
                  <TouchableOpacity
                    onPress={() => {
                      api.put(
                        `/connection/approve/${connectionId}/${member._id}/${user._id}`
                      ).then(() => {
                        fetchConnections();
                        setShowRequests(false);
                      });
                    }}
                  >
                    <Text style={styles.approveBtn}>✔</Text>
                  </TouchableOpacity>

                  {/* ❌ Reject */}
                  <TouchableOpacity
                    onPress={() => {
                      api.put(
                        `/connection/reject/${connectionId}/${member._id}/${user._id}`
                      ).then(() => {
                        fetchConnections();
                        setShowRequests(false);
                      });
                    }}
                  >
                    <Text style={styles.rejectBtn}>✖</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}

          {/* ✅ Personal system notifications */}
          {personalNotifications.map((notif, index) => (
            <View key={`notif-${index}`} style={styles.requestRow}>
              <Text style={{ color: "#fff", fontWeight: "700" }}>
                {notif.message}
              </Text>
              <Text
                style={{
                  color: "#D1FAE5",
                  fontSize: 11,
                  marginTop: 4,
                }}
              >
                {timeAgo(notif.createdAt)}
              </Text>
            </View>
          ))}

          <TouchableOpacity
            style={styles.closeModal}
            onPress={() => setShowRequests(false)}
          >
            <Text style={{ fontWeight: "700" }}>Close</Text>
          </TouchableOpacity>
        </View>
      </View>
    )}

    {/* ================= PANEL ================= */}
    <Animated.View style={[styles.panel, { transform: [{ translateY }] }]}>
      <View {...panResponder.panHandlers} style={styles.handle} />
      <ScrollView showsVerticalScrollIndicator={false}>
        {panelView === "main" && (
          <>
            <Text style={styles.title}>Safety Mark</Text>
            {myAddress && (
              <Text style={styles.locationLabel}>{myAddress}</Text>
            )}

         <TouchableOpacity
  style={[
    styles.primaryBtn,
    hasActiveConnection && { opacity: 0.5 }
  ]}
  disabled={hasActiveConnection}
  onPress={handleCreateConnection}
>
  <Text style={styles.primaryText}>Create Connection</Text>
</TouchableOpacity>





            <Text style={styles.label}>Join with code</Text>
            <TextInput
              style={styles.input}
              value={joinCode}
              onChangeText={setJoinCode}
              placeholder="Enter connection code"
            />

         <TouchableOpacity
  style={[
    styles.secondaryBtn,
    hasActiveConnection && { opacity: 0.5 }
  ]}
  disabled={hasActiveConnection}
  onPress={handleJoinConnection}
>
  <Text style={styles.secondaryText}>Join Connection</Text>
</TouchableOpacity>

            <TouchableOpacity
              style={styles.linkBtn}
              onPress={() => setPanelView("connections")}
            >
              <Text style={styles.linkText}>
                View your connections →
              </Text>
            </TouchableOpacity>
          </>
        )}

          {panelView === "connections" && (
            <>
            {isAnyConnectionFull && (
  <Text style={{ color: "#991B1B", marginTop: 6 }}>
    Connection is full (maximum of 5 members)
  </Text>
)}
              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => setPanelView("main")}
              >
                <Text style={styles.backText}>← Back</Text>
              </TouchableOpacity>

              <Text style={styles.sectionTitle}>Safety Status</Text>

              {/* ✅ MY PROFILE — ALWAYS SHOWN */}
<View style={styles.connectionCard}>
  <View style={{ flexDirection: "row", flex: 1, alignItems: "center" }}>
    <View style={styles.avatarWrap}>
      <Image
        source={{ uri: resolveAvatar(user?.avatar) }}
        style={styles.avatar}
      />
    </View>

    <View style={styles.infoCol}>
      <Text style={styles.name}>
        {user?.username} ({mySafetyStatus})
      </Text>
      <Text style={styles.location}>
        {myAddress || "Location unavailable"}
      </Text>
    </View>
  </View>
</View>

              <TouchableOpacity
                style={styles.safeBtn}
                onPress={handleMarkSafe}
              >
                <Text style={styles.safeText}>Mark SAFE</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.unsafeBtn}
                onPress={handleMarkNotSafe}
              >
                <Text style={styles.unsafeText}>Mark NOT SAFE</Text>
              </TouchableOpacity>

              <Text style={styles.sectionTitle}>
                Family Account Connections
              </Text>

                  



              {connections.map((connection) => (
                <View key={connection._id}>
                  <Text style={styles.codeText}>
                    Connection Code:{" "}
                    <Text style={{ fontWeight: "800" }}>
                      {connection.code}
                    </Text>
                  </Text>
{connection.members.map((member) => (
  <View key={member._id} style={styles.connectionCard}>

    {/* ✅ LEFT WRAPPER (takes all space) */}
    <View style={{ flexDirection: "row", flex: 1, alignItems: "center" }}>
      
      {/* Avatar */}
      <View style={styles.avatarWrap}>
       <Image
  source={{ uri: resolveAvatar(member.avatar) }}
  style={styles.avatar}
/>

      </View>

      {/* Info */}
      <View style={styles.infoCol}>
        <Text style={styles.name}>
          {member.username} ({member.safetyStatus || "UNKNOWN"})
        </Text>

        <Text style={styles.location}>
          {memberAddresses[member._id] || "Location unavailable"}
        </Text>

        {myLocation && member.location?.lat && member.location?.lng && (
          <Text style={styles.location}>
            {timeAgo(member.location.updatedAt)} •{" "}
            {(() => {
              const meters = getDistanceMeters(myLocation, member.location);
              return meters < 1000
                ? `${meters} m away`
                : `${(meters / 1000).toFixed(1)} km away`;
            })()}
          </Text>
        )}
      </View>
    </View>

    {/* ✅ RIGHT‑ALIGNED ⋮ — GUARANTEED */}
    {connection.creator?.toString() === user._id &&
      member._id !== user._id && (
        <TouchableOpacity
          onPress={() => {
            Alert.alert(
              "Remove Member",
              `Remove ${member.username} from this connection?`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Kick",
                  style: "destructive",
                  onPress: () => {
                    api
                      .put(
                        `/connection/kick/${connection._id}/${member._id}/${user._id}`
                      )
                      .then(fetchConnections)
                      .catch(() =>
                        Alert.alert("Error", "Failed to remove member")
                      );
                  },
                },
              ]
            );
          }}
        >
          <Text style={{ fontSize: 18, color: "#D1FAE5", paddingLeft: 8 }}>
            ⋮
          </Text>
        </TouchableOpacity>
      )}
  </View>
))}
{connection.creator?.toString() === user._id ? (
  // ✅ CREATOR: DELETE
  <TouchableOpacity
    style={[styles.leaveBtn, { backgroundColor: "#FEE2E2" }]}
    onPress={() => handleDeleteConnection(connection._id)}
  >
    <Text style={{ color: "#991B1B", fontWeight: "700" }}>
      Delete Connection
    </Text>
  </TouchableOpacity>
) : (
  // ✅ MEMBER: LEAVE
  <TouchableOpacity
    style={styles.leaveBtn}
    onPress={() => handleLeaveConnection(connection._id)}
  >
    <Text style={styles.leaveText}>Leave Connection</Text>
  </TouchableOpacity>
)}

                </View>
              ))}
            </>
          )}
        </ScrollView>
      </Animated.View>
    </View>
    </AppLayout>
   
);
}

/* ================= STYLES ================= */
/* ✅ STYLES UNCHANGED */
/* ================= STYLES ================= */
/* YOUR styles remain unchanged */


/* ================= STYLES ================= */
/* ================= STYLES ================= */
/* ✅ STYLES UNCHANGED */
/* ================= STYLES ================= */
/* YOUR styles remain unchanged */


/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: { flex: 1 },

  locationLabel: {
    color: "#047857",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },

  panel: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    elevation: 15,
  },

  handle: {
    width: 50,
    height: 5,
    backgroundColor: "#D1D5DB",
    borderRadius: 3,
    alignSelf: "center",
    marginBottom: 14,
  },

  markerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
  },

  title: { fontSize: 26, fontWeight: "800", color: "#064E3B" },

  label: { marginTop: 16, fontWeight: "600" },

  input: {
    borderWidth: 1,
    borderColor: "#D1FAE5",
    borderRadius: 12,
    padding: 14,
    backgroundColor: "#F9FAFB",
  },

  primaryBtn: {
    backgroundColor: "#10B981",
    padding: 16,
    borderRadius: 14,
    marginTop: 12,
    alignItems: "center",
  },

  primaryText: { color: "#FFF", fontWeight: "800" },

  secondaryBtn: {
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#10B981",
    alignItems: "center",
  },

  secondaryText: { color: "#047857", fontWeight: "700" },

  linkBtn: { marginTop: 18, alignItems: "center" },

  linkText: { color: "#047857", fontWeight: "700" },

  backBtn: { marginBottom: 10 },

  backText: { color: "#047857", fontWeight: "700" },

  sectionTitle: {
    marginTop: 24,
    marginBottom: 12,
    fontSize: 16,
    fontWeight: "800",
    color: "#064E3B",
  },

  safeBtn: {
    backgroundColor: "#ECFDF5",
    padding: 14,
    borderRadius: 14,
    borderColor: "#10B981",
    borderWidth: 1,
    marginBottom: 10,
  },

  unsafeBtn: {
    backgroundColor: "#FEF2F2",
    padding: 14,
    borderRadius: 14,
    borderColor: "#FCA5A5",
    borderWidth: 1,
  },

  safeText: { textAlign: "center", fontWeight: "800", color: "#047857" },

  unsafeText: { textAlign: "center", fontWeight: "800", color: "#991B1B" },

  connectionCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#064E3B",
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
  },

  avatarWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#ECFDF5",
    marginRight: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  avatar: { width: "100%", height: "100%", borderRadius: 21 },

  statusDot: {
    position: "absolute",
    bottom: 1,
    right: 1,
    width: 10,
    height: 10,
    borderRadius: 5,
  },

  dotSafe: { backgroundColor: "#22C55E" },

  dotUnsafe: { backgroundColor: "#EF4444" },

  infoCol: { flex: 1 },

  name: { color: "#FFF", fontWeight: "800", fontSize: 14 },

  location: { color: "#D1FAE5", fontSize: 12, marginTop: 2 },

  statusPill: {
    backgroundColor: "#022C22",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },

  statusText: {
    color: "#A7F3D0",
    fontSize: 11,
    fontWeight: "700",
  },

  leaveBtn: {
    marginTop: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "#FEF2F2",
  },

  leaveText: {
    textAlign: "center",
    color: "#991B1B",
    fontWeight: "700",
  },

  notificationBtn: {
  position: "absolute",
  top: 40,
  right: 20,
  zIndex: 20,
},

notificationIcon: {
  marginTop: 90,
  fontSize: 26,
},


modalOverlay: {
  position: "absolute",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0,0,0,0.4)",
  justifyContent: "center",
  alignItems: "center",
  zIndex: 999,
  elevation: 999,   // ✅ THIS is the missing piece
},

modalBox: {
  width: "85%",
  backgroundColor: "#E5E7EB",
  borderRadius: 16,
  padding: 20,
},

modalTitle: {
  fontSize: 20,
  fontWeight: "800",
  marginBottom: 16,
  textAlign: "center",
},

requestRow: {
  flexDirection: "row",
  alignItems: "center",
  backgroundColor: "#064E3B",
  padding: 12,
  borderRadius: 12,
  marginBottom: 10,
},

requestAvatar: {
  width: 36,
  height: 36,
  borderRadius: 18,
  marginRight: 10,
},

requestName: {
  flex: 1,
  color: "#fff",
  fontWeight: "700",
},

requestActions: {
  flexDirection: "row",
  gap: 12,
},

approveBtn: {
  fontSize: 20,
  color: "#22C55E",
},

rejectBtn: {
  fontSize: 20,
  color: "#EF4444",
},

closeModal: {
  marginTop: 10,
  alignItems: "center",
},

emptyText: {
  textAlign: "center",
  color: "#374151",
  marginVertical: 20,
},
notificationBadge: {
  position: "absolute",
  top: -4,
  right: -4,
  minWidth: 18,
  height: 18,
  borderRadius: 9,
  marginTop: 90,
  backgroundColor: "#EF4444",
  justifyContent: "center",
  alignItems: "center",
  paddingHorizontal: 4,
},

notificationCount: {
  color: "#fff",
  fontSize: 11,
  fontWeight: "800",
},
modalHeader: {
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
  marginBottom: 16,
},

modalBack: {
  fontSize: 18,
  fontWeight: "800",
},
});