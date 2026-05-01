import React, { useMemo, useState, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import AppLayout from "./AppLayout";
import NewBottomNav from "./NewBottomNav";

import MainCenter from "./MainCenter";
import Map from "./Map";
import Profile from "./Profile";
import Guidelines from "./Guidelines";
import Announcement from "./Announcement";
import SafetyMark from "./SafetyMark";
import PersonalDetails from "./PersonalDetails";
import PasswordSecurity from "./PasswordSecurity";
import DonationScreen from "./DonationScreen";
import Settings from "./Settings";

import { MapContext } from "./contexts/MapContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { useTheme } from "./contexts/ThemeContext";
import SearchProvider from "./SearchContext";
import api from "../lib/api";

const Stack = createNativeStackNavigator();
const MAP_UI_SCREENS = new Set(["Map"]);

export default function AppShell() {
  const { theme } = useTheme();
  const [activeMapModule, setActiveMapModule] = useState(null);
  const [panelState, setPanelState] = useState("HIDDEN");
  const [panelY, setPanelY] = useState(null);
  const [routeRequested, setRouteRequested] = useState(false);

  const [evac, setEvac] = useState(null);
  const [evacPlaces, setEvacPlaces] = useState([]);

  const [routes, setRoutes] = useState([]);
  const [activeRoute, setActiveRoute] = useState(null);
  const [travelMode, setTravelMode] = useState("walking");

  const [incidents, setIncidents] = useState([]);

  const [showFloodMap, setShowFloodMap] = useState(false);
  const [showEarthquakeHazard, setShowEarthquakeHazard] = useState(false);

  const [isBottomNavInteracting, setIsBottomNavInteracting] = useState(false);

  const [currentScreen, setCurrentScreen] = useState("Map");
  const [drawerOpen, setDrawerOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      api
        .get("/incident/getIncidents")
        .then((res) => {
          if (mounted && Array.isArray(res.data)) {
            setIncidents(res.data);
          }
        })
        .catch((err) => console.log(err));

      api
        .get("/evacs")
        .then((res) => {
          if (mounted && Array.isArray(res.data)) {
            setEvacPlaces(res.data);
          }
        })
        .catch((err) => console.log(err));

      return () => {
        mounted = false;
      };
    }, [])
  );

  const mapContextValue = useMemo(
    () => ({
      activeMapModule,
      setActiveMapModule,

      panelState,
      setPanelState,
      panelY,
      setPanelY,

      routeRequested,
      setRouteRequested,

      evac,
      setEvac,

      evacPlaces,
      setEvacPlaces,

      routes,
      setRoutes,
      activeRoute,
      setActiveRoute,

      travelMode,
      setTravelMode,

      incidents,
      setIncidents,

      showFloodMap,
      setShowFloodMap,
      showEarthquakeHazard,
      setShowEarthquakeHazard,

      isBottomNavInteracting,
      setIsBottomNavInteracting,
    }),
    [
      activeMapModule,
      panelState,
      panelY,
      routeRequested,
      evac,
      evacPlaces,
      routes,
      activeRoute,
      travelMode,
      incidents,
      showFloodMap,
      showEarthquakeHazard,
      isBottomNavInteracting,
    ]
  );

  const showBottomNav =
    MAP_UI_SCREENS.has(currentScreen) && !drawerOpen && !activeMapModule;

  return (
    <View style={styles.root}>
      <MapContext.Provider value={mapContextValue}>
        <NotificationProvider>
          <SearchProvider>
            <AppLayout
              currentScreen={currentScreen}
              drawerOpen={drawerOpen}
              onDrawerOpenChange={setDrawerOpen}
            >
              <Stack.Navigator screenOptions={{ headerShown: false }}>
                <Stack.Screen
                  name="Map"
                  component={Map}
                  listeners={{
                    focus: () => setCurrentScreen("Map"),
                  }}
                />
                <Stack.Screen
                  name="MainCenter"
                  component={MainCenter}
                  listeners={{
                    focus: () => setCurrentScreen("MainCenter"),
                  }}
                />
                <Stack.Screen
                  name="Profile"
                  component={Profile}
                  listeners={{
                    focus: () => setCurrentScreen("Profile"),
                  }}
                />
                <Stack.Screen
                  name="Guidelines"
                  component={Guidelines}
                  listeners={{
                    focus: () => setCurrentScreen("Guidelines"),
                  }}
                />
                <Stack.Screen
                  name="Announcement"
                  component={Announcement}
                  listeners={{
                    focus: () => setCurrentScreen("Announcement"),
                  }}
                />
                <Stack.Screen
                  name="Connection"
                  component={SafetyMark}
                  listeners={{
                    focus: () => setCurrentScreen("Connection"),
                  }}
                />
                <Stack.Screen
                  name="PersonalDetails"
                  component={PersonalDetails}
                  listeners={{
                    focus: () => setCurrentScreen("PersonalDetails"),
                  }}
                />
                <Stack.Screen
                  name="PasswordSecurity"
                  component={PasswordSecurity}
                  listeners={{
                    focus: () => setCurrentScreen("PasswordSecurity"),
                  }}
                />
                <Stack.Screen
                  name="DonationScreen"
                  component={DonationScreen}
                  listeners={{
                    focus: () => setCurrentScreen("DonationScreen"),
                  }}
                />
                <Stack.Screen
                  name="Settings"
                  component={Settings}
                  listeners={{
                    focus: () => setCurrentScreen("Settings"),
                  }}
                />
              </Stack.Navigator>
            </AppLayout>
          </SearchProvider>
        </NotificationProvider>

        {showBottomNav && (
          <View
            style={[
              styles.bottomSystemArea,
              { backgroundColor: "transparent", borderTopColor: "transparent" },
            ]}
            pointerEvents="none"
          />
        )}

        {showBottomNav && (
          <View style={styles.navWrapper} pointerEvents="box-none">
            <NewBottomNav />
          </View>
        )}
      </MapContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  navWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 22,
    height: 132,
    zIndex: 99999,
    elevation: 99999,
    justifyContent: "flex-end",
    backgroundColor: "transparent",
  },

  bottomSystemArea: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 56,
    zIndex: 99980,
    elevation: 99980,
    backgroundColor: "#f6faf7",
    borderTopWidth: 1,
    borderTopColor: "rgba(209,224,216,0.9)",
  },
});
