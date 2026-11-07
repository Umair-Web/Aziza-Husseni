import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConfirmProvider } from './components/ConfirmDialog';
import PrivateRoute from './components/PrivateRoute';
import RoleRoute from './components/RoleRoute';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Overview from './pages/Overview';
import PatientHistory from './pages/PatientHistory';
import Categories from './pages/Categories';
import Expenses from './pages/Expenses';
import CreatePatient from './pages/CreatePatient';
import PatientDetail from './pages/PatientDetail';
import Terminology from './pages/Terminology';

function homePath(role) {
  if (role === 'registration') return '/patients/new';
  if (role === 'clinician') return '/patients';
  return '/';
}

function PublicOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading">Loading...</div>;
  if (user) {
    return <Navigate to={homePath(user.role)} replace />;
  }
  return children;
}

function HomeRedirect() {
  const { user } = useAuth();
  if (user?.role === 'registration') {
    return <Navigate to="/patients/new" replace />;
  }
  if (user?.role === 'clinician') {
    return <Navigate to="/patients" replace />;
  }
  return <Overview />;
}

export default function App() {
  return (
    <AuthProvider>
      <ConfirmProvider>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnly>
                <Login />
              </PublicOnly>
            }
          />
          <Route
            element={
              <PrivateRoute>
                <AppLayout />
              </PrivateRoute>
            }
          >
            <Route path="/" element={<HomeRedirect />} />
            <Route
              path="/patients"
              element={
                <RoleRoute allow={['admin', 'staff', 'registration', 'clinician']}>
                  <PatientHistory />
                </RoleRoute>
              }
            />
            <Route
              path="/expenses"
              element={
                <RoleRoute allow={['admin', 'staff']}>
                  <Expenses />
                </RoleRoute>
              }
            />
            <Route
              path="/categories"
              element={
                <RoleRoute allow={['admin', 'staff']}>
                  <Categories />
                </RoleRoute>
              }
            />
            <Route
              path="/terminology"
              element={
                <RoleRoute allow={['clinician']}>
                  <Terminology />
                </RoleRoute>
              }
            />
            <Route
              path="/patients/new"
              element={
                <RoleRoute allow={['admin', 'staff', 'registration']}>
                  <CreatePatient />
                </RoleRoute>
              }
            />
            <Route
              path="/patients/:id"
              element={
                <RoleRoute allow={['admin', 'staff', 'registration', 'clinician']}>
                  <PatientDetail />
                </RoleRoute>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      </ConfirmProvider>
    </AuthProvider>
  );
}
