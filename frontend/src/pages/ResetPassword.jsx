import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Phone, KeyRound, Mail } from 'lucide-react';
import api from '../api';

export default function ResetPassword() {
    const [step, setStep] = useState(1);
    const [phone, setPhone] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [error, setError] = useState('');
    const [msg, setMsg] = useState('');
    const navigate = useNavigate();

    const handleStart = async (e) => {
        e.preventDefault();
        setError('');
        setMsg('');
        try {
            const res = await api.post('auth/password/reset/start/', { phone_number: phone });
            setMsg(res.data.message);
            setStep(2);
        } catch (err) {
            setError(err.response?.data?.error || 'Xatolik yuz berdi');
        }
    };

    const handleConfirm = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const res = await api.post('auth/password/reset/confirm/', { 
                phone_number: phone,
                verification_code: otp,
                new_password: newPassword
            });
            alert(res.data.message);
            navigate('/login');
        } catch (err) {
            setError(err.response?.data?.error || "Kodni tekshirishda xatolik");
        }
    };

    return (
        <div className="auth-container">
            <div className="glass-panel auth-card">
                <h2 style={{ textAlign: 'center', marginBottom: '8px' }} className="text-gradient">Parolni tiklash</h2>
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '32px' }}>
                    {step === 1 ? "Ro'yxatdan o'tgan telefon raqamingizni kiriting" : "Emailingizga yuborilgan kodni va yangi parolni kiriting"}
                </p>

                {error && <div style={{ color: 'var(--danger)', marginBottom: '16px', textAlign: 'center' }}>{error}</div>}
                {msg && <div style={{ color: 'var(--success)', marginBottom: '16px', textAlign: 'center' }}>{msg}</div>}

                {step === 1 ? (
                    <form onSubmit={handleStart} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ position: 'relative' }}>
                            <Phone size={20} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-muted)' }} />
                            <input 
                                type="text" 
                                className="glass-input" 
                                style={{ paddingLeft: '40px' }} 
                                placeholder="+998901234567"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" className="btn-primary" style={{ marginTop: '12px' }}>Kod yuborish</button>
                    </form>
                ) : (
                    <form onSubmit={handleConfirm} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ position: 'relative' }}>
                            <Mail size={20} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-muted)' }} />
                            <input 
                                type="text" 
                                className="glass-input" 
                                style={{ paddingLeft: '40px' }} 
                                placeholder="Tasdiqlash kodi"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                required
                            />
                        </div>
                        <div style={{ position: 'relative' }}>
                            <KeyRound size={20} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-muted)' }} />
                            <input 
                                type="password" 
                                className="glass-input" 
                                style={{ paddingLeft: '40px' }} 
                                placeholder="Yangi parol"
                                value={newPassword}
                                onChange={(e) => setNewPassword(e.target.value)}
                                required
                            />
                        </div>
                        <button type="submit" className="btn-primary" style={{ marginTop: '12px' }}>Parolni tiklash</button>
                    </form>
                )}

                <p style={{ textAlign: 'center', marginTop: '24px', color: 'var(--text-muted)' }}>
                    <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Ortga qaytish</Link>
                </p>
            </div>
        </div>
    );
}
