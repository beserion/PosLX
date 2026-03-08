import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import {
    ShoppingCart,
    Truck,
    LayoutDashboard,
    Package,
    BoxesIcon,
    Receipt,
    ClipboardList,
    Users,
    AlertTriangle,
    BarChart3,
    PercentCircle,
    Settings,
    LogOut,
} from 'lucide-react';

const links = [
    { to: '/', icon: ShoppingCart, label: 'POS', cashier: true },
    { to: '/products', icon: BoxesIcon, label: 'Ürünler' },
    { to: '/couriers', icon: Truck, label: 'Kuryeler', cashier: true },
    { to: '/dashboard', icon: LayoutDashboard, label: 'G. Panel' },
    { to: '/transactions', icon: Receipt, label: 'Hesaplar' },
    { to: '/invoices', icon: ClipboardList, label: 'Faturalar' },
    { to: '/accounts', icon: Users, label: 'Cariler' },
    { to: '/low-stock', icon: AlertTriangle, label: 'Min Stock' },
    { to: '/stock-movements', icon: BarChart3, label: 'Ürün Rpr.' },
    { to: '/courier-settlement', icon: Truck, label: 'Kurye Rpr.' },
    { to: '/special-prices', icon: PercentCircle, label: 'Özel Fiyat' },
    { to: '/staff', icon: Users, label: 'Personel' },
    { to: '/settings', icon: Settings, label: 'Ayarlar' },
];

export default function Sidebar() {
    const user = useAuthStore((s) => s.user);
    const logout = useAuthStore((s) => s.logout);
    const isCashier = user?.Role === 'Cashier';

    const visibleLinks = isCashier
        ? links.filter((l) => l.cashier)
        : links;

    return (
        <aside
            className="glass-card-static flex flex-col items-center py-3 px-1.5 w-[100px] h-screen fixed left-0 top-0 z-50"
            style={{ borderRadius: '0 16px 16px 0' }}
        >
            {/* Logo */}
            <div
                className="flex items-center justify-center w-10 h-10 rounded-xl mb-3 shrink-0"
                style={{ background: 'linear-gradient(135deg, #06b6d4, #10b981)' }}
            >
                <Package size={20} className="text-white" />
            </div>

            {/* Nav Links */}
            <nav className="flex flex-col gap-4.5 flex-1 w-full overflow-hidden">
                {visibleLinks.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                            `flex flex-col items-center gap-1 px-1 py-1 rounded-xl text-[12px] font-medium transition-all duration-200 w-full
               ${isActive
                                ? 'text-cyan-accent bg-cyan-accent/10 box-glow-cyan'
                                : 'text-text-muted hover:text-text-primary hover:bg-white/5'}`
                        }
                    >
                        <Icon size={18} className="shrink-0" />
                        <span className="leading-none text-center truncate w-full">{label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* User info + Logout */}
            <div className="flex flex-col items-center gap-1 mt-1 w-full shrink-0">
                {user && (
                    <span className="text-[9px] text-text-muted text-center leading-tight truncate px-1 w-full">
                        {user.Name}
                    </span>
                )}
                <button
                    onClick={logout}
                    className="flex flex-col items-center gap-1 w-full px-1 py-1.5 rounded-xl text-[10px] font-medium text-text-muted hover:text-red-400 hover:bg-red-400/10 transition-all duration-200 cursor-pointer"
                    title="Çıkış Yap"
                >
                    <LogOut size={16} />
                    <span className="leading-none">Çıkış</span>
                </button>
                <span className="text-[9px] text-text-muted/50 font-mono">v1.1</span>
            </div>
        </aside>
    );
}
