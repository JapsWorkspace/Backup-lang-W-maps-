import React, { useContext, useState } from "react";
import { View, StyleSheet, Text } from "react-native";
import { useNavigation, useIsFocused } from "@react-navigation/native";

import { UserContext } from "./UserContext";
import { MapContext } from "./contexts/MapContext";
import { useSearch } from "./SearchContext";

import AppTopBar from "./components/AppTopBar";
import AppDrawer from "./components/AppDrawer";
import LogoutModal from "./components/LogoutModal";

/* =========================
   NAVIGATION LEGEND (UI ONLY)
========================= */
function NavigationLegend({ destination }) {
  return (
    <View style={styles.legend}>
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={styles.dotBlue} />
          <Text style={styles.legendText}>You</Text>
        </View>

        <View style={styles.connector}>
          <View style={styles.line} />
        </View>

        <View style={styles.legendItem}>
          <View style={styles.dotGreen} />
          <Text style={styles.legendText} numberOfLines={1}>
            {destination || "Destination"}
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function AppLayout({ children }) {
  const navigation = useNavigation();
  const isFocused = useIsFocused();

  const { setUser } = useContext(UserContext);
  const { panelState, evac } = useContext(MapContext);

  const { search, suggestions, clear } = useSearch();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [logoutVisible, setLogoutVisible] = useState(false);

  /* =========================
     IMPORTANT:
     ❌ AppLayout MUST NOT mutate panelState
     ✅ Map.jsx owns navigation lifecycle
  ========================= */

  const showLegend = panelState === "NAVIGATION" && isFocused;
  const showSearchBar = !showLegend;

  const confirmLogout = async () => {
    setLogoutVisible(false);
    await setUser(null);
  };

  return (
    <View style={styles.root}>
      {/* ===== MAP SCREEN (children = Map.jsx) ===== */}
      <View style={styles.content}>{children}</View>

      {/* ===== TOP UI ===== */}
      {showLegend ? (
        <View style={styles.topOverlay}>
          <NavigationLegend destination={evac?.name} />
        </View>
      ) : (
        showSearchBar && (
          <AppTopBar
            showSearch
            onSearchChange={search}
            suggestions={suggestions}
            onSelectSuggestion={(place) => {
              clear();
              navigation.navigate("AppShell", {
                screen: "Map",
                params: { place },
              });
            }}
            onMenuPress={() => setDrawerOpen(true)}
          />
        )
      )}

      {/* ===== DRAWER ===== */}
      {drawerOpen && (
        <AppDrawer
          onRequestClose={() => setDrawerOpen(false)}
          onLogout={() => {
            setDrawerOpen(false);
            setLogoutVisible(true);
          }}
          onNavigate={(route, params) => {
            setDrawerOpen(false);
            navigation.navigate("AppShell", {
              screen: route,
              params,
            });
          }}
        />
      )}

      <LogoutModal
        visible={logoutVisible}
        onCancel={() => setLogoutVisible(false)}
        onConfirm={confirmLogout}
      />


  
    </View>
  );
}

/* =========================
   STYLES
========================= */
const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  content: {
    flex: 1,
    position: "relative",
  },

  topOverlay: {
    position: "absolute",
    top: 55,
    left: 16,
    right: 16,
    zIndex: 2000,
  },

  legend: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    elevation: 4,
  },

  legendRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    maxWidth: "40%",
  },

  legendText: {
    marginLeft: 6,
    fontSize: 14,
    fontWeight: "500",
    color: "#111827",
  },

  connector: {
    flex: 1,
    alignItems: "center",
    marginHorizontal: 8,
  },

  line: {
    height: 2,
    width: "100%",
    backgroundColor: "#e5e7eb",
    borderRadius: 1,
  },

  dotBlue: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2563eb",
  },

  dotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#16a34a",
  },
});
