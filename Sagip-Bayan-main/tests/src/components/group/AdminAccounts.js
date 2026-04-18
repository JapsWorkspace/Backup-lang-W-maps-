import { useState } from "react";
import DashboardShell from "../layout/DashboardShell";

import Register from "../auth/Register";
import EditAccount from "../auth/EditAccount";
import ArchivedAccounts from "../auth/ArchivedAccounts";
import AdminLogs from "../admin/AdminLogs";

import "../css/AdminAccounts.css";

export default function AdminAccounts() {
  const [activeTab, setActiveTab] = useState("register");

  return (
    <DashboardShell>
      <div className="acc-page">
        <div className="acc-shell">

          {/* HEADER */}
          <div className="acc-header-card">
            <div>
              <span className="acc-kicker">Administration Module</span>
              <h1 className="acc-title">Account Management</h1>
              <p className="acc-subtitle">
                Manage DRRMO and Barangay accounts in one workspace.
              </p>
            </div>
          </div>

          {/* TABS */}
          <div className="acc-tabs">
            <button
              className={`acc-tab ${activeTab === "register" ? "active" : ""}`}
              onClick={() => setActiveTab("register")}
            >
              Register
            </button>

            <button
              className={`acc-tab ${activeTab === "edit" ? "active" : ""}`}
              onClick={() => setActiveTab("edit")}
            >
              Edit Accounts
            </button>

            <button
              className={`acc-tab ${activeTab === "archived" ? "active" : ""}`}
              onClick={() => setActiveTab("archived")}
            >
              Archived
            </button>

            <button
              className={`acc-tab ${activeTab === "logs" ? "active" : ""}`}
              onClick={() => setActiveTab("logs")}
            >
              Admin Logs
            </button>
          </div>

          {/* CONTENT */}
          <div className="acc-content">
  <div key={activeTab} className="acc-animated">
    {activeTab === "register" && <Register />}
    {activeTab === "edit" && <EditAccount />}
    {activeTab === "archived" && <ArchivedAccounts />}
    {activeTab === "logs" && <AdminLogs />}
  </div>
</div>

        </div>
      </div>
    </DashboardShell>
  );
}