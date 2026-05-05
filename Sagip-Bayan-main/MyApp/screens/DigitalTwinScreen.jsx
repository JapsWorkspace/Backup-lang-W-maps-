import React, { useRef, useState } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from "react-native";
import { WebView } from "react-native-webview";

const UNITY_WEBGL_URL = "https://sagipbayan.com/digital-twin-mobile";

export default function DigitalTwinScreen({ navigation }) {
  const webViewRef = useRef(null);
  const [loading, setLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const reloadSimulation = () => {
    setHasError(false);
    setLoading(true);
    webViewRef.current?.reload();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Flood Digital Twin</Text>
          <Text style={styles.subtitle}>Realtime Water Level Simulation</Text>
        </View>

        <TouchableOpacity style={styles.reloadButton} onPress={reloadSimulation}>
          <Text style={styles.reloadText}>Reload</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.webContainer}>
        {loading && !hasError && (
          <View style={styles.loader}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Loading simulation...</Text>
          </View>
        )}

        {hasError ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorTitle}>Simulation failed to load</Text>
            <Text style={styles.errorText}>
              Please check your internet connection or Unity WebGL link.
            </Text>

            <TouchableOpacity style={styles.retryButton} onPress={reloadSimulation}>
              <Text style={styles.retryText}>Try Again</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <WebView
            ref={webViewRef}
            source={{ uri: UNITY_WEBGL_URL }}
            javaScriptEnabled={true}
            domStorageEnabled={true}
            originWhitelist={["*"]}
            allowsFullscreenVideo={true}
            mixedContentMode="always"
            startInLoadingState={true}
            onLoadStart={() => setLoading(true)}
            onLoadEnd={() => setLoading(false)}
            onError={(event) => {
              console.log("WebView error:", event.nativeEvent);
              setHasError(true);
              setLoading(false);
            }}
            onHttpError={(event) => {
              console.log("WebView HTTP error:", event.nativeEvent);
            }}
            style={styles.webview}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f4f7fb",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 2,
  },
  reloadButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: "#0f766e",
  },
  reloadText: {
    color: "#ffffff",
    fontWeight: "700",
  },
  webContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  webview: {
    flex: 1,
    backgroundColor: "#000000",
  },
  loader: {
    position: "absolute",
    zIndex: 10,
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f4f7fb",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 14,
    color: "#334155",
  },
  errorBox: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#f4f7fb",
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#991b1b",
    marginBottom: 8,
  },
  errorText: {
    fontSize: 14,
    color: "#475569",
    textAlign: "center",
    marginBottom: 16,
  },
  retryButton: {
    backgroundColor: "#0f766e",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryText: {
    color: "#ffffff",
    fontWeight: "700",
  },
});