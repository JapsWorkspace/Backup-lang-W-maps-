import React, { useEffect, useState } from "react";
import axios from "axios";

export default function GuidelinesScreen() {
  const [guidelines, setGuidelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [status, setStatus] = useState("draft");
  const [priorityLevel, setPriorityLevel] = useState("medium");

  // UPDATE STATES
  const [editingGuideline, setEditingGuideline] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editFiles, setEditFiles] = useState([]);
  const [showArchived, setShowArchived] = useState(false);

  const [removeImages, setRemoveImages] = useState([]);

  const BASE_URL = "http://localhost:8000/api/guidelines/";

  useEffect(() => {
    fetchGuidelines();
  }, [showArchived]); // Re-fetch whenever archived toggle changes

  const fetchGuidelines = async () => {
    try {
      let url = BASE_URL;
      if (showArchived) url += "?status=archived";
      const response = await axios.get(url);
      const sorted = response.data.sort((a, b) => {
        const order = { critical: 4, high: 3, medium: 2, low: 1 };
        return order[b.priorityLevel] - order[a.priorityLevel];
      });
      setGuidelines(sorted);
    } catch (error) {
      console.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const pickFile = (event) => {
    const selectedFiles = Array.from(event.target.files);
    setFiles(selectedFiles);
  };

  const pickEditFile = (event) => {
    const selectedFiles = Array.from(event.target.files);
    setEditFiles(selectedFiles);
  };

  const createGuideline = async () => {
    try {
      const formData = new FormData();

      formData.append("title", title);
      formData.append("description", description);
      formData.append("category", category);
      formData.append("status", status);
      formData.append("priorityLevel", priorityLevel);

      if (files.length > 0) {
        files.forEach((file) => formData.append("attachments", file));
      }

      const response = await axios.post(BASE_URL, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setGuidelines([response.data, ...guidelines]);
      alert("Guideline created successfully!");

      setFiles([]);
      setTitle("");
      setDescription("");
    } catch (error) {
      console.log(error.response?.data || error.message);
    }
  };

  const updateGuideline = async () => {
    try {
      const formData = new FormData();

      formData.append("title", editTitle);
      formData.append("description", editDescription);
      formData.append("category", editCategory);
      formData.append("status", editStatus);
      formData.append("priorityLevel", editPriority);
      formData.append("removeImages", JSON.stringify(removeImages));

      if (editFiles.length > 0) {
        editFiles.forEach((file) => formData.append("attachments", file));
      }

      const response = await axios.put(
        `${BASE_URL}${editingGuideline._id}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      setGuidelines((prev) =>
        prev.map((g) => (g._id === editingGuideline._id ? response.data : g))
      );

      alert("Guideline updated successfully!");
      setEditingGuideline(null);
      setEditFiles([]);
      setEditTitle("");
      setEditDescription("");
      setEditCategory("");
      setEditStatus("");
      setEditPriority("");
      setRemoveImages([]);
    } catch (error) {
      console.error(error.response?.data || error.message);
      alert("Failed to update guideline.");
    }
  };

  const archiveGuideline = async (id) => {
    const confirmDelete = window.confirm("Archive this guideline?");
    if (!confirmDelete) return;

    try {
      await axios.patch(`${BASE_URL}soft-delete/${id}`);
      setGuidelines((prev) =>
        prev.map((g) => (g._id === id ? { ...g, status: "archived" } : g))
      );
      alert("Guideline archived successfully!");
    } catch (error) {
      console.error(error.response?.data || error.message);
      alert("Failed to archive guideline.");
    }
  };

  const publishGuideline = async (id) => {
    try {
      const res = await axios.put(`${BASE_URL}${id}`, {
        status: "published",
      });

      setGuidelines((prev) =>
        prev.map((g) => (g._id === id ? res.data : g))
      );
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
  };

  const makeDraft = async (id) => {
    try {
      const res = await axios.put(`${BASE_URL}${id}`, {
        status: "draft",
      });

      setGuidelines((prev) =>
        prev.map((g) => (g._id === id ? res.data : g))
      );
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
  };

  const restoreGuideline = async (id) => {
    try {
      const res = await axios.patch(`${BASE_URL}restore/${id}`);

      const updated = { ...res.data, status: "draft" }; // enforce rule

      setGuidelines((prev) =>
        prev.map((g) => (g._id === id ? updated : g))
      );

      alert("Guideline restored to draft!");
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
  };

  
  const deleteArchived = async (id) => {
    const confirmDelete = window.confirm("Permanently delete this guideline?");
    if (!confirmDelete) return;

    try {
      await axios.delete(`${BASE_URL}${id}`);

      setGuidelines((prev) =>
        prev.filter((g) => g._id !== id)
      );

      alert("Guideline permanently deleted!");
    } catch (err) {
      console.error(err.response?.data || err.message);
    }
  };

  if (loading) {
    return <div style={{ textAlign: "center", marginTop: 50 }}>Loading...</div>;
  }

  const isCreateDisabled = !title || !description;

  return (
    <div style={styles.container}>
      <h2>Create Guideline</h2>

      <input
        style={styles.input}
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <textarea
        style={{ ...styles.input, height: 80 }}
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <label style={styles.label}>Category</label>
      {["earthquake", "flood", "typhoon", "general"].map((item) => (
        <button
          key={item}
          onClick={() => setCategory(item)}
          style={{
            ...styles.option,
            ...(category === item ? styles.selectedOption : {}),
          }}
        >
          {item}
        </button>
      ))}

      <label style={styles.label}>Priority Level</label>
      {["low", "medium", "high", "critical"].map((item) => (
        <button
          key={item}
          onClick={() => setPriorityLevel(item)}
          style={{
            ...styles.option,
            ...(priorityLevel === item ? styles.selectedOption : {}),
          }}
        >
          {item}
        </button>
      ))}

      <input type="file" multiple onChange={pickFile} style={{ marginTop: 10 }} />

      {files.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <strong>Selected Files:</strong>
          {files.map((file, index) => (
            <div key={index}>• {file.name}</div>
          ))}
        </div>
      )}

      <button
        style={{ ...styles.uploadButton, backgroundColor: "#dc3545" }}
        onClick={() => setFiles([])}
      >
        Clear Files
      </button>

      <button style={styles.button} onClick={createGuideline} disabled={isCreateDisabled}>
        Create Guideline
      </button>

      <button onClick={() => setShowArchived((prev) => !prev)} style={{ marginBottom: 10 }}>
        {showArchived ? "Show Active" : "Show Archived"}
      </button>

      <h2>All Guidelines</h2>

      {guidelines.filter((g) => (showArchived ? g.status === "archived" : g.status !== "archived"))
      .map((item) => (
        <div key={item._id} style={styles.card}>
          <div style={styles.cardHeader}>
            {item.status === "draft" && (
              <>
                <button style={styles.actionButton} onClick={() => publishGuideline(item._id)}>
                  Publish
                </button>
                <button
                  style={styles.updateButton}
                  onClick={() => {
                    setEditingGuideline(item);
                    setEditTitle(item.title);
                    setEditDescription(item.description);
                    setEditCategory(item.category);
                    setEditPriority(item.priorityLevel);
                    setEditFiles([]);
                  }}
                >
                  Update
                </button>
                <button style={styles.actionButton} onClick={() => archiveGuideline(item._id)}>
                  Archive
                </button>
              </>
            )}

            {item.status === "published" && (
              <button style={styles.actionButton} onClick={() => makeDraft(item._id)}>
                Draft
              </button>
            )}

            {item.status === "archived" && (
              <>
                <button style={styles.actionButton} onClick={() => restoreGuideline(item._id)}>
                  Restore
                </button>
                <button style={styles.actionButton} onClick={() => deleteArchived(item._id)}>
                  Delete
                </button>
              </>
            )}
          </div>

          <h3>{item.title}</h3>
          {item.priorityLevel === "critical" && (
            <p style={{ color: "red", fontWeight: "bold" }}>⚠ CRITICAL ALERT</p>
          )}
          <p>Category: {item.category}</p>
          <p>Status: {item.status}</p>
          <p>Priority: {item.priorityLevel}</p>
          <p>{item.description}</p>

          {item.attachments?.length > 0 && (
            <div style={{ marginTop: 5 }}>
              <strong>Attachments:</strong>
              {item.attachments.map((file, idx) =>
                file.fileUrl.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                  <div key={idx}>
                    <img src={file.fileUrl} alt="" style={{ width: 100, height: 100, marginTop: 5 }} />
                  </div>
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
      ))}

      {editingGuideline && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2>Update Guideline</h2>

            <input style={styles.input} value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            <textarea style={styles.input} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />

            <label style={styles.label}>Category</label>
            {["earthquake", "flood", "typhoon", "general"].map((item) => (
              <button
                key={item}
                onClick={() => setEditCategory(item)}
                style={{
                  ...styles.option,
                  ...(editCategory === item ? styles.selectedOption : {}),
                }}
              >
                {item}
              </button>
            ))}

            <label style={styles.label}>Priority Level</label>
            {["low", "medium", "high", "critical"].map((item) => (
              <button
                key={item}
                onClick={() => setEditPriority(item)}
                style={{
                  ...styles.option,
                  ...(editPriority === item ? styles.selectedOption : {}),
                }}
              >
                {item}
              </button>
            ))}

            <input type="file" multiple onChange={pickEditFile} style={{ marginTop: 10 }} />
            {editFiles.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <strong>Selected Files:</strong>
                {editFiles.map((file, index) => (
                  <div key={index}>• {file.name}</div>
                ))}
              </div>
            )}
            {editingGuideline.attachments?.map((img, index) => (
            <div key={index}>
              <img src={img.fileUrl} style={{ width: 80 }} />

              <button
                onClick={() =>
                  setRemoveImages(prev => [...prev, img])
                }
              >
                Remove
              </button>
            </div>
          ))}

            <button style={styles.button} onClick={updateGuideline}>
              Save Update
            </button>

            <button style={styles.cancelButton} onClick={() => setEditingGuideline(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { maxWidth: 600, margin: "auto", padding: 15, fontFamily: "Arial" },
  input: { width: "100%", border: "1px solid #ccc", padding: 10, borderRadius: 8, marginBottom: 10 },
  label: { fontWeight: "bold", marginTop: 10, display: "block" },
  option: { padding: 8, border: "1px solid #ccc", borderRadius: 6, margin: "3px 3px", cursor: "pointer" },
  selectedOption: { backgroundColor: "#cce5ff", borderColor: "#007bff" },
  button: { backgroundColor: "#007bff", color: "#fff", padding: 12, borderRadius: 8, marginTop: 15, border: "none", cursor: "pointer" },
  uploadButton: { backgroundColor: "#28a745", color: "#fff", padding: 12, borderRadius: 8, marginTop: 10, border: "none", cursor: "pointer" },
  card: { backgroundColor: "#f2f2f2", padding: 15, borderRadius: 10, marginBottom: 10 },
  cardHeader: { display: "flex", justifyContent: "flex-end", gap: 5 },
  updateButton: { backgroundColor: "#ffc107", padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer" },
  deleteButton: { backgroundColor: "#dc3545", color: "#fff", padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer" },
  modalOverlay: { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center" },
  modal: { background: "#fff", padding: 20, borderRadius: 10, width: 400 },
  cancelButton: { backgroundColor: "#6c757d", color: "#fff", padding: 10, borderRadius: 6, border: "none", marginTop: 10, cursor: "pointer" },
};