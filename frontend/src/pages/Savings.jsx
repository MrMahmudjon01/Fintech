import React, { useEffect, useState } from 'react';
import { PiggyBank, Plus, Trash2, Edit2, Target, CheckCircle } from 'lucide-react';
import api from '../api';
import { formatMoney } from '../utils/format';

export default function Savings() {
    const [savings, setSavings] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openHistory, setOpenHistory] = useState(null);

    const [form, setForm] = useState({ name: '', target_amount: '', monthly_contribution: '' });
    
    const [addFundsModal, setAddFundsModal] = useState(null);
    const [fundAmount, setFundAmount] = useState('');

    const [borrowModal, setBorrowModal] = useState(null);
    const [borrowAmount, setBorrowAmount] = useState('');
    const [borrowDueDate, setBorrowDueDate] = useState('');

    const [editModalData, setEditModalData] = useState(null);
    const [editForm, setEditForm] = useState({ name: '', target_amount: '', monthly_contribution: '' });

    useEffect(() => { fetchSavings(); }, []);

    const fetchSavings = async () => {
        try {
            const [savRes, txRes] = await Promise.all([
                api.get('finance/savings/'),
                api.get('finance/transactions/')
            ]);
            setSavings(savRes.data);
            setTransactions(txRes.data.results || txRes.data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.post('finance/savings/', form);
            setForm({ name: '', target_amount: '', monthly_contribution: '' });
            fetchSavings();
        } catch (e) { alert("Xatolik!"); }
    };

    const handleAddFunds = async (e) => {
        e.preventDefault();
        try {
            await api.post(`finance/savings/${addFundsModal.id}/add_funds/`, { amount: fundAmount });
            setAddFundsModal(null);
            fetchSavings();
        } catch (e) { alert("Xatolik!"); }
    };

    const handleBorrowFunds = async (e) => {
        e.preventDefault();
        try {
            await api.post(`finance/savings/${borrowModal.id}/borrow_funds/`, { amount: borrowAmount, due_date: borrowDueDate });
            setBorrowModal(null);
            fetchSavings();
        } catch (e) { alert(e.response?.data?.error || "Xatolik!"); }
    };

    const openEditModal = (s) => {
        setEditModalData(s);
        setEditForm({ name: s.name, target_amount: s.target_amount, monthly_contribution: s.monthly_contribution });
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            await api.patch(`finance/savings/${editModalData.id}/`, editForm);
            setEditModalData(null);
            fetchSavings();
        } catch (e) { alert("Xatolik!"); }
    };

    const handleDelete = async (id) => {
        if (window.confirm("O'chirilsinmi?")) {
            try { await api.delete(`finance/savings/${id}/`); fetchSavings(); }
            catch (e) { console.error(e); }
        }
    };

    if (loading) return <div>Yuklanmoqda...</div>;

    const totalSaved = savings.reduce((s, sv) => s + parseFloat(sv.current_amount), 0);
    const totalTarget = savings.reduce((s, sv) => s + parseFloat(sv.target_amount), 0);
    const activeCount = savings.filter(s => s.status === 'ACTIVE').length;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

            {/* STATS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                <div className="glass-panel stat-card">
                    <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '12px', borderRadius: '50%', color: 'var(--primary)' }}>
                        <PiggyBank size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>Jami jamg'arilgan</p>
                        <h3 style={{ margin: 0 }}>{formatMoney(totalSaved)} so'm</h3>
                    </div>
                </div>
                <div className="glass-panel stat-card">
                    <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '12px', borderRadius: '50%', color: 'var(--accent)' }}>
                        <Target size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>Umumiy maqsad</p>
                        <h3 style={{ margin: 0 }}>{formatMoney(totalTarget)} so'm</h3>
                    </div>
                </div>
                <div className="glass-panel stat-card">
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '50%', color: 'var(--success)' }}>
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>Faol maqsadlar</p>
                        <h3 style={{ margin: 0 }}>{activeCount} ta</h3>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '32px' }}>

            {/* ADD FORM */}
            <div className="glass-panel" style={{ padding: '24px', height: 'fit-content' }}>
                <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Plus size={20} /> Yangi Jamg'arma
                </h3>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <div>
                        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Maqsad nomi</label>
                        <input type="text" className="glass-input" placeholder="Mashina, Ta'til..." value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Maqsad summasi (so'm)</label>
                        <input type="number" step="0.01" className="glass-input" placeholder="0.00" value={form.target_amount} onChange={e => setForm({...form, target_amount: e.target.value})} required />
                        {form.target_amount && <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '4px' }}>Format: {formatMoney(form.target_amount)} so'm</div>}
                    </div>
                    <div>
                        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Oylik qo'shimcha (so'm)</label>
                        <input type="number" step="0.01" className="glass-input" placeholder="0.00" value={form.monthly_contribution} onChange={e => setForm({...form, monthly_contribution: e.target.value})} required />
                        {form.monthly_contribution && <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '4px' }}>Format: {formatMoney(form.monthly_contribution)} so'm</div>}
                    </div>
                    <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>Saqlash</button>
                </form>
            </div>

            {/* LIST */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <h1 className="text-gradient" style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                    <PiggyBank size={32} /> Jamg'armalarim
                </h1>

                <div className="glass-panel" style={{ padding: '24px' }}>
                    <div style={{ display: 'grid', gap: '16px' }}>
                        {savings.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>Hozircha jamg'arma yo'q...</p> :
                        savings.map(s => {
                            const percent = Math.min(100, Math.round((s.current_amount / s.target_amount) * 100));
                            const remaining = Math.max(0, s.target_amount - s.current_amount);
                            const monthsLeft = s.monthly_contribution > 0 ? Math.ceil(remaining / s.monthly_contribution) : '∞';
                            return (
                            <div key={s.id} style={{
                                padding: '20px',
                                background: 'rgba(15, 23, 42, 0.4)',
                                borderRadius: '12px',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '18px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                            {s.name}
                                            {s.status === 'COMPLETED' && <CheckCircle size={18} color="var(--success)" />}
                                        </div>
                                        <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            Oylik: {formatMoney(s.monthly_contribution)} so'm • Taxminan {monthsLeft} oy qoldi
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <button onClick={() => openEditModal(s)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                            <Edit2 size={18} />
                                        </button>
                                        <button onClick={() => handleDelete(s.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: 0.8 }}>
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-muted)' }}>
                                    <span>{formatMoney(s.current_amount)} so'm</span>
                                    <span>{formatMoney(s.target_amount)} so'm</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                                        <div style={{ width: `${percent}%`, background: s.status === 'COMPLETED' ? 'var(--success)' : 'var(--primary)', height: '100%', transition: 'width 0.3s ease', borderRadius: '5px' }} />
                                    </div>
                                    <div style={{ fontSize: '14px', fontWeight: '600', minWidth: '45px' }}>{percent}%</div>
                                </div>

                                {s.status === 'ACTIVE' && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <button 
                                            onClick={() => setOpenHistory(openHistory === s.id ? null : s.id)} 
                                            style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '14px' }}
                                        >
                                            {openHistory === s.id ? 'Tarixni yopish' : 'Tarixni ko\'rish'}
                                        </button>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => { setBorrowModal(s); setBorrowAmount(''); setBorrowDueDate(''); }} className="btn-primary" style={{ padding: '6px 12px', fontSize: '13px', width: 'auto', background: 'rgba(239, 68, 68, 0.2)', color: 'var(--danger)', border: '1px solid var(--danger)' }}>
                                                Qarz olish
                                            </button>
                                            <button onClick={() => { setAddFundsModal(s); setFundAmount(''); }} className="btn-primary" style={{ padding: '6px 16px', fontSize: '14px', width: 'auto' }}>
                                                Pul qo'shish
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {openHistory === s.id && (
                                    <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Maqsad tarixi:</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {transactions.filter(t => t.savings === s.id).length === 0 ? (
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Hozircha tarix mavjud emas</div>
                                            ) : (
                                                transactions.filter(t => t.savings === s.id).map(t => (
                                                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                        <span style={{ color: 'var(--text-muted)' }}>{t.date}</span>
                                                        <span style={{ fontWeight: '500', color: t.type === 'SAVING' && t.debt ? 'var(--danger)' : (t.type === 'SAVING' ? 'var(--success)' : 'var(--text-main)') }}>
                                                            {t.type === 'SAVING' && t.debt ? '-' : '+'}{formatMoney(t.amount)} so'm
                                                            {t.debt && <small style={{ display: 'block', fontSize: '10px', opacity: 0.7 }}>Qarzga olindi</small>}
                                                        </span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )})}
                    </div>
                </div>
            </div>
            </div>

            {/* BORROW FUNDS MODAL */}
            {borrowModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3 style={{ marginBottom: '16px', color: 'var(--danger)' }}>Jamg'armadan qarz olish — {borrowModal.name}</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '14px' }}>
                            Mavjud mablag': <strong>{formatMoney(borrowModal.current_amount)} so'm</strong>
                        </p>
                        <form onSubmit={handleBorrowFunds}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Olinadigan summa (so'm)</label>
                                <input type="number" step="0.01" className="glass-input" value={borrowAmount} onChange={e => setBorrowAmount(e.target.value)} autoFocus required />
                                {borrowAmount && <div style={{ fontSize: '12px', color: 'var(--danger)', marginTop: '4px' }}>Diyet: -{formatMoney(borrowAmount)} so'm</div>}
                            </div>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Qachon qaytarasiz? (Muddat)</label>
                                <input type="date" className="glass-input" value={borrowDueDate} onChange={e => setBorrowDueDate(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="submit" className="btn-primary" style={{ flex: 1, background: 'var(--danger)' }}>Qarzga olish</button>
                                <button type="button" onClick={() => setBorrowModal(null)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', borderRadius: '8px', cursor: 'pointer' }}>Bekor</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ADD FUNDS MODAL */}
            {addFundsModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3 style={{ marginBottom: '16px' }}>Pul qo'shish — {addFundsModal.name}</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '14px' }}>
                            Hozirgi: {formatMoney(addFundsModal.current_amount)} so'm<br/>
                            Maqsad: {formatMoney(addFundsModal.target_amount)} so'm<br/>
                            <strong>Qolgan: {formatMoney(addFundsModal.target_amount - addFundsModal.current_amount)} so'm</strong>
                        </p>
                        <form onSubmit={handleAddFunds}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Qo'shiladigan summa (so'm)</label>
                                <input type="number" step="0.01" className="glass-input" value={fundAmount} onChange={e => setFundAmount(e.target.value)} autoFocus required />
                                {fundAmount && <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '4px' }}>Format: {formatMoney(fundAmount)} so'm</div>}
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Tasdiqlash</button>
                                <button type="button" onClick={() => setAddFundsModal(null)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', borderRadius: '8px', cursor: 'pointer' }}>Bekor</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT MODAL */}
            {editModalData && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3 style={{ marginBottom: '24px' }}>Jamg'armani tahrirlash</h3>
                        <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Nomi</label>
                                <input type="text" className="glass-input" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} required />
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Maqsad summasi (so'm)</label>
                                <input type="number" step="0.01" className="glass-input" value={editForm.target_amount} onChange={e => setEditForm({...editForm, target_amount: e.target.value})} required />
                                {editForm.target_amount && <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '4px' }}>Format: {formatMoney(editForm.target_amount)} so'm</div>}
                            </div>
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Oylik qo'shimcha (so'm)</label>
                                <input type="number" step="0.01" className="glass-input" value={editForm.monthly_contribution} onChange={e => setEditForm({...editForm, monthly_contribution: e.target.value})} required />
                                {editForm.monthly_contribution && <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '4px' }}>Format: {formatMoney(editForm.monthly_contribution)} so'm</div>}
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Saqlash</button>
                                <button type="button" onClick={() => setEditModalData(null)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', borderRadius: '8px', cursor: 'pointer' }}>Bekor</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
