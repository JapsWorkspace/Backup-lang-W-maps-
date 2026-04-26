import React, { useContext, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Pressable,
  Text,
  View,
  Easing,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { FlatList } from "react-native-gesture-handler";

import styles from "../Designs/NewBottomNav";
import { MapContext } from "./contexts/MapContext";

const MODULES = [
  {
    key: "incident",
    label: "Incident",
    helper: "Report",
    icon: "warning-outline",
  },
  {
    key: "flood",
    label: "Flood Map",
    helper: "Hazard",
    icon: "water-outline",
  },
  {
    key: "earthquake",
    label: "Earthquake",
    helper: "Risk",
    icon: "pulse-outline",
  },
  {
    key: "barangay",
    label: "Barangay",
    helper: "Boundary",
    icon: "map-outline",
  },
  {
    key: "evac",
    label: "Evac Place",
    helper: "Routes",
    icon: "navigate-outline",
  },
];

function DockCard({
  item,
  index,
  total,
  isActive,
  onPress,
}) {
  const activeAnim = useRef(new Animated.Value(isActive ? 1 : 0)).current;
  const pressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.spring(activeAnim, {
      toValue: isActive ? 1 : 0,
      stiffness: 180,
      damping: 18,
      mass: 0.8,
      useNativeDriver: false,
    }).start();
  }, [isActive, activeAnim]);

  const handlePressIn = () => {
    Animated.timing(pressAnim, {
      toValue: 1,
      duration: 140,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(pressAnim, {
      toValue: 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  };

  const width = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [146, 172],
  });

  const minHeight = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [78, 92],
  });

  const translateY = Animated.add(
    activeAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -8],
    }),
    pressAnim.interpolate({
      inputRange: [0, 1],
      outputRange: [0, -2],
    })
  );

  const scale = pressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.02],
  });

  const backgroundColor = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.93)", "#14532d"],
  });

  const borderColor = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255,255,255,0.72)", "#14532d"],
  });

  const iconBg = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#e7f5ed", "rgba(255,255,255,0.18)"],
  });

  const iconBorder = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#d7eadf", "rgba(255,255,255,0.28)"],
  });

  const labelColor = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#10251b", "#ffffff"],
  });

  const helperColor = activeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ["#5f6f66", "rgba(255,255,255,0.82)"],
  });

  const iconColor = isActive ? "#ffffff" : "#14532d";

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={index === total - 1 ? styles.lastCardWrap : styles.cardWrap}
    >
      <Animated.View
        style={[
          styles.moduleCard,
          {
            width,
            minHeight,
            backgroundColor,
            borderColor,
            transform: [{ translateY }, { scale }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.iconBox,
            {
              backgroundColor: iconBg,
              borderColor: iconBorder,
            },
          ]}
        >
          <Ionicons name={item.icon} size={isActive ? 22 : 20} color={iconColor} />
        </Animated.View>

        <View style={styles.labelBox}>
          <Animated.Text
            numberOfLines={1}
            style={[
              styles.moduleLabel,
              {
                color: labelColor,
                fontSize: isActive ? 14 : 13,
              },
            ]}
          >
            {item.label}
          </Animated.Text>

          <Animated.Text
            numberOfLines={1}
            style={[
              styles.moduleHelper,
              {
                color: helperColor,
              },
            ]}
          >
            {item.helper}
          </Animated.Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default function NewBottomNav() {
  const {
    activeMapModule,
    setActiveMapModule,
    setPanelState,
    setPanelY,
    setIsBottomNavInteracting,
    setEvac,
    setRouteRequested,
    setRoutes,
    setActiveRoute,
  } = useContext(MapContext);

  const [activeDockItem, setActiveDockItem] = useState("incident");
  const moduleData = useMemo(() => MODULES, []);

  if (activeMapModule) return null;

  const openModule = (moduleKey) => {
    setIsBottomNavInteracting(false);
    setActiveDockItem(moduleKey);
    setEvac(null);
    setRouteRequested(false);
    setRoutes([]);
    setActiveRoute(null);
    setActiveMapModule(moduleKey);
    setPanelState("HIDDEN");
    setPanelY(null);
  };

  const handleMomentumEnd = (event) => {
    const offsetX = event?.nativeEvent?.contentOffset?.x || 0;
    const itemWidth = 156;
    const index = Math.round(offsetX / itemWidth);
    const safeIndex = Math.max(0, Math.min(index, moduleData.length - 1));
    const focused = moduleData[safeIndex];

    if (focused) {
      setActiveDockItem(focused.key);
    }

    setIsBottomNavInteracting(false);
  };

  const renderItem = ({ item, index }) => (
    <DockCard
      item={item}
      index={index}
      total={moduleData.length}
      isActive={activeDockItem === item.key}
      onPress={() => openModule(item.key)}
    />
  );

  return (
    <SafeAreaView edges={["bottom"]} style={styles.safe} pointerEvents="auto">
      <View style={styles.root} pointerEvents="auto">
        <FlatList
          data={moduleData}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stackContent}
          keyboardShouldPersistTaps="handled"
          bounces={false}
          decelerationRate="fast"
          snapToInterval={156}
          snapToAlignment="start"
          onTouchStart={() => setIsBottomNavInteracting(true)}
          onTouchEnd={() => setIsBottomNavInteracting(false)}
          onTouchCancel={() => setIsBottomNavInteracting(false)}
          onScrollBeginDrag={() => setIsBottomNavInteracting(true)}
          onScrollEndDrag={() => {}}
          onMomentumScrollEnd={handleMomentumEnd}
        />
      </View>
    </SafeAreaView>
  );
}
