// Designs/NewBottomNav.js
import { StyleSheet, Platform } from "react-native";

export const COLORS = {
  BAR_BG: "#F4F4F5", // dirty white
  ACTIVE: "#16A34A",
  INACTIVE: "#9CA3AF",
};

export const METRICS = {
  BAR_HEIGHT: 72,
  FAB_SIZE: 56,
};

export default StyleSheet.create({
  safe: {
    backgroundColor: COLORS.BAR_BG,

    /* ✅ FORCE NAV TO BE ABOVE EVERYTHING */
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,      // iOS + Android
    elevation: 9999,   // Android
  },

  root: {
    backgroundColor: COLORS.BAR_BG,
  },

  barContainer: {
    height: METRICS.BAR_HEIGHT,
    backgroundColor: COLORS.BAR_BG,
  },

  tabRow: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: METRICS.BAR_HEIGHT,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
  },

  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  icon: {
    width: 22,
    height: 22,
    marginBottom: 2,
  },

  label: {
    fontSize: 11,
    color: COLORS.INACTIVE,
  },

  labelActive: {
    color: COLORS.ACTIVE,
    fontWeight: "700",
  },

  fabWrapper: {
    position: "absolute",
    top: -METRICS.FAB_SIZE / 2,
    left: "50%",
    marginLeft: -METRICS.FAB_SIZE / 2,
    width: METRICS.FAB_SIZE,
    height: METRICS.FAB_SIZE,
    borderRadius: METRICS.FAB_SIZE / 2,
    backgroundColor: COLORS.ACTIVE,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,

    ...Platform.select({
      ios: {
        shadowColor: COLORS.ACTIVE,
        shadowOpacity: 0.35,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 6 },
      },
      android: {
        elevation: 15,
      },
    }),
  },

  fabIcon: {
    width: 26,
    height: 26,
    tintColor: "#fff",
  },

  /* ✅ WHITE U‑SHAPE ILLUSION */
  notchMask: {
    position: "absolute",
    top: 0,
    left: "50%",
    marginLeft: -50,
    width: 100,
    height: 50,
    backgroundColor: "#FFFFFF",
    borderBottomLeftRadius: 140,
    borderBottomRightRadius: 140,
    zIndex: 10,
  },
});