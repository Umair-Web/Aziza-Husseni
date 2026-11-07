import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const fullLinks = [
  { to: '/', end: true, label: 'Overview' },
  { to: '/patients', end: true, label: 'Patient History' },
  { to: '/expenses', end: true, label: 'Expenses' },
  { to: '/categories', end: true, label: 'Charge Category' },
];

const registrationLinks = [
  { to: '/patients/new', end: true, label: 'New Patient' },
  { to: '/patients', end: true, label: 'Patient History' },
];

const clinicianLinks = [
  { to: '/patients', end: true, label: 'Patient History' },
  { to: '/terminology', end: true, label: 'Terminology' },
];

export default function Sidebar({ open, onClose }) {
  const { user } = useAuth();
  const links =
    user?.role === 'registration'
      ? registrationLinks
      : user?.role === 'clinician'
        ? clinicianLinks
        : fullLinks;

  return (
    <>
      <div
        className={`sidebar-overlay ${open ? 'show' : ''}`}
        onClick={onClose}
        aria-hidden={!open}
      />
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-label">Menu</div>
        <nav className="sidebar-nav">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              onClick={onClose}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
