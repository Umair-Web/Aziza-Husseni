import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();

  return (
    <nav className="navbar">
      <Link to="/" className="navbar-brand">
        <div className="navbar-logo">ah</div>
        <div className="navbar-title">
          Aziza Husseni
          <span>Hospital Portal</span>
        </div>
      </Link>
      <div className="navbar-actions">
        {user && <span className="nav-user">{user.name}</span>}
        <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
          Logout
        </button>
      </div>
    </nav>
  );
}
