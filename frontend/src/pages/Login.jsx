import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { KeyRound, Phone } from 'lucide-react';
import api from '../api';

export default function Login() {
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('auth/login/', { phone_number: phone, password });
            localStorage.setItem('access_token', res.data.access);
            localStorage.setItem('refresh_token', res.data.refresh);
            window.location.href = '/';
        } catch (err) {
            setError(err.response?.data?.non_field_errors?.[0] || 'Login yuborishda xatolik');
        }
    };

    return (
        <div className="auth-container">
            <div className="glass-panel auth-card">
                <h2 style={{ textAlign: 'center', marginBottom: '8px' }} className="text-gradient">Xush Kelibsiz!</h2>
                <p style={{ textAlign: 'center', color: 'var(--text-muted)', marginBottom: '32px' }}>Tizimga kirish uchun malumotlaringizni kiriting</p>

                {error && <div style={{ color: 'var(--danger)', marginBottom: '16px', textAlign: 'center' }}>{error}</div>}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
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
                    <div style={{ position: 'relative' }}>
                        <KeyRound size={20} style={{ position: 'absolute', top: '12px', left: '12px', color: 'var(--text-muted)' }} />
                        <input 
                            type="password" 
                            className="glass-input" 
                            style={{ paddingLeft: '40px' }} 
                            placeholder="Parol"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                        <Link to="/reset-password" style={{ color: 'var(--primary)', textDecoration: 'none', fontSize: '14px' }}>Parolni unutdingizmi?</Link>
                    </div>
                    <button type="submit" className="btn-primary" style={{ marginTop: '12px' }}>Kirish</button>
                </form>

                <p style={{ textAlign: 'center', marginTop: '24px', color: 'var(--text-muted)' }}>
                    Hisobingiz yo'qmi? <Link to="/register" style={{ color: 'var(--accent)', textDecoration: 'none' }}>Ro'yxatdan o'tish</Link>
                </p>
            </div>
        </div>
    );
}
