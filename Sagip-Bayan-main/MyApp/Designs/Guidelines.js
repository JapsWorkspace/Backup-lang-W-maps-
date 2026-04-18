// Designs/Guidelines.js
import { Platform, StyleSheet } from "react-native";

/** Green + Yellow theme (aligned with your other screens) */
export const COLORS = {
  bg: "#FFFFFF",
  text: "#0B1220",
  textMuted: "#6B7280",

  green: "#14532D",
  greenBright: "#16A34A",
  yellow: "#FACC15",

  cardBg: "#FFFFFF",
  border: "#E5E7EB",
  placeholder: "#94A3B8",
  link: "#0EA5E9",
};

export const METRICS = {
  phoneMaxWidth: 390,
  padH: 16,
  padTop: 18,
  rowR: 12,
  chipR: 18,
  inputH: 44,
};

const styles = StyleSheet.create({
  /* Frame */
  container: {
    flex: 1,
    alignItems: "center",
    backgroundColor: Platform.OS === "web" ? "#f0f0f0" : COLORS.bg,
  },
  phone: {
    flex: 1,
    width: "100%",
    maxWidth: METRICS.phoneMaxWidth,
    backgroundColor: COLORS.bg,
    paddingHorizontal: METRICS.padH,
    paddingTop: METRICS.padTop,
  },

  /* Header with back button */
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  backBtn: {
    width: 38, height: 38,
    borderRadius: 19,
    borderWidth: 2,
    borderColor: COLORS.green,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  backGlyph: {
    width: 12, height: 12,
    borderLeftWidth: 3, borderBottomWidth: 3,
    borderColor: COLORS.green,
    transform: [{ rotate: "45deg" }],
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.green,
  },

  /* Search */
  searchInput: {
    height: METRICS.inputH,
    borderWidth: 2,
    borderColor: COLORS.green,
    borderRadius: 12,
    paddingHorizontal: 12,
    color: COLORS.text,
    backgroundColor: "#FFFFFF",
    marginBottom: 8,
  },
  suggestionsContainer: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    marginBottom: 10,
    overflow: "hidden",
  },
  suggestionItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  /* Category chips */
  filterContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: METRICS.chipR,
    borderWidth: 2,
    borderColor: COLORS.green,
    backgroundColor: "#FFFFFF",
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    backgroundColor: COLORS.green,
  },
  chipText: {
    fontSize: 12,
    color: COLORS.green,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  chipTextActive: {
    color: "#FFFFFF",
  },

  /* List card */
  card: {
    backgroundColor: COLORS.cardBg,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 6,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginBottom: 6,
  },
  metaPill: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    marginRight: 6,
    marginBottom: 6,
  },
  metaText: {
    fontSize: 11,
    color: COLORS.textMuted,
    fontWeight: "700",
  },
  desc: {
    fontSize: 13,
    color: COLORS.text,
    lineHeight: 18,
  },

  attachHeader: {
    marginTop: 10,
    fontWeight: "800",
    color: COLORS.green,
  },
  link: {
    color: COLORS.link,
    textDecorationLine: "underline",
    marginTop: 5,
  },
});

export default styles;