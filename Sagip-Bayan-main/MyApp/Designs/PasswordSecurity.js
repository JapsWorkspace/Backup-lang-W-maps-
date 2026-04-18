// Designs/PasswordSecurity.js
import { Platform, StyleSheet } from "react-native";

/** Green + Yellow theme (aligned with Profile) */
export const COLORS = {
  bg: "#FFFFFF",
  text: "#0B1220",
  textMuted: "#6B7280",

  green: "#14532D",
  greenBright: "#16A34A",
  yellow: "#FACC15",

  sheetBg: "#FFFFFF",
  inputBorder: "#14532D",
  placeholder: "#94A3B8",

  primary: "#14532D",
  primaryText: "#FFFFFF",

  danger: "#DC2626",
};

export const METRICS = {
  phoneMaxWidth: 390,
  padH: 20,
  padTop: 30,
  cardR: 12,
  inputH: 44,
  btnH: 48,
};

const styles = StyleSheet.create({
  webFrame: {
    flex: 1,
    alignItems: "center",
    backgroundColor: Platform.OS === "web" ? "#f0f0f0" : COLORS.bg,
  },
  phone: {
    flex: 1,
    width: "100%",
    maxWidth: METRICS.phoneMaxWidth,
    backgroundColor: COLORS.bg,
    position: "relative",
    paddingHorizontal: METRICS.padH,
    paddingTop: METRICS.padTop,
  },

  /** Header with back button (same as Profile) */
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
  subText: {
    fontSize: 13,
    color: COLORS.textMuted,
    marginBottom: 12,
  },

  formWrapper: {
    marginTop: 8,
    alignItems: "center",
  },

  input: {
    width: "100%",
    height: METRICS.inputH,
    borderWidth: 2,
    borderColor: COLORS.inputBorder,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginVertical: 6,
    color: COLORS.text,
    backgroundColor: "#FFFFFF",
    fontSize: 15,
  },
  error: {
    color: COLORS.danger,
    marginTop: -2,
    marginBottom: 6,
    alignSelf: "flex-start",
    fontSize: 12,
  },

  twoFAWrapper: {
    marginTop: 20,
    width: "100%",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.green,
    marginBottom: 6,
  },
  subInfo: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 10,
  },
  status: {
    marginTop: 6,
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.green,
  },

  button: {
    width: "100%",
    height: METRICS.btnH,
    backgroundColor: COLORS.green,
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 24,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.green,
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  buttonText: {
    color: COLORS.primaryText,
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: 0.4,
  },

  bottomNavWrapper: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    backgroundColor: "transparent",
    alignItems: "center",
    justifyContent: "center",
  },
});
export default styles;