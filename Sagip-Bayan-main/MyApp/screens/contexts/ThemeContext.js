import React, { createContext, useCallback, useMemo, useState } from "react";
import { useColorScheme } from "react-native";

const light = {
  mode: "light",
  background: "#EEF3EF",
  surface: "#FFFFFF",
  surfaceAlt: "#F8FBF7",
  text: "#10251B",
  muted: "#647067",
  border: "#DCE7E1",
  primary: "#14532D",
  primarySoft: "#E7F5ED",
  danger: "#DC2626",
  warning: "#B45309",
  mapStyle: [],
};

const dark = {
  mode: "dark",
  background: "#0B1210",
  surface: "#121C18",
  surfaceAlt: "#18241F",
  text: "#F1F5F2",
  muted: "#A7B5AD",
  border: "#294038",
  primary: "#86EFAC",
  primarySoft: "#183B2A",
  danger: "#F87171",
  warning: "#FBBF24",
  mapStyle: [
    { elementType: "geometry", stylers: [{ color: "#1A2420" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#B8C7BE" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#0B1210" }] },
    { featureType: "road", elementType: "geometry", stylers: [{ color: "#26362F" }] },
    { featureType: "water", elementType: "geometry", stylers: [{ color: "#102A38" }] },
  ],
};

export const ThemeContext = createContext({
  theme: light,
  mode: "light",
  setMode: () => {},
  toggleMode: () => {},
});

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState("system");

  const resolvedMode = mode === "system" ? systemScheme || "light" : mode;
  const theme = resolvedMode === "dark" ? dark : light;

  const toggleMode = useCallback(() => {
    setMode((current) => {
      const active = current === "system" ? systemScheme || "light" : current;
      return active === "dark" ? "light" : "dark";
    });
  }, [systemScheme]);

  const value = useMemo(
    () => ({ theme, mode, setMode, toggleMode }),
    [mode, theme, toggleMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

