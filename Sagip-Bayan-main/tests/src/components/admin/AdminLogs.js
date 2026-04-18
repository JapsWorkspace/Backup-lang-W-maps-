import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/AdminLogs.css';
import axios from 'axios';

export default function AdminLogs() {
  const BASE_URL =
    process.env.REACT_APP_API_URL || 'https://gaganadapat.onrender.com';
  const navigate = useNavigate();
  const PAGE_SIZE = 10;

  const [allLogs, setAllLogs] = useState([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const actionClass = (action) => {
    switch (action) {
      case 'create':
        return 'admin-create';
      case 'update':
        return 'admin-update';
      case 'archive':
        return 'admin-archive';
      case 'restore':
        return 'admin-restore';
      default:
        return 'admin-default';
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${BASE_URL}/api/auth/admin/logs`, {
        withCredentials: true
      });

      const arr = Array.isArray(res.data) ? res.data : [];
      setAllLogs(arr);
    } catch (e) {
      console.error(e);
      setAllLogs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  useEffect(() => {
    setPage(1);
  }, [search, actionFilter]);

  const formatTime = (date) => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleString('en-PH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return '-';
    }
  };

  const filteredLogs = useMemo(() => {
    const term = search.trim().toLowerCase();

    return allLogs.filter((log) => {
      const adminUsername = String(log.adminUsername || '').toLowerCase();
      const targetUsername = String(log.targetUsername || '').toLowerCase();
      const action = String(log.action || '').toLowerCase();
      const barangay = String(log.barangay || '').toLowerCase();

      const matchesSearch =
        !term ||
        adminUsername.includes(term) ||
        targetUsername.includes(term) ||
        action.includes(term) ||
        barangay.includes(term);

      const matchesAction =
        !actionFilter || String(log.action || '').toLowerCase() === actionFilter;

      return matchesSearch && matchesAction;
    });
  }, [allLogs, search, actionFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const paginatedLogs = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredLogs.slice(start, start + PAGE_SIZE);
  }, [filteredLogs, safePage]);

  const stats = useMemo(() => {
    return allLogs.reduce(
      (acc, log) => {
        const action = String(log.action || '').toLowerCase();
        acc.total += 1;
        if (action === 'create') acc.create += 1;
        if (action === 'update') acc.update += 1;
        if (action === 'archive') acc.archive += 1;
        if (action === 'restore') acc.restore += 1;
        return acc;
      },
      { total: 0, create: 0, update: 0, archive: 0, restore: 0 }
    );
  }, [allLogs]);

  const canPrev = safePage > 1;
  const canNext = safePage < totalPages;

  return (
    <div className="admin-logs-page">
      <div className="admin-logs-shell">
        <section className="admin-logs-hero">
          <div className="admin-logs-hero-copy">
            <span className="admin-logs-kicker">Administration Module</span>
            <h1 className="admin-logs-title">Admin Activity Logs</h1>
            <p className="admin-logs-subtitle">
              Monitor account-related administrative actions including account
              creation, updates, archiving, and restoration. Use filters to review
              system activity more efficiently.
            </p>
          </div>

          <div className="admin-logs-stats">
            <div className="admin-stat-card">
              <span>Total Logs</span>
              <strong>{loading ? '—' : stats.total}</strong>
            </div>
            <div className="admin-stat-card">
              <span>Created</span>
              <strong>{loading ? '—' : stats.create}</strong>
            </div>
            <div className="admin-stat-card">
              <span>Updated</span>
              <strong>{loading ? '—' : stats.update}</strong>
            </div>
            <div className="admin-stat-card">
              <span>Archived</span>
              <strong>{loading ? '—' : stats.archive}</strong>
            </div>
            <div className="admin-stat-card emphasis">
              <span>Restored</span>
              <strong>{loading ? '—' : stats.restore}</strong>
            </div>
          </div>
        </section>

        <section className="admin-logs-panel">
          <div className="admin-logs-panel-head">
            <div>
              <h2>Activity Records</h2>
              <p>
                Search by admin, target user, barangay, or action type. Review the
                latest administrative actions in a cleaner log workspace.
              </p>
            </div>

            <button className="admin-btn admin-btn-back" onClick={() => navigate(-1)}>
              ← Back
            </button>
          </div>

          <div className="admin-logs-toolbar">
            <input
              className="admin-logs-search"
              type="text"
              placeholder="Search admin, target user, barangay, or action..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="admin-logs-filter"
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
            >
              <option value="">All Actions</option>
              <option value="create">Create</option>
              <option value="update">Update</option>
              <option value="archive">Archive</option>
              <option value="restore">Restore</option>
            </select>
          </div>

          <div className="admin-logs-table-region">
            <div className="admin-logs-table-wrap">
              <table className="admin-logs-table">
                <thead>
                  <tr>
                    <th>Admin</th>
                    <th>Action</th>
                    <th>Target User</th>
                    <th>Barangay</th>
                    <th>Date</th>
                  </tr>
                </thead>

                <tbody>
                  {loading ? (
                    <tr className="admin-empty-row">
                      <td colSpan={5}>
                        <div className="admin-empty-inline">
                          <div className="admin-empty-emoji">⏳</div>
                          <div className="admin-empty-text">
                            <strong>Loading admin logs...</strong>
                            <span className="admin-muted">
                              Please wait while records are being fetched.
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : paginatedLogs.length === 0 ? (
                    <tr className="admin-empty-row">
                      <td colSpan={5}>
                        <div className="admin-empty-inline">
                          <div className="admin-empty-emoji">📝</div>
                          <div className="admin-empty-text">
                            <strong>No logs found</strong>
                            <span className="admin-muted">
                              Try adjusting the search or action filter.
                            </span>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedLogs.map((log) => (
                      <tr key={log._id}>
                        <td title={log.adminUsername || ''}>
                          {log.adminUsername || '-'}
                        </td>
                        <td>
                          <span
                            className={`admin-action-pill ${actionClass(log.action)}`}
                          >
                            {log.action || '-'}
                          </span>
                        </td>
                        <td title={log.targetUsername || ''}>
                          {log.targetUsername || '-'}
                        </td>
                        <td title={log.barangay || ''}>
                          {log.barangay || '—'}
                        </td>
                        <td>{formatTime(log.timestamp)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="admin-pagination">
              <button
                className="admin-btn"
                disabled={!canPrev}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                ← Prev
              </button>

              <span className="admin-page">
                Page {safePage} of {totalPages}
              </span>

              <button
                className="admin-btn"
                disabled={!canNext}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                Next →
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}