import api from "./api";

export function saveSafetyDebugLocation(payload) {
  return api.post("/api/safety-marking/debug-location", payload);
}

export function getSafetyDebugLocations() {
  return api.get("/api/safety-marking/debug-locations");
}

export function turnOffSafetyDebugLocation(userId) {
  return api.patch("/api/safety-marking/debug-location/off", { userId });
}
