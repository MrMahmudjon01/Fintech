import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import {
    LayoutDashboard, Receipt, LogOut, Wallet, User,
    Moon, Sun, Tags, CreditCard, PiggyBank, Bell, Sparkles, Menu, X
} from 'lucide-react';
import api from '../api';

const NAV_ITEMS = [
    { to: '/',              icon: <LayoutDashboard size={20} />, label: 'Asosiy Panel' },
    { to: '/transactions',  icon: <Receipt size={20} />,         label: 'Tranzaksiyalar' },
    { to: '/categories',    icon: <Tags size={20} />,            label: 'Kategoriyalar' },
    { to: '/debts',         icon: <CreditCard size={20} />,      label: 'Qarzlar' },
    { to: '/savings',       icon: <PiggyBank size={20} />,       label: "Jamg'arma" },
    { to: '/notifications', icon: <Bell size={20} />,            label: 'Bildirishnomalar', badge: true },
    { to: '/ai-chat',       icon: <Sparkles size={20} />,        label: 'AI Maslahatchi' },
    { to: '/profile',       icon: <User size={20} />,            label: 'Profil' },
];

export default function Layout() {
    const navigate = useNavigate();
    const location = useLocation();
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [unreadCount, setUnreadCount] = useState(0);
    const [mobileOpen, setMobileOpen] = useState(false);
    const sidebarRef = useRef(null);

    // Close sidebar on route change
    useEffect(() => { setMobileOpen(false); }, [location.pathname]);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (mobileOpen && sidebarRef.current && !sidebarRef.current.contains(e.target)) {
                setMobileOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        document.addEventListener('touchstart', handler);
        return () => {
            document.removeEventListener('mousedown', handler);
            document.removeEventListener('touchstart', handler);
        };
    }, [mobileOpen]);

    // Prevent body scroll when mobile menu is open
    useEffect(() => {
        document.body.style.overflow = mobileOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [mobileOpen]);

    useEffect(() => {
        const fetchUnread = async () => {
            try {
                const res = await api.get('finance/notifications/unread_count/');
                setUnreadCount(res.data.count);
            } catch (e) {}
        };
        fetchUnread();
        const interval = setInterval(fetchUnread, 30000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (theme === 'light') {
            document.body.classList.add('light');
        } else {
            document.body.classList.remove('light');
        }
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

    const handleLogout = async () => {
        try {
            const refresh = localStorage.getItem('refresh_token');
            if (refresh) await api.post('auth/logout/', { refresh });
        } catch (e) {
            console.error(e);
        } finally {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            navigate('/login');
        }
    };

    const isActive = (path) => {
        if (path === '/') return location.pathname === '/';
        return location.pathname.startsWith(path);
    };

    const NavLink = ({ item }) => (
        <Link
            to={item.to}
            style={{
                ...navLinkStyle,
                background: isActive(item.to) ? 'rgba(139,92,246,0.15)' : 'transparent',
                color: isActive(item.to) ? 'var(--primary)' : 'var(--text-main)',
                borderLeft: isActive(item.to) ? '3px solid var(--primary)' : '3px solid transparent',
                position: 'relative',
            }}
        >
            {item.icon}
            {item.label}
            {item.badge && unreadCount > 0 && (
                <span style={{
                    background: 'var(--danger)', color: 'white',
                    fontSize: '10px', padding: '1px 5px',
                    borderRadius: '10px', fontWeight: '700', marginLeft: 'auto'
                }}>{unreadCount}</span>
            )}
        </Link>
    );

    const SidebarContent = () => (
        <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: 'var(--primary)', padding: '8px', borderRadius: '8px' }}>
                        <Wallet size={22} color="white" />
                    </div>
                    <h2 className="text-gradient" style={{ margin: 0, fontSize: '22px' }}>FinX</h2>
                </div>
                {/* Mobile close button */}
                <button
                    className="mobile-close-btn"
                    onClick={() => setMobileOpen(false)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', display: 'none' }}
                >
                    <X size={22} />
                </button>
            </div>

            <nav style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                {NAV_ITEMS.map((item) => (
                    <NavLink key={item.to} item={item} />
                ))}
            </nav>

            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '16px', borderTop: '1px solid var(--border)' }}>
                <button onClick={toggleTheme} style={{ ...navLinkStyle, background: 'var(--bg-card)', border: '1px solid var(--border)', cursor: 'pointer', justifyContent: 'flex-start' }}>
                    {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
                    {theme === 'light' ? 'Tun rejimi' : 'Kun rejimi'}
                </button>
                <button onClick={handleLogout} style={{ ...navLinkStyle, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger)', justifyContent: 'flex-start' }}>
                    <LogOut size={20} /> Chiqish
                </button>
            </div>
        </>
    );

    return (
        <div className="app-container">
            {/* ── Desktop Sidebar ──────────────────────────────── */}
            <aside className="sidebar desktop-sidebar">
                <SidebarContent />
            </aside>

            {/* ── Mobile Header Bar ────────────────────────────── */}
            <header className="mobile-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ background: 'var(--primary)', padding: '6px', borderRadius: '7px' }}>
                        <Wallet size={18} color="white" />
                    </div>
                    <h2 className="text-gradient" style={{ margin: 0, fontSize: '20px' }}>FinX</h2>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {unreadCount > 0 && (
                        <Link to="/notifications" style={{ position: 'relative', color: 'var(--text-muted)', display: 'flex' }}>
                            <Bell size={22} />
                            <span style={{
                                position: 'absolute', top: '-4px', right: '-4px',
                                background: 'var(--danger)', color: 'white',
                                fontSize: '9px', padding: '1px 4px',
                                borderRadius: '8px', fontWeight: '700'
                            }}>{unreadCount}</span>
                        </Link>
                    )}
                    <button onClick={() => setMobileOpen(true)} style={{
                        background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer',
                        padding: '4px', display: 'flex', alignItems: 'center'
                    }}>
                        <Menu size={26} />
                    </button>
                </div>
            </header>

            {/* ── Mobile Drawer Overlay ─────────────────────────── */}
            {mobileOpen && (
                <div
                    style={{
                        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
                        zIndex: 200, backdropFilter: 'blur(2px)'
                    }}
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* ── Mobile Drawer Sidebar ─────────────────────────── */}
            <aside
                ref={sidebarRef}
                className={`sidebar mobile-drawer ${mobileOpen ? 'mobile-drawer--open' : ''}`}
            >
                <SidebarContent />
            </aside>

            {/* ── Main Content ──────────────────────────────────── */}
            <main className="main-content">
                <Outlet />
            </main>

            <style>{`
                .desktop-sidebar { display: flex; }
                .mobile-header { display: none; }
                .mobile-drawer { display: none; }

                @media (max-width: 768px) {
                    .desktop-sidebar { display: none !important; }
                    .mobile-header {
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        padding: 12px 16px;
                        background: var(--bg-card);
                        border-bottom: 1px solid var(--border);
                        position: fixed;
                        top: 0; left: 0; right: 0;
                        z-index: 100;
                        height: 56px;
                        backdrop-filter: blur(10px);
                        -webkit-backdrop-filter: blur(10px);
                    }
                    .mobile-close-btn { display: flex !important; }
                    .app-container {
                        flex-direction: column;
                    }
                    .main-content {
                        padding: 16px !important;
                        padding-top: calc(56px + 16px) !important;
                        overflow-y: auto;
                    }
                    .mobile-drawer {
                        display: flex !important;
                        position: fixed;
                        top: 0; left: 0;
                        height: 100vh;
                        width: 270px;
                        z-index: 300;
                        transform: translateX(-100%);
                        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                        overflow-y: auto;
                    }
                    .mobile-drawer--open {
                        transform: translateX(0);
                    }
                }
            `}</style>
        </div>
    );
}

const navLinkStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '11px 14px',
    color: 'var(--text-main)',
    textDecoration: 'none',
    borderRadius: '8px',
    transition: 'all 0.15s ease',
    fontSize: '15px',
    fontWeight: '500',
    width: '100%',
};
