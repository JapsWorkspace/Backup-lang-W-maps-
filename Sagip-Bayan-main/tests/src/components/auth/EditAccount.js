import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import '../css/EditAccount.css';
import DashboardShell from '../layout/DashboardShell';

export default function EditAccount() {
  const navigate = useNavigate();

  useEffect(() => {
    const storedRole = localStorage.getItem('role');
    if (!storedRole) {
      navigate('/');
    }
  }, [navigate]);

  const [accounts, setAccounts] = useState([]);
  const [open, setOpen] = useState(null);
  const [forms, setForms] = useState({});
  const [q, setQ] = useState('');
  const [savingId, setSavingId] = useState(null);
  const [archivingId, setArchivingId] = useState(null);

  const BASE_URL =
    process.env.REACT_APP_API_URL || 'https://gaganadapat.onrender.com';

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/all`, {
        credentials: 'include'
      });

      const data = await res.json();
      const safeData = Array.isArray(data) ? data : [];
      setAccounts(safeData);

      const mappedForms = {};
      safeData.forEach((a) => {
        mappedForms[a._id] = {
          username: a.username || '',
          email: a.email || '',
          phoneNumber: a.phoneNumber || '',
          hotline: a.hotline || '',
          address: a.address || '',
          password: '',
          confirmPassword: ''
        };
      });
      setForms(mappedForms);

      if (safeData.length > 0 && !open) {
        const firstVisible = safeData.find((acc) => acc.role !== 'admin');
        if (firstVisible) {
          setOpen(firstVisible._id);
        }
      }
    } catch (err) {
      console.error(err);
      alert('Failed to fetch accounts');
    }
  };

  const handleChange = (id, field, value) => {
    setForms((prev) => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const validPhone = (phone) => /^[0-9]{10,11}$/.test(phone);
  const validPassword = (pass) =>
    /[A-Z]/.test(pass) && /[0-9]/.test(pass) && pass.length >= 8;
  const validEmail = (email) => email.includes('@') && email.includes('.com');

  const updateAccount = async (id) => {
    const data = forms[id];
    if (!data) return;

    if (data.phoneNumber && !validPhone(data.phoneNumber)) {
      return alert('Phone number must be 10–11 digits');
    }

    if (data.email && !validEmail(data.email)) {
      return alert('Email must contain @ and .com');
    }

    if (data.password) {
      if (!validPassword(data.password)) {
        return alert(
          'Password must be 8+ characters with a capital letter and a number'
        );
      }

      if (data.password !== data.confirmPassword) {
        return alert('Passwords do not match');
      }
    }

    const original = accounts.find((a) => a._id === id);
    if (!original) return;

    if (
      data.username === original.username &&
      data.email === original.email &&
      data.phoneNumber === original.phoneNumber &&
      data.hotline === original.hotline &&
      data.address === original.address &&
      !data.password
    ) {
      return alert('No changes detected');
    }

    const payload = { ...data };
    delete payload.confirmPassword;
    if (!payload.password) delete payload.password;

    try {
      setSavingId(id);

      const res = await fetch(`${BASE_URL}/api/auth/update/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        alert('Updated successfully');
        await fetchAccounts();
      } else {
        alert('Update failed');
      }
    } catch (err) {
      console.error(err);
      alert('Update failed');
    } finally {
      setSavingId(null);
    }
  };

  const archiveAccount = async (id) => {
    if (!window.confirm('Archive this account?')) return;

    try {
      setArchivingId(id);

      const res = await fetch(`${BASE_URL}/api/auth/archive/${id}`, {
        method: 'PUT',
        credentials: 'include'
      });

      if (res.ok) {
        alert('Account archived successfully');
        setAccounts((prev) => prev.filter((a) => a._id !== id));
        setOpen(null);
      } else {
        alert('Failed to archive account');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to archive account');
    } finally {
      setArchivingId(null);
    }
  };

  const visibleAccounts = useMemo(
    () => accounts.filter((acc) => acc.role !== 'admin'),
    [accounts]
  );

  const filteredAccounts = useMemo(() => {
    const term = q.toLowerCase();
    return visibleAccounts.filter((a) =>
      `${a.username} ${a.email} ${a.phoneNumber} ${a.address} ${a.role}`
        .toLowerCase()
        .includes(term)
    );
  }, [visibleAccounts, q]);

  const selected = useMemo(
    () => visibleAccounts.find((a) => a._id === open) || null,
    [visibleAccounts, open]
  );

  const selectedForm = selected ? forms[selected._id] : null;

  const totalBarangay = useMemo(
    () => visibleAccounts.filter((a) => a.role === 'barangay').length,
    [visibleAccounts]
  );

  const totalDrrmo = useMemo(
    () => visibleAccounts.filter((a) => a.role === 'drrmo').length,
    [visibleAccounts]
  );

  const totalFiltered = filteredAccounts.length;

  const getInitials = (value = '') => {
    const text = String(value || '').trim();
    if (!text) return '?';
    return text.slice(0, 1).toUpperCase();
  };

  return (
      <div className="edit-account">
        <div className="ea-page-shell">
          <section className="ea-hero-card">
            <div className="ea-hero-copy">
              <span className="ea-kicker">Administration Module</span>
              <h1 className="ea-page-title">Edit Accounts</h1>
              <p className="ea-page-subtitle">
                Review DRRMO and barangay accounts, update user details, and
                archive accounts through a cleaner management workspace.
              </p>
            </div>

            <div className="ea-hero-stats">
              <div className="ea-stat-card">
                <span>Total Accounts</span>
                <strong>{visibleAccounts.length}</strong>
              </div>
              <div className="ea-stat-card">
                <span>DRRMO</span>
                <strong>{totalDrrmo}</strong>
              </div>
              <div className="ea-stat-card">
                <span>Barangay</span>
                <strong>{totalBarangay}</strong>
              </div>
              <div className="ea-stat-card emphasis">
                <span>Filtered</span>
                <strong>{totalFiltered}</strong>
              </div>
            </div>
          </section>

          <section className="ea-workspace">
            <aside className="ea-sidebar-card">
              <div className="ea-sidebar-head">
                <div>
                  <h2>Account List</h2>
                  <p>Select an account to view and edit details.</p>
                </div>
              </div>

              <div className="ea-listbar">
                <input
                  className="ea-list-search"
                  type="search"
                  placeholder="Search username, email, role..."
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
              </div>

              <div className="ea-list">
                {filteredAccounts.length === 0 ? (
                  <div className="ea-list-empty">
                    <strong>No accounts found</strong>
                    <span>Try another search term.</span>
                  </div>
                ) : (
                  filteredAccounts.map((acc) => (
                    <div key={acc._id} className="ea-item">
                      <button
                        type="button"
                        className={`ea-head ${open === acc._id ? 'is-active' : ''}`}
                        onClick={() => setOpen(acc._id)}
                      >
                        <div className="ea-head-main">
                          <div className="ea-head-avatar">
                            {getInitials(acc.username)}
                          </div>

                          <div className="ea-head-copy">
                            <strong className="ea-username">{acc.username}</strong>
                            <small className="ea-email">{acc.email || 'No email'}</small>
                          </div>
                        </div>

                        <span className={`ea-role ea-role-${acc.role}`}>
                          {acc.role}
                        </span>
                      </button>
                    </div>
                  ))
                )}
              </div>
            </aside>

            <section className="ea-editor-card">
              <div className="ea-countbar">
                <span>{filteredAccounts.length} accounts</span>
              </div>

              {!selected || !selectedForm ? (
                <div className="ea-placeholder ea-placeholder--centered">
                  <div className="ea-empty-illustration">👤</div>
                  <div className="ea-empty-title">Select an account</div>
                  <div className="ea-empty-sub">
                    Choose a user from the list on the left to edit details.
                  </div>
                </div>
              ) : (
                <div className="ea-editor-scroll">
                  <div className="ea-profile-card">
                    <div className="ea-profile-avatar">
                      {getInitials(selected.username)}
                    </div>

                    <div className="ea-profile-copy">
                      <h3>{selected.username}</h3>
                      <p>{selected.email || 'No email address'}</p>
                    </div>

                    <div className={`ea-role-badge ea-role-${selected.role}`}>
                      {selected.role}
                    </div>
                  </div>

                  <div className="ea-section-block">
                    <div className="ea-section-header">
                      <h3>Account Information</h3>
                      <p>Update the main contact and account details below.</p>
                    </div>

                    <div className="ea-form-grid">
                      <div className="ea-field">
                        <label>Username</label>
                        <input
                          value={selectedForm.username || ''}
                          onChange={(e) =>
                            handleChange(selected._id, 'username', e.target.value)
                          }
                        />
                      </div>

                      <div className="ea-field">
                        <label>Email</label>
                        <input
                          value={selectedForm.email || ''}
                          onChange={(e) =>
                            handleChange(selected._id, 'email', e.target.value)
                          }
                        />
                      </div>

                      <div className="ea-field">
                        <label>Phone Number</label>
                        <input
                          value={selectedForm.phoneNumber || ''}
                          onChange={(e) =>
                            handleChange(selected._id, 'phoneNumber', e.target.value)
                          }
                        />
                      </div>

                      <div className="ea-field">
                        <label>Hotline</label>
                        <input
                          value={selectedForm.hotline || ''}
                          onChange={(e) =>
                            handleChange(selected._id, 'hotline', e.target.value)
                          }
                        />
                      </div>

                      <div className="ea-field ea-field-full">
                        <label>Address</label>
                        <input
                          value={selectedForm.address || ''}
                          onChange={(e) =>
                            handleChange(selected._id, 'address', e.target.value)
                          }
                        />
                      </div>
                    </div>
                  </div>

                  <div className="ea-section-block">
                    <div className="ea-section-header">
                      <h3>Security</h3>
                      <p>
                        Leave password fields blank if you do not want to change the
                        current password.
                      </p>
                    </div>

                    <div className="ea-form-grid">
                      <div className="ea-field">
                        <label>New Password</label>
                        <input
                          type="password"
                          value={selectedForm.password || ''}
                          onChange={(e) =>
                            handleChange(selected._id, 'password', e.target.value)
                          }
                          placeholder="Leave blank to keep current password"
                        />
                      </div>

                      <div className="ea-field">
                        <label>Confirm Password</label>
                        <input
                          type="password"
                          value={selectedForm.confirmPassword || ''}
                          onChange={(e) =>
                            handleChange(selected._id, 'confirmPassword', e.target.value)
                          }
                          placeholder="Re-enter password"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="ea-actions">
                    <button
                      className="ea-btn ea-btn-primary"
                      onClick={() => updateAccount(selected._id)}
                      disabled={savingId === selected._id}
                    >
                      {savingId === selected._id ? 'Updating...' : 'Update Account'}
                    </button>

                    <button
                      className="ea-btn ea-btn-danger"
                      onClick={() => archiveAccount(selected._id)}
                      disabled={archivingId === selected._id}
                    >
                      {archivingId === selected._id
                        ? 'Archiving...'
                        : 'Archive Account'}
                    </button>
                  </div>
                </div>
              )}
            </section>
          </section>
        </div>
      </div>
  );
}
