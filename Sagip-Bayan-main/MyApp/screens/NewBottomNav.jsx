import React from "react";
import { View, Pressable, Image, Text, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRoute, useNavigation } from "@react-navigation/native";

import styles, { COLORS } from "../Designs/NewBottomNav";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const TABS = [
  {
    key: "Connection",
    label: "Connection",
    icon: require("../stores/assets/connection.png"),
  },
  {
    key: "IncidentReport",
    label: "Report",
    icon: require("../stores/assets/report.png"),
  },
  {
    key: "Map", // ✅ was MainCenter
    label: "Map",
    icon: require("../stores/assets/critical.png"), // reuse same icon
  },
  {
    key: "Virtual",
    label: "Virtual",
    icon: require("../stores/assets/vr.png"),
  },
  {
    key: "Recent",
    label: "Recent",
    icon: require("../stores/assets/history.png"),
  },
];

export default function NewBottomNav() {
  const navigation = useNavigation();
  const route = useRoute();
  const active = route.name;

  const NOTCH_WIDTH = Math.min(130, SCREEN_WIDTH * 0.28);
  const NOTCH_HEIGHT = 46;

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safe}>
      <View style={styles.root}>
        <View style={styles.barContainer}>
          <View
            style={[
              styles.notchMask,
              {
                width: NOTCH_WIDTH,
                height: NOTCH_HEIGHT,
                marginLeft: -NOTCH_WIDTH / 2,
              },
            ]}
          />

          <View style={styles.tabRow}>
            {TABS.map((tab) => {
              // center slot spacing (kept exactly the same)
              if (tab.key === "Map") {
                return <View key={tab.key} style={{ flex: 1 }} />;
              }

              const isActive = active === tab.key;

              return (
                <Pressable
                  key={tab.key}
                  style={styles.tabItem}
                  onPress={() =>
                    navigation.navigate("AppShell", {
                      screen: tab.key,
                    })
                  }
                >
                  <Image
                    source={tab.icon}
                    style={[
                      styles.icon,
                      {
                        tintColor: isActive
                          ? COLORS.ACTIVE
                          : COLORS.INACTIVE,
                      },
                    ]}
                  />
                  <Text
                    style={[
                      styles.label,
                      isActive && styles.labelActive,
                    ]}
                  >
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* ✅ CENTER FAB NOW OPENS MAP */}
        <Pressable
          style={styles.fabWrapper}
          onPress={() =>
            navigation.navigate("AppShell", {
              screen: "Map",
            })
          }
        >
          <Image source={TABS[2].icon} style={styles.fabIcon} />
        </Pressable>
      </View>
    </SafeAreaView>
  );
}