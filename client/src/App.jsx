import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Sidebar from './components/layout/Sidebar';
import MobileNav from './components/layout/MobileNav';
import { ToastProvider } from './components/ui/ToastProvider';
import OfflineBanner from './components/ui/OfflineBanner';
import { useMediaQuery } from './hooks/useMediaQuery';
import POSPage from './pages/POSPage';
import ProductsPage from './pages/ProductsPage';
import CourierPage from './pages/CourierPage';
import DashboardPage from './pages/DashboardPage';
import TransactionsPage from './pages/TransactionsPage';
import InvoicesPage from './pages/InvoicesPage';
import AccountsPage from './pages/AccountsPage';
import AccountDetailPage from './pages/AccountDetailPage';
import LowStockPage from './pages/LowStockPage';
import OrdersPage from './pages/OrdersPage';

export default function App() {
  const isMobile = useMediaQuery('(max-width: 767px)');

  return (
    <ToastProvider>
      <BrowserRouter>
        <OfflineBanner />
        <div className="flex min-h-screen">
          {!isMobile && <Sidebar />}
          <main className={`flex-1 p-4 ${isMobile ? 'pb-20' : 'ml-[72px]'}`}>
            <Routes>
              <Route path="/" element={<POSPage />} />
              <Route path="/products" element={<ProductsPage />} />
              <Route path="/couriers" element={<CourierPage />} />
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/transactions" element={<TransactionsPage />} />
              <Route path="/invoices" element={<InvoicesPage />} />
              <Route path="/accounts" element={<AccountsPage />} />
              <Route path="/accounts/:id" element={<AccountDetailPage />} />
              <Route path="/low-stock" element={<LowStockPage />} />
              <Route path="/orders" element={<OrdersPage />} />
            </Routes>
          </main>
          {isMobile && <MobileNav />}
        </div>
      </BrowserRouter>
    </ToastProvider>
  );
}
