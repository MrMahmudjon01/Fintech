import React, { useEffect, useState } from 'react';
import {
    PiggyBank, Trash2, Target, CheckCircle,
    Wallet, ShieldCheck, History, X, TrendingUp, TrendingDown,
    ArrowRight, AlertTriangle, Check, AlertCircle
} from 'lucide-react';
import api from '../api';
import { formatMoney } from '../utils/format';

const TX_TYPE_CONFIG = {
    SAVINGS_DEPOSIT: { label: "Jamg'armaga kirim", color: 'var(--success)' },
    SAVINGS_WITHDRAW: { label: "Jamg'armadan chiqim", color: 'var(--danger)' },
    SAVING: { label: "Jamg'arma", color: 'var(--success)' },
    INCOME: { label: "Daromad", color: 'var(--success)' },
    EXPENSE: { label: "Xarajat", color: 'var(--danger)' },
    TRANSFER: { label: "O'tkazma", color: '#f59e0b' },
};

// ─── Toast component ───
function Toast({ toast, onClose }) {
    if (!toast) return null;
    const colors = {
        success: { bg: 'rgba(16,185,129,0.15)', border: 'var(--success)', color: 'var(--success)', icon: <Check size={20} /> },
        error: { bg: 'rgba(239,68,68,0.15)', border: 'var(--danger)', color: 'var(--danger)', icon: <AlertCircle size={20} /> },
        warning: { bg: 'rgba(245,158,11,0.15)', border: '#f59e0b', color: '#f59e0b', icon: <AlertTriangle size={20} /> },
    };
    const c = colors[toast.type] || colors.success;
    return (
        <div style={{
            position: 'fixed', top: '24px', right: '24px', zIndex: 2000,
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '14px 20px', borderRadius: '12px',
            background: c.bg, border: `1px solid ${c.border}`,
            backdropFilter: 'blur(12px)', color: c.color,
            boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
            animation: 'slideIn 0.3s ease', maxWidth: '400px',
            fontWeight: '500', fontSize: '14px'
        }}>
            {c.icon}
            <span style={{ flex: 1 }}>{toast.message}</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: c.color, cursor: 'pointer', padding: '2px' }}>
                <X size={16} />
            </button>
        </div>
    );
}

