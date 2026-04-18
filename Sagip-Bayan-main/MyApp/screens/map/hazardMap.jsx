import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ScrollView,
  StyleSheet,
  Dimensions
} from 'react-native';

import MapView, { Marker, Polygon, Callout } from 'react-native-maps';
import axios from 'axios';
import * as turf from '@turf/turf';

import areasData from '../data/area.json';
import jaenGeoJSON from '../data/jaen.json';
import susceptibleData from '../data/Susceptible_clean.json';
import mediumData from '../data/Medium.json';
import safeData from '../data/Safe.json';

import stylesUI, { METRICS } from "../../Designs/IncidentReporting";
import { Animated, PanResponder, KeyboardAvoidingView, Platform } from "react-native";

export default function hazarddMap() {
  const mapRef = useRef(null);

  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [highlightData, setHighlightData] = useState(null);
  const [visibleMarkers, setVisibleMarkers] = useState([]);

  const [barangayList, setBarangayList] = useState([]);
  const [barangayMap, setBarangayMap] = useState({});

  const [checkedBarangays, setCheckedBarangays] = useState({});
  const [checkedGeoJSON, setCheckedGeoJSON] = useState([]);
  const [checkedMarkers, setCheckedMarkers] = useState([]);

  const [showIncidents, setShowIncidents] = useState(false);
  const [incidents, setIncidents] = useState([]);
  const [showEvacPlaces, setShowEvacPlaces] = useState(false);
  const [evacPlaces, setEvacPlaces] = useState([]);
  const [showEarthquakeHazard, setShowEarthquakeHazard] = useState(false);

  const [mapRegion, setMapRegion] = useState({
    latitude: 15.32,
    longitude: 120.92,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05
  });

  const topSearchStyle = {
  position: "absolute",
  top: 50,
  left: 16,
  right: 16,
  zIndex: 20
};

useEffect(() => {
  const fetchIncidents = async () => {
    try {
      const res = await axios.get(
        "https://landfall-moonwalk-petroleum.ngrok-free.dev/incident/getIncidents"
      );

      setIncidents(res.data);
    } catch (err) {
      console.log("Incident fetch error:", err);
    }
  };

  fetchIncidents();
}, []);

   useEffect(() => {
    if (!mapRef.current) return;

    mapRef.current.animateToRegion(mapRegion, 1000);
  }, [mapRegion]);

  useEffect(() => {
  const fetchEvacPlaces = async () => {
    try {
      const res = await axios.get(
        "https://landfall-moonwalk-petroleum.ngrok-free.dev/evacs"
      );

      setEvacPlaces(res.data);
    } catch (err) {
      console.log("Evac fetch error:", err);
    }
  };

  fetchEvacPlaces();
}, []);

  const [showFloodMap, setShowFloodMap] = useState(false);

  // 🔹 Extract polygon coordinates
  const extractCoords = (geojson) => {
    let coords = [];

    geojson.features.forEach(f => {
      if (f.geometry.type === "Polygon") {
        coords.push(f.geometry.coordinates[0]);
      } else if (f.geometry.type === "MultiPolygon") {
        f.geometry.coordinates.forEach(poly => {
          coords.push(poly[0]);
        });
      }
    });

    return coords.map(ring =>
      ring.map(c => ({
        latitude: c[1],
        longitude: c[0]
      }))
    );
  };

  const floodStyles = {
  susceptible: {
    strokeColor: "rgba(75, 0, 130, 1)",     // indigo
    fillColor: "rgba(75, 0, 130, 0.5)",
    strokeWidth: 1
  },
  medium: {
    strokeColor: "rgba(128, 0, 128, 1)",    // purple
    fillColor: "rgba(128, 0, 128, 0.5)",
    strokeWidth: 1
  },
  safe: {
    strokeColor: "rgba(135, 206, 235, 1)",  // skyblue
    fillColor: "rgba(135, 206, 235, 0.5)",
    strokeWidth: 1
  }
};

const earthquakeStyle = {
  strokeColor: "rgba(255, 0, 0, 1)",
  fillColor: "rgba(255, 0, 0, 0.3)",
  strokeWidth: 2
};

const highlightStyle = {
  strokeColor: "rgba(255, 0, 0, 0.6)",   // red with opacity
  strokeWidth: 2,
  fillColor: "rgba(0,0,0,0)"              // no fill
  // ❌ dashArray & lineCap NOT supported in react-native-maps
};

const jaenStyle = {
  strokeColor: "rgba(8, 102, 31, 0.6)",   // #08661f with opacity
  strokeWidth: 2,
  fillColor: "rgba(0,0,0,0)"
};

  const getBoundsFromGeoJSON = (geojson) => {
  let allCoords = [];

  geojson.features.forEach(f => {
    const coords = f.geometry.coordinates;

    if (f.geometry.type === "MultiPolygon") {
      coords.forEach(poly =>
        poly.forEach(ring =>
          ring.forEach(c => allCoords.push(c))
        )
      );
    } else if (f.geometry.type === "Polygon") {
      coords.forEach(ring =>
        ring.forEach(c => allCoords.push(c))
      );
    }
  });

  const lats = allCoords.map(c => c[1]);
  const lngs = allCoords.map(c => c[0]);

  return {
    minLat: Math.min(...lats),
    maxLat: Math.max(...lats),
    minLng: Math.min(...lngs),
    maxLng: Math.max(...lngs),
  };
};

const flyToBounds = (geojson) => {
  if (!mapRef.current || !geojson) return;

  const b = getBoundsFromGeoJSON(geojson);

  const centerLat = (b.minLat + b.maxLat) / 2;
  const centerLng = (b.minLng + b.maxLng) / 2;

  const latDelta = (b.maxLat - b.minLat) * 1.5;
  const lngDelta = (b.maxLng - b.minLng) * 1.5;

  mapRef.current.animateToRegion({
    latitude: centerLat,
    longitude: centerLng,
    latitudeDelta: latDelta,
    longitudeDelta: lngDelta,
  }, 1200);
};

const jaenBounds = useMemo(() => {
  return getBoundsFromGeoJSON(jaenGeoJSON);
}, []);

const isInsideBounds = (region, bounds) => {
  return (
    region.latitude >= bounds.minLat &&
    region.latitude <= bounds.maxLat &&
    region.longitude >= bounds.minLng &&
    region.longitude <= bounds.maxLng
  );
};

const onRegionChangeComplete = (region) => {
  setMapRegion(region);

  if (!highlightData) {
    // 🔒 LOCK TO JAEN
    if (!isInsideBounds(region, jaenBounds)) {
      flyToBounds(jaenGeoJSON);
    }
    return;
  }

  // 🎯 WITH POLYGON
  const polyBounds = getBoundsFromGeoJSON(highlightData);

  const outsidePolygon = !isInsideBounds(region, polyBounds);
  const outsideJaen = !isInsideBounds(region, jaenBounds);

  if (outsidePolygon && outsideJaen) {
    flyToBounds(highlightData);
  }
};

 const getPointsInsidePolygon = (geojson) => {
  if (!geojson || !geojson.features) return [];

  return areasData.features.filter(pt => {
    try {
      return geojson.features.some(poly => {
        if (!poly.geometry) return false;

        return turf.booleanPointInPolygon(
          turf.point(pt.geometry.coordinates), // ✅ FORCE POINT
          poly.geometry
        );
      });
    } catch (e) {
      return false;
    }
  });
};


  // 🔹 Fetch barangays
  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get("https://landfall-moonwalk-petroleum.ngrok-free.dev/api/barangays/collection");

        const map = {};
        res.data.forEach(bc => {
          bc.features.forEach(f => {
            map[f.properties.name] = bc;
          });
        });

        setBarangayMap(map);
        setBarangayList(Object.keys(map));
      } catch (err) {
        console.log(err);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
  const timer = setTimeout(() => {
    if (mapRef.current) {
      flyToBounds(jaenGeoJSON);
    }
  }, 500); // wait for map to load

  return () => clearTimeout(timer);
}, []);

  // 🔹 Suggestions
  useEffect(() => {
    if (!searchText) return setSuggestions([]);

    const filtered = barangayList.filter(name =>
      name.toLowerCase().includes(searchText.toLowerCase())
    );

    setSuggestions(filtered.slice(0, 5));
  }, [searchText, barangayList]);

  // 🔹 Handle select
  const handleSelect = (name) => {
    setSearchText(name);
    setSuggestions([]);

    const data = barangayMap[name];
    if (!data) return;

    setHighlightData(data);
    flyToBounds(data);

    const centroid = turf.centerOfMass(data);
    const [lng, lat] = centroid.geometry.coordinates;

    setMapRegion({
      latitude: lat,
      longitude: lng,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01
    });

    const inside = getPointsInsidePolygon(data);
console.log("INSIDE COUNT:", inside.length);
setVisibleMarkers(inside);

    setVisibleMarkers(inside);
  };
  

  // 🔹 Checkbox logic
  const handleCheckboxChange = (name) => {
    const isChecked = !checkedBarangays[name];

    setCheckedBarangays(prev => ({
      ...prev,
      [name]: isChecked
    }));

    const geo = barangayMap[name];
    if (!geo) return;

    if (isChecked) {
      setCheckedGeoJSON(prev => [...prev, geo]);

      const inside = getPointsInsidePolygon(geo);

      setCheckedMarkers(prev => {
        const combined = [...prev, ...inside];
        return combined.filter(
          (v, i, a) =>
            a.findIndex(t => t.properties.name === v.properties.name) === i
        );
      });

    } else {
      setCheckedGeoJSON(prev =>
        prev.filter(g =>
          !g.features.some(f => f.properties.name === name)
        )
      );

      setCheckedMarkers(prev =>
        prev.filter(pt =>
          !geo.features.some(poly =>
            turf.booleanPointInPolygon(pt, poly.geometry)
          )
        )
      );
    }
  };

  // 🔹 Render polygons
  const renderPolygons = (data, style) => {
  if (!data || !data.features) return null;

  return data.features.map((feature, idx) => {
    const coords = feature.geometry.coordinates;

    const polygons =
      feature.geometry.type === "MultiPolygon"
        ? coords
        : [coords];

    return polygons.map((polygon, pIdx) => (
      <Polygon
        key={`${idx}-${pIdx}`}
        coordinates={polygon[0].map(coord => ({
          latitude: coord[1],
          longitude: coord[0]
        }))}
        strokeColor={style.strokeColor}
        fillColor={style.fillColor}
        strokeWidth={style.strokeWidth}
      />
    ));
  });
};

  const renderPolygons1 = (data, style) => {
  if (!data || !data.features) return null;

  return data.features.map((feature, idx) => {
    const coords = feature.geometry.coordinates;

    // Handle Polygon and MultiPolygon
    const polygons =
      feature.geometry.type === "MultiPolygon"
        ? coords
        : [coords];

    return polygons.map((polygon, pIdx) => (
      <Polygon
        key={`${idx}-${pIdx}`}
        coordinates={polygon[0].map(coord => ({
          latitude: coord[1],
          longitude: coord[0]
        }))}
        strokeColor={style.strokeColor}
        fillColor={style.fillColor}
        strokeWidth={style.strokeWidth}
      />
    ));
  });
};

