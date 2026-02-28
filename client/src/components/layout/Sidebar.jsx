import { NavLink } from 'react-router-dom';
import { ShoppingCart, Truck, LayoutDashboard, Package, BoxesIcon, Receipt, ClipboardList, Users, AlertTriangle, ShoppingBag } from 'lucide-react';

const links = [
    { to: '/', icon: ShoppingCart, label: 'POS' },
    { to: '/products', icon: BoxesIcon, label: 'Ürünler' },
    { to: '/couriers', icon: Truck, label: 'Couriers' },
    { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { to: '/transactions', icon: Receipt, label: 'Hesaplar' },
    { to: '/invoices', icon: ClipboardList, label: 'Faturalar' },
    { to: '/accounts', icon: Users, label: 'Cariler' },
    { to: '/low-stock', icon: AlertTriangle, label: 'Min Stock' },
    { to: '/orders', icon: ShoppingBag, label: 'Siparişler' },
];

export default function Sidebar() {
    return (
        <aside className="glass-card-static flex flex-col items-center py-6 px-2 gap-2 w-[72px] min-h-screen fixed left-0 top-0 z-50"
            style={{ borderRadius: '0 16px 16px 0' }}>
            {/* Logo */}
            <div className="flex items-center justify-center w-11 h-11 rounded-xl mb-6"
                style={{ background: 'linear-gradient(135deg, #06b6d4, #10b981)' }}>
                <Package size={22} className="text-white" />
            </div>

            {/* Nav Links */}
            <nav className="flex flex-col gap-1 flex-1">
                {links.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        className={({ isActive }) =>
                            `flex flex-col items-center gap-1 px-3 py-3 rounded-xl text-xs font-medium transition-all duration-200 group
               ${isActive
                                ? 'text-cyan-accent bg-cyan-accent/10 box-glow-cyan'
                                : 'text-text-muted hover:text-text-primary hover:bg-white/5'}`
                        }
                    >
                        <Icon size={20} />
                        <span className="leading-none">{label}</span>
                    </NavLink>
                ))}
            </nav>

            {/* Version tag */}
            <span className="text-[10px] text-text-muted/50 font-mono">v1.1</span>
        </aside>
    );
}
