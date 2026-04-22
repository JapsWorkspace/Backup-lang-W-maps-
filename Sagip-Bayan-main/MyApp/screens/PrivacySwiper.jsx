// screens/PrivacySwiper.jsx
import { useRef, useState } from "react";
import {
  View,
  FlatList,
  Text,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
} from "react-native";
import DataPrivacy from "./DataPrivacy";
import TermsCondition from "./TermsCondition";

const { width } = Dimensions.get("window");

export default function PrivacySwiper({ navigation }) {
  const ref = useRef(null);
  const [index, setIndex] = useState(0);
  const [accepted, setAccepted] = useState(false);

  const handleNext = () => {
    if (index === 0) {
      ref.current?.scrollToIndex({ index: 1, animated: true });
    } else if (accepted) {
      navigation.replace("RegisterFlow");
    }
  };

  return (
    <View style={styles.screen}>
      {/* TOP BAR */}
      <View style={styles.topBar}>
        <Text style={styles.back} onPress={() => navigation.goBack()}>
          ←
        </Text>
        <Text style={styles.title}>
          {index === 0 ? "Data Privacy & Policy" : "Terms and Condition"}
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* STEP INDICATOR */}
      <View style={styles.dots}>
        {[0, 1].map((i) => (
          <View
            key={i}
            style={[styles.dot, index === i && styles.activeDot]}
          />
        ))}
      </View>

      {/* PAGES */}
      <FlatList
        ref={ref}
        data={["privacy", "terms"]}
        keyExtractor={(i) => i}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => {
          setIndex(
            Math.round(e.nativeEvent.contentOffset.x / width)
          );
        }}
        renderItem={({ item }) => (
          <View style={{ width, flex: 1 }}>
            {item === "privacy" && <DataPrivacy />}
            {item === "terms" && (
              <TermsCondition
                accepted={accepted}
                setAccepted={setAccepted}
              />
            )}
          </View>
        )}
      />

      {/* BOTTOM BUTTON */}
      <TouchableOpacity
        style={[
          styles.cta,
          index === 1 && !accepted && styles.disabled,
        ]}
        disabled={index === 1 && !accepted}
        onPress={handleNext}
      >
        <Text style={styles.ctaText}>
          {index === 1 ? "ACCEPT" : "NEXT"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

/* ================= STYLES ================= */

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },

  topBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 40,
  },

  back: {
    fontSize: 20,
    color: "#166534",
    width: 24,
  },

  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
  },

  dots: {
    flexDirection: "row",
    justifyContent: "center",
    marginVertical: 12,
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#D1D5DB",
    marginHorizontal: 4,
  },

  activeDot: {
    backgroundColor: "#166534",
    width: 20,
  },

  cta: {
    marginHorizontal: 24,
    marginBottom: 24,
    backgroundColor: "#166534",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
  },

  ctaText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 14,
  },

  disabled: {
    opacity: 0.5,
  },
});
