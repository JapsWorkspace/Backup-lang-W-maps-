// src/components/admin/Admin.js
import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Tooltip } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import incidentImage from '../assets/images/incident-icon.png';
import DashboardShell from './layout/DashboardShell';

const incidentIcon = new L.Icon({
  iconUrl: incidentImage,
  iconSize: [35, 35],
  iconAnchor: [17, 35],
  popupAnchor: [0, -35],
});

const JAEN_CENTER = {
  lat: 15.3382,
  lng: 120.9056,
};

// small bounding box around Jaen
const JAEN_BOUNDS = {
  north: 15.370,
  south: 15.300,
  west: 120.870,
  east: 120.940,
};

export default function IncidentReport() {
  const BASE_URL = process.env.REACT_APP_API_URL || "https://gaganadapat.onrender.com";
  const navigate = useNavigate();
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [statusMap, setStatusMap] = useState({});

  useEffect(() => {
    const storedRole = localStorage.getItem('role');
    if (!storedRole) navigate('/');
  }, [navigate]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${BASE_URL}/incident/getIncidents`);
        setIncidents(res.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [BASE_URL]);

  const handleChange = async (id, value) => {
    try {
      const incident = incidents.find(i => i._id === id);

      await axios.put(`${BASE_URL}/incident/updateStatus/${id}`, {
        status: value
      });

      await axios.post(`${BASE_URL}/history/registerHistory`, {
        action: 'STATUS_UPDATE',
        placeName: incident.location,
        details: incident.description,
      });

      setIncidents(prev =>
        prev.map(i => i._id === id ? { ...i, status: value } : i)
      );
      setStatusMap(prev => ({ ...prev, [id]: value }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    const incident = incidents.find(i => i._id === id);

    await axios.post(`${BASE_URL}/history/registerHistory`, {
      action: 'DELETE',
      placeName: incident.location,
      details: incident.description,
    });

    try {
      await axios.delete(`${BASE_URL}/incident/delete/${id}`);
      setIncidents(prev => prev.filter(i => i._id !== id));
      setStatusMap(prev => {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
    } catch (err) {
      console.error(err);
    }
  };

  const summary = useMemo(() => {
    const total = incidents.length;
    const reported = incidents.filter(
      (i) => !i.status || i.status === 'reported' || i.status === ''
    ).length;
    const onProcess = incidents.filter((i) => i.status === 'onProcess').length;
    const resolved = incidents.filter((i) => i.status === 'resolved').length;

    return {
      total,
      reported,
      onProcess,
      resolved,
    };
  }, [incidents]);

  const getStatusLabel = (status) => {
    if (!status || status === 'reported') return 'Reported';
    if (status === 'onProcess') return 'On Process';
    if (status === 'resolved') return 'Resolved';
    return status;
  };

  const getStatusBadgeStyle = (status) => {
    if (!status || status === 'reported') {
      return {
        background: '#fff7e6',
        color: '#9a6700',
        border: '1px solid #f3d28b',
      };
    }

    if (status === 'onProcess') {
      return {
        background: '#eef4ff',
        color: '#1d4ed8',
        border: '1px solid #bfd3ff',
      };
    }

    if (status === 'resolved') {
      return {
        background: '#ecfdf3',
        color: '#166534',
        border: '1px solid #b7ebc6',
      };
    }

    return {
      background: '#f4f4f5',
      color: '#3f3f46',
      border: '1px solid #d4d4d8',
    };
  };

  const getSeverityBadgeStyle = (level) => {
    const normalized = String(level || '').toLowerCase();

    if (normalized.includes('high')) {
      return {
        background: '#fff1f2',
        color: '#be123c',
        border: '1px solid #fecdd3',
      };
    }

    if (normalized.includes('medium')) {
      return {
        background: '#fff7ed',
        color: '#c2410c',
        border: '1px solid #fed7aa',
      };
    }

    if (normalized.includes('low')) {
      return {
        background: '#f0fdf4',
        color: '#166534',
        border: '1px solid #bbf7d0',
      };
    }

    return {
      background: '#f5f5f5',
      color: '#444',
      border: '1px solid #e4e4e7',
    };
  };

  return (
    <DashboardShell>
    <div style={styles.page}>
      <div style={styles.shell}>
        <div style={styles.hero}>
          <div>
            <div style={styles.kicker}>Emergency Monitoring</div>
            <h1 style={styles.title}>Incident Administration</h1>
            <p style={styles.subtitle}>
              Monitor reported incidents, review map locations, and manage response
              progress in one command view.
            </p>
          </div>

          <div style={styles.heroBadgeWrap}>
            <div style={styles.liveBadge}>
              <span style={styles.liveDot}></span>
              Live updates every 5 seconds
            </div>
          </div>
        </div>

        <div style={styles.summaryGrid}>
          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Total Incidents</div>
            <div style={styles.summaryValue}>{summary.total}</div>
            <div style={styles.summaryHint}>All reported records</div>
          </div>

          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Reported</div>
            <div style={styles.summaryValue}>{summary.reported}</div>
            <div style={styles.summaryHint}>Awaiting active handling</div>
          </div>

          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>On Process</div>
            <div style={styles.summaryValue}>{summary.onProcess}</div>
            <div style={styles.summaryHint}>Currently being addressed</div>
          </div>

          <div style={styles.summaryCard}>
            <div style={styles.summaryLabel}>Resolved</div>
            <div style={styles.summaryValue}>{summary.resolved}</div>
            <div style={styles.summaryHint}>Closed incident reports</div>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h3 style={styles.cardTitle}>Incident Map</h3>
              <p style={styles.cardText}>
                View all mapped incident reports within the monitored area.
              </p>
            </div>
          </div>

          <div style={styles.mapFrame}>
            <MapContainer
  center={[JAEN_CENTER.lat, JAEN_CENTER.lng]}
  zoom={14}
  style={{ height: '100%', width: '100%' }}
  maxBounds={[
    [JAEN_BOUNDS.south, JAEN_BOUNDS.west],
    [JAEN_BOUNDS.north, JAEN_BOUNDS.east],
  ]}
  maxBoundsViscosity={1.0}
>
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; OpenStreetMap contributors"
              />
              {incidents.map((incident) => (
                incident.latitude != null && incident.longitude != null && (
                  <Marker
                    key={incident._id}
                    position={[incident.latitude, incident.longitude]}
                    icon={incidentIcon}
                    eventHandlers={{
                      click: () => setSelectedIncident(incident)
                    }}
                  >
                    <Tooltip direction="top" offset={[0, -10]} opacity={1}>
                      <div style={{ minWidth: 170 }}>
                        <strong>{incident.type?.toUpperCase()}</strong>
                        <br />
                        Status: {getStatusLabel(incident.status)}
                        <br />
                        Severity: {incident.level}
                        <br />
                        {incident.location}
                        <br />
                        {incident.description}
                      </div>
                    </Tooltip>
                  </Marker>
                )
              ))}
            </MapContainer>
          </div>
        </div>

        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <div>
              <h3 style={styles.cardTitle}>Manage Incident Statuses</h3>
              <p style={styles.cardText}>
                Review incident details, update progress, or remove records when needed.
              </p>
            </div>
          </div>

          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Type</th>
                  <th style={styles.th}>Level</th>
                  <th style={styles.th}>Description</th>
                  <th style={styles.th}>Location</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Delete</th>
                </tr>
              </thead>
              <tbody>
                {incidents.length > 0 ? (
                  incidents.map((inc) => (
                    <tr key={inc._id} style={styles.tr}>
                      <td style={styles.td}>
                        <span style={styles.typeBadge}>
                          {inc.type || '-'}
                        </span>
                      </td>

                      <td style={styles.td}>
                        <span style={{ ...styles.badge, ...getSeverityBadgeStyle(inc.level) }}>
                          {inc.level || '-'}
                        </span>
                      </td>

                      <td style={styles.td}>
                        <div style={styles.descriptionCell}>
                          {inc.description || '-'}
                        </div>
                      </td>

                      <td style={styles.td}>
                        <div style={styles.locationCell}>{inc.location || '-'}</div>
                      </td>

                      <td style={styles.td}>
                        <div style={styles.statusCell}>
                          <span
                            style={{
                              ...styles.badge,
                              ...getStatusBadgeStyle(statusMap[inc._id] || inc.status || '')
                            }}
                          >
                            {getStatusLabel(statusMap[inc._id] || inc.status || '')}
                          </span>

                          <select
                            value={statusMap[inc._id] || inc.status || ''}
                            onChange={e => handleChange(inc._id, e.target.value)}
                            style={styles.select}
                          >
                            <option value="">Reported</option>
                            <option value="onProcess">On Process</option>
                            <option value="resolved">Resolved</option>
                          </select>
                        </div>
                      </td>

                      <td style={styles.td}>
                        <button
                          onClick={() => handleDelete(inc._id)}
                          style={styles.deleteBtn}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" style={styles.emptyTd}>
                      <div style={styles.emptyState}>
                        <div style={styles.emptyTitle}>No incident reports found</div>
                        <div style={styles.emptyText}>
                          When incidents are reported, they will appear here automatically.
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {selectedIncident && (
          <div style={styles.modalOverlay} onClick={() => setSelectedIncident(null)}>
            <div style={styles.modalCard} onClick={(e) => e.stopPropagation()}>
              <div style={styles.modalHeader}>
                <div>
                  <div style={styles.modalKicker}>Incident Details</div>
                  <h2 style={styles.modalTitle}>{selectedIncident.type || 'Incident'}</h2>
                </div>

                <button
                  onClick={() => setSelectedIncident(null)}
                  style={styles.modalClose}
                >
                  ✕
                </button>
              </div>

              <div style={styles.modalBody}>
                <div style={styles.modalGrid}>
                  <div style={styles.detailBox}>
                    <span style={styles.detailLabel}>Status</span>
                    <span
                      style={{
                        ...styles.badge,
                        ...getStatusBadgeStyle(selectedIncident.status)
                      }}
                    >
                      {getStatusLabel(selectedIncident.status)}
                    </span>
                  </div>

                  <div style={styles.detailBox}>
                    <span style={styles.detailLabel}>Severity</span>
                    <span
                      style={{
                        ...styles.badge,
                        ...getSeverityBadgeStyle(selectedIncident.level)
                      }}
                    >
                      {selectedIncident.level || '-'}
                    </span>
                  </div>
                </div>

                <div style={styles.detailSection}>
                  <div style={styles.detailLabel}>Location</div>
                  <div style={styles.detailValue}>{selectedIncident.location || '-'}</div>
                </div>

                <div style={styles.detailSection}>
                  <div style={styles.detailLabel}>Description</div>
                  <div style={styles.detailValue}>{selectedIncident.description || '-'}</div>
                </div>

                <div style={styles.modalGrid}>
                  <div style={styles.detailSection}>
                    <div style={styles.detailLabel}>Username</div>
                    <div style={styles.detailValue}>{selectedIncident.usernames || '-'}</div>
                  </div>

                  <div style={styles.detailSection}>
                    <div style={styles.detailLabel}>Phone</div>
                    <div style={styles.detailValue}>{selectedIncident.phone || '-'}</div>
                  </div>
                </div>
              </div>

              <div style={styles.modalFooter}>
                <button
                  onClick={() => setSelectedIncident(null)}
                  style={styles.closeBtn}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    
  </DashboardShell>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background:
      'linear-gradient(180deg, #f5faf6 0%, #eef6f0 100%)',
    padding: '24px',
  },
  shell: {
    width: '100%',
    maxWidth: '1440px',
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '22px',
  },
  hero: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    flexWrap: 'wrap',
    background: 'linear-gradient(135deg, #14532d 0%, #166534 45%, #15803d 100%)',
    borderRadius: '24px',
    padding: '28px',
    color: '#fff',
    boxShadow: '0 18px 45px rgba(20, 83, 45, 0.18)',
  },
  kicker: {
    fontSize: '12px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.12em',
    opacity: 0.88,
    marginBottom: '10px',
  },
  title: {
    margin: 0,
    fontSize: '34px',
    fontWeight: 900,
    lineHeight: 1.1,
  },
  subtitle: {
    margin: '12px 0 0',
    maxWidth: '760px',
    color: 'rgba(255,255,255,0.92)',
    fontSize: '15px',
    lineHeight: 1.7,
  },
  heroBadgeWrap: {
    display: 'flex',
    alignItems: 'flex-start',
  },
  liveBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    borderRadius: '999px',
    background: 'rgba(255,255,255,0.14)',
    border: '1px solid rgba(255,255,255,0.18)',
    fontSize: '13px',
    fontWeight: 700,
    whiteSpace: 'nowrap',
    backdropFilter: 'blur(6px)',
  },
  liveDot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%',
    background: '#86efac',
    boxShadow: '0 0 0 6px rgba(134, 239, 172, 0.18)',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '16px',
  },
  summaryCard: {
    background: '#fff',
    border: '1px solid #e3efe6',
    borderRadius: '20px',
    padding: '20px',
    boxShadow: '0 10px 28px rgba(20, 83, 45, 0.06)',
  },
  summaryLabel: {
    fontSize: '12px',
    fontWeight: 800,
    color: '#4b6b57',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    marginBottom: '10px',
  },
  summaryValue: {
    fontSize: '32px',
    fontWeight: 900,
    color: '#14532d',
    lineHeight: 1,
    marginBottom: '10px',
  },
  summaryHint: {
    fontSize: '13px',
    color: '#6b7f72',
    lineHeight: 1.5,
  },
  card: {
    background: '#fff',
    border: '1px solid #e2efe5',
    borderRadius: '24px',
    padding: '22px',
    boxShadow: '0 14px 35px rgba(20, 83, 45, 0.07)',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    marginBottom: '18px',
    flexWrap: 'wrap',
  },
  cardTitle: {
    margin: 0,
    fontSize: '22px',
    fontWeight: 800,
    color: '#123524',
  },
  cardText: {
    margin: '6px 0 0',
    fontSize: '14px',
    color: '#667c6f',
    lineHeight: 1.6,
  },
  mapFrame: {
    height: '450px',
    borderRadius: '20px',
    overflow: 'hidden',
    border: '1px solid #dceadf',
  },
  tableWrap: {
    width: '100%',
    overflowX: 'auto',
    borderRadius: '18px',
    border: '1px solid #e4ece6',
  },
  table: {
    width: '100%',
    borderCollapse: 'separate',
    borderSpacing: 0,
    minWidth: '980px',
    background: '#fff',
  },
  th: {
    position: 'sticky',
    top: 0,
    background: '#f3f8f4',
    color: '#1f3d2b',
    fontSize: '13px',
    fontWeight: 800,
    textAlign: 'left',
    padding: '14px 16px',
    borderBottom: '1px solid #dde9e0',
    whiteSpace: 'nowrap',
  },
  tr: {
    background: '#fff',
  },
  td: {
    padding: '14px 16px',
    borderBottom: '1px solid #edf3ee',
    verticalAlign: 'top',
    fontSize: '14px',
    color: '#213a2b',
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '6px 10px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 800,
    lineHeight: 1,
    whiteSpace: 'nowrap',
  },
  typeBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '7px 12px',
    borderRadius: '999px',
    fontSize: '12px',
    fontWeight: 800,
    lineHeight: 1,
    background: '#ecfdf3',
    color: '#166534',
    border: '1px solid #b7ebc6',
    textTransform: 'capitalize',
  },
  descriptionCell: {
    minWidth: '220px',
    maxWidth: '320px',
    lineHeight: 1.6,
    color: '#334b3c',
  },
  locationCell: {
    minWidth: '170px',
    lineHeight: 1.6,
    color: '#334b3c',
  },
  statusCell: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    minWidth: '170px',
  },
  select: {
    width: '100%',
    minHeight: '40px',
    borderRadius: '12px',
    border: '1px solid #cfe0d3',
    background: '#fff',
    padding: '0 12px',
    fontSize: '13px',
    color: '#173122',
    outline: 'none',
    cursor: 'pointer',
  },
  deleteBtn: {
    minHeight: '40px',
    padding: '0 14px',
    borderRadius: '12px',
    border: '1px solid #fecaca',
    background: '#fff1f2',
    color: '#be123c',
    fontWeight: 800,
    fontSize: '13px',
    cursor: 'pointer',
  },
  emptyTd: {
    padding: '36px 20px',
    textAlign: 'center',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#5f7768',
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: 800,
    color: '#214031',
  },
  emptyText: {
    fontSize: '14px',
    lineHeight: 1.6,
  },
  modalOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(9, 20, 14, 0.52)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    zIndex: 9999,
    backdropFilter: 'blur(4px)',
  },
  modalCard: {
    width: '100%',
    maxWidth: '700px',
    background: '#fff',
    borderRadius: '24px',
    overflow: 'hidden',
    boxShadow: '0 24px 60px rgba(0,0,0,0.22)',
    border: '1px solid #e4ece6',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: '16px',
    padding: '24px 24px 18px',
    background: 'linear-gradient(135deg, #f6fbf7 0%, #eef7f0 100%)',
    borderBottom: '1px solid #e2ece4',
  },
  modalKicker: {
    fontSize: '12px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: '#5d7566',
    marginBottom: '8px',
  },
  modalTitle: {
    margin: 0,
    fontSize: '28px',
    fontWeight: 900,
    color: '#173122',
    textTransform: 'capitalize',
  },
  modalClose: {
    width: '42px',
    height: '42px',
    borderRadius: '12px',
    border: '1px solid #dbe7de',
    background: '#fff',
    color: '#1f3d2b',
    fontSize: '18px',
    cursor: 'pointer',
    fontWeight: 800,
  },
  modalBody: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '18px',
  },
  modalGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
    gap: '14px',
  },
  detailBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '16px',
    borderRadius: '16px',
    background: '#f8fbf8',
    border: '1px solid #e3ede5',
  },
  detailSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '16px',
    borderRadius: '16px',
    background: '#f8fbf8',
    border: '1px solid #e3ede5',
  },
  detailLabel: {
    fontSize: '12px',
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#63796b',
  },
  detailValue: {
    fontSize: '15px',
    color: '#1e3528',
    lineHeight: 1.7,
    wordBreak: 'break-word',
  },
  modalFooter: {
    padding: '0 24px 24px',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  closeBtn: {
    minHeight: '44px',
    padding: '0 18px',
    borderRadius: '12px',
    border: 'none',
    background: '#166534',
    color: '#fff',
    fontWeight: 800,
    fontSize: '14px',
    cursor: 'pointer',
  },
};