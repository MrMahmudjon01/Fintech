import React, { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Receipt, LogOut, Wallet, User, Moon, Sun, Tags, CreditCard, PiggyBank, Bell } from 'lucide-react';
import api from '../api';

export default function Layout() {
    const navigate = useNavigate();
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
    const [unreadCount, setUnreadCount] = useState(0);

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

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    const handleLogout = async () => {
        try {
            const refresh = localStorage.getItem('refresh_token');
            if (refresh) {
                await api.post('auth/logout/', { refresh });
            }
        } catch (e) {
            console.error(e);
        } finally {
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            navigate('/login');
        }
    };

    return (
        <div className="app-container">
            <aside className="sidebar">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '32px' }}>
                    <div style={{ background: 'var(--primary)', padding: '8px', borderRadius: '8px' }}>
                        <Wallet size={24} color="white" />
                    </div>
                    <h2 className="text-gradient" style={{ margin: 0, fontSize: '24px' }}>FinX</h2>
                </div>

                <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                    <Link to="/" style={navLinkStyle}>
                        <LayoutDashboard size={20} /> Asosiy Panel
                    </Link>
                    <Link to="/transactions" style={navLinkStyle}>
                        <Receipt size={20} /> Tranzaksiyalar
                    </Link>
                    <Link to="/categories" style={navLinkStyle}>
                        <Tags size={20} /> Kategoriyalar
                    </Link>
                    <Link to="/debts" style={navLinkStyle}>
                        <CreditCard size={20} /> Qarzlar
                    </Link>
                    <Link to="/savings" style={navLinkStyle}>
                        <PiggyBank size={20} /> Jamg'arma
                    </Link>
                    <Link to="/notifications" style={{...navLinkStyle, position: 'relative'}}>
                        <Bell size={20} /> Bildirishnomalar
                        {unreadCount > 0 && (
                            <span style={{
                                background: 'var(--danger)',
                                color: 'white',
                                fontSize: '11px',
                                padding: '1px 6px',
                                borderRadius: '10px',
                                fontWeight: '700',
                                marginLeft: 'auto'
                            }}>{unreadCount}</span>
                        )}
                    </Link>
                    <Link to="/profile" style={navLinkStyle}>
                        <User size={20} /> Profil
                    </Link>
                </nav>

                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button onClick={toggleTheme} style={{ ...navLinkStyle, background: 'var(--bg-card)', border: '1px solid var(--border)', cursor: 'pointer' }}>
                        {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />} 
                        {theme === 'light' ? 'Tun rejimi' : 'Kun rejimi'}
                    </button>
                    <button onClick={handleLogout} style={{ ...navLinkStyle, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}>
                        <LogOut size={20} /> Chiqish
                    </button>
                </div>
            </aside>
            <main className="main-content">
                <Outlet />
            </main>
        </div>
    );
}

const navLinkStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    color: 'var(--text-main)',
    textDecoration: 'none',
    borderRadius: '8px',
    transition: 'background 0.2s ease',
    fontSize: '16px',
    fontWeight: '500'
};
