// screens/Guidelines.jsx
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Image,
  Linking,
  TextInput,
  Modal,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import api from "../lib/api";
import styles, { COLORS } from "../Designs/Guidelines";
import {
  isSafeHttpUrl,
  sanitizeSearchText,
  safeDisplayText,
} from "./utils/validation";

export default function GuidelinesListScreen({ navigation }) {
  const [guidelines, setGuidelines] = useState([]);
  const [filteredGuidelines, setFilteredGuidelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedGuideline, setSelectedGuideline] = useState(null);
  const categories = ["all", "earthquake", "flood", "typhoon", "general"];

  useEffect(() => {
    fetchGuidelines();
  }, [selectedCategory]);

  useEffect(() => {
    handleSearch(searchText);
  }, [searchText, guidelines]);

  const fetchGuidelines = async () => {
    try {
      setLoading(true);
      const params = {};
      if (selectedCategory !== "all") params.category = selectedCategory;

      const response = await api.get("/api/guidelines", {
        params,
        validateStatus: (status) => status === 200 || status === 404,
      });

      if (response.status === 404) {
        setGuidelines([]);
        setFilteredGuidelines([]);
        return;
      }

      const items = Array.isArray(response.data) ? response.data : [];
      setGuidelines(items);
      setFilteredGuidelines(items);
    } catch (error) {
      console.log("Error fetching guidelines:", {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text) => {
    const cleanText = sanitizeSearchText(text);
    setSearchText(cleanText);
    if (!cleanText) {
      setFilteredGuidelines(guidelines);
      setSuggestions([]);
      return;
    }
    const filtered = guidelines.filter((item) =>
      safeDisplayText(item?.title, "")
        .toLowerCase()
        .includes(cleanText.toLowerCase())
    );
    setFilteredGuidelines(filtered);
    setSuggestions(
      filtered
        .map((item) => safeDisplayText(item?.title, "Untitled guideline"))
        .slice(0, 5)
    );
  };

  const selectSuggestion = (title) => {
    setSearchText(title);
    setSuggestions([]);
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity style={styles.card} onPress={() => setSelectedGuideline(item)} activeOpacity={0.88}>
      <View style={localStyles.postHeader}>
        <View style={localStyles.publisherAvatar}>
          <Ionicons name="megaphone-outline" size={18} color={COLORS.green} />
        </View>
        <View style={localStyles.publisherCopy}>
          <Text style={localStyles.publisherName}>MDRRMO</Text>
          <Text style={localStyles.publisherMeta}>Official disaster guidance post</Text>
        </View>
      </View>

      <View style={localStyles.postBody}>
        <Text style={styles.title} numberOfLines={2}>
          {safeDisplayText(item?.title, "Untitled guideline")}
        </Text>
        {!!item.description && (
          <Text style={styles.desc} numberOfLines={4}>
            {safeDisplayText(item?.description, "")}
          </Text>
        )}

        {getPrimaryImage(item) && (
          <ResponsiveAttachmentImage
            uri={getPrimaryImage(item).fileUrl}
            style={localStyles.postImage}
            maxHeight={380}
            minHeight={180}
            onPress={() => setSelectedGuideline(item)}
          />
        )}

        <View style={localStyles.postMetaRow}>
          <View style={styles.metaRow}>
            <MetaPill text={item.category || "general"} />
            <MetaPill text={item.status || "active"} />
            <MetaPill text={item.priorityLevel || "normal"} tone="warning" />
          </View>
          <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={COLORS.green} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.phone}>
        <View style={styles.headerRow}>
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
            <Ionicons name="chevron-back" size={22} color={COLORS.green} />
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Guidelines</Text>
            <Text style={styles.headerSub}>Preparedness notes and official safety references.</Text>
          </View>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroIconWrap}>
            <Ionicons name="shield-checkmark-outline" size={22} color="#FFFFFF" />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Emergency guidance</Text>
            <Text style={styles.heroText}>
              Browse MDRRMO-issued instructions, safety notes, and incident-specific references.
            </Text>
          </View>
          <View style={styles.heroCount}>
            <Text style={styles.heroCountValue}>{filteredGuidelines.length}</Text>
            <Text style={styles.heroCountLabel}>results</Text>
          </View>
        </View>

        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={18} color="#647067" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by title"
            value={searchText}
            onChangeText={handleSearch}
            placeholderTextColor={COLORS.placeholder}
          />
        </View>

        {suggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            {suggestions.map((title, index) => (
              <TouchableOpacity
                key={`${title}-${index}`}
                onPress={() => selectSuggestion(title)}
                style={styles.suggestionItem}
              >
                <Ionicons name="return-down-forward-outline" size={15} color="#647067" />
                <Text style={styles.suggestionText}>{title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={styles.filterBlock}>
          <Text style={styles.filterTitle}>Categories</Text>
          <Text style={styles.filterSubtitle}>Quickly narrow the list by hazard type.</Text>
        </View>

        <View style={styles.filterContainer}>
          {categories.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setSelectedCategory(cat)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {cat}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <FlatList
          data={filteredGuidelines}
          keyExtractor={(item, index) => String(item?._id || item?.id || index)}
          renderItem={renderItem}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="document-text-outline" size={28} color="#94A3B8" />
              <Text style={styles.emptyTitle}>No guidelines found</Text>
              <Text style={styles.emptyText}>Try a different search or category.</Text>
            </View>
          }
        />

        <GuidelineModal
          item={selectedGuideline}
          onClose={() => setSelectedGuideline(null)}
        />
      </View>
    </View>
  );
}

function MetaPill({ text, tone }) {
  return (
    <View style={[styles.metaPill, tone === "warning" && styles.metaPillWarning]}>
      <Text style={[styles.metaText, tone === "warning" && styles.metaTextWarning]}>
        {String(text).toUpperCase()}
      </Text>
    </View>
  );
}

function GuidelineModal({ item, onClose }) {
  const [selectedImage, setSelectedImage] = useState(null);

  if (!item) return null;

  return (
    <>
      <Modal transparent animationType="fade" visible={!!item} onRequestClose={onClose}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalBox}>
            <View style={styles.modalHeader}>
              <View style={localStyles.publisherAvatar}>
                <Ionicons name="megaphone-outline" size={18} color={COLORS.green} />
              </View>
              <View style={styles.modalTitleBlock}>
                <Text style={localStyles.publisherName}>MDRRMO</Text>
                <Text style={localStyles.publisherMeta}>Official disaster guidance</Text>
              </View>
              <TouchableOpacity style={styles.closeIcon} onPress={onClose}>
                <Ionicons name="close" size={20} color="#475569" />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.modalTitle}>
                {safeDisplayText(item?.title, "Untitled guideline")}
              </Text>
              {!!item.description && (
                <Text style={styles.modalDesc}>
                  {safeDisplayText(item?.description, "")}
                </Text>
              )}

              {getPrimaryImage(item) && (
                <ResponsiveAttachmentImage
                  uri={getPrimaryImage(item).fileUrl}
                  style={localStyles.modalPostImage}
                  maxHeight={520}
                  minHeight={220}
                  onPress={() => setSelectedImage(getPrimaryImage(item))}
                />
              )}

              {getNonImageAttachments(item).length > 0 && (
                <View style={styles.attachments}>
                  <Text style={styles.attachHeader}>Files</Text>
                  {getNonImageAttachments(item).map((file, index) => (
                    <TouchableOpacity
                      key={index}
                      style={styles.fileRow}
                      onPress={() => {
                        if (!isSafeHttpUrl(file?.fileUrl)) {
                          return;
                        }
                        Linking.openURL(file.fileUrl);
                      }}
                    >
                      <Ionicons name="document-attach-outline" size={18} color={COLORS.link} />
                      <Text style={styles.link}>
                        {safeDisplayText(file?.fileName, "Attachment")}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={!!selectedImage}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setSelectedImage(null)}
      >
        <ZoomableImageViewer
          image={selectedImage}
          title={safeDisplayText(item?.title, "Guideline image")}
          onClose={() => setSelectedImage(null)}
        />
      </Modal>
    </>
  );
}

function ResponsiveAttachmentImage({
  uri,
  onPress,
  style,
  minHeight = 180,
  maxHeight = 420,
}) {
  const [aspectRatio, setAspectRatio] = useState(4 / 3);

  useEffect(() => {
    if (!uri) return;

    let active = true;
    Image.getSize(
      uri,
      (width, height) => {
        if (!active || !width || !height) return;
        setAspectRatio(width / height);
      },
      () => {
        if (active) {
          setAspectRatio(4 / 3);
        }
      }
    );

    return () => {
      active = false;
    };
  }, [uri]);

  const imageNode = (
    <View style={[localStyles.imageFrame, { minHeight, maxHeight }]}>
      <Image
        source={{ uri }}
        style={[style, { aspectRatio }]}
        resizeMode="contain"
      />
    </View>
  );

  if (typeof onPress === "function") {
    return (
      <TouchableOpacity activeOpacity={0.92} onPress={onPress}>
        {imageNode}
      </TouchableOpacity>
    );
  }

  return imageNode;
}

function ZoomableImageViewer({ image, title, onClose }) {
  const { width, height } = useWindowDimensions();
  const [scale, setScale] = useState(1);
  const [aspectRatio, setAspectRatio] = useState(4 / 3);

  useEffect(() => {
    setScale(1);
  }, [image]);

  useEffect(() => {
    if (!image?.fileUrl) return;

    let active = true;
    Image.getSize(
      image.fileUrl,
      (imgWidth, imgHeight) => {
        if (!active || !imgWidth || !imgHeight) return;
        setAspectRatio(imgWidth / imgHeight);
      },
      () => {
        if (active) {
          setAspectRatio(4 / 3);
        }
      }
    );

    return () => {
      active = false;
    };
  }, [image]);

  if (!image?.fileUrl) return null;

  const clampedScale = Math.max(1, Math.min(scale, 3));
  const baseWidth = Math.max(280, width - 32);
  const scaledWidth = baseWidth * clampedScale;
  const scaledHeight = (scaledWidth / aspectRatio);
  const viewerMinHeight = Math.max(height - 210, 320);

  return (
    <View style={styles.imageViewerScreen}>
      <View style={styles.imageViewerHeader}>
        <TouchableOpacity
          style={styles.imageViewerBack}
          onPress={onClose}
        >
          <Ionicons name="chevron-back" size={22} color="#FFFFFF" />
          <Text style={styles.imageViewerBackText}>Back</Text>
        </TouchableOpacity>

        <View style={styles.imageViewerControls}>
          <TouchableOpacity
            style={styles.imageViewerControlBtn}
            onPress={() => setScale((current) => Math.max(1, Number((current - 0.25).toFixed(2))))}
          >
            <Ionicons name="remove" size={18} color="#FFFFFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.imageViewerControlBtn}
            onPress={() => setScale(1)}
          >
            <Text style={styles.imageViewerControlText}>{Math.round(clampedScale * 100)}%</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.imageViewerControlBtn}
            onPress={() => setScale((current) => Math.min(3, Number((current + 0.25).toFixed(2))))}
          >
            <Ionicons name="add" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <Text style={styles.imageViewerTitle} numberOfLines={2}>
        {title}
      </Text>

      <ScrollView horizontal bounces={false} maximumZoomScale={3} minimumZoomScale={1}>
        <ScrollView
          bounces={false}
          contentContainerStyle={[
            styles.imageViewerScrollContent,
            { minHeight: viewerMinHeight, width: Math.max(width, scaledWidth + 32) },
          ]}
        >
          <Image
            source={{ uri: image.fileUrl }}
            style={{
              width: scaledWidth,
              height: scaledHeight,
            }}
            resizeMode="contain"
          />
        </ScrollView>
      </ScrollView>
    </View>
  );
}

function getCategoryIcon(category) {
  switch (String(category || "").toLowerCase()) {
    case "earthquake":
      return "pulse-outline";
    case "flood":
      return "water-outline";
    case "typhoon":
      return "rainy-outline";
    default:
      return "reader-outline";
  }
}

function isImageAttachment(file) {
  return /\.(jpg|jpeg|png|gif|webp)$/i.test(file?.fileUrl || "");
}

function getPrimaryImage(item) {
  return (item?.attachments || []).find(isImageAttachment) || null;
}

function getNonImageAttachments(item) {
  return (item?.attachments || []).filter((file) => !isImageAttachment(file));
}

const localStyles = StyleSheet.create({
  postHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  publisherAvatar: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: COLORS.greenSoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  publisherCopy: {
    flex: 1,
  },
  publisherName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "900",
  },
  publisherMeta: {
    marginTop: 2,
    color: COLORS.textMuted,
    fontSize: 11,
    fontWeight: "600",
  },
  postBody: {
    gap: 10,
  },
  postImage: {
    width: "100%",
    borderRadius: 16,
    backgroundColor: "#DCE7D8",
  },
  modalPostImage: {
    width: "100%",
    borderRadius: 16,
    backgroundColor: "#DCE7D8",
    marginTop: 12,
  },
  imageFrame: {
    width: "100%",
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: "#EEF4EE",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(220,231,216,0.92)",
  },
  postMetaRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
});
