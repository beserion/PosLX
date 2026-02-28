import { NavLink } from 'react-router-dom';
import { ShoppingCart, Truck, LayoutDashboard, BoxesIcon, Receipt, ClipboardList, Users, AlertTriangle, ShoppingBag } from 'lucide-react';

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

export default function MobileNav() {
    return (
        <nav className="fixed bottom-0 left-0 right-0 z-50 glass-card-static flex items-center justify-around h-16 px-2"
            style={{ borderRadius: '16px 16px 0 0' }}>
            {links.map(({ to, icon: Icon, label }) => (
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
        </nav>
    );
}
