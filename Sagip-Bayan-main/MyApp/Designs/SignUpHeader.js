import { StyleSheet } from "react-native";

export default StyleSheet.create({
  container: {
    paddingTop: 40,
    paddingBottom: 12,
    backgroundColor: "#fff",
  },

  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },

  backText: {
    fontSize: 22,
    color: "#166534",
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#374151",
  },

  progressRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 10,
  },

  circle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#d1d5db",
    marginHorizontal: 6,
  },

  activeCircle: {
    backgroundColor: "#166534",
    width: 26,
    borderRadius: 5,
  },

  stepTitle: {
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginTop: 14,
  },
});