const panelTop = METRICS.panelTop;
const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const MIN_HEIGHT = 250;
const MAX_HEIGHT = SCREEN_HEIGHT - 100;

const pan = useRef(new Animated.Value(MIN_HEIGHT)).current;
const lastOffset = useRef(MIN_HEIGHT);

const panResponder = useRef(
  PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => {
      return Math.abs(gesture.dy) > 5;
    },

    onPanResponderMove: (_, gesture) => {
      let newHeight = lastOffset.current - gesture.dy;

      if (newHeight < MIN_HEIGHT) newHeight = MIN_HEIGHT;
      if (newHeight > MAX_HEIGHT) newHeight = MAX_HEIGHT;

      pan.setValue(newHeight);
    },

    onPanResponderRelease: (_, gesture) => {
      let finalHeight = lastOffset.current - gesture.dy;

      if (finalHeight < MIN_HEIGHT) finalHeight = MIN_HEIGHT;
      if (finalHeight > MAX_HEIGHT) finalHeight = MAX_HEIGHT;

      lastOffset.current = finalHeight;

      Animated.spring(pan, {
        toValue: finalHeight,
        useNativeDriver: false,
      }).start();
    },
  })
).current;

  return (
  <View style={stylesUI.webFrame}>
    <View style={stylesUI.phone}>

      {/* 🗺️ MAP */}
      <View style={stylesUI.mapContainer}>
        <MapView
  ref={mapRef}
  style={{ flex: 1 }}
  region={mapRegion}
  onRegionChangeComplete={onRegionChangeComplete}
>
          {renderPolygons(jaenGeoJSON, jaenStyle)}

          {showFloodMap && (
            <>
              {renderPolygons1(susceptibleData, floodStyles.susceptible)}
              {renderPolygons1(mediumData, floodStyles.medium)}
              {renderPolygons1(safeData, floodStyles.safe)}
            </>
          )}
          {showEarthquakeHazard && renderPolygons(jaenGeoJSON, earthquakeStyle)}

          {showEvacPlaces &&
  evacPlaces.map((place) => (
    <Marker
  key={`evac-${place._id}`}
  coordinate={{
    latitude: place.latitude,
    longitude: place.longitude
  }}
  pinColor="blue"   // ✅ ADD THIS
>
      <Callout tooltip>
        <View style={{ width: 220, padding: 8, backgroundColor: "#fff" }}>
          
          <Text style={{ fontWeight: "bold", fontSize: 14 }}>
            {place.name}
          </Text>

          <Text>Location: {place.location}</Text>
          <Text>Barangay: {place.barangayName}</Text>

          <Text>Individuals: {place.capacityIndividual}</Text>
          <Text>Families: {place.capacityFamily}</Text>
          <Text>Beds: {place.bedCapacity}</Text>

          <Text>Status: {place.capacityStatus}</Text>

          <Text>
            CR: {place.femaleCR ? "Female ✔ " : ""}
            {place.maleCR ? "Male ✔ " : ""}
            {place.commonCR ? "Common ✔" : ""}
          </Text>

          <Text>
            Water: {place.potableWater ? "Potable ✔" : "None"}
          </Text>

          {place.remarks ? (
            <Text>Notes: {place.remarks}</Text>
          ) : null}

        </View>
      </Callout>
    </Marker>
  ))}

 {showIncidents &&
  incidents
    .filter(
      (i) =>
        typeof i.latitude === "number" &&
        typeof i.longitude === "number"
    )
    .map((incident, idx) => (
      <Marker
        key={`incident-${incident._id || idx}`}
        coordinate={{
          latitude: Number(incident.latitude),
          longitude: Number(incident.longitude)
        }}
        pinColor="red"
      >
        <Callout tooltip>
          <View style={{ width: 220, padding: 8, backgroundColor: "#fff" }}>
            
            <Text style={{ fontWeight: "bold", fontSize: 14 }}>
              {incident.type}
            </Text>

            <Text>Level: {incident.level}</Text>
            <Text>Location: {incident.location}</Text>
            <Text>Status: {incident.status}</Text>

            {incident.description && (
              <Text>Description: {incident.description}</Text>
            )}

            {incident.usernames && (
              <Text>Reported by: {incident.usernames}</Text>
            )}

          </View>
        </Callout>
      </Marker>
    ))
}

          {highlightData && renderPolygons(highlightData, highlightStyle)}

          
          {checkedGeoJSON.map((geo) =>
            renderPolygons(geo, highlightStyle)
          )}

          {/* Markers */}
        {visibleMarkers.map((pt, idx) => (
          <Marker
            key={`area-${pt.properties.name}-${idx}`}
            coordinate={{
              latitude: pt.geometry.coordinates[1],
              longitude: pt.geometry.coordinates[0]
            }}
            title={pt.properties.name}
          />
        ))}

        </MapView>
      </View>

      {/* 🔍 TOP SEARCH BAR */}
      <View style={topSearchStyle}>
        <View style={stylesUI.card}>

          <TextInput
            style={stylesUI.input}
            placeholder="Search barangay..."
            value={searchText}
            onChangeText={setSearchText}
            placeholderTextColor="#9CA3AF"
          />

          {suggestions.length > 0 && (
            <View style={{ marginTop: 6 }}>
              {suggestions.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => handleSelect(item)}
                >
                  <Text style={{ padding: 8 }}>
                    {item}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

        </View>
      </View>

      {/* 🔻 DRAGGABLE PANEL */}
<Animated.View
  style={[
    stylesUI.centerWrapper1,
    {
      height: pan, // IMPORTANT: height-driven animation
    }
  ]}
>
  {/* THIS WRAPPER IS REQUIRED FOR STABLE LAYOUT */}
  <View style={{ flex: 1 }}>
    
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={{ flex: 1 }}
    >

      <View style={[stylesUI.card, { flex: 1 }]}>
        
        {/* Drag Handle */}
        <View
          {...panResponder.panHandlers}
          style={stylesUI.dragHandle}
        />

        {/* SCROLL AREA */}
        <View style={{ flex: 1 }}>
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              flexGrow: 1,
              paddingBottom: 40,
            }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >

            <Text style={stylesUI.title}>Map Controls</Text>

            {/* 🌊 TOGGLES */}
            <Text style={stylesUI.label}>Map Layers</Text>

            <TouchableOpacity
              style={stylesUI.button}
              onPress={() => setShowFloodMap(prev => !prev)}
            >
              <Text style={stylesUI.buttonText}>
                {showFloodMap ? "Hide Flood Map" : "Show Flood Map"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
  style={stylesUI.button}
  onPress={() => setShowEarthquakeHazard(prev => !prev)}
>
  <Text style={stylesUI.buttonText}>
    {showEarthquakeHazard
      ? "Hide Earthquake Hazard"
      : "Toggle Earthquake Hazard"}
  </Text>
</TouchableOpacity>

            <TouchableOpacity
              style={stylesUI.button}
              onPress={() => setShowEvacPlaces(prev => !prev)}
            >
              <Text style={stylesUI.buttonText}>
                {showEvacPlaces ? "Hide Evac Centers" : "Show Evac Centers"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={stylesUI.button}
              onPress={() => setShowIncidents(prev => !prev)}
            >
              <Text style={stylesUI.buttonText}>
                {showIncidents ? "Hide Incidents" : "Show Incidents"}
              </Text>
            </TouchableOpacity>

            {/* ☑️ BARANGAYS */}
            <Text style={stylesUI.label}>Barangays</Text>

            <View style={{ maxHeight: 180 }}>
              <ScrollView>
                {barangayList.map((name, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => handleCheckboxChange(name)}
                  >
                    <Text style={{ paddingVertical: 4 }}>
                      {checkedBarangays[name] ? "☑" : "☐"} {name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

          </ScrollView>
        </View>

      </View>

    </KeyboardAvoidingView>

  </View>
</Animated.View>

    </View>
  </View>
);
}

