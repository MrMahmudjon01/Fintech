import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, Calendar, ArrowUpRight, ArrowDownRight, PiggyBank, CreditCard, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api';
import { formatMoney } from '../utils/format';

const today = () => new Date().toISOString().split('T')[0];

const TX_TYPE_CONFIG = {
    'INCOME': { label: 'Daromad', color: 'var(--success)', icon: '+', prefix: '+' },
    'EXPENSE': { label: 'Xarajat', color: 'var(--danger)', icon: '-', prefix: '-' },
    'SAVINGS_DEPOSIT': { label: "Jamg'armaga", color: 'var(--accent)', icon: '↓', prefix: '-' },
    'SAVINGS_WITHDRAW': { label: "Jamg'armadan", color: '#f59e0b', icon: '↑', prefix: '+' },
    'SAVING': { label: "Jamg'armaga", color: 'var(--accent)', icon: '↓', prefix: '-' },
    'LOAN_IN': { label: 'Qarz olindi', color: 'var(--success)', icon: '+', prefix: '+' },
    'LOAN_OUT': { label: 'Qarz berildi', color: 'var(--danger)', icon: '-', prefix: '-' },
    'LOAN_REPAY': { label: "Qarz to'lovi", color: '#a78bfa', icon: '⟳', prefix: '' },
    'TRANSFER': { label: "O'tkazma", color: 'var(--accent)', icon: '⇄', prefix: '' },
};

