import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Phone, User, Lock, Mail, KeyRound } from 'lucide-react';
import api from '../api';

export default function Register() {
    const [step, setStep] = useState(1);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    // Form data
    const [formData, setFormData] = useState({
        full_name: '', phone_number: '', password: '', email: '', verification_code: ''
    });

    const updateForm = (key, val) => setFormData({ ...formData, [key]: val });

    const handleStep1 = async (e) => {
        e.preventDefault();
        try {
            await api.post('auth/register/start/', { 
                full_name: formData.full_name, 
                phone_number: formData.phone_number, 
                password: formData.password 
            });
            setError('');
            setStep(2);
        } catch (err) {
            setError(JSON.stringify(err.response?.data));
        }
    };

    const handleStep2 = async (e) => {
        e.preventDefault();
        try {
            await api.post('auth/register/verify/', { 
                phone_number: formData.phone_number, 
                email: formData.email 
            });
            setError('');
            setStep(3);
        } catch (err) {
            setError(JSON.stringify(err.response?.data));
        }
    };

    const handleStep3 = async (e) => {
        e.preventDefault();
        try {
            await api.post('auth/register/confirm/', { 
                phone_number: formData.phone_number, 
                verification_code: formData.verification_code 
            });
            navigate('/login');
        } catch (err) {
            setError(JSON.stringify(err.response?.data));
        }
    };

    return (
        <div className="auth-container">
            <div className="glass-panel auth-card">
                <h2 style={{ textAlign: 'center', marginBottom: '8px' }} className="text-gradient">Ro'yxatdan O'tish</h2>
                <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '24px' }}>
                    <div style={{ height: '4px', width: '30%', background: step >= 1 ? 'var(--primary)' : 'var(--border)', borderRadius: '4px' }}></div>
                    <div style={{ height: '4px', width: '30%', background: step >= 2 ? 'var(--primary)' : 'var(--border)', borderRadius: '4px' }}></div>
                    <div style={{ height: '4px', width: '30%', background: step >= 3 ? 'var(--primary)' : 'var(--border)', borderRadius: '4px' }}></div>
                </div>

                {error && <div style={{ color: 'var(--danger)', marginBottom: '16px', fontSize: '14px' }}>{error}</div>}

                {step === 1 && (
                    <form onSubmit={handleStep1} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div style={{ position: 'relative' }}>
                            <User size={20} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-muted)' }} />
                            <input type="text" className="glass-input" style={{ paddingLeft: '40px' }} placeholder="To'liq ismingiz" required
                                value={formData.full_name} onChange={(e) => updateForm('full_name', e.target.value)} />
                        </div>
                        <div style={{ position: 'relative' }}>
                            <Phone size={20} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-muted)' }} />
                            <input type="text" className="glass-input" style={{ paddingLeft: '40px' }} placeholder="+998901234567" required
                                value={formData.phone_number} onChange={(e) => updateForm('phone_number', e.target.value)} />
                        </div>
                        <div style={{ position: 'relative' }}>
                            <Lock size={20} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-muted)' }} />
                            <input type="password" className="glass-input" style={{ paddingLeft: '40px' }} placeholder="Parol (min 6 harf)" required
                                value={formData.password} onChange={(e) => updateForm('password', e.target.value)} />
                        </div>
                        <button type="submit" className="btn-primary">Davom etish</button>
                    </form>
                )}

                {step === 2 && (
                    <form onSubmit={handleStep2} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '14px' }}>Elektron pochta manzilingizni kiriting. Biz tasdiqlash kodini yuboramiz.</p>
                        <div style={{ position: 'relative' }}>
                            <Mail size={20} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-muted)' }} />
                            <input type="email" className="glass-input" style={{ paddingLeft: '40px' }} placeholder="Email (misol@mail.com)" required
                                value={formData.email} onChange={(e) => updateForm('email', e.target.value)} />
                        </div>
                        <button type="submit" className="btn-primary">Kodni olish</button>
                    </form>
                )}

                {step === 3 && (
                    <form onSubmit={handleStep3} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <p style={{ color: 'var(--text-muted)', textAlign: 'center', fontSize: '14px' }}>Konsolga (yoki pochtaga) kelgan 6 xonali kodni kiriting.</p>
                        <div style={{ position: 'relative' }}>
                            <KeyRound size={20} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-muted)' }} />
                            <input type="text" className="glass-input" style={{ paddingLeft: '40px' }} placeholder="123456" maxLength={6} required
                                value={formData.verification_code} onChange={(e) => updateForm('verification_code', e.target.value)} />
                        </div>
                        <button type="submit" className="btn-primary">Tasdiqlash</button>
                    </form>
                )}

                <p style={{ textAlign: 'center', marginTop: '24px', color: 'var(--text-muted)' }}>
                    Akkauntingiz bormi? <Link to="/login" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Kirish</Link>
                </p>
            </div>
        </div>
    );
}
