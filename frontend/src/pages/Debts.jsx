import React, { useEffect, useState } from 'react';
import { CreditCard, Plus, CheckCircle, Clock, Trash2, Edit2, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import api from '../api';
import { formatMoney } from '../utils/format';

const today = () => new Date().toISOString().split('T')[0];

export default function Debts() {
    const [debts, setDebts] = useState([]);
    const [savings, setSavings] = useState([]);
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [openHistory, setOpenHistory] = useState(null); // ID of debt showing history

    const [form, setForm] = useState({
        person_name: '',
        amount: '',
        type: 'BORROWED',
        due_date: '',
        date: today(),
        note: '',
        savings_id: ''
    });
    const [paymentModalData, setPaymentModalData] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [editModalData, setEditModalData] = useState(null);
    const [editForm, setEditForm] = useState({ person_name: '', amount: '', type: 'BORROWED', due_date: '', date: today(), note: '' });

    useEffect(() => {
        fetchDebts();
    }, []);

    const fetchDebts = async () => {
        try {
            const [debtRes, savRes, txRes] = await Promise.all([
                api.get('finance/debts/'),
                api.get('finance/savings/'),
                api.get('finance/transactions/')
            ]);
            setDebts(debtRes.data);
            setSavings(savRes.data);
            setTransactions(txRes.data.results || txRes.data);
        } catch (error) {
            console.error("Xatolik", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...form };
            if (!payload.due_date) delete payload.due_date;
            if (!payload.savings_id) delete payload.savings_id;
            
            await api.post('finance/debts/', payload);
            setForm({ person_name: '', amount: '', type: 'BORROWED', due_date: '', date: today(), note: '', savings_id: '' });
            fetchDebts();
        } catch (e) {
            alert(e.response?.data?.error || "Qarz qo'shishda xatolik!");
        }
    };

    const openPaymentModal = (debt) => {
        setPaymentModalData(debt);
        setPaymentAmount('');
    };

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        if (!paymentModalData) return;
        
        const payment = parseFloat(paymentAmount);
        if (isNaN(payment) || payment <= 0) return alert('Noto\'g\'ri summa');
        
        const debt = paymentModalData;
        const newPaid = parseFloat(debt.amount_paid) + payment;
        let updateData = { amount_paid: newPaid };
        if (newPaid >= parseFloat(debt.amount)) {
            updateData.status = 'SETTLED';
        }

        try {
            await api.patch(`finance/debts/${debt.id}/`, updateData);
            setPaymentModalData(null);
            fetchDebts();
        } catch (e) {
            alert("To'lovni saqlashda xatolik");
        }
    };

    const openEditModal = (d) => {
        setEditModalData(d);
        setEditForm({
            person_name: d.person_name,
            amount: d.amount,
            type: d.type,
            due_date: d.due_date || '',
            date: d.date || today(),
            note: d.note || ''
        });
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = { ...editForm };
            if (!payload.due_date) delete payload.due_date;
            await api.patch(`finance/debts/${editModalData.id}/`, payload);
            setEditModalData(null);
            fetchDebts();
        } catch (e) {
            alert("Tahrirlashda xatolik!");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("O'chirilsinmi?")) {
            try {
                await api.delete(`finance/debts/${id}/`);
                fetchDebts();
            } catch (e) {
                console.error(e);
            }
        }
    };

    if (loading) return <div>Yuklanmoqda...</div>;

    // Umumiy hisoblar
    const totalBorrowed = debts.filter(d => d.type === 'BORROWED' && d.status === 'ACTIVE').reduce((sum, d) => sum + (parseFloat(d.amount) - parseFloat(d.amount_paid)), 0);
    const totalLent = debts.filter(d => d.type === 'LENT' && d.status === 'ACTIVE').reduce((sum, d) => sum + (parseFloat(d.amount) - parseFloat(d.amount_paid)), 0);

    // Oylik hisoblar
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthDebts = debts.filter(d => (d.date || '').startsWith(currentMonth));
    const monthBorrowed = monthDebts.filter(d => d.type === 'BORROWED').reduce((s, d) => s + parseFloat(d.amount), 0);
    const monthLent = monthDebts.filter(d => d.type === 'LENT').reduce((s, d) => s + parseFloat(d.amount), 0);
    const settledCount = debts.filter(d => d.status === 'SETTLED').length;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

            {/* OYLIK STATISTIKA */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                <div className="glass-panel stat-card">
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '50%', color: 'var(--danger)' }}>
                        <ArrowDownRight size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>Umumiy qarzlarim</p>
                        <h3 style={{ margin: 0 }}>{formatMoney(totalBorrowed)} so'm</h3>
                    </div>
                </div>
                <div className="glass-panel stat-card">
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '50%', color: 'var(--success)' }}>
                        <ArrowUpRight size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>Menga berishi kerak</p>
                        <h3 style={{ margin: 0 }}>{formatMoney(totalLent)} so'm</h3>
                    </div>
                </div>
                <div className="glass-panel stat-card">
                    <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '12px', borderRadius: '50%', color: 'var(--primary)' }}>
                        <Calendar size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>Bu oy olingan/berilgan</p>
                        <h3 style={{ margin: 0 }}>{formatMoney(monthBorrowed + monthLent)} so'm</h3>
                    </div>
                </div>
                <div className="glass-panel stat-card">
                    <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '12px', borderRadius: '50%', color: 'var(--accent)' }}>
                        <CheckCircle size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>To'langan qarzlar</p>
                        <h3 style={{ margin: 0 }}>{settledCount} ta</h3>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '32px' }}>
            
            {/* ADD FORM */}
            <div className="glass-panel" style={{ padding: '24px', height: 'fit-content' }}>
                <h3 style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Plus size={20} /> Yangi Qarz / Kredit
                </h3>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    <div>
                        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Turi</label>
                        <select className="glass-input" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                            <option value="BORROWED">Qarz Oldim (Borrowed)</option>
                            <option value="LENT">Qarz Berdim (Lent)</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Shaxs ismi</label>
                        <input type="text" className="glass-input" placeholder="Kimdan/Kimga" value={form.person_name} onChange={e => setForm({...form, person_name: e.target.value})} required />
                    </div>

                    {(form.person_name.toLowerCase().includes('jamg') || form.person_name.toLowerCase().includes('jamgarma')) && (
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Qaysi jamg'armadan yechilsin?</label>
                            <select className="glass-input" value={form.savings_id} onChange={e => setForm({...form, savings_id: e.target.value})} required>
                                <option value="">Maqsadni tanlang...</option>
                                {savings.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({formatMoney(s.current_amount)} so'm)</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Summa (so'm)</label>
                        <input type="number" step="0.01" className="glass-input" placeholder="0.00" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} required />
                        {form.amount && <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '4px' }}>Format: {formatMoney(form.amount)} so'm</div>}
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Qarz sanasi</label>
                        <input type="date" className="glass-input" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Qaytarish muddati</label>
                        <input type="date" className="glass-input" value={form.due_date} onChange={e => setForm({...form, due_date: e.target.value})} />
                    </div>

                    <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>Saqlash</button>
                </form>
            </div>

            {/* LIST */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <h1 className="text-gradient" style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                    <CreditCard size={32} /> Qarzlar ro'yxati
                </h1>

                <div className="glass-panel" style={{ padding: '24px' }}>
                    <div style={{ display: 'grid', gap: '16px' }}>
                        {debts.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>Hozircha qarzlar yo'q...</p> : 
                        debts.map(d => {
                            const percent = Math.min(100, Math.round((d.amount_paid / d.amount) * 100));
                            const isLent = d.type === 'LENT';
                            return (
                            <div key={d.id} style={{ 
                                padding: '16px', 
                                background: 'rgba(15, 23, 42, 0.4)', 
                                borderRadius: '12px', 
                                border: '1px solid var(--border)',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '12px'
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <div>
                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: isLent ? 'var(--success)' : 'var(--danger)' }}>
                                            {d.person_name} {isLent ? '(Berdim)' : '(Oldim)'}
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            Berilgan sana: {d.date || 'Noma\'lum'}
                                        </div>
                                        <div style={{ 
                                            fontSize: '14px', 
                                            color: d.due_date ? 'var(--accent)' : 'var(--text-muted)', 
                                            marginTop: '8px', 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '6px', 
                                            fontWeight: '500',
                                            background: d.due_date ? 'rgba(6, 182, 212, 0.05)' : 'transparent',
                                            padding: d.due_date ? '4px 8px' : '0',
                                            borderRadius: '6px',
                                            width: 'fit-content'
                                        }}>
                                            <Clock size={16} /> Qaytarish muddati: {d.due_date || 'Belgilanmagan'}
                                        </div>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '20px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                            {formatMoney(d.amount)} so'm
                                            <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                                                <button onClick={() => openEditModal(d)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                                    <Edit2 size={18} />
                                                </button>
                                                <button onClick={() => handleDelete(d.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: 0.8 }}>
                                                    <Trash2 size={18} />
                                                </button>
                                            </div>
                                        </div>
                                        {d.status === 'SETTLED' ? (
                                            <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', justifyContent: 'flex-end', marginTop: '4px' }}>
                                                <CheckCircle size={14} /> To'landi
                                            </div>
                                        ) : (
                                            <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '4px' }}>
                                                Qoldi: {formatMoney(d.amount - d.amount_paid)} so'm
                                            </div>
                                        )}
                                    </div>
                                </div>
                                
                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ width: `${percent}%`, background: isLent ? 'var(--success)' : 'var(--danger)', height: '100%', transition: 'width 0.3s ease' }} />
                                    </div>
                                    <div style={{ fontSize: '14px', color: 'var(--text-muted)', minWidth: '40px' }}>{percent}%</div>
                                </div>

                                {d.status === 'ACTIVE' && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                        <button 
                                            onClick={() => setOpenHistory(openHistory === d.id ? null : d.id)} 
                                            style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '14px' }}
                                        >
                                            {openHistory === d.id ? 'Tarixni yopish' : 'Tarixni ko\'rish'}
                                        </button>
                                        <button onClick={() => openPaymentModal(d)} className="btn-primary" style={{ padding: '6px 12px', fontSize: '14px', width: 'auto' }}>
                                            To'lov qo'shish
                                        </button>
                                    </div>
                                )}

                                {openHistory === d.id && (
                                    <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Tranzaksiyalar tarixi:</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {transactions.filter(t => t.debt === d.id).length === 0 ? (
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Hozircha tarix mavjud emas</div>
                                            ) : (
                                                transactions.filter(t => t.debt === d.id).map(t => (
                                                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                        <span style={{ color: 'var(--text-muted)' }}>{t.date}</span>
                                                        <span style={{ fontWeight: '500', color: t.type === 'INCOME' ? 'var(--success)' : (t.type === 'SAVING' ? 'var(--accent)' : 'var(--danger)') }}>
                                                            {t.type === 'INCOME' ? '+' : '-'}{formatMoney(t.amount)} so'm
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

            {/* PAYMENT MODAL */}
            {paymentModalData && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3 style={{ marginBottom: '16px' }}>To'lov qo'shish</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '16px', fontSize: '14px' }}>
                            Umumiy: {formatMoney(paymentModalData.amount)} so'm<br/>
                            To'langan: {formatMoney(paymentModalData.amount_paid)} so'm<br/>
                            <strong>Qolgan: {formatMoney(paymentModalData.amount - paymentModalData.amount_paid)} so'm</strong>
                        </p>
                        <form onSubmit={handlePaymentSubmit}>
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>To'lanayotgan Summa (so'm)</label>
                                <input 
                                    type="number" 
                                    step="0.01" 
                                    className="glass-input" 
                                    value={paymentAmount} 
                                    onChange={e => setPaymentAmount(e.target.value)} 
                                    autoFocus
                                    required 
                                />
                                {paymentAmount && <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '4px' }}>Format: {formatMoney(paymentAmount)} so'm</div>}
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Tasdiqlash</button>
                                <button type="button" onClick={() => setPaymentModalData(null)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', borderRadius: '8px', cursor: 'pointer' }}>Bekor qilish</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* EDIT MODAL */}
            {editModalData && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3 style={{ marginBottom: '24px' }}>Qarz/Kreditni tahrirlash</h3>
                        <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Turi</label>
                                <select className="glass-input" value={editForm.type} onChange={e => setEditForm({...editForm, type: e.target.value})}>
                                    <option value="BORROWED">Qarz Oldim (Borrowed)</option>
                                    <option value="LENT">Qarz Berdim (Lent)</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Shaxs ismi</label>
                                <input type="text" className="glass-input" value={editForm.person_name} onChange={e => setEditForm({...editForm, person_name: e.target.value})} required />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Umumiy Summa (so'm)</label>
                                <input type="number" step="0.01" className="glass-input" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: e.target.value})} required />
                                {editForm.amount && <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '4px' }}>Format: {formatMoney(editForm.amount)} so'm</div>}
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Qarz sanasi</label>
                                <input type="date" className="glass-input" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} required />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Qaytarish muddati</label>
                                <input type="date" className="glass-input" value={editForm.due_date} onChange={e => setEditForm({...editForm, due_date: e.target.value})} />
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
