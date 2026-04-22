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
        <TouchableOpacity style={styles.iconButton} onPress={onMenuPress}>
          <Ionicons name="menu" size={24} color="#10251b" />
        </TouchableOpacity>

        {showSearch && (
          <View style={styles.searchWrap}>
            <Ionicons name="search-outline" size={17} color="#6b7280" />
            <TextInput
              placeholder="Search place in Jaen"
              style={styles.search}
              value={value}
              onChangeText={handleChangeText}
              autoCorrect={false}
              autoCapitalize="none"
              clearButtonMode="while-editing"
              returnKeyType="search"
              placeholderTextColor="#7b867f"
            />
          </View>
        )}

        <TouchableOpacity style={styles.profileButton}>
          <Ionicons name="person-circle-outline" size={25} color="#10251b" />
        </TouchableOpacity>
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
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    pointerEvents: "auto",
  },

  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    elevation: 7,
  },

  profileButton: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    elevation: 7,
  },

  searchWrap: {
    flex: 1,
    minHeight: 44,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.72)",
    elevation: 7,
  },

  search: {
    flex: 1,
    marginLeft: 8,
    paddingVertical: 8,
    fontSize: 14,
    color: "#10251b",
  },

  dropdown: {
    marginTop: 8,
    backgroundColor: "rgba(255,255,255,0.98)",
    borderRadius: 16,
    maxHeight: 220,
    elevation: 8,
    pointerEvents: "auto",
    overflow: "hidden",
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
