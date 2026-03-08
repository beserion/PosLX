import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import MobileNav from './components/layout/MobileNav';
import { ToastProvider } from './components/ui/ToastProvider';
import OfflineBanner from './components/ui/OfflineBanner';
import { useMediaQuery } from './hooks/useMediaQuery';
import { useAuthStore } from './store/authStore';
import LoginPage from './pages/LoginPage';
import POSPage from './pages/POSPage';
import ProductsPage from './pages/ProductsPage';
import CourierPage from './pages/CourierPage';
import DashboardPage from './pages/DashboardPage';
import TransactionsPage from './pages/TransactionsPage';
import InvoicesPage from './pages/InvoicesPage';
import AccountsPage from './pages/AccountsPage';
import AccountDetailPage from './pages/AccountDetailPage';
import InvoiceDetailPage from './pages/InvoiceDetailPage';
import LowStockPage from './pages/LowStockPage';
import OrdersPage from './pages/OrdersPage';
import StockMovementsPage from './pages/StockMovementsPage';
import CourierSettlementPage from './pages/CourierSettlementPage';
import SpecialPricesPage from './pages/SpecialPricesPage';
import StaffPage from './pages/StaffPage';
import CancellationLogsPage from './pages/CancellationLogsPage';
import ProductDashboardPage from './pages/ProductDashboardPage';
import SettingsPage from './pages/SettingsPage';

// Cashier can only access POS page
function isCashier(user) {
  return user?.Role === 'Cashier';
}

// Guard wrapper: redirects Cashier to / if they try other routes
function ManagerRoute({ children }) {
  const user = useAuthStore((s) => s.user);
  if (isCashier(user)) return <Navigate to="/" replace />;
  return children;
}

export default function App() {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = !!user;

  if (!isAuthenticated) {
    return (
      <ToastProvider>
        <LoginPage />
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <OfflineBanner />
        <div className="flex min-h-screen">
          {!isMobile && <Sidebar />}
          <main className={`flex-1 p-4 ${isMobile ? 'pb-20' : 'ml-[100px]'}`}>
            <Routes>
              <Route path="/" element={<POSPage />} />
              <Route path="/products" element={<ManagerRoute><ProductsPage /></ManagerRoute>} />
              <Route path="/products/:id/dashboard" element={<ManagerRoute><ProductDashboardPage /></ManagerRoute>} />
              <Route path="/couriers" element={<CourierPage />} />
              <Route path="/dashboard" element={<ManagerRoute><DashboardPage /></ManagerRoute>} />
              <Route path="/transactions" element={<ManagerRoute><TransactionsPage /></ManagerRoute>} />
              <Route path="/invoices" element={<ManagerRoute><InvoicesPage /></ManagerRoute>} />
              <Route path="/invoices/:id" element={<ManagerRoute><InvoiceDetailPage /></ManagerRoute>} />
              <Route path="/accounts" element={<ManagerRoute><AccountsPage /></ManagerRoute>} />
              <Route path="/accounts/:id" element={<ManagerRoute><AccountDetailPage /></ManagerRoute>} />
              <Route path="/low-stock" element={<ManagerRoute><LowStockPage /></ManagerRoute>} />
              <Route path="/stock-movements" element={<ManagerRoute><StockMovementsPage /></ManagerRoute>} />
              <Route path="/courier-settlement" element={<ManagerRoute><CourierSettlementPage /></ManagerRoute>} />
              <Route path="/special-prices" element={<ManagerRoute><SpecialPricesPage /></ManagerRoute>} />
              <Route path="/staff" element={<ManagerRoute><StaffPage /></ManagerRoute>} />
              <Route path="/cancellations" element={<ManagerRoute><CancellationLogsPage /></ManagerRoute>} />
              <Route path="/orders" element={<ManagerRoute><OrdersPage /></ManagerRoute>} />
              <Route path="/settings" element={<ManagerRoute><SettingsPage /></ManagerRoute>} />
              {/* Catch-all: redirect to POS */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          {isMobile && <MobileNav />}
        </div>
      </BrowserRouter>
    </ToastProvider>
  );
}
