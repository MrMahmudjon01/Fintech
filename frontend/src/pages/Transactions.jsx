import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Edit2, Calendar, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../api';
import { formatMoney } from '../utils/format';

const today = () => new Date().toISOString().split('T')[0];

export default function Transactions() {
    const [transactions, setTransactions] = useState([]);
    const [categories, setCategories] = useState([]);
    const [savings, setSavings] = useState([]);
    const [loading, setLoading] = useState(true);

    const [form, setForm] = useState({
        amount: '', type: 'EXPENSE', category: '', savings_id: '', note: '', date: today()
    });

    const [editModalData, setEditModalData] = useState(null);
    const [editForm, setEditForm] = useState({ amount: '', type: 'EXPENSE', category: '', savings: '', note: '', date: today() });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [txRes, catRes, savRes] = await Promise.all([
                api.get('finance/transactions/'),
                api.get('finance/categories/'),
                api.get('finance/savings/')
            ]);
            const txData = txRes.data.results || txRes.data;
            setTransactions(txData);
            setCategories(catRes.data);
            setSavings(savRes.data);
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
            alert("Tranzaksiya qo'shishda xatolik!");
        }
    };

    const openEditModal = (t) => {
        setEditModalData(t);
        setEditForm({
            amount: t.amount,
            type: t.type,
            category: t.category || '',
            savings: t.savings || '',
            note: t.note || '',
            date: t.date || today()
        });
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        const cleanData = {
            ...editForm,
            category: editForm.category === '' ? null : editForm.category,
            savings_id: editForm.savings_id === '' ? null : editForm.savings_id
        };
        try {
            await api.patch(`finance/transactions/${editModalData.id}/`, cleanData);
            setEditModalData(null);
            fetchData();
        } catch (e) {
            alert("Tahrirlashda xatolik!");
        }
    };

    const handleDelete = async (id) => {
        if(window.confirm("O'chirilsinmi?")) {
            try {
                await api.delete(`finance/transactions/${id}/`);
                setTransactions(transactions.filter(t => t.id !== id));
            } catch (e) {
                console.error(e);
            }
        }
    }

    if (loading) return <div>Yuklanmoqda...</div>;

    // Oylik hisoblar
    const currentMonth = new Date().toISOString().slice(0, 7); // "2026-04"
    const monthTx = transactions.filter(t => (t.date || '').startsWith(currentMonth));
    const monthIncome = monthTx.filter(t => t.type === 'INCOME').reduce((s, t) => s + parseFloat(t.amount), 0);
    const monthExpense = monthTx.filter(t => t.type === 'EXPENSE' || t.type === 'SAVING').reduce((s, t) => s + parseFloat(t.amount), 0);

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>

            {/* OYLIK STATISTIKA */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
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
                    <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '12px', borderRadius: '50%', color: 'var(--primary)' }}>
                        <Calendar size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>Oylik Balans</p>
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
                            <option value="EXPENSE">Xarajat (Expense)</option>
                            <option value="INCOME">Daromad (Income)</option>
                            <option value="SAVING">Jamg'arma (Saving)</option>
                        </select>
                    </div>

                    {form.type === 'SAVING' ? (
                        <div>
                            <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Qaysi jamg'armaga?</label>
                            <select className="glass-input" value={form.savings_id} onChange={e => setForm({...form, savings_id: e.target.value})} required>
                                <option value="">Maqsadni tanlang...</option>
                                {savings.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({formatMoney(s.current_amount)} / {formatMoney(s.target_amount)})</option>
                                ))}
                            </select>
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

                    <button type="submit" className="btn-primary" style={{ marginTop: '8px' }}>
                        <Plus size={20} /> Qo'shish
                    </button>
                </form>
            </div>

            {/* LIST */}
            <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ marginBottom: '24px' }}>Oxirgi Tranzaksiyalar</h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {transactions.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>Hozircha bo'sh...</p> : 
                    transactions.map(t => (
                        <div key={t.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                            <div>
                                <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '4px' }}>{t.category_name || 'Kategoriyasiz'}</div>
                                <div style={{ fontSize: '14px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <Calendar size={14} /> {t.date || new Date(t.created_at).toLocaleDateString()} • {t.note || '-'}
                                </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <span style={{ fontWeight: 'bold', fontSize: '18px', color: t.type === 'INCOME' ? 'var(--success)' : (t.type === 'SAVING' ? 'var(--accent)' : 'var(--danger)') }}>
                                    {t.type === 'INCOME' ? '+' : '-'}{formatMoney(t.amount)} so'm
                                </span>
                                <button onClick={() => openEditModal(t)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                    <Edit2 size={20} />
                                </button>
                                <button onClick={() => handleDelete(t.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: 0.8 }}>
                                    <Trash2 size={20} />
                                </button>
                            </div>
                        </div>
                    ))}
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
                                    <option value="EXPENSE">Xarajat (Expense)</option>
                                    <option value="INCOME">Daromad (Income)</option>
                                    <option value="SAVING">Jamg'arma (Saving)</option>
                                </select>
                            </div>

                            {editForm.type === 'SAVING' ? (
                                <div>
                                    <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Qaysi jamg'armaga?</label>
                                    <select className="glass-input" value={editForm.savings_id} onChange={e => setEditForm({...editForm, savings_id: e.target.value})} required>
                                        <option value="">Maqsadni tanlang...</option>
                                        {savings.map(s => (
                                            <option key={s.id} value={s.id}>{s.name}</option>
                                        ))}
                                    </select>
                                </div>
                            ) : (
                                <div>
                                    <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Kategoriya</label>
                                    <select className="glass-input" value={editForm.category} onChange={e => setEditForm({...editForm, category: e.target.value})} required>
                                        <option value="">Tanlang...</option>
                                        {categories.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

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
                                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Saqlash</button>
                                <button type="button" onClick={() => setEditModalData(null)} style={{ flex: 1, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text-main)', borderRadius: '8px', cursor: 'pointer' }}>Bekor</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
}
