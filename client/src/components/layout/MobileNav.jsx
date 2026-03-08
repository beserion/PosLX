import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
    ShoppingCart,
    Truck,
    LayoutDashboard,
    BoxesIcon,
    Receipt,
    ClipboardList,
    Users,
    AlertTriangle,
    LogOut,
} from 'lucide-react';

const links = [
    { to: '/', icon: ShoppingCart, label: 'POS', cashier: true },
    { to: '/products', icon: BoxesIcon, label: 'Ürünler' },
    { to: '/couriers', icon: Truck, label: 'Couriers', cashier: true },
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/transactions', icon: Receipt, label: 'Hesaplar' },
    { to: '/invoices', icon: ClipboardList, label: 'Faturalar' },
    { to: '/accounts', icon: Users, label: 'Cariler' },
    { to: '/low-stock', icon: AlertTriangle, label: 'Min Stock' },
];

export default function MobileNav() {
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);
    const isCashier = user?.Role === 'Cashier';

    const visibleLinks = isCashier
        ? links.filter((l) => l.cashier)
        : links;

    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 glass-card-static flex items-center justify-around h-16 px-2"
            style={{ borderRadius: '16px 16px 0 0' }}>
            {visibleLinks.map(({ to, icon: Icon, label }) => (
                <NavLink
                    key={to}
                    to={to}
                    className={({ isActive }) =>
                        `flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[11px] font-medium transition-all duration-200
             ${isActive
                            ? 'text-cyan-accent box-glow-cyan'
                            : 'text-text-muted'}`
                    }
                >
                    <Icon size={18} />
                    <span>{label}</span>
                </NavLink>
            ))}
            {/* Logout */}
            <button
                onClick={logout}
                className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl text-[11px] font-medium text-text-muted hover:text-red-400 transition-all duration-200 cursor-pointer"
            >
                <LogOut size={18} />
                <span>Çıkış</span>
            </button>
        </nav>
    );
}
