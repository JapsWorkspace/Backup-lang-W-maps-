import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import { useLocation, useNavigate } from "react-router-dom";
import DashboardShell from "./layout/DashboardShell";
import Map from "./map/Map";
import "./map/MapIcon";
import "./css/EManagement.css";

const BASE_URL =
  process.env.REACT_APP_API_URL || "https://gaganadapat.onrender.com";

const initialFormState = {
  name: "",
  location: "",
  barangayId: "",
  barangayName: "",
  latitude: null,
  longitude: null,
  capacityIndividual: "",
  capacityFamily: "",
  bedCapacity: "",
  floorArea: "",
  femaleCR: false,
  maleCR: false,
  commonCR: false,
  potableWater: false,
  nonPotableWater: false,
  foodPackCapacity: "",
  isPermanent: false,
  isCovidFacility: false,
  remarks: "",
};

const sanitizeText = (value) => String(value || "").replace(/<[^>]*>?/gm, "").trim();
const safeLower = (value) => String(value || "").toLowerCase();

const numberOrZero = (value) => {
  if (value === "" || value === null || value === undefined) return 0;
  const num = Number(value);
  return Number.isNaN(num) ? 0 : num;
};

const formatNumber = (value) => {
  const num = Number(value || 0);
  return new Intl.NumberFormat().format(num);
};

const formatDateTime = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
};

const getStoredRole = () => localStorage.getItem("role") || "";
const getStoredUserId = () =>
  localStorage.getItem("userId") ||
  localStorage.getItem("_id") ||
  localStorage.getItem("id") ||
  "";

