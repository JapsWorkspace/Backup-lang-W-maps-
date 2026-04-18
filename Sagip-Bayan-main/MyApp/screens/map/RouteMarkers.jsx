import React from "react";
import { Marker } from "react-native-maps";

export default function RouteMarkers({ start, destination }) {
  return (
    <>
      {start && (
        <Marker
          coordinate={{
            latitude: start.lat,
            longitude: start.lng,
          }}
          title="Your location"
        />
      )}

      {destination && (
        <Marker
          coordinate={{
            latitude: destination.lat,
            longitude: destination.lng,
          }}
          title="Destination"
          pinColor="green"
        />
      )}
    </>
  );
}