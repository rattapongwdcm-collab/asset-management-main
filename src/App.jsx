import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Approve from './pages/Approve';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Device from './pages/Device';
import Repair from './pages/Repair';
import HistoryPage from './pages/HistoryPage';
import AdminAccounts from './pages/AdminAccounts';
import AdminDeviceEdit from './pages/AdminDeviceEdit';
import PageNotFound from './lib/PageNotFound';
import Accessories from './pages/Accessories';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/device" element={<Device />} />
          <Route path="/accessories" element={<Accessories />} />
          <Route path="/repair" element={<Repair />} />
          <Route path="/approve" element={<Approve />} />
          <Route path="/history" element={<HistoryPage />} />

          {/* ✅ ซ้อน AdminRoute เข้าไปอีกชั้น เฉพาะ route ที่ต้องเป็น admin เท่านั้น */}
          <Route element={<AdminRoute />}>
            <Route path="/admin/accounts" element={<AdminAccounts />} />
            <Route path="/admin/devices" element={<AdminDeviceEdit />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

export default App;