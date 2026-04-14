import React, { useEffect, useState } from 'react';
import { Bell, CheckCheck, AlertCircle, Info } from 'lucide-react';
import api from '../api';

export default function Notifications() {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => { fetchNotifications(); }, []);

    const fetchNotifications = async () => {
        try {
            const res = await api.get('finance/notifications/');
            setNotifications(res.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const markAsRead = async (id) => {
        try {
            await api.patch(`finance/notifications/${id}/`, { is_read: true });
            setNotifications(notifications.map(n => n.id === id ? {...n, is_read: true} : n));
        } catch (e) { console.error(e); }
    };

    const markAllRead = async () => {
        try {
            await api.post('finance/notifications/mark_all_read/');
            setNotifications(notifications.map(n => ({...n, is_read: true})));
        } catch (e) { console.error(e); }
    };

    const handleDelete = async (id) => {
        try {
            await api.delete(`finance/notifications/${id}/`);
            setNotifications(notifications.filter(n => n.id !== id));
        } catch (e) { console.error(e); }
    };

    if (loading) return <div>Yuklanmoqda...</div>;

    const unreadCount = notifications.filter(n => !n.is_read).length;

    const getIcon = (type) => {
        switch(type) {
            case 'REMINDER': return <AlertCircle size={20} color="var(--accent)" />;
            case 'AI': return <Info size={20} color="var(--primary)" />;
            default: return <Bell size={20} color="var(--text-muted)" />;
        }
    };

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 className="text-gradient" style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                    <Bell size={32} /> Bildirishnomalar
                    {unreadCount > 0 && (
                        <span style={{
                            background: 'var(--danger)',
                            color: 'white',
                            fontSize: '14px',
                            padding: '2px 10px',
                            borderRadius: '12px',
                            fontWeight: '600'
                        }}>{unreadCount}</span>
                    )}
                </h1>
                {unreadCount > 0 && (
                    <button onClick={markAllRead} className="btn-primary" style={{ width: 'auto', padding: '8px 16px', fontSize: '14px' }}>
                        <CheckCheck size={18} /> Hammasini o'qildi
                    </button>
                )}
            </div>

            <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {notifications.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '32px 0' }}>Bildirishnomalar yo'q</p>
                    ) : notifications.map(n => (
                        <div key={n.id} style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '16px',
                            padding: '16px',
                            background: n.is_read ? 'rgba(15, 23, 42, 0.2)' : 'rgba(139, 92, 246, 0.08)',
                            borderRadius: '12px',
                            border: `1px solid ${n.is_read ? 'var(--border)' : 'rgba(139, 92, 246, 0.3)'}`,
                            cursor: !n.is_read ? 'pointer' : 'default',
                            transition: 'background 0.2s ease'
                        }}
                        onClick={() => !n.is_read && markAsRead(n.id)}
                        >
                            <div style={{ marginTop: '2px' }}>{getIcon(n.type)}</div>
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: n.is_read ? '400' : '600', fontSize: '16px', marginBottom: '4px' }}>
                                    {n.title}
                                </div>
                                <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>{n.message}</div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
                                    {new Date(n.created_at).toLocaleString()}
                                </div>
                            </div>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(n.id); }} style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                cursor: 'pointer',
                                fontSize: '12px',
                                opacity: 0.6
                            }}>✕</button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
