import React, { useMemo, useState, useCallback } from "react";
import { View, StyleSheet } from "react-native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useFocusEffect } from "@react-navigation/native";

import AppLayout from "./AppLayout";
import NewBottomNav from "./NewBottomNav";

import MainCenter from "./MainCenter";
import Map from "./Map";
import IncidentReportScreen from "./IncidentReportingScreen";
import Profile from "./Profile";
import RiskHeatMap from "./RiskHeatMap";
import Guidelines from "./Guidelines";
import SafetyMark from "./SafetyMark";

import HazardMap from "./map/hazardMap";

import { MapContext } from "./contexts/MapContext";
import SearchProvider from "./SearchContext";
import api from "../lib/api";

const Stack = createNativeStackNavigator();

export default function AppShell() {
  /* =========================
     PANEL + ROUTING STATE
  ========================= */

  const [panelState, setPanelState] = useState("HIDDEN");
  const [panelY, setPanelY] = useState(null);
  const [routeRequested, setRouteRequested] = useState(false);

  /* =========================
     EVAC + ROUTE DATA
  ========================= */

  const [evac, setEvac] = useState(null);
  const [evacPlaces, setEvacPlaces] = useState([]);

  const [routes, setRoutes] = useState([]);
  const [activeRoute, setActiveRoute] = useState(null);
  const [travelMode, setTravelMode] = useState("walking");

  /* =========================
     INCIDENT REPORTS
  ========================= */

  const [incidents, setIncidents] = useState([]);

  /* =========================
     ✅ HAZARD TOGGLES (CRITICAL FIX)
     SINGLE SOURCE OF TRUTH
  ========================= */

  const [showFloodMap, setShowFloodMap] = useState(false);
  const [showEarthquakeHazard, setShowEarthquakeHazard] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let mounted = true;

      // ✅ FETCH INCIDENTS
      api
        .get("/incident/getIncidents")
        .then((res) => {
          if (mounted && Array.isArray(res.data)) {
            setIncidents(res.data);
          }
        })
        .catch((err) => {
          console.log("[AppShell] failed to fetch incidents", err);
        });

      // ✅ FETCH EVACUATION CENTERS
      api
        .get("/evacs")
        .then((res) => {
          if (mounted && Array.isArray(res.data)) {
            setEvacPlaces(res.data);
          }
        })
        .catch((err) => {
          console.log("[AppShell] failed to fetch evac places", err);
        });

      return () => {
        mounted = false;
      };
    }, [])
  );

  /* =========================
     MAP CONTEXT VALUE ✅ FIXED
  ========================= */

  const mapContextValue = useMemo(
    () => ({
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

      // ✅ HAZARD STATE EXPOSED
      showFloodMap,
      setShowFloodMap,
      showEarthquakeHazard,
      setShowEarthquakeHazard,
    }),
    [
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
    ]
  );

  /* =========================
     RENDER
  ========================= */

  return (
    <View style={styles.root}>
      <MapContext.Provider value={mapContextValue}>
        <SearchProvider>
          <AppLayout>
            <Stack.Navigator screenOptions={{ headerShown: false }}>
              <Stack.Screen name="Map" component={Map} />
              <Stack.Screen name="MainCenter" component={MainCenter} />

              <Stack.Screen
                name="IncidentReport"
                component={IncidentReportScreen}
              />
              <Stack.Screen name="Profile" component={Profile} />
              <Stack.Screen name="RiskHeatMap" component={RiskHeatMap} />
              <Stack.Screen name="Guidelines" component={Guidelines} />
              <Stack.Screen name="Connection" component={SafetyMark} />

              <Stack.Screen name="HazardMap" component={HazardMap} />
            </Stack.Navigator>
          </AppLayout>
        </SearchProvider>
      </MapContext.Provider>

      {/* Bottom navigation */}
      <View style={styles.navWrapper} pointerEvents="box-none">
        <NewBottomNav />
      </View>
    </View>
  );
}

/* =========================
   STYLES
========================= */

const styles = StyleSheet.create({
  root: { flex: 1 },

  navWrapper: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 200,
    elevation: 200,
  },
});
