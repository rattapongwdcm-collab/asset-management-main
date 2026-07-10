import { Routes, Route } from 'react-router-dom';

import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import Approve from './pages/Approve';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Device from './pages/Device';
import Repair from './pages/Repair';
// import Rent from './pages/Rent';
import HistoryPage from './pages/HistoryPage'; // ➕ 1. Import หน้า HistoryPage เข้ามา

import PageNotFound from './lib/PageNotFound';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/"element={<Dashboard />} />
          <Route path="/device" element={<Device />} />
          <Route path="/repair" element={<Repair />} />
          {/* <Route path="/rent" element={<Rent />} /> */}
          <Route path="/approve" element={<Approve />} />
          
          {/* ➕ 2. เพิ่ม Route เส้นทางสำหรับหน้า History */}
          <Route path="/history" element={<HistoryPage />} /> 
        </Route>
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

export default App;