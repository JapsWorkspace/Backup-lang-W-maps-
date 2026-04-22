import React, { useContext, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
} from "react-native";
import { UserContext } from "../UserContext";

/* ========= CONSTANTS ========= */
const BASE_URL = "http://172.31.100.51:8000";
const DEFAULT_AVATAR =
  "https://ui-avatars.com/api/?background=E5E7EB&color=6B7280&rounded=true&name=User";

/* ========= ICON SET ========= */
const iconSet = {
  safety: require("../../stores/assets/safetyblack.png"),
  incident: require("../../stores/assets/incidentreportblack.png"),
  digital: require("../../stores/assets/digitalblack.png"),
  virtual: require("../../stores/assets/virtualblack.png"),
  guide: require("../../stores/assets/guidelinesblack.png"),
  settings: require("../../stores/assets/settingsblack.png"),
};

const { width } = Dimensions.get("window");
const DRAWER_WIDTH = width * 0.78;

export default function AppDrawer({
  onRequestClose = () => {},
  onLogout = async () => {},
  onNavigate, // ⚠️ MUST be provided by AppLayout
}) {
  const { user } = useContext(UserContext);

  const translateX = useRef(new Animated.Value(-DRAWER_WIDTH)).current;

  useEffect(() => {
    Animated.timing(translateX, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [translateX]);

  const closeDrawer = (cb) => {
    Animated.timing(translateX, {
      toValue: -DRAWER_WIDTH,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      onRequestClose();
      if (typeof cb === "function") cb();
    });
  };

  /* ✅ REAL NAVIGATION */
  const goTo = (route, params) => {
    closeDrawer(() => {
      if (typeof onNavigate === "function") {
        onNavigate(route, params);
      }
    });
  };

  const handleLogout = async () => {
    closeDrawer(async () => {
      await onLogout();
    });
  };

  const avatarUri = user?.avatar
    ? user.avatar.startsWith("http")
      ? user.avatar
      : `${BASE_URL}${user.avatar}`
    : DEFAULT_AVATAR;

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
        <TouchableOpacity
          onPress={() => closeDrawer()}
          style={styles.backBtn}
        >
          <Text style={styles.back}>←</Text>
        </TouchableOpacity>

        <View style={styles.profile}>
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
          <Text style={styles.name}>
            {user?.fname} {user?.lname}
          </Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <View style={styles.divider} />

        <DrawerItem
          icon={iconSet.safety}
          label="Safety Marking"
          onPress={() => goTo("Connection")}
        />
        <DrawerItem
          icon={iconSet.incident}
          label="Incident Tagging"
          onPress={() => goTo("Map", { module: "incident" })}
        />
        <DrawerItem
          icon={iconSet.digital}
          label="Digital Twin"
          onPress={() => goTo("Map", { module: "barangay" })}
        />
        <DrawerItem
          icon={iconSet.virtual}
          label="Virtual Twin"
          onPress={() => goTo("MainCenter")}
        />
        <DrawerItem
          icon={iconSet.guide}
          label="Education & Guidelines"
          onPress={() => goTo("Guidelines")}
        />
        <DrawerItem
          icon={iconSet.settings}
          label="Account Settings"
          onPress={() => goTo("Profile")}
        />

<DrawerItem
  icon={iconSet.digital}
  label="Hazard Map"
  onPress={() => goTo("Map", { module: "flood" })}
/>

        <TouchableOpacity style={styles.logout} onPress={handleLogout}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </Animated.View>

      <TouchableOpacity
        style={styles.backdrop}
        onPress={() => closeDrawer()}
      />
    </View>
  );
}

function DrawerItem({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={styles.item} onPress={onPress}>
      <Image source={icon} style={styles.icon} />
      <Text style={styles.itemText}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ========= STYLES ========= */
const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    zIndex: 9999,
    elevation: 9999,
  },
  drawer: {
    width: DRAWER_WIDTH,
    backgroundColor: "#F3F4F6",
    paddingTop: 40,
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  backBtn: {
    marginBottom: 12,
  },
  back: {
    fontSize: 22,
  },
  profile: {
    alignItems: "flex-start",
    marginBottom: 16,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 10,
  },
  name: {
    fontSize: 26,
    fontWeight: "700",
  },
  email: {
    fontSize: 12,
    color: "#6B7280",
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E7EB",
    marginBottom: 8,
  },
  item: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  icon: {
    width: 20,
    height: 20,
    marginRight: 12,
    resizeMode: "contain",
  },
  itemText: {
    fontSize: 14,
  },
  logout: {
    marginTop: 20,
    backgroundColor: "#0a5915",
    paddingVertical: 12,
    borderRadius: 28,
    alignItems: "center",
  },
  logoutText: {
    color: "#fff",
    fontWeight: "700",
  },
});
