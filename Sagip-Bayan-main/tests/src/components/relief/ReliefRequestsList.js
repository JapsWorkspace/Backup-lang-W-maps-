import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardShell from '../layout/DashboardShell';
import '../css/ReliefRequestList.css';

const BASE_URL =
  process.env.REACT_APP_API_URL || 'https://gaganadapat.onrender.com';

export default function ReliefRequestsList() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [search, setSearch] = useState('');
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');

  useEffect(() => {
    const storedRole = localStorage.getItem('role');
    if (!storedRole) {
      navigate('/');
    }
  }, [navigate]);

  const fetchRequests = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`${BASE_URL}/api/drrmo/requests/pending`, {
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('Failed to fetch requests');
      }

      const data = await res.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
    const interval = setInterval(fetchRequests, 5000);
    return () => clearInterval(interval);
  }, [fetchRequests]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();

    if (!q) return rows;

    return rows.filter((row) => {
      const requestNo = String(row.requestNo || '').toLowerCase();
      const barangayName = String(row.barangayName || '').toLowerCase();
      const disaster = String(row.disaster || '').toLowerCase();
      const status = String(row.status || '').toLowerCase();

      return (
        requestNo.includes(q) ||
        barangayName.includes(q) ||
        disaster.includes(q) ||
        status.includes(q)
      );
    });
  }, [rows, search]);

  const handleAction = async (requestId, action, remarks = '') => {
    try {
      setSubmittingAction(true);

      const res = await fetch(
        `${BASE_URL}/api/drrmo/requests/${requestId}/status`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ action, remarks })
        }
      );

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to update request');
      }

      alert(
        action === 'accept'
          ? 'Request approved successfully.'
          : 'Request rejected successfully.'
      );

      setSelectedRequest(null);
      setPdfPreviewUrl('');
      fetchRequests();
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setSubmittingAction(false);
    }
  };

  const getTotalIndividuals = (request) => {
    const totals = request?.totals || {};
    return (
      Number(totals.male || 0) +
      Number(totals.female || 0) +
      Number(totals.lgbtq || 0) +
      Number(totals.pwd || 0) +
      Number(totals.pregnant || 0) +
      Number(totals.senior || 0)
    );
  };

  const formatDate = (date) => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleDateString();
    } catch {
      return '-';
    }
  };

  const formatDateTime = (date) => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleString();
    } catch {
      return '-';
    }
  };

  const getPdfPath = (request) => {
    if (request?.pdfFile) return request.pdfFile;
    if (request?.requestNo) {
      return `/uploads/relief-requests/${request.requestNo}.pdf`;
    }
    return '';
  };

  const openPdfInNewTab = (pdfPath) => {
    if (!pdfPath) {
      alert('No PDF file available for this request yet.');
      return;
    }

    window.open(`${BASE_URL}${pdfPath}`, '_blank', 'noopener,noreferrer');
  };

  const previewPdfInModal = (pdfPath) => {
    if (!pdfPath) {
      alert('No PDF file available for this request yet.');
      return;
    }

    setPdfPreviewUrl(`${BASE_URL}${pdfPath}`);
  };

  const closePdfPreview = () => {
    setPdfPreviewUrl('');
  };

  const totalFoodPacks = filteredRows.reduce(
    (sum, row) => sum + Number(row?.totals?.requestedFoodPacks || 0),
    0
  );

  const avgFoodPacks = filteredRows.length
    ? Math.round(totalFoodPacks / filteredRows.length)
    : 0;

  const selectedIndividuals = selectedRequest
    ? getTotalIndividuals(selectedRequest)
    : 0;

  return (
    <DashboardShell>
      <div className="rrl-page">
        <div className="rrl-shell">
          <div className="rrl-header-card">
            <div>
              <span className="rrl-kicker">DRRMO Review Module</span>
              <h1 className="rrl-title">Pending Relief Requests</h1>
              <p className="rrl-subtitle">
                Review, validate, and approve barangay-submitted evacuation-based
                relief requests before release processing.
              </p>
            </div>

            <div className="rrl-header-actions">
              <button
                className="rrl-btn rrl-btn-secondary"
                onClick={() => navigate('/drrmo/dashboard')}
              >
                ← Back to Dashboard
              </button>
            </div>
          </div>

          <div className="rrl-top-grid">
            <section className="rrl-card">
              <div className="rrl-card-head">
                <h2>Request Queue</h2>
                <p>
                  Search pending requests, inspect submitted request sheets, and
                  validate them for release processing.
                </p>
              </div>

              <div className="rrl-search-row">
                <input
                  className="rrl-search"
                  type="text"
                  placeholder="Search by request no., barangay, disaster..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="rrl-table-wrapper">
                <table className="rrl-table">
                  <thead>
                    <tr>
                      <th>Request No.</th>
                      <th>Barangay</th>
                      <th>Disaster</th>
                      <th>Date</th>
                      <th>Centers</th>
                      <th>Food Packs</th>
                      <th>Status</th>
                      <th>Review</th>
                    </tr>
                  </thead>

                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="8" className="rrl-empty-cell">
                          Loading pending requests...
                        </td>
                      </tr>
                    ) : filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="rrl-empty-cell">
                          No pending requests found.
                        </td>
                      </tr>
                    ) : (
                      filteredRows.map((row) => (
                        <tr key={row._id}>
                          <td>{row.requestNo || '-'}</td>
                          <td>{row.barangayName || '-'}</td>
                          <td>{row.disaster || '-'}</td>
                          <td>{formatDate(row.requestDate)}</td>
                          <td>{row.rows?.length || 0}</td>
                          <td>{row.totals?.requestedFoodPacks || 0}</td>
                          <td>
                            <span className="rrl-status-pill">
                              {row.status || 'pending'}
                            </span>
                          </td>
                          <td>
                            <button
                              className="rrl-btn rrl-btn-outline rrl-btn-sm"
                              onClick={() => {
                                setSelectedRequest(row);
                                setPdfPreviewUrl('');
                              }}
                            >
                              Review
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <aside className="rrl-card rrl-summary-card">
              <div className="rrl-card-head">
                <h2>Queue Summary</h2>
                <p>Quick operational overview of the current pending queue.</p>
              </div>

              <div className="rrl-summary-list">
                <div className="rrl-summary-item">
                  <span>Total Pending Requests</span>
                  <strong>{rows.length}</strong>
                </div>
                <div className="rrl-summary-item">
                  <span>Filtered Results</span>
                  <strong>{filteredRows.length}</strong>
                </div>
                <div className="rrl-summary-item">
                  <span>Average Food Packs</span>
                  <strong>{avgFoodPacks}</strong>
                </div>
                <div className="rrl-summary-item emphasis">
                  <span>Total Requested Food Packs</span>
                  <strong>{totalFoodPacks}</strong>
                </div>
              </div>
            </aside>
          </div>

          {selectedRequest && (
            <section className="rrl-card rrl-details-card">
              <div className="rrl-card-head rrl-details-head">
                <div>
                  <h2>Request Review Details</h2>
                  <p>
                    Inspect the request sheet carefully before approving or rejecting
                    the submission.
                  </p>
                </div>

                <button
                  className="rrl-btn rrl-btn-secondary"
                  onClick={() => {
                    setSelectedRequest(null);
                    setPdfPreviewUrl('');
                  }}
                >
                  Close
                </button>
              </div>

              <div className="rrl-info-grid">
                <div className="rrl-info-box">
                  <span>Request No.</span>
                  <strong>{selectedRequest.requestNo || '-'}</strong>
                </div>
                <div className="rrl-info-box">
                  <span>Barangay</span>
                  <strong>{selectedRequest.barangayName || '-'}</strong>
                </div>
                <div className="rrl-info-box">
                  <span>Disaster</span>
                  <strong>{selectedRequest.disaster || '-'}</strong>
                </div>
                <div className="rrl-info-box">
                  <span>Date Submitted</span>
                  <strong>{formatDateTime(selectedRequest.requestDate)}</strong>
                </div>
              </div>

              <div className="rrl-pdf-toolbar">
                <div className="rrl-pdf-copy">
                  <h3>Request PDF</h3>
                  <p>
                    Open the generated PDF copy of this relief request for review,
                    printing, or download.
                  </p>
                </div>

                <div className="rrl-pdf-actions">
                  <button
                    type="button"
                    className="rrl-btn rrl-btn-outline"
                    onClick={() => previewPdfInModal(getPdfPath(selectedRequest))}
                    disabled={!getPdfPath(selectedRequest)}
                  >
                    Preview PDF
                  </button>

                  {getPdfPath(selectedRequest) ? (
                    <a
                      className="rrl-btn rrl-btn-primary"
                      href={`${BASE_URL}${getPdfPath(selectedRequest)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                    >
                      Download PDF
                    </a>
                  ) : (
                    <button
                      type="button"
                      className="rrl-btn rrl-btn-secondary"
                      disabled
                    >
                      No PDF Yet
                    </button>
                  )}

                  <button
                    type="button"
                    className="rrl-btn rrl-btn-secondary"
                    onClick={() => openPdfInNewTab(getPdfPath(selectedRequest))}
                    disabled={!getPdfPath(selectedRequest)}
                  >
                    Open in New Tab
                  </button>
                </div>
              </div>

              <div className="rrl-review-layout">
                <div className="rrl-review-main">
                  <div className="rrl-subhead">
                    <h3>Evacuation Request Table</h3>
                    <p>Submitted evacuation center details and requested food packs.</p>
                  </div>

                  <div className="rrl-table-wrapper">
                    <table className="rrl-table rrl-detail-table">
                      <thead>
                        <tr>
                          <th>No.</th>
                          <th>Evacuation Center</th>
                          <th>Households</th>
                          <th>Families</th>
                          <th>Male</th>
                          <th>Female</th>
                          <th>LGBTQ</th>
                          <th>PWD</th>
                          <th>Pregnant</th>
                          <th>Senior</th>
                          <th>Food Packs</th>
                        </tr>
                      </thead>

                      <tbody>
                        {(selectedRequest.rows || []).map((row, index) => (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td>{row.evacuationCenterName || '-'}</td>
                            <td>{row.households || 0}</td>
                            <td>{row.families || 0}</td>
                            <td>{row.male || 0}</td>
                            <td>{row.female || 0}</td>
                            <td>{row.lgbtq || 0}</td>
                            <td>{row.pwd || 0}</td>
                            <td>{row.pregnant || 0}</td>
                            <td>{row.senior || 0}</td>
                            <td>{row.requestedFoodPacks || 0}</td>
                          </tr>
                        ))}
                      </tbody>

                      <tfoot>
                        <tr>
                          <td colSpan="2" className="rrl-total-label">
                            TOTAL
                          </td>
                          <td>{selectedRequest.totals?.households || 0}</td>
                          <td>{selectedRequest.totals?.families || 0}</td>
                          <td>{selectedRequest.totals?.male || 0}</td>
                          <td>{selectedRequest.totals?.female || 0}</td>
                          <td>{selectedRequest.totals?.lgbtq || 0}</td>
                          <td>{selectedRequest.totals?.pwd || 0}</td>
                          <td>{selectedRequest.totals?.pregnant || 0}</td>
                          <td>{selectedRequest.totals?.senior || 0}</td>
                          <td>{selectedRequest.totals?.requestedFoodPacks || 0}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>

                <aside className="rrl-review-side">
                  <div className="rrl-subhead">
                    <h3>Validation Summary</h3>
                    <p>Use this summary to help decide whether to approve the request.</p>
                  </div>

                  <div className="rrl-summary-list">
                    <div className="rrl-summary-item">
                      <span>Evacuation Centers</span>
                      <strong>{selectedRequest.rows?.length || 0}</strong>
                    </div>
                    <div className="rrl-summary-item">
                      <span>Total Households</span>
                      <strong>{selectedRequest.totals?.households || 0}</strong>
                    </div>
                    <div className="rrl-summary-item">
                      <span>Total Families</span>
                      <strong>{selectedRequest.totals?.families || 0}</strong>
                    </div>
                    <div className="rrl-summary-item">
                      <span>Total Individuals</span>
                      <strong>{selectedIndividuals}</strong>
                    </div>
                    <div className="rrl-summary-item emphasis">
                      <span>Requested Food Packs</span>
                      <strong>{selectedRequest.totals?.requestedFoodPacks || 0}</strong>
                    </div>
                  </div>

                  <div className="rrl-remarks-box">
                    <span>Remarks</span>
                    <p>{selectedRequest.remarks?.trim() || 'No remarks provided.'}</p>
                  </div>

                  <div className="rrl-action-card">
                    <div className="rrl-action-copy">
                      <h4>Decision Actions</h4>
                      <p>
                        Approve if the submitted figures are valid and ready for release
                        planning. Reject if the request needs correction or cannot be
                        processed yet.
                      </p>
                    </div>

                    <div className="rrl-actions rrl-actions-stacked">
                      <button
                        className="rrl-btn rrl-btn-danger"
                        disabled={submittingAction}
                        onClick={() =>
                          handleAction(selectedRequest._id, 'reject', 'Rejected by DRRMO')
                        }
                      >
                        {submittingAction ? 'Processing...' : 'Reject'}
                      </button>

                      <button
                        className="rrl-btn rrl-btn-primary"
                        disabled={submittingAction}
                        onClick={() =>
                          handleAction(selectedRequest._id, 'accept', 'Approved by DRRMO')
                        }
                      >
                        {submittingAction ? 'Processing...' : 'Approve Request'}
                      </button>
                    </div>
                  </div>
                </aside>
              </div>
            </section>
          )}
        </div>
      </div>

      {pdfPreviewUrl && (
        <div className="rrl-pdf-modal-overlay" onClick={closePdfPreview}>
          <div
            className="rrl-pdf-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="rrl-pdf-modal-header">
              <div>
                <h3>Relief Request PDF Preview</h3>
                <p>Review the generated request form before taking action.</p>
              </div>

              <button
                type="button"
                className="rrl-btn rrl-btn-secondary"
                onClick={closePdfPreview}
              >
                Close
              </button>
            </div>

            <iframe
              src={pdfPreviewUrl}
              title="Relief Request PDF Preview"
              className="rrl-pdf-iframe"
            />
          </div>
        </div>
      )}
    </DashboardShell>
  );
}