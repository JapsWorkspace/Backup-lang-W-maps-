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
import SafetyMark from "./SafetyMark";
import PersonalDetails from "./PersonalDetails";
import PasswordSecurity from "./PasswordSecurity";

import { MapContext } from "./contexts/MapContext";
import SearchProvider from "./SearchContext";
import api from "../lib/api";

const Stack = createNativeStackNavigator();

export default function AppShell() {
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
    currentScreen === "Map" || currentScreen === "MainCenter";

  return (
    <View style={styles.root}>
      <MapContext.Provider value={mapContextValue}>
        <SearchProvider>
          <AppLayout currentScreen={currentScreen}>
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
            </Stack.Navigator>
          </AppLayout>
        </SearchProvider>

        {showBottomNav && (
          <View style={styles.navWrapper} pointerEvents="auto">
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
    bottom: 0,
    height: 120,
    zIndex: 99999,
    elevation: 99999,
    justifyContent: "flex-end",
  },
});