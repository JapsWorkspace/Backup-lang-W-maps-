// Designs/StepPersonal.js
import { StyleSheet } from "react-native";

export default StyleSheet.create({
  /* ================= CONTAINER ================= */
  container: {
    padding: 24,
    backgroundColor: "#FFFFFF",
    paddingBottom: 64, // prevents keyboard overlap
  },

  /* ================= IMAGE ================= */
  image: {
    width: "100%",
    height: 200,
    resizeMode: "contain",
    marginTop: 40,
    marginBottom: 8,
  },

  /* ================= TEXT ================= */
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#166534",
    textAlign: "center",
    marginTop: 12,
  },

  subtext: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 4,
    marginBottom: 20,
  },

  /* ================= INPUT ================= */
  input: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 14,
    marginBottom: 12,
    backgroundColor: "#FFFFFF",
  },

  /* ================= ERROR ================= */
  error: {
    color: "#DC2626", // red
    fontSize: 12,
    marginBottom: 6,
  },

  /* ================= BUTTON ================= */
  button: {
    backgroundColor: "#166534",
    paddingVertical: 16,
    borderRadius: 8,
    marginTop: 20,
  },

  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    textAlign: "center",
    fontSize: 14,
  },
});