import { Routes, Route, useLocation } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import ReceiptCapture from './pages/ReceiptCapture';
import Profile from './pages/Profile';

function AppRoutes() {
  const location = useLocation();
  const hideNav = location.pathname === '/capture';

  return (
    <div className="relative">
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/capture" element={<ReceiptCapture />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
      {!hideNav && <BottomNav />}
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <AppRoutes />
    </AppProvider>
  );
}
