import React, { useState, useEffect } from 'react';
import { User, Phone, KeyRound, CheckCircle } from 'lucide-react';
import api from '../api';

export default function Profile() {
    const [profile, setProfile] = useState(null);
    const [phone, setPhone] = useState('');
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    
    const [msg, setMsg] = useState({ type: '', text: '' });

    useEffect(() => {
        fetchProfile();
    }, []);

    const fetchProfile = async () => {
        try {
            const res = await api.get('auth/profile/');
            setProfile(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handlePhoneUpdate = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('auth/profile/phone/', { new_phone_number: phone });
            setMsg({ type: 'success', text: res.data.message });
            setPhone('');
            fetchProfile();
        } catch (err) {
            setMsg({ type: 'error', text: err.response?.data?.error || 'Xatolik yuz berdi' });
        }
    };

    const handlePasswordUpdate = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('auth/profile/password/', { 
                old_password: oldPassword, 
                new_password: newPassword 
            });
            setMsg({ type: 'success', text: res.data.message });
            setOldPassword('');
            setNewPassword('');
        } catch (err) {
            setMsg({ type: 'error', text: err.response?.data?.error || 'Xatolik yuz berdi' });
        }
    };

    if (!profile) return <div style={{ color: 'var(--text-main)' }}>Yuklanmoqda...</div>;

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h1 className="text-gradient" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <User size={32} /> Shaxsiy Profil
            </h1>

            {msg.text && (
                <div style={{ 
                    padding: '16px', 
                    borderRadius: '8px', 
                    marginBottom: '24px', 
                    background: msg.type === 'success' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: msg.type === 'success' ? 'var(--success)' : 'var(--danger)',
                    border: `1px solid ${msg.type === 'success' ? 'var(--success)' : 'var(--danger)'}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                }}>
                    <CheckCircle size={20} />
                    {msg.text}
                </div>
            )}

            <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
                <h3 style={{ marginBottom: '16px', color: 'var(--text-main)' }}>Asosiy ma'lumotlar</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <p style={{ color: 'var(--text-muted)' }}>Ism-sharif: <span style={{ color: 'var(--text-main)', fontWeight: '500' }}>{profile.full_name}</span></p>
                    <p style={{ color: 'var(--text-muted)' }}>Telefon raqam: <span style={{ color: 'var(--text-main)', fontWeight: '500' }}>{profile.phone_number}</span></p>
                    {profile.email && <p style={{ color: 'var(--text-muted)' }}>Email: <span style={{ color: 'var(--text-main)', fontWeight: '500' }}>{profile.email}</span></p>}
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>
                {/* Phone Update */}
                <form onSubmit={handlePhoneUpdate} className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ marginBottom: '16px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Phone size={20} /> Telefon raqamni o'zgartirish
                    </h3>
                    <div style={{ position: 'relative', marginBottom: '16px' }}>
                        <Phone size={20} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-muted)' }} />
                        <input 
                            type="text" 
                            className="glass-input" 
                            style={{ paddingLeft: '40px' }} 
                            placeholder="Yangi telefon raqam"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="btn-primary">Saqlash</button>
                </form>

                {/* Password Update */}
                <form onSubmit={handlePasswordUpdate} className="glass-panel" style={{ padding: '24px' }}>
                    <h3 style={{ marginBottom: '16px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <KeyRound size={20} /> Parolni o'zgartirish
                    </h3>
                    <div style={{ position: 'relative', marginBottom: '16px' }}>
                        <KeyRound size={20} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-muted)' }} />
                        <input 
                            type="password" 
                            className="glass-input" 
                            style={{ paddingLeft: '40px' }} 
                            placeholder="Eski parol"
                            value={oldPassword}
                            onChange={(e) => setOldPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div style={{ position: 'relative', marginBottom: '16px' }}>
                        <KeyRound size={20} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-muted)' }} />
                        <input 
                            type="password" 
                            className="glass-input" 
                            style={{ paddingLeft: '40px' }} 
                            placeholder="Yangi parol (min. 6 belgi)"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            required
                        />
                    </div>
                    <button type="submit" className="btn-primary">Saqlash</button>
                </form>
            </div>
        </div>
    );
}
