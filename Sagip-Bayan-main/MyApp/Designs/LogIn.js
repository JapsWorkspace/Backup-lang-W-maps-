// Designs/LogIn.js
import { StyleSheet, Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");

export const COLORS = {
  base: "#053101",
  dark: "#032500",
  mid: "#0C4308",
  light: "#25B01A",
  white: "#FFFFFF",
  placeholder: "#5E7E5E",
  danger: "#DC2626",
  gold: "#FFC82C",
};

export default StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.base,
  },

  safeDark: {
    backgroundColor: "#020617",
  },

  keyboard: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
  },

  /* ===== CAMO STRIPES (SAME AS GETSTARTED) ===== */

  stripeTop: {
    position: "absolute",
    top: -150,
    left: -width,
    width: width * 2,
    height: height * 0.35,
    backgroundColor: COLORS.dark,
    transform: [{ rotate: "-12deg" }],
  },

  stripeMid: {
    position: "absolute",
    top: height * 0.15,
    left: -width,
    width: width * 2,
    height: height * 0.35,
    backgroundColor: COLORS.mid,
    transform: [{ rotate: "-12deg" }],
  },

  stripeMid2: {
    position: "absolute",
    top: height * 0.35,
    left: -width,
    width: width * 2,
    height: height * 0.25,
    backgroundColor: COLORS.dark,
    transform: [{ rotate: "-12deg" }],
  },

  stripeBottom: {
    position: "absolute",
    bottom: -200,
    left: -width,
    width: width * 2,
    height: height * 0.4,
    backgroundColor: COLORS.light,
    transform: [{ rotate: "-12deg" }],
  },

  /* ===== CONTENT ===== */

  pageContainer: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingTop: 24,
  },

  logo: {
    width: width * 2.75,
    height: 180,
    marginBottom: 56,
  },

  /* ===== FULL-WIDTH PANEL ===== */

  panel: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingTop: 30,

    // ensure panel sticks to bottom visually
    minHeight: height * 0.55,

    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: -6 },
    elevation: 10,
  },

  panelDark: {
    backgroundColor: "#0F172A",
  },

  panelTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "900",
    color: "#10251B",
  },

  panelTitleDark: {
    color: "#F8FAFC",
  },

  panelSubtitle: {
    marginTop: 6,
    marginBottom: 20,
    color: "#64748B",
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
  },

  panelSubtitleDark: {
    color: "#CBD5E1",
  },

  input: {
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 16,
    marginBottom: 12,
    backgroundColor: COLORS.white,
    color: "#111827",
    fontSize: 15,
    fontWeight: "700",
  },

  inputDark: {
    backgroundColor: "#111827",
    borderColor: "#334155",
    color: "#F8FAFC",
  },

  passwordWrap: {
    position: "relative",
  },

  passwordInput: {
    paddingRight: 52,
  },

  eyeButton: {
    position: "absolute",
    right: 14,
    top: 12,
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  button: {
    backgroundColor: "#136D2A",
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: 10,
  },

  buttonDisabled: {
    opacity: 0.65,
  },

  buttonText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 16,
  },

  forgotText: {
    color: "#166534",
    fontWeight: "800",
    textAlign: "right",
  },

  loginOptionsRow: {
    marginBottom: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },

  staySignedInButton: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },

  staySignedInText: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "800",
  },

  staySignedInTextDark: {
    color: "#CBD5E1",
  },

  registerText: {
    marginTop: 20,
    textAlign: "center",
    fontSize: 15,
    color: "#334155",
    fontWeight: "600",
  },

  registerTextDark: {
    color: "#CBD5E1",
  },

  registerLink: {
    color: "#166534",
    fontWeight: "900",
  },

  helperText: {
    textAlign: "center",
    marginTop: 14,
    color: "#333",
  },

  secondaryButton: {
    borderWidth: 1.5,
    borderColor: "#136D2A",
    borderRadius: 18,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 10,
  },

  secondaryButtonText: {
    color: "#136D2A",
    fontWeight: "700",
  },

  error: {
    color: COLORS.danger,
    marginBottom: 8,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
});
