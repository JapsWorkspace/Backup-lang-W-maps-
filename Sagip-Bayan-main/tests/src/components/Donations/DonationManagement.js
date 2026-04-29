import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_BASE = "http://localhost:8000/api/donations";
const STATUSES = ["pending", "accepted", "in_transit", "delivered", "rejected"];
const CATEGORIES = ["", "clothes", "food", "appliances", "furniture", "medicine", "essentials", "other"];

export default function DonationManagement() {
  const [donations, setDonations] = useState([]);
  const [filters, setFilters] = useState({
    type: "",
    category: "",
    status: "",
    location: "",
  });
  const [selected, setSelected] = useState(null);
  const [matches, setMatches] = useState([]);
  const [assignment, setAssignment] = useState({
    targetType: "general",
    targetName: "",
    notes: "",
  });
  const [needForm, setNeedForm] = useState({
    category: "food",
    itemName: "",
    quantityNeeded: "",
    urgency: "high",
    targetType: "evacuation_center",
    targetName: "",
    barangay: "",
  });

  useEffect(() => {
    fetchDonations();
  }, [filters]);

  const fetchDonations = async () => {
    const params = Object.fromEntries(
      Object.entries(filters).filter(([, value]) => value)
    );
    const res = await axios.get(API_BASE, { params });
    setDonations(Array.isArray(res.data) ? res.data : []);
  };

  const summary = useMemo(
    () => ({
      total: donations.length,
      pending: donations.filter((item) => item.status === "pending").length,
      money: donations.filter((item) => item.donationType === "monetary").length,
      goods: donations.filter((item) => item.donationType === "non_monetary").length,
    }),
    [donations]
  );

  const updateStatus = async (donation, status) => {
    const res = await axios.put(`${API_BASE}/${donation._id}/status`, {
      status,
      message: `Donation marked as ${status}.`,
    });
    setDonations((prev) =>
      prev.map((item) => (item._id === donation._id ? res.data : item))
    );
    setSelected((current) => (current?._id === donation._id ? res.data : current));
  };

  const openDonation = async (donation) => {
    setSelected(donation);
    setAssignment({
      targetType: donation.assignment?.targetType || "general",
      targetName: donation.assignment?.targetName || "",
      notes: donation.assignment?.notes || "",
    });
    if (donation.donationType === "non_monetary") {
      const res = await axios.get(`${API_BASE}/${donation._id}/matches`);
      setMatches(Array.isArray(res.data) ? res.data : []);
    } else {
      setMatches([]);
    }
  };

  const assignDonation = async () => {
    if (!selected?._id) return;
    const res = await axios.put(`${API_BASE}/${selected._id}/assign`, assignment);
    setSelected(res.data);
    setDonations((prev) =>
      prev.map((item) => (item._id === selected._id ? res.data : item))
    );
  };

  const createNeed = async () => {
    await axios.post(`${API_BASE}/needs`, needForm);
    setNeedForm({
      category: "food",
      itemName: "",
      quantityNeeded: "",
      urgency: "high",
      targetType: "evacuation_center",
      targetName: "",
      barangay: "",
    });
    alert("Need added. Matching donations will now prioritize it.");
  };

  return (
    <div style={styles.page}>
      <div style={styles.header}>
        <div>
          <p style={styles.kicker}>Donation Operations</p>
          <h1 style={styles.title}>Donation Management</h1>
          <p style={styles.subtitle}>
            Review monetary donations, relief goods, assignments, and needs matching.
          </p>
        </div>
      </div>

      <div style={styles.summaryGrid}>
        <SummaryCard label="Total" value={summary.total} />
        <SummaryCard label="Pending" value={summary.pending} />
        <SummaryCard label="Monetary" value={summary.money} />
        <SummaryCard label="Non-monetary" value={summary.goods} />
      </div>

      <div style={styles.filters}>
        <select style={styles.input} value={filters.type} onChange={(e) => setFilters((p) => ({ ...p, type: e.target.value }))}>
          <option value="">All types</option>
          <option value="monetary">Monetary</option>
          <option value="non_monetary">Non-monetary</option>
        </select>
        <select style={styles.input} value={filters.category} onChange={(e) => setFilters((p) => ({ ...p, category: e.target.value }))}>
          {CATEGORIES.map((item) => (
            <option key={item || "all"} value={item}>{item || "All categories"}</option>
          ))}
        </select>
        <select style={styles.input} value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))}>
          <option value="">All statuses</option>
          {STATUSES.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <input style={styles.input} placeholder="Location" value={filters.location} onChange={(e) => setFilters((p) => ({ ...p, location: e.target.value }))} />
      </div>

      <div style={styles.needPanel}>
        <h3 style={{ marginTop: 0 }}>Add urgent need for matching</h3>
        <div style={styles.needGrid}>
          <select style={styles.input} value={needForm.category} onChange={(e) => setNeedForm((p) => ({ ...p, category: e.target.value }))}>
            {CATEGORIES.filter(Boolean).map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
          <input style={styles.input} placeholder="Needed item" value={needForm.itemName} onChange={(e) => setNeedForm((p) => ({ ...p, itemName: e.target.value }))} />
          <input style={styles.input} placeholder="Quantity needed" value={needForm.quantityNeeded} onChange={(e) => setNeedForm((p) => ({ ...p, quantityNeeded: e.target.value }))} />
          <select style={styles.input} value={needForm.urgency} onChange={(e) => setNeedForm((p) => ({ ...p, urgency: e.target.value }))}>
            <option value="critical">critical</option>
            <option value="high">high</option>
            <option value="medium">medium</option>
            <option value="low">low</option>
          </select>
          <select style={styles.input} value={needForm.targetType} onChange={(e) => setNeedForm((p) => ({ ...p, targetType: e.target.value }))}>
            <option value="evacuation_center">Evacuation Center</option>
            <option value="barangay">Barangay</option>
          </select>
          <input style={styles.input} placeholder="Target name" value={needForm.targetName} onChange={(e) => setNeedForm((p) => ({ ...p, targetName: e.target.value }))} />
          <input style={styles.input} placeholder="Barangay" value={needForm.barangay} onChange={(e) => setNeedForm((p) => ({ ...p, barangay: e.target.value }))} />
          <button style={styles.primaryButton} onClick={createNeed}>Add need</button>
        </div>
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th>Type</th>
              <th>Donation</th>
              <th>Donor</th>
              <th>Status</th>
              <th>Assigned To</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {donations.map((item) => (
              <tr key={item._id}>
                <td>{item.donationType}</td>
                <td>
                  {item.donationType === "monetary"
                    ? `PHP ${Number(item.amount || 0).toLocaleString("en-PH")}`
                    : `${item.itemName || item.category} x ${item.quantity || 0}`}
                </td>
                <td>{item.donorName || item.donorPhone || "Unknown"}</td>
                <td>{item.status}</td>
                <td>{item.assignment?.targetName || "-"}</td>
                <td>
                  <button style={styles.linkButton} onClick={() => openDonation(item)}>Manage</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <div style={styles.modalBackdrop}>
          <div style={styles.modal}>
            <button style={styles.close} onClick={() => setSelected(null)}>x</button>
            <h2>{selected.donationType === "monetary" ? "Monetary Donation" : "Non-monetary Donation"}</h2>
            <p><strong>Status:</strong> {selected.status}</p>
            <p><strong>Description:</strong> {selected.description || "-"}</p>
            <p><strong>Contact:</strong> {selected.donorPhone || selected.contactInfo || "-"}</p>
            <p><strong>Location:</strong> {selected.location || selected.barangay || "-"}</p>

            <div style={styles.actions}>
              {STATUSES.map((status) => (
                <button key={status} style={styles.actionButton} onClick={() => updateStatus(selected, status)}>
                  {status}
                </button>
              ))}
            </div>

            <h3>Assignment</h3>
            <select style={styles.input} value={assignment.targetType} onChange={(e) => setAssignment((p) => ({ ...p, targetType: e.target.value }))}>
              <option value="general">General</option>
              <option value="evacuation_center">Evacuation Center</option>
              <option value="barangay">Barangay</option>
            </select>
            <input style={styles.input} placeholder="Target name" value={assignment.targetName} onChange={(e) => setAssignment((p) => ({ ...p, targetName: e.target.value }))} />
            <textarea style={styles.input} placeholder="Notes" value={assignment.notes} onChange={(e) => setAssignment((p) => ({ ...p, notes: e.target.value }))} />
            <button style={styles.primaryButton} onClick={assignDonation}>Save assignment</button>

            {matches.length > 0 && (
              <>
                <h3>Matching urgent needs</h3>
                {matches.map((need) => (
                  <div key={need._id} style={styles.matchCard}>
                    <strong>{need.itemName || need.category}</strong>
                    <p>{need.targetName} | {need.urgency} | Remaining: {need.remainingQuantity}</p>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }) {
  return (
    <div style={styles.summaryCard}>
      <p style={styles.summaryLabel}>{label}</p>
      <h3 style={styles.summaryValue}>{value}</h3>
    </div>
  );
}

const styles = {
  page: { padding: 24, fontFamily: "Arial, sans-serif", background: "#f5f7f5", minHeight: "100vh" },
  header: { marginBottom: 18 },
  kicker: { color: "#14532d", fontWeight: 800, textTransform: "uppercase", fontSize: 12 },
  title: { margin: 0, color: "#10251b" },
  subtitle: { color: "#647067" },
  summaryGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 12, marginBottom: 16 },
  summaryCard: { background: "#fff", border: "1px solid #dce7e1", borderRadius: 12, padding: 16 },
  summaryLabel: { margin: 0, color: "#647067", fontWeight: 700 },
  summaryValue: { margin: "6px 0 0", color: "#14532d", fontSize: 26 },
  filters: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10, marginBottom: 16 },
  needPanel: { background: "#fff", border: "1px solid #dce7e1", borderRadius: 12, padding: 16, marginBottom: 16 },
  needGrid: { display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 },
  input: { width: "100%", minHeight: 38, border: "1px solid #cfe5d4", borderRadius: 8, padding: "8px 10px", marginBottom: 8 },
  tableWrap: { background: "#fff", border: "1px solid #dce7e1", borderRadius: 12, overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" },
  linkButton: { border: 0, background: "#e7f5ed", color: "#14532d", padding: "7px 10px", borderRadius: 8, cursor: "pointer", fontWeight: 700 },
  modalBackdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 },
  modal: { width: "100%", maxWidth: 720, maxHeight: "90vh", overflowY: "auto", background: "#fff", borderRadius: 16, padding: 22, position: "relative" },
  close: { position: "absolute", right: 14, top: 14 },
  actions: { display: "flex", flexWrap: "wrap", gap: 8, margin: "12px 0" },
  actionButton: { border: "1px solid #cfe5d4", background: "#f8fbf7", borderRadius: 8, padding: "8px 10px", cursor: "pointer" },
  primaryButton: { background: "#14532d", color: "#fff", border: 0, borderRadius: 8, padding: "10px 14px", cursor: "pointer", fontWeight: 800 },
  matchCard: { border: "1px solid #fde68a", background: "#fffbeb", borderRadius: 10, padding: 10, marginTop: 8 },
};