export default function EManagement() {
  const navigate = useNavigate();
  const location = useLocation();
  const nameRef = useRef(null);

  const [places, setPlaces] = useState([]);
  const [barangays, setBarangays] = useState([]);
  const [stocks, setStocks] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [history, setHistory] = useState([]);
  const [me, setMe] = useState(null);

  const [loadingPage, setLoadingPage] = useState(true);
  const [loadingSave, setLoadingSave] = useState(false);
  const [loadingAllocate, setLoadingAllocate] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [barangayFilter, setBarangayFilter] = useState("all");
  const [supportFilter, setSupportFilter] = useState("all");

  const [selectedId, setSelectedId] = useState(null);
  const [statusChoice, setStatusChoice] = useState("available");
  const [notes, setNotes] = useState(""); // right-panel local-only notes
  const [capacityDisplay, setCapacityDisplay] = useState(0);
  const [panelView, setPanelView] = useState("main");

  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pickMode, setPickMode] = useState(false);

  const [formData, setFormData] = useState(initialFormState);

  const [selectedStockId, setSelectedStockId] = useState("");
  const [allocateQty, setAllocateQty] = useState("");

  const storedRole = getStoredRole();
  const storedUserId = getStoredUserId();

  const routeSaysBarangay = location.pathname.startsWith("/barangay");
  const meRole = me?.role || "";
  const isBarangayRole =
    routeSaysBarangay ||
    safeLower(storedRole) === "barangay" ||
    safeLower(meRole) === "barangay";

  const canAllocate = isBarangayRole;

  const localUserId = me?._id || storedUserId || "";
  const localBarangayName =
    me?.barangayName ||
    localStorage.getItem("barangayName") ||
    localStorage.getItem("barangay") ||
    localStorage.getItem("username") ||
    localStorage.getItem("name") ||
    "";

  const normalizeBarangayItem = useCallback((item) => {
    const id =
      item?._id ||
      item?.id ||
      item?.barangayId ||
      item?.value ||
      "";

    const name =
      item?.barangayName ||
      item?.name ||
      item?.barangay ||
      item?.username ||
      item?.email ||
      item?.label ||
      "";

    return {
      _id: String(id || ""),
      name: String(name || ""),
      raw: item,
    };
  }, []);

  const fetchMe = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/barangays/me`, {
        withCredentials: true,
      });
      setMe(res.data || null);
      return res.data || null;
    } catch (error) {
      console.error("Fetch me error:", error);
      setMe(null);
      return null;
    }
  }, []);

  const fetchPlaces = useCallback(async () => {
    const res = await axios.get(`${BASE_URL}/evacs`, { withCredentials: true });
    const payload = Array.isArray(res.data) ? res.data : [];
    setPlaces(payload);
    console.log("Fetched places:", payload);
    return payload;
  }, []);

  const fetchBarangays = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/barangays`, {
        withCredentials: true,
      });

      const raw = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.barangays)
        ? res.data.barangays
        : Array.isArray(res.data?.data)
        ? res.data.data
        : [];

      const mapped = raw
        .map(normalizeBarangayItem)
        .filter((item) => item._id && item.name)
        .sort((a, b) => a.name.localeCompare(b.name));

      setBarangays(mapped);
      return mapped;
    } catch (error) {
      console.error("Fetch barangays error:", error);
      setBarangays([]);
      return [];
    }
  }, [normalizeBarangayItem]);

  const fetchStocks = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/barangay-stock`, {
        withCredentials: true,
      });
      const payload = Array.isArray(res.data) ? res.data : [];
      setStocks(payload);
      return payload;
    } catch (error) {
      console.error("Fetch barangay stock error:", error);
      setStocks([]);
      return [];
    }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/barangay-stock/transactions`, {
        withCredentials: true,
      });
      const payload = Array.isArray(res.data) ? res.data : [];
      setTransactions(payload);
      return payload;
    } catch (error) {
      console.error("Fetch stock transactions error:", error);
      setTransactions([]);
      return [];
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/evacs/history/logs`, {
        withCredentials: true,
      });
      const payload = Array.isArray(res.data) ? res.data : [];
      setHistory(payload);
      return payload;
    } catch (error) {
      console.error("Fetch history error:", error);
      setHistory([]);
      return [];
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    setLoadingPage(true);
    try {
      await Promise.all([
        fetchMe(),
        fetchPlaces(),
        fetchBarangays(),
        fetchStocks(),
        fetchTransactions(),
        fetchHistory(),
      ]);
    } catch (error) {
      console.error("Fetch all EManagement data error:", error);
    } finally {
      setLoadingPage(false);
    }
  }, [fetchMe, fetchPlaces, fetchBarangays, fetchStocks, fetchTransactions, fetchHistory]);

  useEffect(() => {
    const role = getStoredRole();
    if (!role && !routeSaysBarangay) {
      navigate("/");
      return;
    }
    fetchAllData();
  }, [fetchAllData, navigate, routeSaysBarangay]);

  useEffect(() => {
    if ((showAddForm || showEditForm) && nameRef.current) {
      const timer = setTimeout(() => {
        nameRef.current?.focus();
      }, 40);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [showAddForm, showEditForm]);

  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target && e.target.tagName) || document.activeElement?.tagName;
      const isField =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        e.target?.isContentEditable;

      if (e.key === "Escape" && !isField) {
        if (showAddForm) setShowAddForm(false);
        if (showEditForm) setShowEditForm(false);
        if (showDeleteConfirm) setShowDeleteConfirm(false);
        if (pickMode) setPickMode(false);
        if (panelView === "history") setPanelView("main");
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showAddForm, showEditForm, showDeleteConfirm, pickMode, panelView]);

  const resolveOwnBarangay = useCallback(() => {
    if (!barangays.length) return null;

    return (
      barangays.find(
        (item) =>
          String(item._id) === String(localUserId) ||
          safeLower(item.name) === safeLower(localBarangayName) ||
          safeLower(item.raw?.barangayName) === safeLower(localBarangayName) ||
          safeLower(item.raw?.username) === safeLower(localBarangayName)
      ) || null
    );
  }, [barangays, localUserId, localBarangayName]);

  const visiblePlacesBase = useMemo(() => {
    if (!Array.isArray(places)) return [];

    if (!isBarangayRole) return places;

    return places.filter((place) => {
      const sameBarangayId =
        localUserId && String(place?.barangayId) === String(localUserId);
      const sameBarangayName =
        localBarangayName &&
        safeLower(place?.barangayName) === safeLower(localBarangayName);

      return sameBarangayId || sameBarangayName;
    });
  }, [places, isBarangayRole, localUserId, localBarangayName]);

  const computedPlaces = useMemo(() => {
    const allocationTransactions = Array.isArray(transactions)
      ? transactions.filter((item) => item?.transactionType === "allocation")
      : [];

    return visiblePlacesBase.map((place) => {
      const placeAllocations = allocationTransactions.filter(
        (tx) => String(tx?.evacPlaceId) === String(place?._id)
      );

      const totalAllocated = placeAllocations.reduce(
        (sum, tx) => sum + Number(tx?.quantity || 0),
        0
      );

      const recentAllocated = placeAllocations
        .filter((tx) => {
          if (!tx?.createdAt) return false;
          const txDate = new Date(tx.createdAt);
          if (Number.isNaN(txDate.getTime())) return false;
          const now = new Date();
          const diff = now.getTime() - txDate.getTime();
          const days = diff / (1000 * 60 * 60 * 24);
          return days <= 30;
        })
        .reduce((sum, tx) => sum + Number(tx?.quantity || 0), 0);

      const supportBaseline = Math.max(
        Number(place?.foodPackCapacity || 0),
        Number(place?.capacityFamily || 0) * 2,
        Math.ceil(Number(place?.capacityIndividual || 0) * 0.5),
        10
      );

      let supportStatus = "adequate";
      let supportLabel = "Adequate support";

      if (placeAllocations.length === 0 || totalAllocated <= 0) {
        supportStatus = "none";
        supportLabel = "No relief allocation";
      } else if (recentAllocated < supportBaseline * 0.25) {
        supportStatus = "low";
        supportLabel = "Low on support";
      }

      return {
        ...place,
        totalAllocated,
        recentAllocated,
        supportBaseline,
        supportStatus,
        supportLabel,
        allocationCount: placeAllocations.length,
        placeAllocations,
      };
    });
  }, [transactions, visiblePlacesBase]);

  const filteredPlaces = useMemo(() => {
    return computedPlaces.filter((place) => {
      const term = search.trim().toLowerCase();

      const matchesSearch = !term
        ? true
        : isBarangayRole
        ? safeLower(place?.name).includes(term) ||
          safeLower(place?.location).includes(term)
        : safeLower(place?.name).includes(term) ||
          safeLower(place?.location).includes(term) ||
          safeLower(place?.barangayName).includes(term);

      const matchesStatus =
        statusFilter === "all" || place?.capacityStatus === statusFilter;

      const matchesBarangay =
        isBarangayRole
          ? true
          : barangayFilter === "all" ||
            safeLower(place?.barangayName) === safeLower(barangayFilter);

      const matchesSupport =
        supportFilter === "all" || place?.supportStatus === supportFilter;

      return matchesSearch && matchesStatus && matchesBarangay && matchesSupport;
    });
  }, [computedPlaces, search, statusFilter, barangayFilter, supportFilter, isBarangayRole]);

  useEffect(() => {
    if (!filteredPlaces.length) {
      setSelectedId(null);
      return;
    }

    const stillExists = filteredPlaces.some(
      (place) => String(place._id) === String(selectedId)
    );

    if (!stillExists) {
      setSelectedId(filteredPlaces[0]._id);
    }
  }, [filteredPlaces, selectedId]);

  const selectedPlace = useMemo(() => {
    return filteredPlaces.find((item) => String(item._id) === String(selectedId)) || null;
  }, [filteredPlaces, selectedId]);

  const selectedPlaceAllocations = useMemo(() => {
    return selectedPlace?.placeAllocations || [];
  }, [selectedPlace]);

  const visibleStocks = useMemo(() => {
    if (!Array.isArray(stocks)) return [];

    if (!selectedPlace) {
      return isBarangayRole ? stocks : [];
    }

    return stocks.filter((stock) => {
      const sameBarangayId =
        selectedPlace?.barangayId &&
        String(stock?.barangayId) === String(selectedPlace.barangayId);
      const sameBarangayName =
        safeLower(stock?.barangayName) === safeLower(selectedPlace?.barangayName);

      return sameBarangayId || sameBarangayName;
    });
  }, [stocks, selectedPlace, isBarangayRole]);

  const selectedStock = useMemo(() => {
    return visibleStocks.find((item) => String(item._id) === String(selectedStockId)) || null;
  }, [visibleStocks, selectedStockId]);

  const summary = useMemo(() => {
    const totalPlaces = computedPlaces.length;
    const availableCount = computedPlaces.filter(
      (item) => item.capacityStatus === "available"
    ).length;
    const limitedCount = computedPlaces.filter(
      (item) => item.capacityStatus === "limited"
    ).length;
    const fullCount = computedPlaces.filter(
      (item) => item.capacityStatus === "full"
    ).length;
    const unsupportedCount = computedPlaces.filter(
      (item) => item.supportStatus === "none"
    ).length;
    const lowSupportCount = computedPlaces.filter(
      (item) => item.supportStatus === "low"
    ).length;

    return {
      totalPlaces,
      availableCount,
      limitedCount,
      fullCount,
      unsupportedCount,
      lowSupportCount,
    };
  }, [computedPlaces]);

  const barangayFilterOptions = useMemo(() => {
    const set = new Set();
    computedPlaces.forEach((item) => {
      if (item?.barangayName) set.add(item.barangayName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [computedPlaces]);

  const updateFormField = (name, value) => {
    setFormData((prev) => ({
      ...prev,
      [name]:
        name === "capacity"
          ? value.replace(/\D/g, "")
          : name === "extraNotes"
          ? sanitizeText(value).slice(0, 30) // enforce 30-char max
          : sanitizeText(value),
    }));
  };

  const handleTextFieldChange = (e) => {
    const { name, value } = e.target;
    updateFormField(name, sanitizeText(value));
  };

  const handleNumericFieldChange = (e) => {
    const { name, value } = e.target;
    if (value === "") {
      updateFormField(name, "");
      return;
    }
    updateFormField(name, value.replace(/[^\d.]/g, ""));
  };

  const handleLatitudeChange = (e) => {
    const value = e.target.value.trim();
    if (value === "") {
      updateFormField("latitude", null);
      return;
    }
    const num = Number(value);
    if (!Number.isNaN(num)) updateFormField("latitude", num);
  };

  const handleLongitudeChange = (e) => {
    const value = e.target.value.trim();
    if (value === "") {
      updateFormField("longitude", null);
      return;
    }
    const num = Number(value);
    if (!Number.isNaN(num)) updateFormField("longitude", num);
  };

  const resetForm = useCallback(() => {
    setFormData(initialFormState);
  }, []);

  const handleStartPick = () => {
    const baseForm = { ...initialFormState };

    if (isBarangayRole) {
      const ownBarangay = resolveOwnBarangay();

      if (ownBarangay) {
        baseForm.barangayId = ownBarangay._id;
        baseForm.barangayName = ownBarangay.name;
      } else if (localBarangayName) {
        baseForm.barangayName = localBarangayName;
      }
    }

    setFormData(baseForm);
    setShowAddForm(false);
    setShowEditForm(false);
    setPickMode(true);
  };

  const openEditModal = () => {
    if (!selectedPlace) return;

    setFormData({
      name: selectedPlace.name || "",
      location: selectedPlace.location || "",
      barangayId: selectedPlace.barangayId || "",
      barangayName: selectedPlace.barangayName || "",
      latitude:
        selectedPlace.latitude === null || selectedPlace.latitude === undefined
          ? null
          : Number(selectedPlace.latitude),
      longitude:
        selectedPlace.longitude === null || selectedPlace.longitude === undefined
          ? null
          : Number(selectedPlace.longitude),
      capacityIndividual: String(selectedPlace.capacityIndividual || ""),
      capacityFamily: String(selectedPlace.capacityFamily || ""),
      bedCapacity: String(selectedPlace.bedCapacity || ""),
      floorArea: String(selectedPlace.floorArea || ""),
      femaleCR: Boolean(selectedPlace.femaleCR),
      maleCR: Boolean(selectedPlace.maleCR),
      commonCR: Boolean(selectedPlace.commonCR),
      potableWater: Boolean(selectedPlace.potableWater),
      nonPotableWater: Boolean(selectedPlace.nonPotableWater),
      foodPackCapacity: String(selectedPlace.foodPackCapacity || ""),
      isPermanent: Boolean(selectedPlace.isPermanent),
      isCovidFacility: Boolean(selectedPlace.isCovidFacility),
      remarks: selectedPlace.remarks || "",
    });

    setShowAddForm(false);
  };

  // Fly helper — used ONL
  // Normalize args from Map -> supports {latlng:{lat,lng}, label?} or (label, lat, lng)
  const normalizeMapArgs = (...args) => {
    let locationLabel = "";
    let lat = null;
    let lng = null;

    if (args.length === 1 && args[0]?.latlng) {
      lat = args[0].latlng.lat;
      lng = args[0].latlng.lng;
      locationLabel = args[0].label || "";
    } else if (args.length >= 3) {
      locationLabel = args[0];
      lat = Number(args[1]);
      lng = Number(args[2]);
    }

    return {
      locationLabel: sanitizeText(locationLabel),
      lat,
      lng,
    };
  };

  const flyTo = (lat, lng, zoom = 17) => {
    if (lat === null || lng === null || lat === undefined || lng === undefined) return;
    window.dispatchEvent(
      new CustomEvent("emap:flyTo", {
        detail: { lat, lng, zoom },
      })
    );
  };

  const handleMapSelectLocation = useCallback(
    (...args) => {
      const { locationLabel, lat, lng } = normalizeMapArgs(...args);
      if (lat === null || lng === null) return;

      if (pickMode) {
        setFormData((prev) => ({
          ...prev,
          location: locationLabel || prev.location,
          latitude: lat,
          longitude: lng,
        }));
        setPickMode(false);
        setShowAddForm(true);
        flyTo(lat, lng, 18);
      }
    },
    [pickMode]
  );

  useEffect(() => {
    if (!selectedPlace) return;

    const lat = Number(selectedPlace.latitude);
    const lng = Number(selectedPlace.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) return;

    flyTo(lat, lng, 16);
  }, [selectedPlace]);

  const validateForm = () => {
    if (!sanitizeText(formData.name)) {
      alert("Place name is required.");
      return false;
    }

    if (!sanitizeText(formData.location)) {
      alert("Location is required.");
      return false;
    }

    if (!formData.barangayId && !sanitizeText(formData.barangayName)) {
      alert("Barangay is required.");
      return false;
    }

    if (formData.latitude === null || formData.longitude === null) {
      alert("Latitude and longitude are required.");
      return false;
    }

    if (Number(formData.latitude) < -90 || Number(formData.latitude) > 90) {
      alert("Latitude must be between -90 and 90.");
      return false;
    }

    if (Number(formData.longitude) < -180 || Number(formData.longitude) > 180) {
      alert("Longitude must be between -180 and 180.");
      return false;
    }

    return true;
  };

  const buildPayload = () => {
    const barangayRecord =
      barangays.find(
        (item) =>
          String(item._id) === String(formData.barangayId) ||
          safeLower(item.name) === safeLower(formData.barangayName)
      ) || null;

    const finalBarangayId =
      formData.barangayId || barangayRecord?._id || localUserId || "";
    const finalBarangayName =
      formData.barangayName || barangayRecord?.name || localBarangayName || "";

    return {
      name: sanitizeText(formData.name),
      location: sanitizeText(formData.location),
      barangayId: finalBarangayId,
      barangayName: sanitizeText(finalBarangayName),
      barangay: sanitizeText(finalBarangayName),
      latitude: Number(formData.latitude),
      longitude: Number(formData.longitude),
      capacityIndividual: numberOrZero(formData.capacityIndividual),
      capacityFamily: numberOrZero(formData.capacityFamily),
      bedCapacity: numberOrZero(formData.bedCapacity),
      floorArea: numberOrZero(formData.floorArea),
      femaleCR: Boolean(formData.femaleCR),
      maleCR: Boolean(formData.maleCR),
      commonCR: Boolean(formData.commonCR),
      potableWater: Boolean(formData.potableWater),
      nonPotableWater: Boolean(formData.nonPotableWater),
      foodPackCapacity: numberOrZero(formData.foodPackCapacity),
      isPermanent: Boolean(formData.isPermanent),
      isCovidFacility: Boolean(formData.isCovidFacility),
      remarks: sanitizeText(formData.remarks),
    };
  };

  const handleSubmitAdd = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoadingSave(true);
    try {
      const payload = buildPayload();
      await axios.post(`${BASE_URL}/evacs/make`, payload, {
        withCredentials: true,
      });

      resetForm();
      setShowAddForm(false);
      await Promise.all([fetchPlaces(), fetchHistory()]);
    } catch (error) {
      console.error("Create place error:", error);
      alert(error?.response?.data?.message || "Failed to create evacuation place.");
    } finally {
      setLoadingSave(false);
    }
  };

  const handleSubmitEdit = async (e) => {
    e.preventDefault();

    if (!selectedPlace?._id) {
      alert("Select a place first.");
      return;
    }

    if (!validateForm()) return;

    setLoadingSave(true);
    try {
      const payload = buildPayload();

      await axios.put(`${BASE_URL}/evacs/${selectedPlace._id}`, payload, {
        withCredentials: true,
      });

      resetForm();
      setShowEditForm(false);
      await Promise.all([fetchPlaces(), fetchHistory()]);
    } catch (error) {
      console.error("Update place error:", error);
      alert(error?.response?.data?.message || "Update failed.");
    } finally {
      setLoadingSave(false);
    }
  };

  const handleUpdateStatus = async (status) => {
    if (!selectedPlace?._id) {
      alert("Select a place first.");
      return;
    }

    try {
      await axios.put(
        `${BASE_URL}/evacs/${selectedPlace._id}/status`,
        { capacityStatus: status },
        { withCredentials: true }
      );
      await Promise.all([fetchPlaces(), fetchHistory()]);
    } catch (error) {
      console.error("Update status error:", error);
      alert(error?.response?.data?.message || "Failed to update status.");
    }
  };

  const handleDeletePlace = async () => {
    if (!selectedPlace?._id) {
      setShowDeleteConfirm(false);
      return;
    }

    try {
      await axios.delete(`${BASE_URL}/evacs/${selectedPlace._id}`, {
        withCredentials: true,
      });
      setShowDeleteConfirm(false);
      await Promise.all([fetchPlaces(), fetchHistory()]);
    } catch (error) {
      console.error("Delete place error:", error);
      alert(error?.response?.data?.message || "Failed to delete place.");
    }
  };

  const handleAllocate = async () => {
    if (!selectedPlace?._id) {
      alert("Select an evacuation place first.");
      return;
    }

    if (!selectedStockId) {
      alert("Select a stock item.");
      return;
    }

    const qty = Number(allocateQty);
    if (!qty || qty <= 0) {
      alert("Enter a valid quantity.");
      return;
    }

    setLoadingAllocate(true);
    try {
      await axios.post(
        `${BASE_URL}/evacs/${selectedPlace._id}/allocate`,
        {
          stockId: selectedStockId,
          quantity: qty,
        },
        { withCredentials: true }
      );

      setSelectedStockId("");
      setAllocateQty("");
      await Promise.all([fetchStocks(), fetchTransactions(), fetchHistory(), fetchPlaces()]);
      alert("Stock allocated successfully.");
    } catch (error) {
      console.error("Allocate stock error:", error);
      alert(error?.response?.data?.message || "Allocation failed.");
    } finally {
      setLoadingAllocate(false);
    }
  };

  const selectedStatusClass = (status) => {
    if (status === "available") return "status-available";
    if (status === "limited") return "status-limited";
    return "status-full";
  };

  const supportClass = (status) => {
    if (status === "none") return "support-none";
    if (status === "low") return "support-low";
    return "support-adequate";
  };

  const statusCountsForPlaceCard = (place) => ({
    individual: Number(place?.capacityIndividual || 0),
    family: Number(place?.capacityFamily || 0),
    foodPackCapacity: Number(place?.foodPackCapacity || 0),
  });

  const getHistoryAccentClass = (action) => {
    const value = String(action || "").toUpperCase();
    if (value === "ADD") return "history-accent-add";
    if (value === "UPDATE") return "history-accent-update";
    if (value === "STATUS_UPDATE") return "history-accent-status";
    if (value === "ALLOCATE") return "history-accent-allocate";
    if (value === "DELETE") return "history-accent-delete";
    return "history-accent-default";
  };

  const renderPlaceModal = (mode) => {
    const isEdit = mode === "edit";
    const onSubmit = isEdit ? handleSubmitEdit : handleSubmitAdd;
    const isOpen = isEdit ? showEditForm : showAddForm;
    const title = isEdit ? "Edit Evacuation Place" : "Add Evacuation Place";

    if (!isOpen) return null;

    return createPortal(
      <div
        className="evac-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={() => {
          if (isEdit) setShowEditForm(false);
          else setShowAddForm(false);
        }}
      >
        <div className="evac-modal-card" onClick={(e) => e.stopPropagation()}>
          <div className="evac-modal-header">
            <div>
              <h3>{title}</h3>
              <p>
                {isEdit
                  ? "Update the selected evacuation place details."
                  : "Create a new evacuation place and pin it on the map."}
              </p>
            </div>
            <button
              type="button"
              className="evac-modal-close"
              onClick={() => {
                if (isEdit) setShowEditForm(false);
                else setShowAddForm(false);
              }}
            >
              ✕
            </button>
          </div>

          <form className="evac-modal-form" onSubmit={onSubmit}>
            <div className="evac-form-grid">
              <div className="evac-form-section">
                <div className="section-title">Basic Information</div>

                <label className="field">
                  <span>Place Name</span>
                  <input
                    ref={nameRef}
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleTextFieldChange}
                    autoComplete="off"
                  />
                </label>

                <label className="field">
                  <span>Location</span>
                  <textarea
                    name="location"
                    rows={2}
                    value={formData.location}
                    onChange={handleTextFieldChange}
                    autoComplete="off"
                  />
                </label>

                <label className="field">
                  <span>Barangay</span>
                  {isBarangayRole ? (
                    <input
                      type="text"
                      value={
                        formData.barangayName ||
                        resolveOwnBarangay()?.name ||
                        me?.barangayName ||
                        localBarangayName ||
                        ""
                      }
                      readOnly
                    />
                  ) : (
                    <select
                      value={formData.barangayId}
                      onChange={(e) => {
                        const record =
                          barangays.find(
                            (item) => String(item._id) === String(e.target.value)
                          ) || null;

                        setFormData((prev) => ({
                          ...prev,
                          barangayId: e.target.value,
                          barangayName: record?.name || "",
                        }));
                      }}
                    >
                      <option value="">Select barangay</option>
                      {barangays.map((item) => (
                        <option key={item._id} value={item._id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  )}
                </label>

                <div className="field field-row-2">
                  <label className="field">
                    <span>Latitude</span>
                    <input
                      type="number"
                      step="0.000001"
                      value={
                        formData.latitude === null || Number.isNaN(formData.latitude)
                          ? ""
                          : String(formData.latitude)
                      }
                      onChange={handleLatitudeChange}
                    />
                  </label>

                  <label className="field">
                    <span>Longitude</span>
                    <input
                      type="number"
                      step="0.000001"
                      value={
                        formData.longitude === null || Number.isNaN(formData.longitude)
                          ? ""
                          : String(formData.longitude)
                      }
                      onChange={handleLongitudeChange}
                    />
                  </label>
                </div>

                {!isEdit && (
                  <div className="map-pick-hint">
                    <button
                      type="button"
                      className="btn btn-back"
                      onClick={() => {
                        setShowAddForm(false);
                        setPickMode(true);
                      }}
                    >
                      Pick From Map Again
                    </button>
                  </div>
                )}
              </div>

              <div className="evac-form-section">
                <div className="section-title">Capacity</div>

                <div className="field field-row-2">
                  <label className="field">
                    <span>Individual Capacity</span>
                    <input
                      type="number"
                      name="capacityIndividual"
                      value={formData.capacityIndividual}
                      onChange={handleNumericFieldChange}
                    />
                  </label>

                  <label className="field">
                    <span>Family Capacity</span>
                    <input
                      type="number"
                      name="capacityFamily"
                      value={formData.capacityFamily}
                      onChange={handleNumericFieldChange}
                    />
                  </label>
                </div>

                <div className="field field-row-2">
                  <label className="field">
                    <span>Bed Capacity</span>
                    <input
                      type="number"
                      name="bedCapacity"
                      value={formData.bedCapacity}
                      onChange={handleNumericFieldChange}
                    />
                  </label>

                  <label className="field">
                    <span>Floor Area (sq.m.)</span>
                    <input
                      type="number"
                      name="floorArea"
                      value={formData.floorArea}
                      onChange={handleNumericFieldChange}
                    />
                  </label>
                </div>

                <label className="field">
                  <span>Food Pack Capacity</span>
                  <input
                    type="number"
                    name="foodPackCapacity"
                    value={formData.foodPackCapacity}
                    onChange={handleNumericFieldChange}
                  />
                </label>

                <label className="field">
                  <span>Remarks</span>
                  <textarea
                    name="remarks"
                    rows={3}
                    value={formData.remarks}
                    onChange={handleTextFieldChange}
                  />
                </label>
              </div>

              <div className="evac-form-section">
                <div className="section-title">Facilities</div>

                <div className="checkbox-grid">
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={formData.femaleCR}
                      onChange={(e) => updateFormField("femaleCR", e.target.checked)}
                    />
                    <span>Female CR</span>
                  </label>

                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={formData.maleCR}
                      onChange={(e) => updateFormField("maleCR", e.target.checked)}
                    />
                    <span>Male CR</span>
                  </label>

                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={formData.commonCR}
                      onChange={(e) => updateFormField("commonCR", e.target.checked)}
                    />
                    <span>Common CR</span>
                  </label>

                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={formData.potableWater}
                      onChange={(e) => updateFormField("potableWater", e.target.checked)}
                    />
                    <span>Potable Water</span>
                  </label>

                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={formData.nonPotableWater}
                      onChange={(e) =>
                        updateFormField("nonPotableWater", e.target.checked)
                      }
                    />
                    <span>Non-potable Water</span>
                  </label>
                </div>
              </div>

              <div className="evac-form-section">
                <div className="section-title">Flags</div>

                <div className="checkbox-grid flags-grid">
                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={formData.isPermanent}
                      onChange={(e) => updateFormField("isPermanent", e.target.checked)}
                    />
                    <span>Permanent Facility</span>
                  </label>

                  <label className="checkbox-field">
                    <input
                      type="checkbox"
                      checked={formData.isCovidFacility}
                      onChange={(e) =>
                        updateFormField("isCovidFacility", e.target.checked)
                      }
                    />
                    <span>COVID Facility</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="evac-modal-actions">
              <button
                type="button"
                className="btn btn-back"
                onClick={() => {
                  if (isEdit) setShowEditForm(false);
                  else setShowAddForm(false);
                }}
              >
                Cancel
              </button>

              <button type="submit" className="btn btn-update" disabled={loadingSave}>
                {loadingSave ? "Saving..." : isEdit ? "Save Changes" : "Save Place"}
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    );
  };

  return (
    <DashboardShell>
      <div className={`evac-dashboard-page ${isBarangayRole ? "barangay-mode-page" : ""}`}>
        <div className="evac-dashboard-header">
          <div className="evac-dashboard-heading">
            <div className="eyebrow">
              {isBarangayRole ? "Barangay Operations" : "Operations Module"}
            </div>
            <h1>
              {isBarangayRole
                ? "Your Evacuation Management"
                : "Evacuation Management Dashboard"}
            </h1>
            <p>
              {isBarangayRole
                ? "Manage your evacuation places, monitor support, and allocate barangay stock to centers."
                : "Monitor all evacuation places, capacity status, support gaps, and barangay-level readiness."}
            </p>
          </div>

          <div className="evac-dashboard-actions">
            <button className="btn btn-back" onClick={() => navigate(-1)}>
              Back
            </button>
            <button className="btn btn-update add-evac-btn" onClick={handleStartPick}>
              Add Evac Place
            </button>
          </div>
        </div>

        <div className="evac-summary-grid">
          <div className="summary-card">
            <div className="summary-label">Total Places</div>
            <div className="summary-value">{formatNumber(summary.totalPlaces)}</div>
            <div className="summary-sub">Visible in current scope</div>
          </div>

          <div className="summary-card success">
            <div className="summary-label">Available</div>
            <div className="summary-value">{formatNumber(summary.availableCount)}</div>
            <div className="summary-sub">Ready for occupancy</div>
          </div>

          <div className="summary-card warning">
            <div className="summary-label">Limited</div>
            <div className="summary-value">{formatNumber(summary.limitedCount)}</div>
            <div className="summary-sub">Needs monitoring</div>
          </div>

          <div className="summary-card danger">
            <div className="summary-label">Full</div>
            <div className="summary-value">{formatNumber(summary.fullCount)}</div>
            <div className="summary-sub">Capacity reached</div>
          </div>

          <div className="summary-card accent">
            <div className="summary-label">No Allocation</div>
            <div className="summary-value">{formatNumber(summary.unsupportedCount)}</div>
            <div className="summary-sub">No relief assigned</div>
          </div>

          <div className="summary-card muted">
            <div className="summary-label">Low Support</div>
            <div className="summary-value">{formatNumber(summary.lowSupportCount)}</div>
            <div className="summary-sub">Needs reinforcement</div>
          </div>
        </div>

        <div className={`evac-top-filters ${isBarangayRole ? "barangay-mode" : ""}`}>
          <label className="filter-field search-field">
            <span>Search</span>
            <input
              type="text"
              placeholder={
                isBarangayRole
                  ? "Search place or location"
                  : "Search place, location, or barangay"
              }
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoComplete="off"
            />
          </label>

          {!isBarangayRole && (
            <label className="filter-field">
              <span>Barangay</span>
              <select
                value={barangayFilter}
                onChange={(e) => setBarangayFilter(e.target.value)}
              >
                <option value="all">All barangays</option>
                {barangayFilterOptions.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </label>
          )}

          <label className="filter-field">
            <span>Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All statuses</option>
              <option value="available">Available</option>
              <option value="limited">Limited</option>
              <option value="full">Full</option>
            </select>
          </label>

          <label className="filter-field">
            <span>Support</span>
            <select
              value={supportFilter}
              onChange={(e) => setSupportFilter(e.target.value)}
            >
              <option value="all">All support levels</option>
              <option value="none">No relief allocation</option>
              <option value="low">Low on support</option>
              <option value="adequate">Adequate support</option>
            </select>
          </label>
        </div>

        <div className="evac-main-layout">
          <section className="evac-map-panel">
            <div className="panel-head">
              <div>
                <h2>{isBarangayRole ? "Your Evacuation Map" : "Evacuation Map"}</h2>
                <p>
                  {pickMode
                    ? "Click anywhere on the map to set the new evacuation place coordinates."
                    : isBarangayRole
                    ? "View and manage your evacuation place coverage."
                    : "View and inspect evacuation place coverage."}
                </p>
              </div>

              <div className="map-panel-actions">
                {pickMode && (
                  <button className="btn btn-back" onClick={() => setPickMode(false)}>
                    Cancel Pick Mode
                  </button>
                )}
              </div>
            </div>

            <div className="map-stage">
              <Map onSelectLocation={handleMapSelectLocation} places={filteredPlaces} />

              {pickMode && (
                <div className="pick-mode-banner">
                  <strong>Pick mode active.</strong> Click on the map to set the location
                  for the new evacuation place.
                </div>
              )}
            </div>
          </section>

          <aside className="evac-side-panel">
            <div className="side-panel-sticky-head">
              <div className="side-panel-tabs">
                <button
                  className={`tab-btn ${panelView === "main" ? "active" : ""}`}
                  onClick={() => setPanelView("main")}
                >
                  List & Details
                </button>
                <button
                  className={`tab-btn ${panelView === "history" ? "active" : ""}`}
                  onClick={() => setPanelView("history")}
                >
                  History
                </button>
              </div>
            </div>

            {panelView === "main" ? (
              <div className="side-panel-body">
                <div className="side-block">
                  <div className="side-block-header">
                    <h3>
                      {isBarangayRole ? "Your Evacuation Places" : "Evacuation Places"}
                    </h3>
                    <span>{filteredPlaces.length} result(s)</span>
                  </div>

                  <div className="place-list">
                    {loadingPage ? (
                      <div className="empty-state">Loading evacuation places...</div>
                    ) : filteredPlaces.length === 0 ? (
                      <div className="empty-state">
                        No evacuation places match the current filters.
                      </div>
                    ) : (
                      filteredPlaces.map((place) => {
                        const capacityStats = statusCountsForPlaceCard(place);

                        return (
                          <button
                            type="button"
                            key={place._id}
                            className={`place-card ${
                              String(selectedId) === String(place._id) ? "selected" : ""
                            }`}
                            onClick={() => setSelectedId(place._id)}
                          >
                            <div className="place-card-top">
                              <div className="place-card-title-wrap">
                                <div className="place-card-title">{place.name}</div>
                                <div className="place-card-subtitle">{place.location}</div>
                              </div>

                              <div className="place-badge-stack">
                                <span
                                  className={`status-pill ${selectedStatusClass(
                                    place.capacityStatus
                                  )}`}
                                >
                                  {place.capacityStatus || "available"}
                                </span>

                                <span
                                  className={`support-pill ${supportClass(
                                    place.supportStatus
                                  )}`}
                                >
                                  {place.supportLabel}
                                </span>
                              </div>
                            </div>

                            <div className="place-card-meta">
                              <span>{place.barangayName || "Unknown barangay"}</span>
                              <span>
                                Allocations: {formatNumber(place.allocationCount)}
                              </span>
                            </div>

                            <div className="place-card-capacity">
                              <div className="mini-stat">
                                <strong>{formatNumber(capacityStats.individual)}</strong>
                                <span>Individuals</span>
                              </div>
                              <div className="mini-stat">
                                <strong>{formatNumber(capacityStats.family)}</strong>
                                <span>Families</span>
                              </div>
                              <div className="mini-stat">
                                <strong>{formatNumber(capacityStats.foodPackCapacity)}</strong>
                                <span>Food Packs</span>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="side-block details-block">
                  <div className="side-block-header">
                    <h3>Selected Place Details</h3>
                    {selectedPlace && (
                      <div className="detail-actions-inline">
                        <button type="button" className="text-action" onClick={openEditModal}>
                          Edit
                        </button>
                        <button
                          type="button"
                          className="text-action danger"
                          onClick={() => setShowDeleteConfirm(true)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>

                  {!selectedPlace ? (
                    <div className="empty-state">
                      Select an evacuation place to view details.
                    </div>
                  ) : (
                    <>
                      <div className="details-hero">
                        <div>
                          <h3>{selectedPlace.name}</h3>
                          <p>{selectedPlace.location}</p>
                        </div>

                        <div className="details-hero-badges">
                          <span
                            className={`status-pill ${selectedStatusClass(
                              selectedPlace.capacityStatus
                            )}`}
                          >
                            {selectedPlace.capacityStatus || "available"}
                          </span>
                          <span
                            className={`support-pill ${supportClass(
                              selectedPlace.supportStatus
                            )}`}
                          >
                            {selectedPlace.supportLabel}
                          </span>
                        </div>
                      </div>

                      <div className="details-grid">
                        <div className="detail-kv">
                          <span>Barangay</span>
                          <strong>{selectedPlace.barangayName || "-"}</strong>
                        </div>
                        <div className="detail-kv">
                          <span>Coordinates</span>
                          <strong>
                            {selectedPlace.latitude}, {selectedPlace.longitude}
                          </strong>
                        </div>
                        <div className="detail-kv">
                          <span>Individual Capacity</span>
                          <strong>{formatNumber(selectedPlace.capacityIndividual)}</strong>
                        </div>
                        <div className="detail-kv">
                          <span>Family Capacity</span>
                          <strong>{formatNumber(selectedPlace.capacityFamily)}</strong>
                        </div>
                        <div className="detail-kv">
                          <span>Bed Capacity</span>
                          <strong>{formatNumber(selectedPlace.bedCapacity)}</strong>
                        </div>
                        <div className="detail-kv">
                          <span>Floor Area</span>
                          <strong>{formatNumber(selectedPlace.floorArea)}</strong>
                        </div>
                        <div className="detail-kv">
                          <span>Food Pack Capacity</span>
                          <strong>{formatNumber(selectedPlace.foodPackCapacity)}</strong>
                        </div>
                        <div className="detail-kv">
                          <span>Total Allocated</span>
                          <strong>{formatNumber(selectedPlace.totalAllocated)}</strong>
                        </div>
                      </div>

                      <div className="facility-group">
                        <div className="subsection-title">Facilities & Flags</div>
                        <div className="chip-grid">
                          <span className={`chip ${selectedPlace.femaleCR ? "on" : ""}`}>
                            Female CR
                          </span>
                          <span className={`chip ${selectedPlace.maleCR ? "on" : ""}`}>
                            Male CR
                          </span>
                          <span className={`chip ${selectedPlace.commonCR ? "on" : ""}`}>
                            Common CR
                          </span>
                          <span
                            className={`chip ${selectedPlace.potableWater ? "on" : ""}`}
                          >
                            Potable Water
                          </span>
                          <span
                            className={`chip ${selectedPlace.nonPotableWater ? "on" : ""}`}
                          >
                            Non-Potable Water
                          </span>
                          <span
                            className={`chip ${selectedPlace.isPermanent ? "on" : ""}`}
                          >
                            Permanent
                          </span>
                          <span
                            className={`chip ${selectedPlace.isCovidFacility ? "on" : ""}`}
                          >
                            COVID Facility
                          </span>
                        </div>
                      </div>

                      <div className="status-update-block">
                        <div className="subsection-title">Update Capacity Status</div>
                        <div className="status-actions">
                          <button
                            type="button"
                            className={`status-btn ${
                              selectedPlace.capacityStatus === "available" ? "active" : ""
                            }`}
                            onClick={() => handleUpdateStatus("available")}
                          >
                            Available
                          </button>
                          <button
                            type="button"
                            className={`status-btn ${
                              selectedPlace.capacityStatus === "limited" ? "active" : ""
                            }`}
                            onClick={() => handleUpdateStatus("limited")}
                          >
                            Limited
                          </button>
                          <button
                            type="button"
                            className={`status-btn ${
                              selectedPlace.capacityStatus === "full" ? "active" : ""
                            }`}
                            onClick={() => handleUpdateStatus("full")}
                          >
                            Full
                          </button>
                        </div>
                      </div>

                      {canAllocate ? (
                        <div className="allocation-block">
                          <div className="subsection-title">Allocate Barangay Stock</div>
                          <div className="allocation-note">
                            Allocate goods from barangay storage to this evacuation place.
                          </div>

                          <label className="field">
                            <span>Available Stock Item</span>
                            <select
                              value={selectedStockId}
                              onChange={(e) => setSelectedStockId(e.target.value)}
                            >
                              <option value="">Select stock</option>
                              {visibleStocks.map((stock) => (
                                <option key={stock._id} value={stock._id}>
                                  {stock.itemName} • {stock.category} • Available:{" "}
                                  {stock.quantityAvailable} {stock.unit || ""}
                                </option>
                              ))}
                            </select>
                          </label>

                          <label className="field">
                            <span>Quantity</span>
                            <input
                              type="number"
                              min="1"
                              value={allocateQty}
                              onChange={(e) => setAllocateQty(e.target.value)}
                              placeholder="Enter quantity to allocate"
                            />
                          </label>

                          {selectedStock && (
                            <div className="stock-preview">
                              <div>
                                <strong>{selectedStock.itemName}</strong>
                                <span>{selectedStock.category}</span>
                              </div>
                              <div>
                                Available: {selectedStock.quantityAvailable}{" "}
                                {selectedStock.unit || ""}
                              </div>
                            </div>
                          )}

                          <button
                            type="button"
                            className="btn btn-update full-width"
                            onClick={handleAllocate}
                            disabled={loadingAllocate}
                          >
                            {loadingAllocate ? "Allocating..." : "Allocate to Evac Place"}
                          </button>
                        </div>
                      ) : (
                        <div className="monitoring-note-block">
                          <div className="subsection-title">Monitoring Only</div>
                          <div className="monitoring-note-text">
                            DRRMO and admin can monitor allocation status here, but stock
                            allocation must be done by the barangay from their own storage.
                          </div>
                        </div>
                      )}

                      <div className="recent-allocations-block">
                        <div className="subsection-title">Recent Allocation Logs</div>

                        {selectedPlaceAllocations.length === 0 ? (
                          <div className="empty-inline">
                            No allocation has been recorded for this evacuation place yet.
                          </div>
                        ) : (
                          <div className="allocation-log-list">
                            {selectedPlaceAllocations.slice(0, 6).map((log) => (
                              <div key={log._id} className="allocation-log-item">
                                <div className="allocation-log-main">
                                  <strong>{log.itemName || "Stock item"}</strong>
                                  <span>
                                    {log.quantity} {log.unit || ""}
                                  </span>
                                </div>
                                <div className="allocation-log-sub">
                                  <span>{log.category || "-"}</span>
                                  <span>{formatDateTime(log.createdAt)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="side-panel-body">
                <div className="side-block history-block">
                  <div className="side-block-header">
                    <h3>{isBarangayRole ? "Your Evacuation History" : "Evacuation History"}</h3>
                    <button type="button" className="text-action" onClick={fetchHistory}>
                      Refresh
                    </button>
                  </div>

                  {history.length === 0 ? (
                    <div className="empty-state">No history records yet.</div>
                  ) : (
                    <div className="history-timeline">
                      {history.map((item) => (
                        <div
                          key={item._id}
                          className={`history-entry ${getHistoryAccentClass(item.action)}`}
                        >
                          <div className="history-entry-top">
                            <div className="history-entry-action">
                              {item.action || "ACTION"}
                            </div>
                            <div className="history-entry-date">
                              {formatDateTime(item.createdAt)}
                            </div>
                          </div>

                          <div className="history-entry-place">
                            {item.placeName || "Unknown place"}
                          </div>

                          <div className="history-entry-details">
                            {item.details || "-"}
                          </div>

                          <div className="history-entry-meta">
                            <span>{item.barangayName || "—"}</span>
                            <span>
                              {item.performedBy
                                ? `${item.performedByRole || "user"} • ${item.performedBy}`
                                : "—"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </aside>
        </div>

        {renderPlaceModal("add")}
        {renderPlaceModal("edit")}

        {showDeleteConfirm &&
          createPortal(
            <div
              className="evac-modal"
              role="dialog"
              aria-modal="true"
              aria-label="Delete evacuation place"
              onClick={() => setShowDeleteConfirm(false)}
            >
              <div className="delete-dialog" onClick={(e) => e.stopPropagation()}>
                <div className="delete-dialog-head">
                  <h3>Delete Evacuation Place</h3>
                  <button
                    type="button"
                    className="evac-modal-close"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    ✕
                  </button>
                </div>

                <p>
                  Are you sure you want to delete{" "}
                  <strong>{selectedPlace?.name || "this place"}</strong>?
                </p>

                <div className="delete-dialog-actions">
                  <button
                    type="button"
                    className="btn btn-back"
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancel
                  </button>
                  <button type="button" className="btn btn-danger" onClick={handleDeletePlace}>
                    Delete
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )}
      </div>
    </DashboardShell>
  )

}
