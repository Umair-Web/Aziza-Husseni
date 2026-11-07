import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function fallbackPath(role) {
  if (role === 'registration') return '/patients/new';
  if (role === 'clinician') return '/patients';
  return '/';
}

export default function RoleRoute({ allow, children, redirectTo }) {
  const { user, loading } = useAuth();

  if (loading) return <div className="loading">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (allow && !allow.includes(user.role)) {
    return <Navigate to={redirectTo || fallbackPath(user.role)} replace />;
  }
  return children;
}
