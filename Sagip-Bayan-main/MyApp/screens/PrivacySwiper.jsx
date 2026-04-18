import { useRef, useState } from "react";
import { View, FlatList, TouchableOpacity, Text, Dimensions } from "react-native";
import DataPrivacy from "./DataPrivacy";
import TermsCondition from "./TermsCondition";
import styles from "../Designs/privacyStyles";

const { width } = Dimensions.get("window");

export default function PrivacySwiper({ onAccept }) {
  const ref = useRef(null);
  const [index, setIndex] = useState(0);
  const [accepted, setAccepted] = useState(false);

  const next = () => {
    if (index === 0) ref.current.scrollToIndex({ index: 1 });
    else if (accepted) onAccept();
  };

  return (
    <View style={styles.container}>
      <View style={styles.paginationRowTop}>
        {index === 0 ? (
          <>
            <View style={styles.activePill} />
            <View style={styles.inactiveDot} />
          </>
        ) : (
          <>
            <View style={styles.inactiveDot} />
            <View style={styles.activePill} />
          </>
        )}
      </View>

      <FlatList
        ref={ref}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        data={[
          { key: "privacy", component: <DataPrivacy /> },
          {
            key: "terms",
            component: (
              <TermsCondition
                accepted={accepted}
                setAccepted={setAccepted}
              />
            ),
          },
        ]}
        renderItem={({ item }) => (
          <View style={{ width }}>{item.component}</View>
        )}
        keyExtractor={(i) => i.key}
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
        }
      />

      <TouchableOpacity
        style={[
          styles.button,
          index === 1 && !accepted && styles.buttonDisabled,
        ]}
        onPress={next}
        disabled={index === 1 && !accepted}
      >
        <Text style={styles.buttonText}>
          {index === 1 ? "ACCEPT" : "NEXT"}
        </Text>
      </TouchableOpacity>
    </View>
  );
}