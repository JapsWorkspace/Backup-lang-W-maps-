import React, { useState } from "react";
import {
  View,
  TextInput,
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  Platform,
  Keyboard,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function AppTopBar({
  onMenuPress,
  onSearchChange,
  showSearch,
  suggestions = [],
  onSelectSuggestion,
}) {
  // ✅ local controlled input state
  const [value, setValue] = useState("");

  const handleChangeText = (text) => {
    setValue(text);
    onSearchChange?.(text);
  };

  /**
   * ✅ IMPORTANT:
   * This function forwards the FULL suggestion object exactly as received.
   * This includes:
   * - latitude
   * - longitude
   * - label
   * - source
   * - raw (full MongoDB evacuation document, when available)
   *
   * DO NOT destructure or rebuild `item` here.
   */
  const handleSelect = (item) => {
    // ✅ clear UI immediately
    setValue("");
    Keyboard.dismiss();

    // ✅ forward FULL object to parent (navigation happens there)
    onSelectSuggestion?.(item);

    // ✅ clear suggestions
    onSearchChange?.("");
  };

  return (
    <View style={styles.wrapper}>
      <View style={styles.container}>
        <TouchableOpacity onPress={onMenuPress}>
          <Ionicons name="menu" size={28} color="#000" />
        </TouchableOpacity>

        {showSearch && (
          <TextInput
            placeholder="Search place in Jaen"
            style={styles.search}
            value={value}
            onChangeText={handleChangeText}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
        )}

        <Ionicons name="person-circle" size={32} color="#444" />
      </View>

      {/* ✅ Suggestions dropdown */}
      {showSearch && suggestions.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={suggestions}
            keyExtractor={(item, index) =>
              item.id
                ? String(item.id)
                : `${item.source}-${item.latitude}-${item.longitude}-${index}`
            }
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.item}
                onPress={() => handleSelect(item)}
              >
                <Text numberOfLines={2}>{item.label}</Text>

                {item.source === "evacuation" && (
                  <Text style={styles.badge}>EVAC CENTER</Text>
                )}
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: Platform.OS === "ios" ? 55 : 25,
    left: 16,
    right: 16,
    zIndex: 2000,
    elevation: 2000,
    pointerEvents: "box-none",
  },

  container: {
    backgroundColor: "#fff",
    borderRadius: 30,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    elevation: 6,
    pointerEvents: "auto",
  },

  search: {
    flex: 1,
    marginHorizontal: 12,
  },

  dropdown: {
    marginTop: 6,
    backgroundColor: "#fff",
    borderRadius: 12,
    maxHeight: 220,
    elevation: 6,
    pointerEvents: "auto",
  },

  item: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },

  badge: {
    fontSize: 11,
    color: "#047857",
    fontWeight: "700",
    marginTop: 4,
  },
});