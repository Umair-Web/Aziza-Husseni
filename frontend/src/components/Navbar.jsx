import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar({ onMenuClick }) {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <div className="navbar-left">
        {onMenuClick && (
          <button
            type="button"
            className="menu-btn"
            onClick={onMenuClick}
            aria-label="Open menu"
          >
            ☰
          </button>
        )}
        <Link to="/" className="navbar-brand">
          <div className="navbar-logo">ah</div>
          <div className="navbar-title">
            Aziza Husseni
            <span>Hospital Portal</span>
          </div>
        </Link>
      </div>
      <div className="navbar-actions">
        {user && <span className="nav-user">{user.name}</span>}
        <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
