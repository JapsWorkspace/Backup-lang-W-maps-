import React, { useContext, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { UserContext } from "../UserContext";

const BASE_URL = "http://172.31.100.51:8000";
const DEFAULT_AVATAR =
  "https://ui-avatars.com/api/?background=E5E7EB&color=6B7280&rounded=true&name=User";

const { width } = Dimensions.get("window");
const DRAWER_WIDTH = Math.min(width * 0.8, 340);

const PRIMARY_TILES = [
  {
    icon: "home-outline",
    label: "Home",
    route: "Map",
    params: { resetMap: true },
  },
  {
    icon: "shield-checkmark-outline",
    label: "Safety Marking",
    route: "Connection",
  },
  {
    icon: "warning-outline",
    label: "Incident Tagging",
    route: "Map",
    params: { module: "incident" },
  },
  {
    icon: "water-outline",
    label: "Hazard Map",
    route: "Map",
    params: { module: "flood" },
  },
  {
    icon: "heart-outline",
    label: "Donate",
    route: "DonationScreen",
  },
];

const MENU_GROUPS = [
  {
    title: "Resources",
    items: [
      {
        icon: "reader-outline",
        label: "Guidelines",
        route: "Guidelines",
      },
      {
        icon: "map-outline",
        label: "Digital Twin",
        route: "Map",
        params: { module: "barangay" },
      },
      {
        icon: "cube-outline",
        label: "Virtual Twin",
        route: "MainCenter",
      },
    ],
  },
  {
    title: "Account and Security",
    items: [
      {
        icon: "settings-outline",
        label: "Account",
        route: "Profile",
      },
    ],
  },
];

export default function AppDrawer({
  onRequestClose = () => {},
  onLogout = async () => {},
  onNavigate,
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

  const goTo = (route, params) => {
    closeDrawer(() => {
      onNavigate?.(route, params);
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

  const displayName = `${user?.fname || ""} ${user?.lname || ""}`.trim() || "Resident";

  return (
    <View style={styles.overlay}>
      <Animated.View style={[styles.drawer, { transform: [{ translateX }] }]}>
        <View style={styles.topRow}>
          <View style={styles.brandBlock}>
            <View style={styles.brandBadge}>
              <Ionicons name="shield-half-outline" size={18} color="#355A2C" />
            </View>
            <View>
              <Text style={styles.brand}>Main Menu</Text>
              <Text style={styles.brandSub}>Safety operations and account access</Text>
            </View>
          </View>
          <TouchableOpacity
            onPress={() => closeDrawer()}
            style={styles.closeBtn}
            activeOpacity={0.78}
          >
            <Ionicons name="close" size={20} color="#203125" />
          </TouchableOpacity>
        </View>

        <View style={styles.featureCard}>
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
          <View style={styles.featureCopy}>
            <Text style={styles.featureTitle} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={styles.featureSubtitle} numberOfLines={2}>
              Resident access is active for alerts, safety coordination, and emergency guidance.
            </Text>
          </View>
          <View style={styles.featureArrow}>
            <Ionicons name="chevron-forward" size={18} color="#355A2C" />
          </View>
        </View>

        <ScrollView
          style={styles.menuScroll}
          contentContainerStyle={styles.menuContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.tileGrid}>
            {PRIMARY_TILES.map((item) => (
              <TouchableOpacity
                key={`tile-${item.label}`}
                style={styles.tile}
                onPress={() => goTo(item.route, item.params)}
                activeOpacity={0.84}
              >
                <View style={styles.tileIcon}>
                  <Ionicons name={item.icon} size={19} color="#355A2C" />
                </View>
                <Text style={styles.tileText}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {MENU_GROUPS.map((group) => (
            <View key={group.title} style={styles.group}>
              <Text style={styles.groupTitle}>{group.title}</Text>
              {group.items.map((item) => (
                <DrawerItem
                  key={`${group.title}-${item.label}`}
                  icon={item.icon}
                  label={item.label}
                  onPress={() => goTo(item.route, item.params)}
                />
              ))}
            </View>
          ))}
        </ScrollView>

        <View style={styles.logoutSection}>
          <TouchableOpacity style={styles.logout} onPress={handleLogout} activeOpacity={0.84}>
            <View style={styles.logoutIcon}>
              <Ionicons name="log-out-outline" size={18} color="#B91C1C" />
            </View>
            <View style={styles.logoutCopy}>
              <Text style={styles.logoutText}>Sign Out</Text>
              <Text style={styles.logoutSub}>End current session</Text>
            </View>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <TouchableOpacity
        style={styles.backdrop}
        onPress={() => closeDrawer()}
        activeOpacity={1}
      />
    </View>
  );
}

function DrawerItem({ icon, label, onPress }) {
  return (
    <TouchableOpacity style={styles.listItem} onPress={onPress} activeOpacity={0.82}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={19} color="#355A2C" />
      </View>
      <View style={styles.itemCopy}>
        <Text style={styles.itemText}>{label}</Text>
      </View>
      <Ionicons name="chevron-forward" size={17} color="#7D8B83" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: "row",
    zIndex: 9999,
    elevation: 9999,
  },
  drawer: {
    width: DRAWER_WIDTH,
    backgroundColor: "#F5F7EF",
    paddingTop: 42,
    paddingHorizontal: 14,
    paddingBottom: 18,
    borderTopRightRadius: 26,
    borderBottomRightRadius: 26,
    shadowColor: "#000000",
    shadowOpacity: 0.2,
    shadowRadius: 24,
    shadowOffset: { width: 8, height: 0 },
    elevation: 24,
  },
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.52)",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  brandBlock: {
    flexDirection: "row",
    alignItems: "center",
  },
  brandBadge: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#E7F0E2",
    borderWidth: 1,
    borderColor: "#D3E0D0",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  brand: {
    color: "#10251B",
    fontSize: 18,
    fontWeight: "900",
  },
  brandSub: {
    marginTop: 2,
    color: "#647067",
    fontSize: 12,
    fontWeight: "700",
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EAE4",
  },
  featureCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EAE4",
    shadowColor: "#0F2319",
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 18,
    marginRight: 12,
    backgroundColor: "#E5E7EB",
  },
  featureCopy: {
    flex: 1,
    minWidth: 0,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#10251B",
  },
  featureSubtitle: {
    marginTop: 3,
    fontSize: 12,
    color: "#647067",
    fontWeight: "600",
    lineHeight: 17,
  },
  featureArrow: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#E7F0E2",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 10,
  },
  menuScroll: {
    flex: 1,
    marginTop: 18,
  },
  menuContent: {
    paddingBottom: 14,
  },
  tileGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  tile: {
    width: "48.5%",
    minHeight: 96,
    borderRadius: 22,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EAE4",
    padding: 14,
    marginBottom: 10,
    justifyContent: "space-between",
  },
  tileIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#E7F0E2",
    alignItems: "center",
    justifyContent: "center",
  },
  tileText: {
    color: "#10251B",
    fontSize: 15,
    fontWeight: "900",
    lineHeight: 19,
  },
  group: {
    marginBottom: 14,
  },
  groupTitle: {
    marginBottom: 10,
    paddingHorizontal: 2,
    color: "#10251B",
    fontSize: 14,
    fontWeight: "900",
  },
  listItem: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E1EAE4",
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 13,
    backgroundColor: "#E7F0E2",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  itemCopy: {
    flex: 1,
    minWidth: 0,
  },
  itemText: {
    fontSize: 14,
    fontWeight: "900",
    color: "#10251B",
  },
  logoutSection: {
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#DDE7DE",
  },
  logout: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF6F6",
    borderWidth: 1,
    borderColor: "#F0CACA",
    borderRadius: 18,
    paddingHorizontal: 12,
  },
  logoutIcon: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "#FDE5E5",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  logoutCopy: {
    flex: 1,
  },
  logoutText: {
    color: "#B91C1C",
    fontSize: 14,
    fontWeight: "900",
  },
  logoutSub: {
    marginTop: 2,
    color: "#D18181",
    fontSize: 11,
    fontWeight: "700",
  },
});