export default function Transactions() {
    const [transactions, setTransactions] = useState([]);
    const [categories, setCategories] = useState([]);
    const [savings, setSavings] = useState([]);
    const [balance, setBalance] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [form, setForm] = useState({
        amount: '', type: 'EXPENSE', category: '', savings_id: '', note: '', date: today()
    });

    const [editModalData, setEditModalData] = useState(null);
    const [editForm, setEditForm] = useState({ amount: '', type: 'EXPENSE', category: '', note: '', date: today() });

    const [filterType, setFilterType] = useState('');
    
    // Delete Modal
    const [deleteModalData, setDeleteModalData] = useState(null);

    useEffect(() => { fetchData(); }, []);

    const fetchData = async () => {
        try {
            const [txRes, catRes, savRes, balRes] = await Promise.all([
                api.get('finance/transactions/'),
                api.get('finance/categories/'),
                api.get('finance/savings/'),
                api.get('finance/balance/')
            ]);
            const txData = txRes.data.results || txRes.data;
            setTransactions(txData);
            setCategories(catRes.data);
            setSavings(savRes.data);
            setBalance(balRes.data);
            if (catRes.data.length > 0 && !form.category) {
                setForm(f => ({ ...f, category: catRes.data[0].id }));
            }
        } catch (error) {
            console.error("Xatolik", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        const cleanData = {
            ...form,
            category: form.category === '' ? null : form.category,
            savings_id: form.savings_id === '' ? null : form.savings_id
        };
        try {
            await api.post('finance/transactions/', cleanData);
            setForm({ amount: '', type: 'EXPENSE', category: categories.length > 0 ? categories[0].id : '', savings_id: '', note: '', date: today() });
            fetchData();
        } catch (e) {
            alert(e.response?.data?.error || "Tranzaksiya qo'shishda xatolik!");
        } finally {
            setIsSubmitting(false);
        }
    };

    const openEditModal = (t) => {
        setEditModalData(t);
        setEditForm({
            amount: t.amount,
            type: t.type,
            category: t.category || '',
            note: t.note || '',
            date: t.date || today()
        });
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        const cleanData = {
            ...editForm,
            category: editForm.category === '' ? null : editForm.category
        };
        try {
            await api.patch(`finance/transactions/${editModalData.id}/`, cleanData);
            setEditModalData(null);
            fetchData();
        } catch (e) {
            alert(e.response?.data?.error || "Tahrirlashda xatolik!");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if(!deleteModalData) return;
        setIsSubmitting(true);
        try {
            await api.delete(`finance/transactions/${deleteModalData}/`);
            setTransactions(transactions.filter(t => t.id !== deleteModalData));
            setDeleteModalData(null);
            fetchData();
        } catch (e) {
            console.error(e);
            alert(e.response?.data?.error || "O'chirishda xatolik!");
        } finally {
            setIsSubmitting(false);
        }
    }

    if (loading) return <div style={{ color: 'var(--text-main)', padding: '40px', textAlign: 'center' }}>Yuklanmoqda...</div>;

    // Oylik hisoblar
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthTx = transactions.filter(t => (t.date || '').startsWith(currentMonth));
    const monthIncome = monthTx.filter(t => t.type === 'INCOME').reduce((s, t) => s + parseFloat(t.amount), 0);
    const monthExpense = monthTx.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + parseFloat(t.amount), 0);

    // Filter transactions
    const filteredTx = filterType ? transactions.filter(t => t.type === filterType) : transactions;

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

            {/* OYLIK STATISTIKA */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                <div className="glass-panel stat-card">
                    <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '12px', borderRadius: '50%', color: 'var(--primary)' }}>
                        <CreditCard size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>Asosiy Balans</p>
                        <h3 style={{ margin: 0 }} className="text-gradient">{balance ? formatMoney(balance.total_amount) : '0'} so'm</h3>
                    </div>
                </div>
                <div className="glass-panel stat-card">
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '50%', color: 'var(--success)' }}>
                        <ArrowUpRight size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>Oylik Daromad</p>
                        <h3 style={{ margin: 0 }}>{formatMoney(monthIncome)} so'm</h3>
                    </div>
                </div>
                <div className="glass-panel stat-card">
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '12px', borderRadius: '50%', color: 'var(--danger)' }}>
                        <ArrowDownRight size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>Oylik Xarajat</p>
                        <h3 style={{ margin: 0 }}>{formatMoney(monthExpense)} so'm</h3>
                    </div>
                </div>
                <div className="glass-panel stat-card">
                    <div style={{ background: 'rgba(6, 182, 212, 0.1)', padding: '12px', borderRadius: '50%', color: 'var(--accent)' }}>
                        <Calendar size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>Oylik Sof</p>
                        <h3 style={{ margin: 0, color: monthIncome - monthExpense >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatMoney(monthIncome - monthExpense)} so'm</h3>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 1fr) 2fr', gap: '32px' }}>

            {/* ADD FORM */}
            <div className="glass-panel" style={{ padding: '24px', height: 'fit-content' }}>
                <h3 style={{ marginBottom: '24px' }}>Yangi Tranzaksiya</h3>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    <div>
                        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Turi</label>
                        <select className="glass-input" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                            <option value="EXPENSE">Xarajat</option>
                            <option value="INCOME">Daromad</option>
                            <option value="SAVING">Jamg'armaga</option>
                        </select>
                    </div>

                    {form.type === 'SAVING' ? (
                        <div>
                            <div style={{ padding: '12px', background: 'rgba(6, 182, 212, 0.1)', borderRadius: '8px', border: '1px solid rgba(6, 182, 212, 0.3)' }}>
                                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <PiggyBank size={18} color="var(--accent)" />
                                    Pul to'g'ridan-to'g'ri umumiy Jamg'armaga o'tkaziladi. Keyin uni har xil maqsadlarga bo'lishingiz mumkin.
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div>
                            <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                                <span>Kategoriya</span>
                                <Link to="/categories" style={{ color: 'var(--accent)', textDecoration: 'none' }}>+ Boshqarish</Link>
                            </label>
                            <select className="glass-input" value={form.category} onChange={e => setForm({...form, category: e.target.value})} required={form.type !== 'SAVING'}>
                                <option value="">Tanlang...</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
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
                        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Sana</label>
                        <input type="date" className="glass-input" value={form.date} onChange={e => setForm({...form, date: e.target.value})} required />
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Eslatma</label>
                        <input type="text" className="glass-input" placeholder="Non, Yo'lkira..." value={form.note} onChange={e => setForm({...form, note: e.target.value})} />
                    </div>

                    <button disabled={isSubmitting} type="submit" className="btn-primary" style={{ marginTop: '8px', opacity: isSubmitting ? 0.5 : 1 }}>
                        <Plus size={20} /> {isSubmitting ? 'Qo\'shilmoqda...' : 'Qo\'shish'}
                    </button>
                </form>
            </div>

            {/* LIST */}
            <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                    <h3 style={{ margin: 0 }}>Oxirgi Tranzaksiyalar</h3>
                    <select className="glass-input" style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
                        value={filterType} onChange={e => setFilterType(e.target.value)}>
                        <option value="">Barchasi</option>
                        <option value="INCOME">Daromad</option>
                        <option value="EXPENSE">Xarajat</option>
                        <option value="SAVINGS_DEPOSIT">Jamg'armaga</option>
                        <option value="SAVINGS_WITHDRAW">Jamg'armadan</option>
                        <option value="LOAN_IN">Qarz olindi</option>
                        <option value="LOAN_OUT">Qarz berildi</option>
                        <option value="LOAN_REPAY">Qarz to'lovi</option>
                    </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {filteredTx.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>Hozircha bo'sh...</p> :
                    filteredTx.map(t => {
                        const config = TX_TYPE_CONFIG[t.type] || { label: t.type_display || t.type, color: 'var(--text-muted)', prefix: '' };
                        return (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <div>
                                <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <span style={{ background: `${config.color}22`, color: config.color, padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '600' }}>
                                        {config.label}
                                    </span>
                                    {t.category_name || t.note || ''}
                                </div>
                                <div style={{ fontSize: '14px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Calendar size={14} /> {t.date || new Date(t.created_at).toLocaleDateString()}
                                    {t.note && <> • {t.note}</>}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <span style={{ fontWeight: 'bold', fontSize: '18px', color: config.color }}>
                                    {config.prefix}{formatMoney(t.amount)} so'm
                                </span>
                                <>
                                    <button onClick={() => openEditModal(t)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                        <Edit2 size={20} />
                                    </button>
                                    <button onClick={() => setDeleteModalData(t.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: 0.8 }}>
                                        <Trash2 size={20} />
                                    </button>
                                </>
                            </div>
                        </div>
                    )})}
                </div>
            </div>

            {/* EDIT MODAL */}
            {editModalData && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h3 style={{ marginBottom: '24px' }}>Tranzaksiyani tahrirlash</h3>
                        <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Turi</label>
                                <select className="glass-input" value={editForm.type} onChange={e => setEditForm({...editForm, type: e.target.value})}>
                                    <option value="EXPENSE">Xarajat</option>
                                    <option value="INCOME">Daromad</option>
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Kategoriya</label>
                                <select className="glass-input" value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})}>
                                    <option value="">Tanlang...</option>
                                    {categories.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Summa (so'm)</label>
                                <input type="number" step="0.01" className="glass-input" value={editForm.amount} onChange={e => setEditForm({...editForm, amount: e.target.value})} required />
                                {editForm.amount && <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '4px' }}>Format: {formatMoney(editForm.amount)} so'm</div>}
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Sana</label>
                                <input type="date" className="glass-input" value={editForm.date} onChange={e => setEditForm({...editForm, date: e.target.value})} required />
                            </div>

                            <div>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Eslatma</label>
                                <input type="text" className="glass-input" value={editForm.note} onChange={e => setEditForm({...editForm, note: e.target.value})} />
                            </div>

                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                <button disabled={isSubmitting} type="submit" className="btn-primary" style={{ flex: 1, opacity: isSubmitting ? 0.5 : 1 }}>{isSubmitting ? 'Saqlanmoqda...' : 'Saqlash'}</button>
                                <button type="button" onClick={() => setEditModalData(null)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', borderRadius: '8px', cursor: 'pointer' }}>Bekor</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* DELETE MODAL */}
            {deleteModalData && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{ maxWidth: '400px', textAlign: 'center' }}>
                        <div style={{ color: 'var(--danger)', marginBottom: '16px', display: 'flex', justifyContent: 'center' }}>
                            <div style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%' }}>
                                <Trash2 size={48} />
                            </div>
                        </div>
                        <h3 style={{ marginBottom: '8px' }}>Rostdan ham o'chirmoqchimisiz?</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px' }}>
                            Ushbu tranzaksiya va unga bog'liq barcha ma'lumotlar o'chiriladi. Bu jarayon balansingizda avtomatik hisob-kitob qilinadi.
                        </p>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={handleDelete} disabled={isSubmitting} className="btn-primary" style={{ flex: 1, backgroundColor: 'var(--danger)', border: 'none', opacity: isSubmitting ? 0.5 : 1 }}>
                                {isSubmitting ? 'O\'chirilmoqda...' : 'Ha, o\'chirish'}
                            </button>
                            <button onClick={() => setDeleteModalData(null)} disabled={isSubmitting} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', borderRadius: '8px', cursor: 'pointer' }}>
                                Bekor qilish
                            </button>
                        </div>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
}
