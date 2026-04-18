import { createContext } from "react";

export const MapContext = createContext({
  /* =========================
     PANEL STATE
  ========================= */

  panelState: "PLACE_INFO",
  setPanelState: () => {
    throw new Error("setPanelState not provided");
  },

  /* =========================
     PANEL POSITION (DRAG)
     null = not positioned yet
  ========================= */

  panelY: null,
  setPanelY: () => {
    throw new Error("setPanelY not provided");
  },

  /* =========================
     SELECTED EVAC PLACE
     full MongoDB document
  ========================= */

  evac: null,
  setEvac: () => {
    throw new Error("setEvac not provided");
  },

  /* =========================
     EVACUATION PLACES ✅
  ========================= */

  evacPlaces: [],
  setEvacPlaces: () => {
    throw new Error("setEvacPlaces not provided");
  },

  /* =========================
     ROUTING
  ========================= */

  routes: [],
  setRoutes: () => {
    throw new Error("setRoutes not provided");
  },

  activeRoute: null,
  setActiveRoute: () => {
    throw new Error("setActiveRoute not provided");
  },

  travelMode: "walking",
  setTravelMode: () => {
    throw new Error("setTravelMode not provided");
  },

  routeRequested: false,
  setRouteRequested: () => {
    throw new Error("setRouteRequested not provided");
  },

  /* =========================
     INCIDENT REPORTS ✅
  ========================= */

  incidents: [],
  setIncidents: () => {
    throw new Error("setIncidents not provided");
  },

  /* =========================
     ✅ HAZARD TOGGLES (FIX)
     SINGLE SOURCE OF TRUTH
  ========================= */

  showFloodMap: false,
  setShowFloodMap: () => {
    throw new Error("setShowFloodMap not provided");
  },

  showEarthquakeHazard: false,
  setShowEarthquakeHazard: () => {
    throw new Error("setShowEarthquakeHazard not provided");
  },
});