// ─── Confirm Modal component ───
function ConfirmModal({ open, title, message, icon, iconColor, confirmText, confirmColor, onConfirm, onCancel, loading }) {
    if (!open) return null;
    return (
        <div className="modal-overlay">
            <div className="modal-content" style={{ maxWidth: '420px', textAlign: 'center' }}>
                <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'center' }}>
                    <div style={{
                        padding: '18px', borderRadius: '50%',
                        background: `${iconColor}15`, color: iconColor,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        {icon}
                    </div>
                </div>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '20px' }}>{title}</h3>
                <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px', lineHeight: '1.6' }}>{message}</p>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        onClick={onConfirm} disabled={loading}
                        className="btn-primary"
                        style={{ flex: 1, backgroundColor: confirmColor, border: 'none', opacity: loading ? 0.5 : 1 }}
                    >
                        {loading ? 'Kutilmoqda...' : confirmText}
                    </button>
                    <button
                        onClick={onCancel} disabled={loading}
                        style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', borderRadius: '8px', cursor: 'pointer' }}
                    >
                        Bekor qilish
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function Savings() {
    const [savings, setSavings] = useState([]);
    const [balance, setBalance] = useState(null);
    const [loading, setLoading] = useState(true);
    const [openHistory, setOpenHistory] = useState(null);
    const [savingsHistory, setSavingsHistory] = useState({});
    const [historyLoading, setHistoryLoading] = useState(false);

    // Toast
    const [toast, setToast] = useState(null);
    const showToast = (type, message) => {
        setToast({ type, message });
        setTimeout(() => setToast(null), 4000);
    };

    // Goal Forms
    const [goalForm, setGoalForm] = useState({ name: '', target_amount: '' });

    const [depositModal, setDepositModal] = useState(null);
    const [depositAmount, setDepositAmount] = useState('');
    const [depositNote, setDepositNote] = useState('');

    const [withdrawModal, setWithdrawModal] = useState(null);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [withdrawNote, setWithdrawNote] = useState('');

    const [allocateModal, setAllocateModal] = useState(null);
    const [allocateAmount, setAllocateAmount] = useState('');

    const [goalWithdrawModal, setGoalWithdrawModal] = useState(null);
    const [goalWithdrawAmount, setGoalWithdrawAmount] = useState('');

    // Delete confirm
    const [deleteConfirm, setDeleteConfirm] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => { fetchSavings(); }, []);

    const fetchSavings = async () => {
        try {
            const [savRes, balRes] = await Promise.all([
                api.get('finance/savings/'),
                api.get('finance/balance/')
            ]);
            setSavings(savRes.data);
            setBalance(balRes.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const fetchSavingsHistory = async (savingsId) => {
        setHistoryLoading(true);
        try {
            const res = await api.get(`finance/transactions/by_savings/?savings_id=${savingsId}`);
            const txData = res.data.results || res.data;
            setSavingsHistory(prev => ({ ...prev, [savingsId]: txData }));
        } catch (e) { console.error(e); }
        finally { setHistoryLoading(false); }
    };

    const toggleHistory = (savingsId) => {
        if (openHistory === savingsId) {
            setOpenHistory(null);
        } else {
            setOpenHistory(savingsId);
            fetchSavingsHistory(savingsId);
        }
    };

    const getMainPool = async () => {
        let pool = savings.find(s => s.name === "Asosiy Jamg'arma") || savings[0];
        if (!pool) {
            const res = await api.post('finance/savings/', { name: "Asosiy Jamg'arma", target_amount: null });
            pool = res.data;
            fetchSavings();
        }
        return pool;
    };

    const handleAddGoal = async (e) => {
        e.preventDefault();
        try {
            const pool = await getMainPool();
            await api.post('finance/goals/', {
                savings: pool.id,
                name: goalForm.name,
                target_amount: goalForm.target_amount
            });
            setGoalForm({ name: '', target_amount: '' });
            showToast('success', `"${goalForm.name}" maqsadi yaratildi!`);
            fetchSavings();
        } catch (e) {
            showToast('error', e.response?.data?.error || "Maqsad yaratishda xatolik!");
        }
    };

    const handleDeposit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.post(`finance/savings/${depositModal.id}/deposit/`, {
                amount: depositAmount,
                note: depositNote
            });
            showToast('success', `${formatMoney(depositAmount)} so'm jamg'armaga tushirildi`);
            setDepositModal(null);
            setDepositAmount('');
            setDepositNote('');
            fetchSavings();
        } catch (e) {
            showToast('error', e.response?.data?.error || "Xatolik!");
        }
        finally { setIsSubmitting(false); }
    };

    const handleWithdraw = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.post(`finance/savings/${withdrawModal.id}/withdraw/`, {
                amount: withdrawAmount,
                note: withdrawNote
            });
            showToast('success', `${formatMoney(withdrawAmount)} so'm jamg'armadan yechildi`);
            setWithdrawModal(null);
            setWithdrawAmount('');
            setWithdrawNote('');
            fetchSavings();
        } catch (e) {
            showToast('error', e.response?.data?.error || "Xatolik!");
        }
        finally { setIsSubmitting(false); }
    };

    const handleAllocateToGoal = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.post(`finance/goals/${allocateModal.goalId}/add_funds/`, {
                amount: allocateAmount
            });
            showToast('success', `${formatMoney(allocateAmount)} so'm "${allocateModal.goalName}" maqsadiga ajratildi`);
            setAllocateModal(null);
            setAllocateAmount('');
            fetchSavings();
        } catch (e) {
            showToast('error', e.response?.data?.error || "Xatolik!");
        }
        finally { setIsSubmitting(false); }
    };

    const handleWithdrawFromGoal = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            await api.post(`finance/goals/${goalWithdrawModal.goalId}/withdraw_funds/`, {
                amount: goalWithdrawAmount
            });
            showToast('success', `${formatMoney(goalWithdrawAmount)} so'm asosiy jamg'armaga qaytarildi`);
            setGoalWithdrawModal(null);
            setGoalWithdrawAmount('');
            fetchSavings();
        } catch (e) {
            showToast('error', e.response?.data?.error || "Xatolik!");
        }
        finally { setIsSubmitting(false); }
    };

    const handleDeleteGoal = async () => {
        if (!deleteConfirm) return;
        setIsSubmitting(true);
        try {
            await api.delete(`finance/goals/${deleteConfirm.id}/`);
            showToast('success', `"${deleteConfirm.name}" maqsadi o'chirildi`);
            setDeleteConfirm(null);
            fetchSavings();
        } catch (e) {
            showToast('error', "O'chirishda xatolik!");
        }
        finally { setIsSubmitting(false); }
    };

    if (loading) return <div style={{ color: 'var(--text-main)', padding: '40px', textAlign: 'center' }}>Yuklanmoqda...</div>;

    const mainPool = savings.find(s => s.name === "Asosiy Jamg'arma") || savings[0];
    const poolAmount = mainPool ? parseFloat(mainPool.current_amount) : 0;

    const allGoals = savings.reduce((acc, s) => acc.concat(s.goals || []), []);
    const totalGoalsSaved = allGoals.reduce((acc, g) => acc + parseFloat(g.current_amount || 0), 0);
    const totalTarget = allGoals.reduce((acc, g) => acc + parseFloat(g.target_amount || 0), 0);
    const totalSavings = poolAmount + totalGoalsSaved;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            <Toast toast={toast} onClose={() => setToast(null)} />

            {/* STATS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                {/* Asosiy Jamg'arma stat card */}
                <div className="glass-panel stat-card" style={{
                    background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(6, 182, 212, 0.1))',
                    border: '1px solid rgba(16, 185, 129, 0.3)',
                    flexDirection: 'column', alignItems: 'flex-start', gap: '12px'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ background: 'var(--success)', padding: '10px', borderRadius: '50%', color: 'white' }}>
                            <ShieldCheck size={20} />
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>Asosiy Jamg'arma</p>
                    </div>
                    <div>
                        <h3 style={{ margin: 0, color: 'var(--success)', fontSize: '22px' }}>{formatMoney(totalSavings)} so'm</h3>
                        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Asosiy jamg'arma:</span>
                                <span style={{ color: 'var(--success)', fontWeight: '600' }}>{formatMoney(poolAmount)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                                <span style={{ color: 'var(--text-muted)' }}>Maqsadlarga:</span>
                                <span style={{ color: 'var(--accent)', fontWeight: '600' }}>{formatMoney(totalGoalsSaved)}</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="glass-panel stat-card">
                    <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '12px', borderRadius: '50%', color: 'var(--accent)' }}>
                        <PiggyBank size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>Maqsadlarga yo'naltirilgan</p>
                        <h3 style={{ margin: 0 }}>{formatMoney(totalGoalsSaved)} so'm</h3>
                    </div>
                </div>
                <div className="glass-panel stat-card">
                    <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '12px', borderRadius: '50%', color: 'var(--primary)' }}>
                        <Target size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>Jami maqsadlar summasi</p>
                        <h3 style={{ margin: 0 }}>{formatMoney(totalTarget)} so'm</h3>
                    </div>
                </div>
                <div className="glass-panel stat-card">
                    <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '12px', borderRadius: '50%', color: '#f59e0b' }}>
                        <Wallet size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>Asosiy balans</p>
                        <h3 style={{ margin: 0 }}>{balance ? formatMoney(balance.total_amount) : '0'} so'm</h3>
                    </div>
                </div>
            </div>

            {/* MAIN POOL CONTROLS */}
            <div className="glass-panel" style={{ padding: '24px', background: 'rgba(15, 23, 42, 0.5)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                    <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <ShieldCheck color="var(--success)" size={28} /> Asosiy Jamg'arma
                    </h2>
                    <p style={{ margin: '8px 0 0 0', color: 'var(--text-muted)', fontSize: '14px' }}>
                        Asosiy xavfsizlik fondingiz. Bu yerdagi pulni maqsadlaringizga yo'naltirishingiz mumkin.
                    </p>
                </div>
                {mainPool && (
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                        <button onClick={() => toggleHistory(mainPool.id)} style={{
                            display: 'flex', alignItems: 'center', gap: '6px',
                            padding: '10px 16px', fontSize: '14px',
                            background: openHistory === mainPool.id ? 'rgba(139,92,246,0.2)' : 'rgba(255,255,255,0.05)',
                            border: '1px solid ' + (openHistory === mainPool.id ? 'var(--primary)' : 'var(--border)'),
                            color: openHistory === mainPool.id ? 'var(--primary)' : 'var(--text-muted)',
                            borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s'
                        }}>
                            <History size={16} /> Tranzaksiyalar tarixi
                        </button>
                        <button onClick={() => { setWithdrawModal(mainPool); setWithdrawAmount(''); setWithdrawNote(''); }}
                            style={{ padding: '10px 16px', fontSize: '14px', background: 'rgba(239,68,68,0.15)', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '8px', cursor: 'pointer' }}>
                            Yechib olish
                        </button>
                        <button onClick={() => { setDepositModal(mainPool); setDepositAmount(''); setDepositNote(''); }}
                            className="btn-primary" style={{ padding: '10px 16px', fontSize: '14px', width: 'auto' }}>
                            Mablag' tushirish
                        </button>
                    </div>
                )}
            </div>

            {/* TRANSACTION HISTORY */}
            {mainPool && openHistory === mainPool.id && (
                <div className="glass-panel" style={{ padding: '24px', border: '1px solid rgba(139,92,246,0.2)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--primary)' }}>
                            <History size={20} /> Tranzaksiyalar Tarixi
                        </h3>
                        <button onClick={() => setOpenHistory(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                            <X size={20} />
                        </button>
                    </div>
                    {historyLoading ? (
                        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>⏳ Yuklanmoqda...</div>
                    ) : (savingsHistory[mainPool.id] || []).length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                            <History size={48} opacity={0.3} />
                            <p>Hozircha tranzaksiyalar tarixi mavjud emas</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {(savingsHistory[mainPool.id] || []).map((t, i) => {
                                const cfg = TX_TYPE_CONFIG[t.type] || { label: t.type_display || t.type, color: 'var(--text-muted)' };
                                const isCredit = t.type === 'SAVINGS_DEPOSIT' || t.type === 'SAVING' || t.type === 'INCOME';
                                return (
                                    <div key={t.id} style={{
                                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                        padding: '14px 16px',
                                        background: i % 2 === 0 ? 'rgba(15,23,42,0.3)' : 'rgba(15,23,42,0.15)',
                                        borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <div style={{
                                                width: '36px', height: '36px', borderRadius: '50%',
                                                background: isCredit ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                color: isCredit ? 'var(--success)' : 'var(--danger)'
                                            }}>
                                                {isCredit ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                            </div>
                                            <div>
                                                <div style={{ fontWeight: '600', fontSize: '14px', color: 'var(--text-main)' }}>
                                                    {cfg.label || t.type_display || t.type}
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '8px' }}>
                                                    <span>📅 {t.date}</span>
                                                    {t.note && <span>• {t.note}</span>}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ fontWeight: '700', fontSize: '15px', color: isCredit ? 'var(--success)' : 'var(--danger)', whiteSpace: 'nowrap' }}>
                                            {isCredit ? '+' : '-'}{formatMoney(Math.abs(t.amount))} so'm
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '32px' }}>
                {/* ADD GOAL FORM */}
                <div className="glass-panel" style={{ padding: '24px', height: 'fit-content' }}>
                    <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent)' }}>
                        <Target size={20} /> Yangi Maqsad
                    </h3>
                    <form onSubmit={handleAddGoal} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Maqsad nomi (Misol: Mashina)</label>
                            <input type="text" className="glass-input" placeholder="Yangi noutbuk..." value={goalForm.name} onChange={e => setGoalForm({ ...goalForm, name: e.target.value })} required />
                        </div>
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Kerakli To'liq Summa (so'm)</label>
                            <input type="number" step="0.01" className="glass-input" placeholder="0.00" value={goalForm.target_amount} onChange={e => setGoalForm({ ...goalForm, target_amount: e.target.value })} required />
                            {goalForm.target_amount && <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '4px' }}>Format: {formatMoney(goalForm.target_amount)} so'm</div>}
                        </div>
                        <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>Yaratish</button>
                    </form>
                </div>

                {/* GOALS LIST */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h1 className="text-gradient" style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                        <Target size={32} /> Mening Maqsadlarim
                    </h1>

                    <div className="glass-panel" style={{ padding: '24px' }}>
                        <div style={{ display: 'grid', gap: '16px' }}>
                            {allGoals.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>Hozircha maqsadlar yo'q...</p> :
                                allGoals.map(g => {
                                    const gPercent = g.target_amount ? Math.min(100, Math.round((parseFloat(g.current_amount) / parseFloat(g.target_amount)) * 100)) : 0;
                                    const hasBalance = parseFloat(g.current_amount) > 0;
                                    return (
                                        <div key={g.id} style={{
                                            padding: '20px', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '12px',
                                            border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '12px'
                                        }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <div style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {g.name}
                                                    {g.status === 'COMPLETED' && <CheckCircle size={18} color="var(--success)" />}
                                                </div>
                                                <button
                                                    onClick={() => setDeleteConfirm({ id: g.id, name: g.name, amount: g.current_amount })}
                                                    style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: 'var(--danger)', cursor: 'pointer', padding: '6px 8px', borderRadius: '6px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', transition: 'all 0.2s' }}
                                                >
                                                    <Trash2 size={14} /> O'chirish
                                                </button>
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '4px' }}>
                                                <span>Jamg'arildi: <strong style={{ color: 'var(--text-main)' }}>{formatMoney(g.current_amount)}</strong> so'm</span>
                                                <span>Maqsad: {formatMoney(g.target_amount)} so'm</span>
                                            </div>

                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                                                    <div style={{ width: `${gPercent}%`, background: g.status === 'COMPLETED' ? 'var(--success)' : 'linear-gradient(90deg, var(--primary), var(--accent))', height: '100%', transition: 'width 0.4s ease' }} />
                                                </div>
                                                <div style={{ fontSize: '14px', fontWeight: '600', minWidth: '45px', color: g.status === 'COMPLETED' ? 'var(--success)' : 'var(--accent)' }}>{gPercent}%</div>
                                            </div>

                                            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '4px', gap: '8px', flexWrap: 'wrap' }}>
                                                {g.status === 'ACTIVE' && (
                                                    <button
                                                        onClick={() => { setAllocateModal({ goalId: g.id, goalName: g.name, remaining: parseFloat(g.target_amount) - parseFloat(g.current_amount) }); setAllocateAmount(''); }}
                                                        style={{ padding: '8px 16px', fontSize: '13px', background: 'rgba(6,182,212,0.1)', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500', transition: 'all 0.2s' }}
                                                    >
                                                        🎯 Maqsadga Pul Ajratish
                                                    </button>
                                                )}
                                                {hasBalance && (
                                                    <button
                                                        onClick={() => { setGoalWithdrawModal({ goalId: g.id, goalName: g.name, current: g.current_amount }); setGoalWithdrawAmount(''); }}
                                                        style={{ padding: '8px 16px', fontSize: '13px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', color: 'var(--danger)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '500', transition: 'all 0.2s' }}
                                                    >
                                                        🔙 Jamg'armaga Qaytarish
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )
                                })}
                        </div>
                    </div>
                </div>
            </div>

            {/* DELETE CONFIRMATION MODAL */}
            <ConfirmModal
                open={!!deleteConfirm}
                title="Maqsadni o'chirmoqchimisiz?"
                message={deleteConfirm ? `"${deleteConfirm.name}" maqsadi o'chiriladi.${parseFloat(deleteConfirm.amount) > 0 ? ` Maqsaddagi ${formatMoney(deleteConfirm.amount)} so'm asosiy jamg'armaga qaytariladi.` : ''} Bu amalni qaytarib bo'lmaydi.` : ''}
                icon={<Trash2 size={40} />}
                iconColor="var(--danger)"
                confirmText="Ha, o'chirish"
                confirmColor="var(--danger)"
                onConfirm={handleDeleteGoal}
                onCancel={() => setDeleteConfirm(null)}
                loading={isSubmitting}
            />

            {/* DEPOSIT MODAL */}
            {depositModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0 }}>💰 Jamg'armaga Pul Tushirish</h3>
                            <button onClick={() => setDepositModal(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '14px' }}>
                            Jamg'arma hajmi: <strong>{formatMoney(depositModal.current_amount)} so'm</strong><br />
                            Asosiy balans: <strong>{balance ? formatMoney(balance.total_amount) : '0'} so'm</strong>
                        </p>
                        <div style={{ padding: '10px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: 'var(--success)' }}>
                            💡 Asosiy balansdan jamg'armaga xavfsiz holda saqlanadi.
                        </div>
                        <form onSubmit={handleDeposit}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Summa (so'm)</label>
                                <input type="number" step="0.01" className="glass-input" value={depositAmount} onChange={e => setDepositAmount(e.target.value)} autoFocus required />
                                {depositAmount && <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '4px' }}>Format: {formatMoney(depositAmount)} so'm</div>}
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Izoh (ixtiyoriy)</label>
                                <input type="text" className="glass-input" placeholder="Misol: Oylik tejash..." value={depositNote} onChange={e => setDepositNote(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ flex: 1, opacity: isSubmitting ? 0.5 : 1 }}>{isSubmitting ? 'Kutilmoqda...' : 'Saqlash'}</button>
                                <button type="button" onClick={() => setDepositModal(null)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', borderRadius: '8px', cursor: 'pointer' }}>Bekor</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* WITHDRAW MODAL */}
            {withdrawModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <h3 style={{ margin: 0, color: 'var(--danger)' }}>📤 Jamg'armadan Pul Yechish</h3>
                            <button onClick={() => setWithdrawModal(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '14px' }}>
                            Mavjud jamg'arma: <strong>{formatMoney(withdrawModal.current_amount)} so'm</strong>
                        </p>
                        <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: 'var(--danger)' }}>
                            💡 Pul jamg'armadan Asosiy Balansga qaytariladi.
                        </div>
                        <form onSubmit={handleWithdraw}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Summa (so'm)</label>
                                <input type="number" step="0.01" className="glass-input" value={withdrawAmount} onChange={e => setWithdrawAmount(e.target.value)} autoFocus required />
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Izoh (ixtiyoriy)</label>
                                <input type="text" className="glass-input" placeholder="Sabab..." value={withdrawNote} onChange={e => setWithdrawNote(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ flex: 1, background: 'var(--danger)', opacity: isSubmitting ? 0.5 : 1 }}>{isSubmitting ? 'Kutilmoqda...' : 'Yechish'}</button>
                                <button type="button" onClick={() => setWithdrawModal(null)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', borderRadius: '8px', cursor: 'pointer' }}>Bekor</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ALLOCATE TO GOAL MODAL */}
            {allocateModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h3 style={{ margin: 0 }}>🎯 Maqsadga Pul Ajratish</h3>
                            <button onClick={() => setAllocateModal(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <h4 style={{ color: 'var(--accent)', marginTop: 0 }}>📍 {allocateModal.goalName}</h4>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '14px' }}>
                            Asosiy jamg'armadagi pul: <strong>{formatMoney(poolAmount)} so'm</strong><br />
                            Maqsadga yana kerak: <strong>{formatMoney(allocateModal.remaining)} so'm</strong>
                        </p>
                        <div style={{ padding: '10px', background: 'rgba(6, 182, 212, 0.1)', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                            💡 Asosiy jamg'armadan uzilib maqsad hisobiga o'tadi.
                        </div>
                        <form onSubmit={handleAllocateToGoal}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Summa (so'm)</label>
                                <input type="number" step="0.01" className="glass-input" value={allocateAmount} onChange={e => setAllocateAmount(e.target.value)} autoFocus required />
                                {allocateAmount && <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '4px' }}>Format: {formatMoney(allocateAmount)} so'm</div>}
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ flex: 1, opacity: isSubmitting ? 0.5 : 1 }}>{isSubmitting ? 'Kutilmoqda...' : 'Ajratish'}</button>
                                <button type="button" onClick={() => setAllocateModal(null)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', borderRadius: '8px', cursor: 'pointer' }}>Bekor</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* WITHDRAW FROM GOAL MODAL */}
            {goalWithdrawModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                            <h3 style={{ margin: 0, color: 'var(--danger)' }}>🔙 Maqsaddan Jamg'armaga Qaytarish</h3>
                            <button onClick={() => setGoalWithdrawModal(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}><X size={20} /></button>
                        </div>
                        <h4 style={{ color: 'var(--accent)', marginTop: 0 }}>📍 {goalWithdrawModal.goalName}</h4>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '14px' }}>
                            Maqsadda jamlangan: <strong>{formatMoney(goalWithdrawModal.current)} so'm</strong>
                        </p>
                        <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: 'var(--danger)' }}>
                            💡 Pul ushbu maqsaddan asosiy jamg'armaga qaytariladi. Keyinchalik boshqa maqsadga yo'naltirishingiz mumkin.
                        </div>
                        <form onSubmit={handleWithdrawFromGoal}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Summa (so'm)</label>
                                <input type="number" step="0.01" max={goalWithdrawModal.current} className="glass-input" value={goalWithdrawAmount} onChange={e => setGoalWithdrawAmount(e.target.value)} autoFocus required />
                                {goalWithdrawAmount && <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '4px' }}>Format: {formatMoney(goalWithdrawAmount)} so'm</div>}
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="submit" disabled={isSubmitting} className="btn-primary" style={{ flex: 1, backgroundColor: 'var(--danger)', border: 'none', opacity: isSubmitting ? 0.5 : 1 }}>{isSubmitting ? 'Kutilmoqda...' : 'Qaytarish'}</button>
                                <button type="button" onClick={() => setGoalWithdrawModal(null)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', borderRadius: '8px', cursor: 'pointer' }}>Bekor</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
