import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import axios from "axios";
import "../css/Inventory.css";
import DashboardShell from "../layout/DashboardShell";

const BASE_URL =
  process.env.REACT_APP_API_URL || "https://gaganadapat.onrender.com";

export default function Inventory() {
  const { user } = useAuth();
  const role = user?.role || "";
  const canSeeCentralInventory = role === "admin" || role === "drrmo";

  const [inventory, setInventory] = useState([]);
  const [approvedRequests, setApprovedRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [releaseLoading, setReleaseLoading] = useState(false);
  const [error, setError] = useState("");

  const [viewType, setViewType] = useState("goods");

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sourceTypeFilter, setSourceTypeFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortOrder, setSortOrder] = useState("desc");

  const [requestSearch, setRequestSearch] = useState("");
  const [selectedRequestId, setSelectedRequestId] = useState("");
  const [releaseRemarks, setReleaseRemarks] = useState("");
  const [releaseInputs, setReleaseInputs] = useState({});
  const [releaseItems, setReleaseItems] = useState([]);

  const [barangayStock, setBarangayStock] = useState([]);
  const [activeTab, setActiveTab] = useState("storage");

  const [evacPlaces, setEvacPlaces] = useState([]);
  const [selectedEvac, setSelectedEvac] = useState("");
  const [stockQty, setStockQty] = useState("");
  const [selectedStockId, setSelectedStockId] = useState(null);

  const normalize = (val) => (val || "").toString().toLowerCase();

  const fetchInventory = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${BASE_URL}/api/inventory`, {
        withCredentials: true,
      });
      setInventory(Array.isArray(res.data) ? res.data : []);
      setError("");
    } catch (err) {
      console.error(err);
      setError("Failed to fetch inventory.");
      setInventory([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchApprovedRequests = async () => {
    try {
      setLoadingRequests(true);
      const res = await axios.get(
        `${BASE_URL}/api/relief-releases/approved-requests`,
        {
          withCredentials: true,
        }
      );
      setApprovedRequests(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Failed to fetch approved requests:", err);
      setApprovedRequests([]);
    } finally {
      setLoadingRequests(false);
    }
  };

  const fetchBarangayStock = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/barangay-stock`, {
        withCredentials: true,
      });
      setBarangayStock(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Stock fetch error:", err);
      setBarangayStock([]);
    }
  };

  const fetchEvacPlaces = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/evacs`, {
        withCredentials: true,
      });
      setEvacPlaces(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Evac fetch error:", err);
      setEvacPlaces([]);
    }
  };

  useEffect(() => {
    if (canSeeCentralInventory) {
      setActiveTab("inventory");
    } else {
      setActiveTab("storage");
    }
  }, [canSeeCentralInventory]);

  useEffect(() => {
    fetchBarangayStock();
    fetchEvacPlaces();

    if (canSeeCentralInventory) {
      fetchInventory();
      fetchApprovedRequests();
    } else {
      setInventory([]);
      setApprovedRequests([]);
      setSelectedRequestId("");
      setReleaseItems([]);
      setReleaseInputs({});
      setReleaseRemarks("");
      setError("");
      setLoading(false);
      setLoadingRequests(false);
    }
  }, [canSeeCentralInventory]);

  const goodsInventory = useMemo(() => {
    return inventory.filter((item) => normalize(item.type) === "goods");
  }, [inventory]);

  const monetaryInventory = useMemo(() => {
    return inventory.filter((item) => normalize(item.type) === "monetary");
  }, [inventory]);

  const currentInventory =
    viewType === "goods" ? goodsInventory : monetaryInventory;

  const filteredInventory = useMemo(() => {
    return currentInventory.filter((item) => {
      const matchesSearch =
        normalize(item.name).includes(normalize(search)) ||
        normalize(item.category).includes(normalize(search)) ||
        normalize(item.description).includes(normalize(search)) ||
        normalize(item.sourceType).includes(normalize(search)) ||
        normalize(item.sourceName).includes(normalize(search)) ||
        normalize(item.addedBy).includes(normalize(search)) ||
        normalize(item.unit).includes(normalize(search));

      const matchesCategory =
        viewType !== "goods" || !categoryFilter
          ? true
          : normalize(item.category) === normalize(categoryFilter);

      const matchesSourceType = sourceTypeFilter
        ? normalize(item.sourceType) === normalize(sourceTypeFilter)
        : true;

      return matchesSearch && matchesCategory && matchesSourceType;
    });
  }, [currentInventory, search, categoryFilter, sourceTypeFilter, viewType]);

  const sortFunction = (a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];

    if (sortBy === "quantity" || sortBy === "amount") {
      valA = Number(valA || 0);
      valB = Number(valB || 0);
    } else if (sortBy === "createdAt") {
      valA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      valB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    } else {
      valA = (valA || "").toString().toLowerCase();
      valB = (valB || "").toString().toLowerCase();
    }

    if (valA < valB) return sortOrder === "asc" ? -1 : 1;
    if (valA > valB) return sortOrder === "asc" ? 1 : -1;
    return 0;
  };

  const sortedInventory = useMemo(() => {
    return [...filteredInventory].sort(sortFunction);
  }, [filteredInventory, sortBy, sortOrder]);

  const groupedGoods = useMemo(() => {
    const groups = {};

    goodsInventory.forEach((item) => {
      const category = item.category || "uncategorized";

      if (!groups[category]) {
        groups[category] = {
          category,
          totalQuantity: 0,
          totalItems: 0,
        };
      }

      groups[category].totalItems += 1;
      groups[category].totalQuantity += Number(item.quantity || 0);
    });

    return Object.values(groups).sort((a, b) =>
      a.category.localeCompare(b.category)
    );
  }, [goodsInventory]);

  const summary = useMemo(() => {
    return {
      totalRecords: inventory.length,
      goodsCount: goodsInventory.length,
      monetaryCount: monetaryInventory.length,
      totalQuantity: goodsInventory.reduce(
        (sum, item) => sum + Number(item.quantity || 0),
        0
      ),
      totalAmount: monetaryInventory.reduce(
        (sum, item) => sum + Number(item.amount || 0),
        0
      ),
      categoryCount: new Set(goodsInventory.map((item) => item.category)).size,
    };
  }, [inventory, goodsInventory, monetaryInventory]);

  const storageSummary = useMemo(() => {
    const totalStockRows = barangayStock.length;
    const totalStockQuantity = barangayStock.reduce(
      (sum, item) => sum + Number(item.quantityAvailable || 0),
      0
    );
    const lowStockCount = barangayStock.filter((item) => {
      const qty = Number(item.quantityAvailable || 0);
      return qty > 0 && qty < 20;
    }).length;
    const emptyStockCount = barangayStock.filter(
      (item) => Number(item.quantityAvailable || 0) <= 0
    ).length;

    return {
      totalStockRows,
      totalStockQuantity,
      lowStockCount,
      emptyStockCount,
    };
  }, [barangayStock]);

  const filteredApprovedRequests = useMemo(() => {
    const q = normalize(requestSearch);

    if (!q) return approvedRequests;

    return approvedRequests.filter((req) => {
      return (
        normalize(req.requestNo).includes(q) ||
        normalize(req.barangayName).includes(q) ||
        normalize(req.disaster).includes(q) ||
        normalize(req.status).includes(q)
      );
    });
  }, [approvedRequests, requestSearch]);

  const selectedRequest = useMemo(() => {
    return approvedRequests.find((req) => req._id === selectedRequestId) || null;
  }, [approvedRequests, selectedRequestId]);

  const selectedRequestTotalIndividuals = useMemo(() => {
    if (!selectedRequest?.totals) return 0;

    return (
      Number(selectedRequest.totals.male || 0) +
      Number(selectedRequest.totals.female || 0) +
      Number(selectedRequest.totals.lgbtq || 0) +
      Number(selectedRequest.totals.pwd || 0) +
      Number(selectedRequest.totals.pregnant || 0) +
      Number(selectedRequest.totals.senior || 0)
    );
  }, [selectedRequest]);

  const plannedReleaseTotal = useMemo(() => {
    return releaseItems.reduce(
      (sum, item) => sum + Number(item.quantityReleased || 0),
      0
    );
  }, [releaseItems]);

  const fulfillmentPercent = useMemo(() => {
    const requested = Number(selectedRequest?.totals?.requestedFoodPacks || 0);
    if (!requested) return 0;
    return Math.min(100, Math.round((plannedReleaseTotal / requested) * 100));
  }, [selectedRequest, plannedReleaseTotal]);

  const getRequestStatusLabel = (status) => {
    if (!status) return "Unknown";
    return status.replace(/_/g, " ");
  };

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleString();
  };

  const clearReleaseWorkspace = () => {
    setSelectedRequestId("");
    setRequestSearch("");
    setReleaseRemarks("");
    setReleaseInputs({});
    setReleaseItems([]);
  };

  const clearAllocationWorkspace = () => {
    setSelectedStockId(null);
    setSelectedEvac("");
    setStockQty("");
  };

  const handleReleaseInputChange = (itemId, value) => {
    setReleaseInputs((prev) => ({
      ...prev,
      [itemId]: value,
    }));
  };

  const addItemToRelease = (item) => {
    if (!selectedRequest) {
      alert("Please select an approved relief request first.");
      return;
    }

    const rawQty = releaseInputs[item._id];
    const qty = Number(rawQty);

    if (!rawQty || Number.isNaN(qty) || qty <= 0) {
      alert("Enter a valid release quantity first.");
      return;
    }

    const available = Number(item.quantity || 0);

    if (qty > available) {
      alert(`Release quantity cannot exceed available stock (${available}).`);
      return;
    }

    setReleaseItems((prev) => {
      const existingIndex = prev.findIndex(
        (releaseItem) => releaseItem.inventoryItemId === item._id
      );

      const payload = {
        inventoryItemId: item._id,
        itemName: item.name || "",
        category: item.category || "",
        quantityReleased: qty,
        unit: item.unit || "",
        availableQuantity: available,
      };

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = payload;
        return updated;
      }

      return [...prev, payload];
    });

    setReleaseInputs((prev) => ({
      ...prev,
      [item._id]: "",
    }));
  };

  const removeReleaseItem = (inventoryItemId) => {
    setReleaseItems((prev) =>
      prev.filter((item) => item.inventoryItemId !== inventoryItemId)
    );
  };

  const handleReleaseDraftChange = (inventoryItemId, value) => {
    const qty = Number(value);

    setReleaseItems((prev) =>
      prev.map((item) => {
        if (item.inventoryItemId !== inventoryItemId) return item;

        if (value === "") {
          return { ...item, quantityReleased: "" };
        }

        if (Number.isNaN(qty) || qty < 0) {
          return item;
        }

        if (qty > Number(item.availableQuantity || 0)) {
          return {
            ...item,
            quantityReleased: Number(item.availableQuantity || 0),
          };
        }

        return { ...item, quantityReleased: qty };
      })
    );
  };

  const handleSubmitRelease = async () => {
    if (!selectedRequest) {
      alert("Please select an approved request.");
      return;
    }

    if (!releaseItems.length) {
      alert("Please add at least one inventory item to the release list.");
      return;
    }

    const invalidItem = releaseItems.find((item) => {
      const qty = Number(item.quantityReleased);
      return (
        Number.isNaN(qty) ||
        qty <= 0 ||
        qty > Number(item.availableQuantity || 0)
      );
    });

    if (invalidItem) {
      alert("Please review the release quantities before submitting.");
      return;
    }

    try {
      setReleaseLoading(true);

      const payload = {
        reliefRequestId: selectedRequest._id,
        items: releaseItems.map((item) => ({
          inventoryItemId: item.inventoryItemId,
          itemName: item.itemName,
          category: item.category,
          quantityReleased: Number(item.quantityReleased),
          unit: item.unit,
        })),
        remarks: releaseRemarks.trim(),
      };

      const res = await axios.post(`${BASE_URL}/api/relief-releases`, payload, {
        withCredentials: true,
      });

      alert(res.data?.message || "Relief goods released successfully.");

      clearReleaseWorkspace();
      fetchInventory();
      fetchApprovedRequests();
      fetchBarangayStock();
    } catch (err) {
      console.error("Release error:", err);
      alert(
        err.response?.data?.message || "Failed to release goods from inventory."
      );
    } finally {
      setReleaseLoading(false);
    }
  };

  const handleAllocate = async () => {
    if (!selectedStockId) {
      alert("Please choose a stock item first.");
      return;
    }

    if (!selectedEvac || !stockQty) {
      alert("Select an evacuation place and quantity.");
      return;
    }

    const qty = Number(stockQty);
    if (Number.isNaN(qty) || qty <= 0) {
      alert("Enter a valid allocation quantity.");
      return;
    }

    try {
      await axios.post(
        `${BASE_URL}/evacs/${selectedEvac}/allocate`,
        {
          stockId: selectedStockId,
          quantity: qty,
        },
        { withCredentials: true }
      );

      alert("Stock allocated successfully.");
      fetchBarangayStock();
      fetchEvacPlaces();
      clearAllocationWorkspace();
    } catch (err) {
      console.error("Allocate stock error:", err);
      alert(err.response?.data?.message || "Allocation failed.");
    }
  };

  const handleDistribute = async (stockId) => {
    const qty = prompt("Enter quantity to distribute:");
    if (!qty) return;

    const qtyNum = Number(qty);
    if (Number.isNaN(qtyNum) || qtyNum <= 0) {
      alert("Enter a valid quantity.");
      return;
    }

    try {
      await axios.post(
        `${BASE_URL}/api/barangay-stock/distribute`,
        {
          stockId,
          quantity: qtyNum,
        },
        { withCredentials: true }
      );

      alert("Stock distributed successfully.");
      fetchBarangayStock();
      fetchEvacPlaces();
    } catch (err) {
      console.error("Distribute stock error:", err);
      alert(err.response?.data?.message || "Distribution failed.");
    }
  };

  const getRowAlreadyAdded = (itemId) => {
    return releaseItems.find((item) => item.inventoryItemId === itemId);
  };

  const selectedStock = useMemo(() => {
    return barangayStock.find((item) => item._id === selectedStockId) || null;
  }, [barangayStock, selectedStockId]);

  const filteredEvacPlacesForAllocation = useMemo(() => {
    if (!selectedStock) return evacPlaces;

    return evacPlaces.filter(
      (place) => String(place.barangayId) === String(selectedStock.barangayId)
    );
  }, [evacPlaces, selectedStock]);

  return (
    <DashboardShell>
      <div className="inventory-page">
        <div className="inventory-shell">
          <div className="inventory-tabs">
            {canSeeCentralInventory && (
              <button
                className={activeTab === "inventory" ? "active" : ""}
                onClick={() => {
                  setActiveTab("inventory");
                  clearAllocationWorkspace();
                }}
              >
                DRRMO Inventory
              </button>
            )}

            <button
              className={activeTab === "storage" ? "active" : ""}
              onClick={() => {
                setActiveTab("storage");
                clearReleaseWorkspace();
              }}
            >
              Barangay Storage
            </button>
          </div>

          <div className="inventory-header inventory-header-elevated">
            <div>
              <span className="inventory-kicker">
                {activeTab === "inventory"
                  ? "DRRMO Inventory & Release Console"
                  : "Barangay Storage & Allocation Console"}
              </span>
              <h1 className="inventory-title">Inventory Management</h1>
              <p className="inventory-subtitle">
                {activeTab === "inventory"
                  ? "Monitor donation stock, review available resources, and release inventory directly against approved barangay relief requests."
                  : "Review barangay storage, distribute received goods, and allocate stock to evacuation centers."}
              </p>
            </div>
          </div>

          {canSeeCentralInventory && activeTab === "inventory" && (
            <>
              <div className="inventory-summary summary-grid">
                <div className="summary-card">
                  <p className="summary-label">Total Inventory Records</p>
                  <h3 className="summary-value">{summary.totalRecords}</h3>
                  <span className="summary-note">Active donation entries</span>
                </div>

                <div className="summary-card">
                  <p className="summary-label">Goods Records</p>
                  <h3 className="summary-value">{summary.goodsCount}</h3>
                  <span className="summary-note">
                    Total stock: {summary.totalQuantity.toLocaleString()}
                  </span>
                </div>

                <div className="summary-card">
                  <p className="summary-label">Monetary Records</p>
                  <h3 className="summary-value">{summary.monetaryCount}</h3>
                  <span className="summary-note">
                    ₱{summary.totalAmount.toLocaleString()}
                  </span>
                </div>

                <div className="summary-card">
                  <p className="summary-label">Goods Categories</p>
                  <h3 className="summary-value">{summary.categoryCount}</h3>
                  <span className="summary-note">Food, clothing, hygiene</span>
                </div>
              </div>

              <div className="inventory-release-console inventory-card">
                <div className="section-header compact inventory-release-header">
                  <div>
                    <span className="section-kicker">
                      Approved Request Release
                    </span>
                    <h2 className="section-title">Release Workspace</h2>
                    <p className="section-subtitle">
                      Search approved barangay requests, select one, then
                      prepare the inventory items you want to release.
                    </p>
                  </div>
                </div>

                <div className="inventory-release-topbar">
                  <div className="inventory-request-search">
                    <label>Select Approved Request</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Search request no., barangay, disaster..."
                      value={requestSearch}
                      onChange={(e) => setRequestSearch(e.target.value)}
                    />
                  </div>

                  <div className="inventory-release-meta">
                    <span className="inventory-meta-pill">
                      {loadingRequests
                        ? "Loading requests..."
                        : `${approvedRequests.length} approved request(s)`}
                    </span>
                  </div>
                </div>

                <div className="inventory-request-results">
                  {filteredApprovedRequests.length === 0 ? (
                    <div className="inventory-empty-inline">
                      No approved requests matched your search.
                    </div>
                  ) : (
                    filteredApprovedRequests.slice(0, 6).map((req) => (
                      <button
                        key={req._id}
                        type="button"
                        className={`inventory-request-chip ${
                          selectedRequestId === req._id ? "active" : ""
                        }`}
                        onClick={() => setSelectedRequestId(req._id)}
                      >
                        <strong>{req.requestNo}</strong>
                        <span>{req.barangayName}</span>
                        <small>{req.disaster}</small>
                      </button>
                    ))
                  )}
                </div>

                {selectedRequest && (
                  <div className="inventory-release-workspace">
                    <div className="inventory-release-request-card">
                      <div className="inventory-release-card-head">
                        <div>
                          <h3>Selected Request</h3>
                          <p>
                            Release goods against this approved barangay request.
                          </p>
                        </div>

                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={clearReleaseWorkspace}
                        >
                          Clear Selection
                        </button>
                      </div>

                      <div className="inventory-release-request-grid">
                        <div className="inventory-request-info">
                          <span>Request No.</span>
                          <strong>{selectedRequest.requestNo || "-"}</strong>
                        </div>
                        <div className="inventory-request-info">
                          <span>Barangay</span>
                          <strong>{selectedRequest.barangayName || "-"}</strong>
                        </div>
                        <div className="inventory-request-info">
                          <span>Disaster</span>
                          <strong>{selectedRequest.disaster || "-"}</strong>
                        </div>
                        <div className="inventory-request-info">
                          <span>Status</span>
                          <strong>
                            {getRequestStatusLabel(selectedRequest.status)}
                          </strong>
                        </div>
                        <div className="inventory-request-info">
                          <span>Requested Food Packs</span>
                          <strong>
                            {Number(
                              selectedRequest?.totals?.requestedFoodPacks || 0
                            ).toLocaleString()}
                          </strong>
                        </div>
                        <div className="inventory-request-info">
                          <span>Total Individuals</span>
                          <strong>
                            {selectedRequestTotalIndividuals.toLocaleString()}
                          </strong>
                        </div>
                      </div>

                      <div className="inventory-release-progress">
                        <div className="inventory-release-progress-head">
                          <span>Planned Release Progress</span>
                          <strong>{fulfillmentPercent}%</strong>
                        </div>
                        <div className="inventory-release-progress-bar">
                          <span style={{ width: `${fulfillmentPercent}%` }} />
                        </div>
                        <p>
                          Planned quantity:{" "}
                          <strong>{plannedReleaseTotal.toLocaleString()}</strong>{" "}
                          / Requested:
                          <strong>
                            {" "}
                            {Number(
                              selectedRequest?.totals?.requestedFoodPacks || 0
                            ).toLocaleString()}
                          </strong>
                        </p>
                      </div>
                    </div>

                    <div className="inventory-release-draft-card">
                      <div className="inventory-release-card-head">
                        <div>
                          <h3>Release Draft</h3>
                          <p>
                            Control exactly which items and quantities will be
                            released to the selected barangay.
                          </p>
                        </div>
                      </div>

                      {releaseItems.length === 0 ? (
                        <div className="inventory-empty-inline">
                          No inventory items added to the release draft yet.
                        </div>
                      ) : (
                        <div className="inventory-release-draft-list">
                          {releaseItems.map((item) => (
                            <div
                              className="inventory-release-draft-item"
                              key={item.inventoryItemId}
                            >
                              <div className="inventory-release-draft-main">
                                <strong>{item.itemName}</strong>
                                <span>
                                  {item.category} • Available:{" "}
                                  {Number(
                                    item.availableQuantity || 0
                                  ).toLocaleString()}{" "}
                                  {item.unit}
                                </span>
                              </div>

                              <div className="inventory-release-draft-actions">
                                <input
                                  type="number"
                                  min="0"
                                  max={item.availableQuantity}
                                  value={item.quantityReleased}
                                  onChange={(e) =>
                                    handleReleaseDraftChange(
                                      item.inventoryItemId,
                                      e.target.value
                                    )
                                  }
                                />
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() =>
                                    removeReleaseItem(item.inventoryItemId)
                                  }
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="inventory-release-remarks">
                        <label>Release Remarks</label>
                        <textarea
                          rows="4"
                          placeholder="Add release notes, allocation notes, or delivery instructions..."
                          value={releaseRemarks}
                          onChange={(e) => setReleaseRemarks(e.target.value)}
                        />
                      </div>

                      <div className="inventory-release-actions">
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => {
                            setReleaseItems([]);
                            setReleaseInputs({});
                            setReleaseRemarks("");
                          }}
                          disabled={releaseLoading}
                        >
                          Clear Draft
                        </button>

                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={handleSubmitRelease}
                          disabled={releaseLoading || !selectedRequest}
                        >
                          {releaseLoading ? "Releasing..." : "Release to Barangay"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="inventory-card">
                <div className="inventory-controls">
                  <div className="type-switch">
                    <button
                      className={viewType === "goods" ? "active" : ""}
                      onClick={() => setViewType("goods")}
                    >
                      Goods
                    </button>
                    <button
                      className={viewType === "monetary" ? "active" : ""}
                      onClick={() => setViewType("monetary")}
                    >
                      Monetary
                    </button>
                  </div>

                  <input
                    type="text"
                    className="input inventory-control-input"
                    placeholder={
                      viewType === "goods"
                        ? "Search item, category, source, notes..."
                        : "Search donor, source, notes..."
                    }
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />

                  {viewType === "goods" && (
                    <select
                      className="input inventory-control-select"
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                    >
                      <option value="">All Categories</option>
                      <option value="food">Food</option>
                      <option value="clothing">Clothing</option>
                      <option value="hygiene">Hygiene</option>
                    </select>
                  )}

                  <select
                    className="input inventory-control-select"
                    value={sourceTypeFilter}
                    onChange={(e) => setSourceTypeFilter(e.target.value)}
                  >
                    <option value="">All Sources</option>
                    <option value="external">External</option>
                    <option value="government">Government</option>
                    <option value="internal">Internal</option>
                  </select>

                  <select
                    className="input inventory-control-select"
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                  >
                    <option value="createdAt">Date</option>
                    <option value="name">Name</option>
                    <option value="quantity">Quantity</option>
                    <option value="amount">Amount</option>
                    <option value="sourceType">Source Type</option>
                  </select>

                  <select
                    className="input inventory-control-select"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value)}
                  >
                    <option value="desc">Desc</option>
                    <option value="asc">Asc</option>
                  </select>
                </div>
              </div>

              {viewType === "goods" && (
                <div className="inventory-card inventory-category-overview">
                  <div className="section-header compact">
                    <div>
                      <h2 className="section-title">Goods Category Overview</h2>
                      <p className="section-subtitle">
                        Aggregated inventory by category for faster stock
                        assessment.
                      </p>
                    </div>
                  </div>

                  <div className="inventory-category-grid">
                    {groupedGoods.map((group) => (
                      <div
                        className="inventory-category-tile"
                        key={group.category}
                      >
                        <span className="inventory-category-label">
                          {String(group.category || "-").toUpperCase()}
                        </span>
                        <strong>{group.totalQuantity.toLocaleString()}</strong>
                        <small>{group.totalItems} item record(s)</small>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="inventory-card">
                <div className="section-header compact">
                  <div>
                    <h2 className="section-title">
                      {viewType === "goods"
                        ? "Goods Inventory"
                        : "Monetary Records"}
                    </h2>
                    <p className="section-subtitle">
                      {viewType === "goods"
                        ? "Review stock details and add selected items into the release draft."
                        : "Track monetary donations and funding intake records."}
                    </p>
                  </div>
                </div>

                {loading && <p className="inventory-state">Loading inventory...</p>}
                {error && <p className="inventory-state error">{error}</p>}

                {!loading && viewType === "goods" && (
                  <div className="table-wrapper inventory-release-table-wrap">
                    <table className="inventory-table">
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Category</th>
                          <th>Available Qty</th>
                          <th>Unit</th>
                          <th>Source</th>
                          <th>Added By</th>
                          <th>Date</th>
                          <th>Files</th>
                          <th>Release Qty</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedInventory.length === 0 ? (
                          <tr>
                            <td colSpan="10">
                              <div className="table-empty">
                                <h4>No goods inventory found</h4>
                                <p>
                                  Try adjusting your filters or add new goods
                                  donations.
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          sortedInventory.map((item) => {
                            const draftItem = getRowAlreadyAdded(item._id);

                            return (
                              <tr key={item._id}>
                                <td>
                                  <div className="cell-main">
                                    {item.name || "-"}
                                  </div>
                                  {item.description ? (
                                    <small className="cell-sub">
                                      {item.description}
                                    </small>
                                  ) : null}
                                </td>
                                <td>
                                  <span className="badge badge-category">
                                    {item.category || "-"}
                                  </span>
                                </td>
                                <td>
                                  {Number(item.quantity || 0).toLocaleString()}
                                </td>
                                <td>{item.unit || "-"}</td>
                                <td>
                                  <div className="source-cell">
                                    <strong>{item.sourceType || "-"}</strong>
                                    <small>
                                      {item.sourceName || "No source name"}
                                    </small>
                                  </div>
                                </td>
                                <td>{item.addedBy || "-"}</td>
                                <td>{formatDate(item.createdAt)}</td>
                                <td>
                                  {item.proofFiles?.length > 0 ? (
                                    <div className="proof-list">
                                      {item.proofFiles.map((file, i) => (
                                        <a
                                          key={i}
                                          href={`${BASE_URL}/uploads/proofs/${file}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="file-link"
                                        >
                                          File {i + 1}
                                        </a>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="muted-text">No files</span>
                                  )}
                                </td>
                                <td>
                                  <input
                                    type="number"
                                    min="0"
                                    max={Number(item.quantity || 0)}
                                    className="inventory-release-input"
                                    placeholder="0"
                                    value={
                                      releaseInputs[item._id] !== undefined
                                        ? releaseInputs[item._id]
                                        : ""
                                    }
                                    onChange={(e) =>
                                      handleReleaseInputChange(
                                        item._id,
                                        e.target.value
                                      )
                                    }
                                    disabled={!selectedRequest}
                                  />
                                </td>
                                <td>
                                  <button
                                    type="button"
                                    className={`btn btn-sm ${
                                      draftItem
                                        ? "btn-secondary"
                                        : "btn-primary"
                                    }`}
                                    onClick={() => addItemToRelease(item)}
                                    disabled={!selectedRequest}
                                  >
                                    {draftItem ? "Update Draft" : "Add to Draft"}
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                {!loading && viewType === "monetary" && (
                  <div className="table-wrapper">
                    <table className="inventory-table">
                      <thead>
                        <tr>
                          <th>Name / Donor</th>
                          <th>Amount</th>
                          <th>Source</th>
                          <th>Description</th>
                          <th>Added By</th>
                          <th>Date</th>
                          <th>Files</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedInventory.length === 0 ? (
                          <tr>
                            <td colSpan="7">
                              <div className="table-empty">
                                <h4>No monetary records found</h4>
                                <p>
                                  There are no monetary donation records for this
                                  view.
                                </p>
                              </div>
                            </td>
                          </tr>
                        ) : (
                          sortedInventory.map((item) => (
                            <tr key={item._id}>
                              <td>{item.name || "-"}</td>
                              <td>
                                ₱{Number(item.amount || 0).toLocaleString()}
                              </td>
                              <td>
                                <div className="source-cell">
                                  <strong>{item.sourceType || "-"}</strong>
                                  <small>
                                    {item.sourceName || "No source name"}
                                  </small>
                                </div>
                              </td>
                              <td>{item.description || "-"}</td>
                              <td>{item.addedBy || "-"}</td>
                              <td>{formatDate(item.createdAt)}</td>
                              <td>
                                {item.proofFiles?.length > 0 ? (
                                  <div className="proof-list">
                                    {item.proofFiles.map((file, i) => (
                                      <a
                                        key={i}
                                        href={`${BASE_URL}/uploads/proofs/${file}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="file-link"
                                      >
                                        File {i + 1}
                                      </a>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="muted-text">No files</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}

          {activeTab === "storage" && (
            <>
              <div className="inventory-summary summary-grid">
                <div className="summary-card">
                  <p className="summary-label">Storage Records</p>
                  <h3 className="summary-value">
                    {storageSummary.totalStockRows}
                  </h3>
                  <span className="summary-note">Barangay stock entries</span>
                </div>

                <div className="summary-card">
                  <p className="summary-label">Total Available Quantity</p>
                  <h3 className="summary-value">
                    {storageSummary.totalStockQuantity.toLocaleString()}
                  </h3>
                  <span className="summary-note">Current storage balance</span>
                </div>

                <div className="summary-card">
                  <p className="summary-label">Low Stock Items</p>
                  <h3 className="summary-value">
                    {storageSummary.lowStockCount}
                  </h3>
                  <span className="summary-note">Below threshold</span>
                </div>

                <div className="summary-card">
                  <p className="summary-label">Empty Stock Items</p>
                  <h3 className="summary-value">
                    {storageSummary.emptyStockCount}
                  </h3>
                  <span className="summary-note">No available balance</span>
                </div>
              </div>

              <div className="inventory-card">
                <div className="section-header compact">
                  <div>
                    <h2 className="section-title">Barangay Storage</h2>
                    <p className="section-subtitle">
                      Review received relief goods, distribute them directly, or
                      allocate stock to evacuation centers.
                    </p>
                  </div>
                </div>

                <div className="table-wrapper">
                  <table className="inventory-table">
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th>Category</th>
                        <th>Barangay</th>
                        <th>Quantity</th>
                        <th>Unit</th>
                        <th>Status</th>
                        <th>Last Updated By</th>
                        <th>Updated</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {barangayStock.length === 0 ? (
                        <tr>
                          <td colSpan="9">
                            <div className="table-empty">
                              <h4>No barangay stock found</h4>
                              <p>
                                Barangay storage will appear here after relief
                                releases are received.
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        barangayStock.map((stock) => {
                          const qty = Number(stock.quantityAvailable || 0);

                          let status = "Available";
                          if (qty === 0) status = "Empty";
                          else if (qty < 20) status = "Low";

                          const rowSelected = selectedStockId === stock._id;

                          return (
                            <tr key={stock._id}>
                              <td>{stock.itemName || "-"}</td>
                              <td>
                                <span className="badge badge-category">
                                  {stock.category || "-"}
                                </span>
                              </td>
                              <td>{stock.barangayName || "-"}</td>
                              <td>{qty.toLocaleString()}</td>
                              <td>{stock.unit || "-"}</td>
                              <td>
                                <span
                                  className={`badge ${status.toLowerCase()}`}
                                >
                                  {status}
                                </span>
                              </td>
                              <td>{stock.lastUpdatedBy || "-"}</td>
                              <td>{formatDate(stock.updatedAt)}</td>
                              <td>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "8px",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <button
                                    type="button"
                                    className={`btn btn-sm ${
                                      rowSelected
                                        ? "btn-secondary"
                                        : "btn-primary"
                                    }`}
                                    onClick={() => {
                                      if (rowSelected) {
                                        clearAllocationWorkspace();
                                      } else {
                                        setSelectedStockId(stock._id);
                                        setSelectedEvac("");
                                        setStockQty("");
                                      }
                                    }}
                                  >
                                    {rowSelected
                                      ? "Cancel Allocation"
                                      : "Allocate"}
                                  </button>

                                  <button
                                    type="button"
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleDistribute(stock._id)}
                                    disabled={qty <= 0}
                                  >
                                    Distribute
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {selectedStock && (
                <div className="inventory-card">
                  <div className="section-header compact">
                    <div>
                      <h2 className="section-title">
                        Allocate to Evacuation Center
                      </h2>
                      <p className="section-subtitle">
                        Assign stock from barangay storage directly to a selected
                        evacuation place.
                      </p>
                    </div>
                  </div>

                  <div
                    className="inventory-release-request-grid"
                    style={{ marginBottom: "18px" }}
                  >
                    <div className="inventory-request-info">
                      <span>Selected Item</span>
                      <strong>{selectedStock.itemName || "-"}</strong>
                    </div>
                    <div className="inventory-request-info">
                      <span>Category</span>
                      <strong>{selectedStock.category || "-"}</strong>
                    </div>
                    <div className="inventory-request-info">
                      <span>Barangay</span>
                      <strong>{selectedStock.barangayName || "-"}</strong>
                    </div>
                    <div className="inventory-request-info">
                      <span>Available</span>
                      <strong>
                        {Number(
                          selectedStock.quantityAvailable || 0
                        ).toLocaleString()}{" "}
                        {selectedStock.unit || ""}
                      </strong>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 220px auto",
                      gap: "14px",
                      alignItems: "end",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "8px",
                          fontWeight: 600,
                        }}
                      >
                        Select Evacuation Center
                      </label>
                      <select
                        className="input inventory-control-select"
                        value={selectedEvac}
                        onChange={(e) => setSelectedEvac(e.target.value)}
                      >
                        <option value="">Select Evac Place</option>
                        {filteredEvacPlacesForAllocation.map((place) => (
                          <option key={place._id} value={place._id}>
                            {place.name} ({place.barangayName})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          marginBottom: "8px",
                          fontWeight: 600,
                        }}
                      >
                        Quantity
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={Number(selectedStock.quantityAvailable || 0)}
                        className="input inventory-control-input"
                        placeholder="0"
                        value={stockQty}
                        onChange={(e) => setStockQty(e.target.value)}
                      />
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "10px",
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleAllocate}
                      >
                        Confirm Allocation
                      </button>

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={clearAllocationWorkspace}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}