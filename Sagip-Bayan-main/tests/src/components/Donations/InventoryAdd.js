import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import "../css/InventoryAdd.css";
import DashboardShell from '../layout/DashboardShell';

const BASE_URL =
  process.env.REACT_APP_API_URL || "https://gaganadapat.onrender.com";

const CUSTOM_CATEGORY_VALUE = "__custom__";

const InventoryAdd = () => {
  const [items, setItems] = useState([]);
  const [archivedItems, setArchivedItems] = useState([]);
  const [proofFiles, setProofFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [donationType, setDonationType] = useState("goods");
  const fileInputRef = useRef(null);

  const [categoryOptions, setCategoryOptions] = useState([]);
  const [categoryLoading, setCategoryLoading] = useState(false);

  const [form, setForm] = useState({
    type: "goods",
    name: "",
    category: "",
    customCategory: "",
    quantity: "",
    unit: "",
    amount: "",
    description: "",
    sourceType: "external",
    sourceName: ""
  });

  const [formErrors, setFormErrors] = useState({});

  const [filters, setFilters] = useState({
    search: "",
    category: "",
    addedBy: "",
    date: ""
  });

  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "desc"
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const fetchInventory = async () => {
    try {
      setFetching(true);
      const res = await axios.get(`${BASE_URL}/api/inventory`, {
        withCredentials: true
      });

      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching inventory:", err);
      alert("Failed to fetch inventory items.");
    } finally {
      setFetching(false);
    }
  };

  const fetchInventoryCategories = async () => {
    try {
      setCategoryLoading(true);
      const res = await axios.get(`${BASE_URL}/api/inventory/categories`, {
        withCredentials: true
      });

      const data = Array.isArray(res.data) ? res.data : [];
      setCategoryOptions(data);
    } catch (err) {
      console.error("Error fetching inventory categories:", err);
      setCategoryOptions([]);
    } finally {
      setCategoryLoading(false);
    }
  };

  const fetchArchivedInventory = async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/inventory/archived`, {
        withCredentials: true
      });

      setArchivedItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching archived inventory:", err);
      alert("Failed to fetch archived inventory items.");
    }
  };

  useEffect(() => {
    fetchInventory();
    fetchInventoryCategories();
  }, []);

  useEffect(() => {
    if (showArchived) {
      fetchArchivedInventory();
    }
  }, [showArchived]);

  const resetForm = () => {
    setForm({
      type: donationType,
      name: "",
      category: "",
      customCategory: "",
      quantity: "",
      unit: "",
      amount: "",
      description: "",
      sourceType: "external",
      sourceName: ""
    });
    setProofFiles([]);
    setFormErrors({});
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    setForm({
      type: donationType,
      name: "",
      category: "",
      customCategory: "",
      quantity: "",
      unit: "",
      amount: "",
      description: "",
      sourceType: "external",
      sourceName: ""
    });
    setProofFiles([]);
    setFormErrors({});
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (donationType === "goods") {
      fetchInventoryCategories();
    }
  }, [donationType]);

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleString();
  };

  const formatShortDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString();
  };

  const normalizeType = (type) => (type || "goods").toLowerCase();

  const normalizeCategoryValue = (value) => {
    return String(value || "").trim().toLowerCase();
  };

  const formatCategory = (category) => {
    if (!category) return "-";
    return category
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const isRecentDonation = (createdAt) => {
    if (!createdAt) return false;
    const itemDate = new Date(createdAt);
    const now = new Date();
    const diffInDays = (now - itemDate) / (1000 * 60 * 60 * 24);
    return diffInDays <= 7;
  };

  const getFormTitle = () => {
    return donationType === "goods"
      ? "Add Goods Donation"
      : "Add Monetary Donation";
  };

  const getFormSubtitle = () => {
    return donationType === "goods"
      ? "Record incoming relief goods donations and stock intake for inventory tracking."
      : "Log incoming monetary donations for financial intake and disaster response support.";
  };

  const getPrimaryFieldLabel = () => {
    return donationType === "goods" ? "Item Name" : "Donor Name";
  };

  const getPrimaryFieldPlaceholder = () => {
    return donationType === "goods"
      ? "e.g. Rice, Canned Goods, Hygiene Kit"
      : "e.g. Juan Dela Cruz, ABC Foundation";
  };

  const getSourceNamePlaceholder = () => {
    return donationType === "goods"
      ? "e.g. NGO, Barangay Office, Private Donor"
      : "e.g. Municipal Office, Foundation, Private Sponsor";
  };

  const getProofLabel = () => {
    return donationType === "goods"
      ? "Upload receipts, delivery photos, acknowledgement slips, or intake proof."
      : "Upload receipts, deposit slips, acknowledgement forms, or proof of transaction.";
  };

  const getNumberInputValue = (value) => {
    return value === 0 ? "" : value;
  };

  const getFinalGoodsCategory = () => {
    if (form.category === CUSTOM_CATEGORY_VALUE) {
      return normalizeCategoryValue(form.customCategory);
    }
    return normalizeCategoryValue(form.category);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "quantity" || name === "amount") {
      if (value === "") {
        setForm((prev) => ({ ...prev, [name]: "" }));
      } else {
        const parsedValue = Number(value);
        if (!Number.isNaN(parsedValue) && parsedValue >= 0) {
          setForm((prev) => ({ ...prev, [name]: value }));
        }
      }
    } else if (name === "category") {
      setForm((prev) => ({
        ...prev,
        category: value,
        customCategory: value === CUSTOM_CATEGORY_VALUE ? prev.customCategory : ""
      }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }

    setFormErrors((prev) => ({ ...prev, [name]: "", category: "", customCategory: "" }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    setProofFiles(files);
  };

  const validateForm = () => {
    const errors = {};

    if (!form.name.trim()) {
      errors.name =
        donationType === "goods"
          ? "Item name is required."
          : "Donor name is required.";
    }

    if (donationType === "goods") {
      const finalCategory = getFinalGoodsCategory();

      if (!finalCategory) {
        errors.category = "Category is required.";
      }

      if (
        form.category === CUSTOM_CATEGORY_VALUE &&
        !normalizeCategoryValue(form.customCategory)
      ) {
        errors.customCategory = "Please enter a custom category.";
      }

      if (form.quantity === "" || Number(form.quantity) <= 0) {
        errors.quantity = "Quantity must be greater than 0.";
      }

      if (!form.unit.trim()) {
        errors.unit = "Unit is required for goods donations.";
      }
    }

    if (donationType === "monetary") {
      if (form.amount === "" || Number(form.amount) <= 0) {
        errors.amount = "Amount must be greater than 0.";
      }
    }

    if (!form.sourceType.trim()) {
      errors.sourceType = "Source type is required.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      const formData = new FormData();

      formData.append("type", donationType);
      formData.append("name", form.name.trim());
      formData.append("description", form.description.trim());
      formData.append("sourceType", form.sourceType);
      formData.append("sourceName", form.sourceName.trim());

      if (donationType === "goods") {
        formData.append("category", getFinalGoodsCategory());
        if (form.quantity !== "") {
          formData.append("quantity", form.quantity);
        }
        formData.append("unit", form.unit.trim());
      } else {
        if (form.amount !== "") {
          formData.append("amount", form.amount);
        }
      }

      for (let i = 0; i < proofFiles.length; i++) {
        formData.append("proofFiles", proofFiles[i]);
      }

      await axios.post(`${BASE_URL}/api/inventory`, formData, {
        withCredentials: true,
        headers: { "Content-Type": "multipart/form-data" }
      });

      alert(
        donationType === "goods"
          ? "Goods donation added successfully!"
          : "Monetary donation added successfully!"
      );

      resetForm();
      setShowForm(false);
      fetchInventory();
      fetchInventoryCategories();
    } catch (err) {
      console.error("Error adding inventory:", err);
      alert("Failed to add inventory item.");
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (id, name) => {
    const confirmArchive = window.confirm(
      `Are you sure you want to archive "${name || "this item"}"?`
    );

    if (!confirmArchive) return;

    try {
      await axios.delete(`${BASE_URL}/api/inventory/${id}`, {
        withCredentials: true
      });

      alert("Inventory item archived successfully!");
      fetchInventory();
      fetchInventoryCategories();
    } catch (err) {
      console.error("Error archiving item:", err);
      alert("Failed to archive item.");
    }
  };

  const handleUnarchive = async (id, name) => {
  const confirmUnarchive = window.confirm(
    `Are you sure you want to unarchive "${name || "this item"}"?`
  );

  if (!confirmUnarchive) return;

  try {
    await axios.put(
      `${BASE_URL}/api/inventory/archived/${id}/restore`,
      {},
      { withCredentials: true }
    );

    alert("Inventory item unarchived successfully!");
    fetchArchivedInventory();
    fetchInventory();
    fetchInventoryCategories();
  } catch (err) {
    console.error("Error unarchiving item:", err);
    alert("Failed to unarchive item.");
  }
};

const handlePermanentDelete = async (id, name) => {
  const confirmDelete = window.confirm(
    `Permanently delete "${name || "this item"}"? This cannot be undone.`
  );

  if (!confirmDelete) return;

  try {
    await axios.delete(`${BASE_URL}/api/inventory/archived/${id}/permanent`, {
      withCredentials: true
    });

    alert("Inventory item deleted permanently!");
    fetchArchivedInventory();
    fetchInventoryCategories();
  } catch (err) {
    console.error("Error deleting archived item:", err);
    alert("Failed to permanently delete item.");
  }
};

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      category: "",
      addedBy: "",
      date: ""
    });
    setCurrentPage(1);
  };

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc"
        };
      }

      return {
        key,
        direction: "asc"
      };
    });
  };

  const goodsItems = useMemo(
    () => items.filter((item) => normalizeType(item.type) === "goods"),
    [items]
  );

  const monetaryItems = useMemo(
    () => items.filter((item) => normalizeType(item.type) === "monetary"),
    [items]
  );

  const currentTypeItems = useMemo(() => {
    const sourceItems = showArchived ? archivedItems : items;
    return sourceItems.filter((item) => normalizeType(item.type) === donationType);
  }, [items, archivedItems, donationType, showArchived]);

  const categories = useMemo(() => {
    if (donationType !== "goods") return [];
    const unique = [
      ...new Set(currentTypeItems.map((item) => item.category).filter(Boolean))
    ];
    return unique.sort((a, b) => a.localeCompare(b));
  }, [currentTypeItems, donationType]);

  const selectableCategoryOptions = useMemo(() => {
    const merged = [...new Set([...categoryOptions, ...categories].filter(Boolean))];
    return merged.sort((a, b) => a.localeCompare(b));
  }, [categoryOptions, categories]);

  const addedByOptions = useMemo(() => {
    const unique = [
      ...new Set(currentTypeItems.map((item) => item.addedBy).filter(Boolean))
    ];
    return unique.sort((a, b) => a.localeCompare(b));
  }, [currentTypeItems]);

  const summary = useMemo(() => {
    const totalItems = items.length;
    const totalGoodsEntries = goodsItems.length;
    const totalMonetaryEntries = monetaryItems.length;

    const totalGoodsQuantity = goodsItems.reduce((sum, item) => {
      const qty = Number(item.quantity);
      return sum + (isNaN(qty) ? 0 : qty);
    }, 0);

    const totalMonetaryAmount = monetaryItems.reduce((sum, item) => {
      const amount = Number(item.amount || 0);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

    const recentDonationsCount = items.filter((item) =>
      isRecentDonation(item.createdAt)
    ).length;

    return {
      totalItems,
      totalGoodsEntries,
      totalMonetaryEntries,
      totalGoodsQuantity,
      totalMonetaryAmount,
      recentDonationsCount
    };
  }, [items, goodsItems, monetaryItems]);

  const filteredItems = useMemo(() => {
    let filtered = [...currentTypeItems];

    if (filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter((item) =>
        [
          item.name,
          item.description,
          item.category,
          item.addedBy,
          item.unit,
          item.sourceType,
          item.sourceName
        ]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm)
      );
    }

    if (donationType === "goods" && filters.category) {
      filtered = filtered.filter(
        (item) =>
          (item.category || "").toLowerCase() === filters.category.toLowerCase()
      );
    }

    if (filters.addedBy) {
      filtered = filtered.filter(
        (item) =>
          (item.addedBy || "").toLowerCase() === filters.addedBy.toLowerCase()
      );
    }

    if (filters.date) {
      filtered = filtered.filter((item) => {
        if (!item.createdAt) return false;
        const itemDate = new Date(item.createdAt).toISOString().slice(0, 10);
        return itemDate === filters.date;
      });
    }

    return filtered;
  }, [currentTypeItems, filters, donationType]);

  const sortedItems = useMemo(() => {
    const sorted = [...filteredItems];

    sorted.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      if (sortConfig.key === "type") {
        aValue = normalizeType(a.type);
        bValue = normalizeType(b.type);
      }

      if (sortConfig.key === "createdAt") {
        aValue = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        bValue = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      }

      if (sortConfig.key === "quantity") {
        aValue =
          donationType === "monetary"
            ? Number(a.amount || 0)
            : Number(a.quantity) || 0;

        bValue =
          donationType === "monetary"
            ? Number(b.amount || 0)
            : Number(b.quantity) || 0;
      }

      if (typeof aValue === "string") aValue = aValue.toLowerCase();
      if (typeof bValue === "string") bValue = bValue.toLowerCase();

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredItems, sortConfig, donationType]);

  const totalPages = Math.ceil(sortedItems.length / rowsPerPage) || 1;

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return sortedItems.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedItems, currentPage, rowsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const pageNumbers = useMemo(() => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }, [totalPages]);

  const sortArrow = (key) => {
    if (sortConfig.key !== key) return "↕";
    return sortConfig.direction === "asc" ? "↑" : "↓";
  };

  const tableColSpan = donationType === "goods" ? 10 : 8;

  return (
    <DashboardShell>
      <div className="inventory-page">
        <div className="inventory-shell">
          <div className="inventory-header">
            <div>
              <h1 className="inventory-title">Add Donations to Inventory</h1>
              <p className="inventory-subtitle">
                Manage incoming goods and monetary donations for disaster relief
                operations.
              </p>
            </div>

            {!showForm && (
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowArchived((prev) => !prev);
                    setCurrentPage(1);
                    clearFilters();
                  }}
                >
                  {showArchived ? "Back to Active Donations" : "View Archived Donations"}
                </button>

                <button className="btn btn-primary" onClick={() => setShowForm(true)}>
                  + Add {donationType === "goods" ? "Goods" : "Monetary"} Donation
                </button>
              </div>
            )}
          </div>

          {!showForm && !showArchived && (
            <div className="summary-grid">
              <div className="summary-card">
                <p className="summary-label">Total Inventory Records</p>
                <h3 className="summary-value">{summary.totalItems}</h3>
                <span className="summary-note">All donation entries</span>
              </div>

              <div className="summary-card">
                <p className="summary-label">Goods Donations</p>
                <h3 className="summary-value">{summary.totalGoodsEntries}</h3>
                <span className="summary-note">
                  Total quantity: {summary.totalGoodsQuantity}
                </span>
              </div>

              <div className="summary-card">
                <p className="summary-label">Monetary Donations</p>
                <h3 className="summary-value">{summary.totalMonetaryEntries}</h3>
                <span className="summary-note">
                  Total amount: ₱{summary.totalMonetaryAmount.toLocaleString()}
                </span>
              </div>

              <div className="summary-card">
                <p className="summary-label">Recent Donations</p>
                <h3 className="summary-value">{summary.recentDonationsCount}</h3>
                <span className="summary-note">Last 7 days</span>
              </div>
            </div>
          )}

          {showForm ? (
            <div className="donation-modal-shell">
              <div className="donation-modal-card inventory-card">
                <div className="donation-modal-header">
                  <div className="donation-modal-heading">
                    <span className="section-kicker">Donation Intake</span>
                    <h2 className="section-title">{getFormTitle()}</h2>
                    <p className="section-subtitle">{getFormSubtitle()}</p>
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary modal-back-btn"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                  >
                    Back
                  </button>
                </div>

                <div className="donation-type-tabs">
                  <button
                    type="button"
                    className={`donation-type-tab ${
                      donationType === "goods" ? "active" : ""
                    }`}
                    onClick={() => setDonationType("goods")}
                  >
                    Goods
                  </button>
                  <button
                    type="button"
                    className={`donation-type-tab ${
                      donationType === "monetary" ? "active" : ""
                    }`}
                    onClick={() => setDonationType("monetary")}
                  >
                    Monetary
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="donation-form">
                  <div className="donation-form-section">
                    <div className="donation-section-heading">
                      <h3>Donation Details</h3>
                      <p>Main information for this donation record.</p>
                    </div>

                    <div className="donation-form-grid">
                      <div
                        className={`donation-form-group ${
                          donationType === "goods" ? "span-2" : ""
                        }`}
                      >
                        <label htmlFor="name">
                          {getPrimaryFieldLabel()} <span>*</span>
                        </label>
                        <input
                          id="name"
                          type="text"
                          name="name"
                          placeholder={getPrimaryFieldPlaceholder()}
                          value={form.name}
                          onChange={handleChange}
                          className={`input ${formErrors.name ? "input-error" : ""}`}
                        />
                        {formErrors.name && (
                          <span className="error-text">{formErrors.name}</span>
                        )}
                      </div>

                      {donationType === "goods" && (
                        <>
                          <div className="donation-form-group">
                            <label htmlFor="category">
                              Category <span>*</span>
                            </label>
                            <select
                              id="category"
                              name="category"
                              value={form.category}
                              onChange={handleChange}
                              className={`input ${
                                formErrors.category ? "input-error" : ""
                              }`}
                              disabled={categoryLoading}
                            >
                              <option value="">
                                {categoryLoading
                                  ? "Loading categories..."
                                  : "Select category"}
                              </option>

                              {selectableCategoryOptions.map((category) => (
                                <option key={category} value={category}>
                                  {formatCategory(category)}
                                </option>
                              ))}

                              <option value={CUSTOM_CATEGORY_VALUE}>
                                Other / Custom Category
                              </option>
                            </select>
                            {formErrors.category && (
                              <span className="error-text">{formErrors.category}</span>
                            )}
                          </div>

                          {form.category === CUSTOM_CATEGORY_VALUE && (
                            <div className="donation-form-group">
                              <label htmlFor="customCategory">
                                Custom Category <span>*</span>
                              </label>
                              <input
                                id="customCategory"
                                type="text"
                                name="customCategory"
                                placeholder="e.g. medicine, water, shelter kits"
                                value={form.customCategory}
                                onChange={handleChange}
                                className={`input ${
                                  formErrors.customCategory ? "input-error" : ""
                                }`}
                              />
                              {formErrors.customCategory && (
                                <span className="error-text">
                                  {formErrors.customCategory}
                                </span>
                              )}
                            </div>
                          )}
                        </>
                      )}

                      {donationType === "goods" ? (
                        <>
                          <div className="donation-form-group">
                            <label htmlFor="quantity">
                              Quantity <span>*</span>
                            </label>
                            <input
                              id="quantity"
                              type="number"
                              min="0"
                              step="1"
                              name="quantity"
                              placeholder="e.g. 50"
                              value={getNumberInputValue(form.quantity)}
                              onChange={handleChange}
                              className={`input ${
                                formErrors.quantity ? "input-error" : ""
                              }`}
                            />
                            {formErrors.quantity && (
                              <span className="error-text">
                                {formErrors.quantity}
                              </span>
                            )}
                          </div>

                          <div className="donation-form-group">
                            <label htmlFor="unit">
                              Unit <span>*</span>
                            </label>
                            <input
                              id="unit"
                              type="text"
                              name="unit"
                              placeholder="e.g. sacks, boxes, packs, pcs"
                              value={form.unit}
                              onChange={handleChange}
                              className={`input ${formErrors.unit ? "input-error" : ""}`}
                            />
                            {formErrors.unit && (
                              <span className="error-text">{formErrors.unit}</span>
                            )}
                          </div>
                        </>
                      ) : (
                        <div className="donation-form-group">
                          <label htmlFor="amount">
                            Amount <span>*</span>
                          </label>
                          <input
                            id="amount"
                            type="number"
                            min="0"
                            step="0.01"
                            name="amount"
                            placeholder="e.g. 10000"
                            value={getNumberInputValue(form.amount)}
                            onChange={handleChange}
                            className={`input ${
                              formErrors.amount ? "input-error" : ""
                            }`}
                          />
                          {formErrors.amount && (
                            <span className="error-text">{formErrors.amount}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="donation-form-section">
                    <div className="donation-section-heading">
                      <h3>Source Information</h3>
                      <p>Where the donation came from or who endorsed it.</p>
                    </div>

                    <div className="donation-form-grid">
                      <div className="donation-form-group">
                        <label htmlFor="sourceType">
                          Source Type <span>*</span>
                        </label>
                        <select
                          id="sourceType"
                          name="sourceType"
                          value={form.sourceType}
                          onChange={handleChange}
                          className={`input ${
                            formErrors.sourceType ? "input-error" : ""
                          }`}
                        >
                          <option value="external">External</option>
                          <option value="government">Government</option>
                          <option value="internal">Internal</option>
                        </select>
                        {formErrors.sourceType && (
                          <span className="error-text">{formErrors.sourceType}</span>
                        )}
                      </div>

                      <div className="donation-form-group">
                        <label htmlFor="sourceName">Source Name</label>
                        <input
                          id="sourceName"
                          type="text"
                          name="sourceName"
                          placeholder={getSourceNamePlaceholder()}
                          value={form.sourceName}
                          onChange={handleChange}
                          className="input"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="donation-form-section">
                    <div className="donation-section-heading">
                      <h3>Additional Information</h3>
                      <p>Attach files and add supporting notes.</p>
                    </div>

                    <div className="donation-form-grid">
                      <div className="donation-form-group full-width">
                        <label htmlFor="description">Description / Notes</label>
                        <textarea
                          id="description"
                          name="description"
                          placeholder={
                            donationType === "goods"
                              ? "Add notes about packaging, expiry, condition, delivery details, or stock intake remarks..."
                              : "Add notes about transaction reference, intended use, receipt details, or supporting remarks..."
                          }
                          value={form.description}
                          onChange={handleChange}
                          className="textarea"
                          rows="4"
                        />
                      </div>

                      <div className="donation-form-group full-width">
                        <label htmlFor="proofFiles">Validation</label>

                        <div
                          className="donation-upload-box"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <input
                            id="proofFiles"
                            ref={fileInputRef}
                            type="file"
                            multiple
                            onChange={handleFileChange}
                            className="file-input"
                          />

                          <div className="donation-upload-content">
                            <p className="donation-upload-title">
                              Click to upload supporting files
                            </p>
                            <span className="donation-upload-subtext">
                              {getProofLabel()}
                            </span>
                            <span className="donation-upload-count">
                              {proofFiles.length > 0
                                ? `${proofFiles.length} file${
                                    proofFiles.length > 1 ? "s" : ""
                                  } selected`
                                : "No files selected"}
                            </span>
                          </div>
                        </div>

                        {proofFiles.length > 0 && (
                          <div className="donation-selected-files">
                            {proofFiles.map((file, index) => (
                              <div key={`${file.name}-${index}`} className="donation-file-chip">
                                <span className="donation-file-chip-name">{file.name}</span>
                                <span className="donation-file-chip-size">
                                  {(file.size / 1024).toFixed(1)} KB
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="donation-form-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setShowForm(false);
                        resetForm();
                      }}
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={resetForm}
                      disabled={loading}
                    >
                      Reset
                    </button>

                    <button type="submit" disabled={loading} className="btn btn-primary">
                      {loading
                        ? "Saving..."
                        : donationType === "goods"
                        ? "Save Goods"
                        : "Save Monetary"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <>
              <div className="inventory-card">
                <div className="type-switch">
                  <button
                    className={`type-tab ${donationType === "goods" ? "active" : ""}`}
                    onClick={() => {
                      setDonationType("goods");
                      setCurrentPage(1);
                      clearFilters();
                    }}
                  >
                    Goods Donations
                  </button>
                  <button
                    className={`type-tab ${
                      donationType === "monetary" ? "active" : ""
                    }`}
                    onClick={() => {
                      setDonationType("monetary");
                      setCurrentPage(1);
                      clearFilters();
                    }}
                  >
                    Monetary Donations
                  </button>
                </div>
              </div>

              <div className="inventory-card">
                <div className="section-header compact">
                  <div>
                    <h2 className="section-title">
                      {showArchived
                        ? donationType === "goods"
                          ? "Archived Goods Donations"
                          : "Archived Monetary Donations"
                        : donationType === "goods"
                        ? "Goods Donations"
                        : "Monetary Donations"}
                    </h2>
                    <p className="section-subtitle">
                      {showArchived
                        ? "Review archived donation records."
                        : "Search, sort, and manage donation records."}
                    </p>
                  </div>
                </div>

                <div className="filter-toolbar">
                  <div className="filter-group search-group">
                    <label>Search</label>
                    <input
                      type="text"
                      name="search"
                      placeholder={
                        donationType === "goods"
                          ? "Search item name, category, notes, source..."
                          : "Search donor, notes, source..."
                      }
                      value={filters.search}
                      onChange={handleFilterChange}
                      className="input"
                    />
                  </div>

                  {donationType === "goods" && (
                    <div className="filter-group">
                      <label>Category</label>
                      <select
                        name="category"
                        value={filters.category}
                        onChange={handleFilterChange}
                        className="input"
                      >
                        <option value="">All Categories</option>
                        {categories.map((category, index) => (
                          <option key={index} value={category}>
                            {formatCategory(category)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="filter-group">
                    <label>Added By</label>
                    <select
                      name="addedBy"
                      value={filters.addedBy}
                      onChange={handleFilterChange}
                      className="input"
                    >
                      <option value="">All Users</option>
                      {addedByOptions.map((user, index) => (
                        <option key={index} value={user}>
                          {user}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="filter-group">
                    <label>Date</label>
                    <input
                      type="date"
                      name="date"
                      value={filters.date}
                      onChange={handleFilterChange}
                      className="input"
                    />
                  </div>

                  <div className="filter-actions">
                    <button className="btn btn-secondary" onClick={clearFilters}>
                      Clear Filters
                    </button>
                  </div>
                </div>

                <div className="table-topbar">
                  <div className="table-meta">
                    <span>
                      Showing <strong>{paginatedItems.length}</strong> of{" "}
                      <strong>{sortedItems.length}</strong> filtered record(s)
                    </span>
                  </div>

                  <div className="rows-control">
                    <label>Rows per page</label>
                    <select
                      value={rowsPerPage}
                      onChange={(e) => {
                        setRowsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="rows-select"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>

                <div className="table-wrapper">
                  <table className="inventory-table">
                    <thead>
                      <tr>
                        <th onClick={() => handleSort("type")} className="sortable">
                          Type <span>{sortArrow("type")}</span>
                        </th>

                        <th onClick={() => handleSort("name")} className="sortable">
                          {donationType === "goods" ? "Item Name" : "Name / Donor"}{" "}
                          <span>{sortArrow("name")}</span>
                        </th>

                        {donationType === "goods" && (
                          <th
                            onClick={() => handleSort("category")}
                            className="sortable"
                          >
                            Category <span>{sortArrow("category")}</span>
                          </th>
                        )}

                        <th onClick={() => handleSort("quantity")} className="sortable">
                          {donationType === "goods" ? "Quantity" : "Amount"}{" "}
                          <span>{sortArrow("quantity")}</span>
                        </th>

                        {donationType === "goods" && <th>Unit</th>}

                        <th>Source</th>
                        <th>Description</th>
                        <th>Files</th>

                        <th onClick={() => handleSort("addedBy")} className="sortable">
                          Added By <span>{sortArrow("addedBy")}</span>
                        </th>

                        <th
                          onClick={() => handleSort("createdAt")}
                          className="sortable"
                        >
                          Created <span>{sortArrow("createdAt")}</span>
                        </th>

                        <th>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {fetching && !showArchived ? (
                        <tr>
                          <td colSpan={tableColSpan}>
                            <div className="table-empty">
                              <div className="spinner"></div>
                              <p>Loading inventory records...</p>
                            </div>
                          </td>
                        </tr>
                      ) : paginatedItems.length === 0 ? (
                        <tr>
                          <td colSpan={tableColSpan}>
                            <div className="table-empty">
                              <h4>No items found</h4>
                              <p>
                                {sortedItems.length === 0
                                  ? showArchived
                                    ? "There are no archived donation records for this section yet."
                                    : "There are no donation records available for this section yet."
                                  : "No records matched your current filters. Try adjusting your search or filters."}
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paginatedItems.map((item) => (
                          <tr key={item._id}>
                            <td>
                              <span className={`badge badge-type ${normalizeType(item.type)}`}>
                                {normalizeType(item.type)}
                              </span>
                            </td>

                            <td>
                              <div className="cell-main">{item.name || "-"}</div>
                            </td>

                            {donationType === "goods" && (
                              <td>
                                <span className="badge badge-category">
                                  {formatCategory(item.category)}
                                </span>
                              </td>
                            )}

                            <td className="quantity-cell">
                              {donationType === "monetary"
                                ? `₱${Number(item.amount || 0).toLocaleString()}`
                                : Number(item.quantity || 0).toLocaleString()}
                            </td>

                            {donationType === "goods" && <td>{item.unit || "-"}</td>}

                            <td>
                              <div className="source-cell">
                                <strong>{item.sourceType || "-"}</strong>
                                <small>{item.sourceName || "No source name"}</small>
                              </div>
                            </td>

                            <td>
                              <div className="description-cell" title={item.description || ""}>
                                {item.description || "-"}
                              </div>
                            </td>

                            <td>
                              {item.proofFiles && item.proofFiles.length > 0 ? (
                                <div className="proof-list">
                                  {item.proofFiles.map((file, idx) => (
                                    <a
                                      key={idx}
                                      href={`${BASE_URL}/uploads/proofs/${file}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="file-link"
                                    >
                                      View File {idx + 1}
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <span className="muted-text">No files</span>
                              )}
                            </td>

                            <td>{item.addedBy || "-"}</td>

                            <td>
                              <div className="date-cell">
                                <span>{formatShortDate(item.createdAt)}</span>
                                <small>{formatDate(item.createdAt)}</small>
                              </div>
                            </td>

                            <td>
                              {showArchived ? (
                                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleUnarchive(item._id, item.name)}
                                  >
                                    Unarchive
                                  </button>
                                  <button
                                    className="btn btn-danger btn-sm"
                                    onClick={() => handlePermanentDelete(item._id, item.name)}
                                  >
                                    Delete
                                  </button>
                                </div>
                              ) : (
                                <button
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleArchive(item._id, item.name)}
                                >
                                  Archive
                                </button>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {!fetching && sortedItems.length > 0 && (
                  <div className="pagination-bar">
                    <button
                      className="pagination-btn"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((prev) => prev - 1)}
                    >
                      Previous
                    </button>

                    <div className="page-numbers">
                      {pageNumbers.map((page) => (
                        <button
                          key={page}
                          className={`page-number ${currentPage === page ? "active" : ""}`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </button>
                      ))}
                    </div>

                    <button
                      className="pagination-btn"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((prev) => prev + 1)}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardShell>
  );
};

export default InventoryAdd;