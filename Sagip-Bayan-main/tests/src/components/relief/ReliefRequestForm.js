
// src/components/relief/ReliefRequestForm.js

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import DashboardShell from '../layout/DashboardShell';

import '../css/ReliefRequestForm.css';

const BASE_URL =
  process.env.REACT_APP_API_URL || 'https://gaganadapat.onrender.com';

const createEmptyRow = () => ({
  evacPlaceId: '',
  evacuationCenterName: '',
  households: 0,
  families: 0,
  male: 0,
  female: 0,
  lgbtq: 0,
  pwd: 0,
  pregnant: 0,
  senior: 0,
  requestedFoodPacks: 0
});

const numberFields = [
  'households',
  'families',
  'male',
  'female',
  'lgbtq',
  'pwd',
  'pregnant',
  'senior',
  'requestedFoodPacks'
];

const sanitizeText = (value) => String(value || '').trim();

export default function ReliefRequestForm() {
  const navigate = useNavigate();
  const location = useLocation();

  const editMode = location.state?.mode === 'edit';
  const editingRequest = location.state?.request || null;

  const [loadingPage, setLoadingPage] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [requestId, setRequestId] = useState('');
  const [requestNo, setRequestNo] = useState('Auto-generated upon submit');
  const [barangayId, setBarangayId] = useState('');
  const [barangayName, setBarangayName] = useState('');
  const [disaster, setDisaster] = useState('');
  const [requestDate, setRequestDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [remarks, setRemarks] = useState('');
  const [rows, setRows] = useState([createEmptyRow()]);
  const [evacPlaces, setEvacPlaces] = useState([]);

  useEffect(() => {
  const checkSession = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/barangays/me`, {
        credentials: 'include'
      });

      if (!res.ok) {
        navigate('/');
      }
    } catch (err) {
      console.error(err);
      navigate('/');
    }
  };

  checkSession();
}, [navigate]);

  useEffect(() => {
    let mounted = true;

    const fetchInitialData = async () => {
      try {
        setLoadingPage(true);

        const [barangayRes, evacRes] = await Promise.all([
          fetch(`${BASE_URL}/api/barangays/me`, {
            credentials: 'include'
          }),
          fetch(`${BASE_URL}/evacs`, {
            credentials: 'include'
          })
        ]);

        if (!barangayRes.ok) {
          throw new Error('Failed to load barangay information');
        }

        if (!evacRes.ok) {
          throw new Error('Failed to load evacuation places');
        }

        const barangayData = await barangayRes.json();
        const evacData = await evacRes.json();

        if (!mounted) return;

        setBarangayId(barangayData._id || '');
        setBarangayName(barangayData.barangayName || '');

        const normalizedEvacPlaces = Array.isArray(evacData)
          ? evacData.map((place) => ({
              _id: place._id || '',
              name: sanitizeText(place.name),
              location: sanitizeText(place.location),
              barangayId: place.barangayId || '',
              barangayName: sanitizeText(place.barangayName)
            }))
          : [];

        setEvacPlaces(normalizedEvacPlaces);

        if (editMode && editingRequest) {
          setRequestId(editingRequest._id || '');
          setRequestNo(editingRequest.requestNo || 'Auto-generated upon submit');
          setDisaster(editingRequest.disaster || '');
          setRequestDate(
            editingRequest.requestDate
              ? new Date(editingRequest.requestDate).toISOString().slice(0, 10)
              : new Date().toISOString().slice(0, 10)
          );
          setRemarks(editingRequest.remarks || '');
          setRows(
            Array.isArray(editingRequest.rows) && editingRequest.rows.length > 0
              ? editingRequest.rows.map((row) => ({
                  evacPlaceId: row.evacPlaceId || '',
                  evacuationCenterName: row.evacuationCenterName || '',
                  households: Number(row.households || 0),
                  families: Number(row.families || 0),
                  male: Number(row.male || 0),
                  female: Number(row.female || 0),
                  lgbtq: Number(row.lgbtq || 0),
                  pwd: Number(row.pwd || 0),
                  pregnant: Number(row.pregnant || 0),
                  senior: Number(row.senior || 0),
                  requestedFoodPacks: Number(row.requestedFoodPacks || 0)
                }))
              : [createEmptyRow()]
          );
        }
      } catch (err) {
        console.error(err);
        alert(err.message || 'Failed to load request form data.');
      } finally {
        if (mounted) setLoadingPage(false);
      }
    };

    fetchInitialData();

    return () => {
      mounted = false;
    };
  }, [editMode, editingRequest]);

  const evacPlaceOptions = useMemo(() => {
    return [...evacPlaces].sort((a, b) => a.name.localeCompare(b.name));
  }, [evacPlaces]);

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.households += Number(row.households) || 0;
        acc.families += Number(row.families) || 0;
        acc.male += Number(row.male) || 0;
        acc.female += Number(row.female) || 0;
        acc.lgbtq += Number(row.lgbtq) || 0;
        acc.pwd += Number(row.pwd) || 0;
        acc.pregnant += Number(row.pregnant) || 0;
        acc.senior += Number(row.senior) || 0;
        acc.requestedFoodPacks += Number(row.requestedFoodPacks) || 0;
        return acc;
      },
      {
        households: 0,
        families: 0,
        male: 0,
        female: 0,
        lgbtq: 0,
        pwd: 0,
        pregnant: 0,
        senior: 0,
        requestedFoodPacks: 0
      }
    );
  }, [rows]);

  const totalIndividuals = useMemo(() => {
    return (
      totals.male +
      totals.female +
      totals.lgbtq +
      totals.pwd +
      totals.pregnant +
      totals.senior
    );
  }, [totals]);

  const hasInvalidRows = useMemo(() => {
    if (!rows.length) return true;

    return rows.some((row) => {
      if (!row.evacuationCenterName.trim()) return true;

      return numberFields.some((field) => {
        const value = Number(row[field]);
        return Number.isNaN(value) || value < 0;
      });
    });
  }, [rows]);

  const isSubmitDisabled =
    submitting ||
    loadingPage ||
    !barangayName.trim() ||
    !disaster.trim() ||
    !requestDate ||
    rows.length === 0 ||
    hasInvalidRows ||
    (editMode && !requestId);

  const handleEvacPlaceChange = (index, selectedId) => {
    const selectedPlace =
      evacPlaceOptions.find(
        (place) => String(place._id) === String(selectedId)
      ) || null;

    setRows((prev) =>
      prev.map((row, i) =>
        i === index
          ? {
              ...row,
              evacPlaceId: selectedPlace?._id || '',
              evacuationCenterName: selectedPlace?.name || ''
            }
          : row
      )
    );
  };

  const handleRowTextChange = (index, field, value) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;

        const updated = { ...row, [field]: value };

        if (field === 'evacuationCenterName') {
          const matchedPlace =
            evacPlaceOptions.find(
              (place) =>
                sanitizeText(place.name).toLowerCase() ===
                sanitizeText(value).toLowerCase()
            ) || null;

          updated.evacPlaceId = matchedPlace?._id || '';
          updated.evacuationCenterName = value;
        }

        return updated;
      })
    );
  };

  const handleRowNumberChange = (index, field, value) => {
    const sanitized =
      value === '' ? '' : Math.max(0, Number.isNaN(Number(value)) ? 0 : Number(value));

    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: sanitized } : row))
    );
  };

  const addRow = () => {
    setRows((prev) => [...prev, createEmptyRow()]);
  };

  const removeRow = (index) => {
    setRows((prev) => {
      if (prev.length === 1) return prev;
      return prev.filter((_, i) => i !== index);
    });
  };

  const resetForm = () => {
    if (editMode && editingRequest) {
      setRequestId(editingRequest._id || '');
      setRequestNo(editingRequest.requestNo || 'Auto-generated upon submit');
      setDisaster(editingRequest.disaster || '');
      setRequestDate(
        editingRequest.requestDate
          ? new Date(editingRequest.requestDate).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10)
      );
      setRemarks(editingRequest.remarks || '');
      setRows(
        Array.isArray(editingRequest.rows) && editingRequest.rows.length > 0
          ? editingRequest.rows.map((row) => ({
              evacPlaceId: row.evacPlaceId || '',
              evacuationCenterName: row.evacuationCenterName || '',
              households: Number(row.households || 0),
              families: Number(row.families || 0),
              male: Number(row.male || 0),
              female: Number(row.female || 0),
              lgbtq: Number(row.lgbtq || 0),
              pwd: Number(row.pwd || 0),
              pregnant: Number(row.pregnant || 0),
              senior: Number(row.senior || 0),
              requestedFoodPacks: Number(row.requestedFoodPacks || 0)
            }))
          : [createEmptyRow()]
      );
      return;
    }

    setRequestId('');
    setRequestNo('Auto-generated upon submit');
    setDisaster('');
    setRequestDate(new Date().toISOString().slice(0, 10));
    setRemarks('');
    setRows([createEmptyRow()]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (isSubmitDisabled) {
      alert('Please complete the required fields before submitting.');
      return;
    }

    try {
      setSubmitting(true);

      const payload = {
        requestNo,
        barangayId,
        barangayName,
        disaster: disaster.trim(),
        requestDate,
        rows: rows.map((row) => ({
          evacPlaceId: row.evacPlaceId || null,
          evacuationCenterName: row.evacuationCenterName.trim(),
          households: Number(row.households) || 0,
          families: Number(row.families) || 0,
          male: Number(row.male) || 0,
          female: Number(row.female) || 0,
          lgbtq: Number(row.lgbtq) || 0,
          pwd: Number(row.pwd) || 0,
          pregnant: Number(row.pregnant) || 0,
          senior: Number(row.senior) || 0,
          requestedFoodPacks: Number(row.requestedFoodPacks) || 0
        })),
        remarks: remarks.trim()
      };

      const url = editMode
        ? `${BASE_URL}/api/relief-requests/${requestId}`
        : `${BASE_URL}/api/relief-requests`;

      const method = editMode ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(
          data.message ||
            (editMode
              ? 'Failed to update relief request'
              : 'Failed to submit relief request')
        );
      }

      alert(
        data.message ||
          (editMode
            ? 'Relief request updated successfully.'
            : 'Relief request submitted successfully.')
      );

      if (data?.request?.requestNo) {
        setRequestNo(data.request.requestNo);
      }

      resetForm();
      navigate('/barangay/relief-tracking');
    } catch (err) {
      console.error(err);
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingPage) {
    return (
      <DashboardShell>
        <div className="rrf-page">
          <div className="rrf-loading-card">
            <div className="rrf-spinner" />
            <p>Loading relief request form...</p>
          </div>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="rrf-page">
        <div className="rrf-shell">
          <div className="rrf-header-card">
            <div>
              <span className="rrf-kicker">Barangay Relief Module</span>
              <h1 className="rrf-title">
                {editMode ? 'Edit Relief Request' : 'Relief Request Form'}
              </h1>
              <p className="rrf-subtitle">
                {editMode
                  ? 'Update your pending evacuation-based food pack request before DRRMO review.'
                  : 'Submit evacuation-based food pack requests to DRRMO using a structured request sheet.'}
              </p>
            </div>

            <div className="rrf-header-actions">
              <button
                type="button"
                className="rrf-btn rrf-btn-secondary"
                onClick={() => navigate('/barangay/relief-tracking')}
              >
                ← Back to Tracking
              </button>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rrf-form">
            <div className="rrf-top-grid">
              <section className="rrf-card">
                <div className="rrf-card-head">
                  <h2>Request Information</h2>
                  <p>Review the basic request details before filling out the table.</p>
                </div>

                <div className="rrf-info-grid">
                  <div className="rrf-field">
                    <label>Relief Request No.</label>
                    <input
                      type="text"
                      value={requestNo}
                      readOnly
                      placeholder="Auto-generated"
                    />
                  </div>

                  <div className="rrf-field">
                    <label>Barangay</label>
                    <input type="text" value={barangayName} readOnly />
                  </div>

                  <div className="rrf-field">
                    <label>Disaster</label>
                    <input
                      type="text"
                      value={disaster}
                      onChange={(e) => setDisaster(e.target.value)}
                      placeholder="e.g. Flood, Typhoon, Fire"
                      required
                    />
                  </div>

                  <div className="rrf-field">
                    <label>Date</label>
                    <input
                      type="date"
                      value={requestDate}
                      onChange={(e) => setRequestDate(e.target.value)}
                      required
                    />
                  </div>
                </div>
              </section>

              <aside className="rrf-card rrf-summary-card">
                <div className="rrf-card-head">
                  <h2>Request Summary</h2>
                  <p>Totals update automatically as you edit the rows below.</p>
                </div>

                <div className="rrf-summary-list">
                  <div className="rrf-summary-item">
                    <span>Evacuation Centers</span>
                    <strong>{rows.length}</strong>
                  </div>
                  <div className="rrf-summary-item">
                    <span>Total Households</span>
                    <strong>{totals.households}</strong>
                  </div>
                  <div className="rrf-summary-item">
                    <span>Total Families</span>
                    <strong>{totals.families}</strong>
                  </div>
                  <div className="rrf-summary-item">
                    <span>Total Individuals</span>
                    <strong>{totalIndividuals}</strong>
                  </div>
                  <div className="rrf-summary-item emphasis">
                    <span>Requested Food Packs</span>
                    <strong>{totals.requestedFoodPacks}</strong>
                  </div>
                </div>
              </aside>
            </div>

            <section className="rrf-card">
              <div className="rrf-card-head rrf-table-head">
                <div>
                  <h2>Evacuation Request Details</h2>
                  <p>
                    Add one row per evacuation center and fill in the affected
                    population data.
                  </p>
                </div>

                <button
                  type="button"
                  className="rrf-btn rrf-btn-primary"
                  onClick={addRow}
                >
                  + Add Row
                </button>
              </div>

              <div className="rrf-table-wrapper">
                <table className="rrf-table">
                  <thead>
                    <tr>
                      <th>No.</th>
                      <th>Name of Evacuation Center/s</th>
                      <th>No. of Households</th>
                      <th>No. of Family</th>
                      <th>Male</th>
                      <th>Female</th>
                      <th>LGBTQ</th>
                      <th>PWD</th>
                      <th>Pregnant</th>
                      <th>Senior</th>
                      <th>No. of Requested Food Packs</th>
                      <th>Action</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row, index) => (
                      <tr key={index}>
                        <td className="rrf-row-number">{index + 1}</td>

                        <td className="rrf-cell-wide">
                          <div className="rrf-evac-cell">
                            <select
                              value={row.evacPlaceId}
                              onChange={(e) =>
                                handleEvacPlaceChange(index, e.target.value)
                              }
                            >
                              <option value="">Select evacuation center</option>
                              {evacPlaceOptions.map((place) => (
                                <option key={place._id} value={place._id}>
                                  {place.name}
                                </option>
                              ))}
                            </select>

                            <input
                              type="text"
                              value={row.evacuationCenterName}
                              onChange={(e) =>
                                handleRowTextChange(
                                  index,
                                  'evacuationCenterName',
                                  e.target.value
                                )
                              }
                              placeholder="Evacuation center name will auto-fill"
                            />
                          </div>
                        </td>

                        {numberFields.map((field) => (
                          <td key={field}>
                            <input
                              type="number"
                              min="0"
                              value={row[field]}
                              onChange={(e) =>
                                handleRowNumberChange(index, field, e.target.value)
                              }
                            />
                          </td>
                        ))}

                        <td>
                          <button
                            type="button"
                            className="rrf-icon-btn"
                            onClick={() => removeRow(index)}
                            disabled={rows.length === 1}
                            title="Remove row"
                          >
                            ×
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  <tfoot>
                    <tr>
                      <td colSpan="2" className="rrf-total-label">
                        TOTAL
                      </td>
                      <td>{totals.households}</td>
                      <td>{totals.families}</td>
                      <td>{totals.male}</td>
                      <td>{totals.female}</td>
                      <td>{totals.lgbtq}</td>
                      <td>{totals.pwd}</td>
                      <td>{totals.pregnant}</td>
                      <td>{totals.senior}</td>
                      <td>{totals.requestedFoodPacks}</td>
                      <td>-</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>

            <section className="rrf-card">
              <div className="rrf-card-head">
                <h2>Remarks</h2>
                <p>Add any supporting notes or special instructions for DRRMO.</p>
              </div>

              <div className="rrf-field">
                <textarea
                  rows="5"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Optional remarks..."
                />
              </div>
            </section>

            <div className="rrf-actions">
              <button
                type="button"
                className="rrf-btn rrf-btn-secondary"
                onClick={() => navigate('/barangay/relief-tracking')}
              >
                Cancel
              </button>

              <button
                type="button"
                className="rrf-btn rrf-btn-outline"
                onClick={resetForm}
              >
                Reset
              </button>

              <button
                type="submit"
                className="rrf-btn rrf-btn-primary"
                disabled={isSubmitDisabled}
              >
                {submitting
                  ? editMode
                    ? 'Updating...'
                    : 'Submitting...'
                  : editMode
                  ? 'Save Changes'
                  : 'Submit Request'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashboardShell>
  );
}
