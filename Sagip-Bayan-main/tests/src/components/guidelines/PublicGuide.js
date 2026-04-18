// components/GuidelinesList.jsx
import React, { useEffect, useState } from "react";
import axios from "axios";

export default function PublicGuide() {
  const [guidelines, setGuidelines] = useState([]);
  const [filteredGuidelines, setFilteredGuidelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [selectedGuideline, setSelectedGuideline] = useState(null);
  const BASE_URL = "http://localhost:8000/api/guidelines/";
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
      let url = BASE_URL;
      if (selectedCategory !== "all") url = `${BASE_URL}?category=${selectedCategory}`;
      const response = await axios.get(url);
      setGuidelines(response.data);
      setFilteredGuidelines(response.data);
    } catch (error) {
      console.error("Error fetching guidelines:", error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (text) => {
    setSearchText(text);
    if (text.trim() === "") {
      setFilteredGuidelines(guidelines);
      setSuggestions([]);
      return;
    }
    const filtered = guidelines.filter((item) =>
      (item.title || "").toLowerCase().includes(text.toLowerCase())
    );
    setFilteredGuidelines(filtered);
    const autoSuggestions = filtered.map((item) => item.title).slice(0, 5);
    setSuggestions(autoSuggestions);
  };

  const selectSuggestion = (title) => {
    setSearchText(title);
    setSuggestions([]);
  };

  // ---------- View count handler ----------
  const handleViewGuideline = async (item) => {
    try {
      await axios.patch(`${BASE_URL}view/${item._id}`);
      setGuidelines((prev) =>
        prev.map((g) =>
          g._id === item._id ? { ...g, views: (g.views || 0) + 1 } : g
        )
      );
      setSelectedGuideline(item); // open modal
    } catch (err) {
      console.error("Error incrementing view:", err.message);
    }
  };

  const renderCard = (item) => (
    <div
      key={item._id}
      onClick={() => handleViewGuideline(item)}
      style={{
        border: "1px solid #ccc",
        borderRadius: 10,
        padding: 15,
        marginBottom: 15,
        cursor: "pointer",
        backgroundColor: "#f9f9f9",
      }}
    >
      <h3>{item.title}</h3>
      <p>Views: {item.views || 0}</p>
      <p>Category: {item.category}</p>
      <p>Status: {item.status}</p>
      <p>Priority: {item.priorityLevel}</p>
      {item.description && <p>{item.description}</p>}
      {item.attachments?.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <strong>Attachments:</strong>
          {item.attachments.map((file, idx) =>
            /\.(jpg|jpeg|png|gif)$/i.test(file.fileUrl) ? (
              <img
                key={idx}
                src={file.fileUrl}
                alt=""
                style={{ width: 120, height: 120, marginTop: 6, borderRadius: 8 }}
              />
            ) : (
              <div key={idx}>
                <a
                  href={file.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: "#007bff", textDecoration: "underline" }}
                >
                  {file.fileName}
                </a>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );

  if (loading) {
    return <div style={{ textAlign: "center", marginTop: 40 }}>Loading...</div>;
  }

  return (
    <div style={{ maxWidth: 800, margin: "auto", padding: 20 }}>
      <h2>Disaster Guidelines</h2>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by title..."
        value={searchText}
        onChange={(e) => handleSearch(e.target.value)}
        style={{ width: "100%", padding: 10, marginBottom: 10, borderRadius: 6, border: "1px solid #ccc" }}
      />

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div style={{ border: "1px solid #ccc", padding: 5, borderRadius: 6, marginBottom: 10 }}>
          {suggestions.map((title, idx) => (
            <div
              key={idx}
              onClick={() => selectSuggestion(title)}
              style={{ padding: 5, cursor: "pointer" }}
            >
              {title}
            </div>
          ))}
        </div>
      )}

      {/* Category Filters */}
      <div style={{ marginBottom: 15 }}>
        {categories.map((cat) => {
          const active = selectedCategory === cat;
          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              style={{
                padding: "6px 12px",
                marginRight: 5,
                borderRadius: 6,
                border: "1px solid #ccc",
                backgroundColor: active ? "#007bff" : "#fff",
                color: active ? "#fff" : "#000",
                cursor: "pointer",
              }}
            >
              {cat.toUpperCase()}
            </button>
          );
        })}
      </div>

      {/* Guidelines List */}
      <div>
        {filteredGuidelines.map((item) => renderCard(item))}
      </div>
      {selectedGuideline && (
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
        }}
      >
        <div
          style={{
            background: "#fff",
            padding: 20,
            borderRadius: 10,
            width: "90%",
            maxWidth: 500,
            maxHeight: "80%",
            overflowY: "auto",
          }}
        >
          <h2>{selectedGuideline.title}</h2>

          <p><strong>Views:</strong> {selectedGuideline.views || 0}</p>
          <p><strong>Category:</strong> {selectedGuideline.category}</p>
          <p><strong>Priority:</strong> {selectedGuideline.priorityLevel}</p>

          {selectedGuideline.description && (
            <p>{selectedGuideline.description}</p>
          )}

          {/* ✅ IMAGES HERE */}
          {selectedGuideline.attachments?.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <strong>Attachments:</strong>

              {selectedGuideline.attachments.map((file, idx) =>
                file?.fileUrl && /\.(jpg|jpeg|png|gif)$/i.test(file.fileUrl) ? (
                  <div key={idx}>
                    <img
                      src={file.fileUrl}
                      alt=""
                      style={{
                        width: "100%",
                        maxHeight: 200,
                        objectFit: "cover",
                        marginTop: 6,
                        borderRadius: 8,
                      }}
                    />
                  </div>
                ) : file?.fileUrl ? (
                  <div key={idx}>
                    <a
                      href={file.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#007bff", textDecoration: "underline" }}
                    >
                      {file.fileName}
                    </a>
                  </div>
                ) : null
              )}
            </div>
          )}

          {/* CLOSE BUTTON */}
          <button
            onClick={() => setSelectedGuideline(null)}
            style={{
              marginTop: 15,
              padding: "10px 15px",
              backgroundColor: "#dc3545",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>
    )}
    </div>
  );
}