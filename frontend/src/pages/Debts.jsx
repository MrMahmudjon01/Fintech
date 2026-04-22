import React, { useEffect, useState } from 'react';
import { CreditCard, Plus, CheckCircle, Clock, Trash2, Edit2, Calendar, ArrowUpRight, ArrowDownRight, DollarSign } from 'lucide-react';
import api from '../api';
import { formatMoney } from '../utils/format';

const today = () => new Date().toISOString().split('T')[0];

export default function Debts() {
    const [loans, setLoans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [form, setForm] = useState({
        person_name: '',
        amount: '',
        direction: 'INCOMING',
        due_date: '',
        date: today(),
        note: ''
    });

    const [paymentModalData, setPaymentModalData] = useState(null);
    const [paymentAmount, setPaymentAmount] = useState('');
    const [paymentNote, setPaymentNote] = useState('');

    const [editModalData, setEditModalData] = useState(null);
    const [editForm, setEditForm] = useState({
        person_name: '', amount: '', direction: 'INCOMING',
        due_date: '', date: today(), note: ''
    });

    // Transaction history for loans
    const [loanHistory, setLoanHistory] = useState({});
    const [openHistory, setOpenHistory] = useState(null);

    // Delete Modal
    const [deleteModalData, setDeleteModalData] = useState(null);

    useEffect(() => { fetchLoans(); }, []);

    const fetchLoans = async () => {
        try {
            const res = await api.get('finance/loans/');
            setLoans(res.data);
        } catch (error) {
            console.error("Xatolik", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchLoanHistory = async (loanId) => {
        try {
            const res = await api.get(`finance/transactions/by_loan/?loan_id=${loanId}`);
            const txData = res.data.results || res.data;
            setLoanHistory(prev => ({ ...prev, [loanId]: txData }));
        } catch (e) { console.error(e); }
    };

    const toggleHistory = (loanId) => {
        if (openHistory === loanId) {
            setOpenHistory(null);
        } else {
            setOpenHistory(loanId);
            if (!loanHistory[loanId]) {
                fetchLoanHistory(loanId);
            }
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const payload = { ...form };
            if (!payload.due_date) delete payload.due_date;

            await api.post('finance/loans/', payload);
            setForm({ person_name: '', amount: '', direction: 'INCOMING', due_date: '', date: today(), note: '' });
            fetchLoans();
        } catch (e) {
            alert(e.response?.data?.error || "Qarz qo'shishda xatolik!");
        } finally {
            setIsSubmitting(false);
        }
    };

    const openPaymentModal = (loan) => {
        setPaymentModalData(loan);
        setPaymentAmount('');
        setPaymentNote('');
    };

    const handlePaymentSubmit = async (e) => {
        e.preventDefault();
        if (!paymentModalData || isSubmitting) return;
        setIsSubmitting(true);

        try {
            await api.post(`finance/loans/${paymentModalData.id}/repay/`, {
                amount: paymentAmount,
                note: paymentNote
            });
            setPaymentModalData(null);
            fetchLoans();
        } catch (e) {
            alert(e.response?.data?.error || "To'lovni saqlashda xatolik");
        } finally {
            setIsSubmitting(false);
        }
    };

    const openEditModal = (d) => {
        setEditModalData(d);
        setEditForm({
            person_name: d.person_name,
            amount: d.amount,
            direction: d.direction,
            due_date: d.due_date || '',
            date: d.date || today(),
            note: d.note || ''
        });
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (isSubmitting) return;
        setIsSubmitting(true);
        try {
            const payload = { ...editForm };
            if (!payload.due_date) delete payload.due_date;
            await api.patch(`finance/loans/${editModalData.id}/`, payload);
            setEditModalData(null);
            fetchLoans();
        } catch (e) {
            alert(e.response?.data?.error || "Tahrirlashda xatolik!");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteModalData) return;
        setIsSubmitting(true);
        try {
            await api.delete(`finance/loans/${deleteModalData}/`);
            setDeleteModalData(null);
            fetchLoans();
        } catch (e) {
            console.error(e);
            alert(e.response?.data?.error || "O'chirishda xatolik!");
        } finally {
            setIsSubmitting(false);
        }
    };

    if (loading) return <div style={{ color: 'var(--text-main)', padding: '40px', textAlign: 'center' }}>Yuklanmoqda...</div>;

    // Umumiy hisoblar
    const totalBorrowed = loans.filter(d => d.direction === 'INCOMING' && d.status === 'ACTIVE')
        .reduce((sum, d) => sum + (parseFloat(d.amount) - parseFloat(d.amount_paid)), 0);
    const totalLent = loans.filter(d => d.direction === 'OUTGOING' && d.status === 'ACTIVE')
        .reduce((sum, d) => sum + (parseFloat(d.amount) - parseFloat(d.amount_paid)), 0);

    // Oylik hisoblar
    const currentMonth = new Date().toISOString().slice(0, 7);
    const monthLoans = loans.filter(d => (d.date || '').startsWith(currentMonth));
    const monthBorrowed = monthLoans.filter(d => d.direction === 'INCOMING').reduce((s, d) => s + parseFloat(d.amount), 0);
    const monthLent = monthLoans.filter(d => d.direction === 'OUTGOING').reduce((s, d) => s + parseFloat(d.amount), 0);
    const settledCount = loans.filter(d => d.status === 'SETTLED').length;

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
                    <Plus size={20} /> Yangi Qarz
                </h3>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

                    <div>
                        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Turi</label>
                        <select className="glass-input" value={form.direction} onChange={e => setForm({...form, direction: e.target.value})}>
                            <option value="INCOMING">Qarz Oldim (Men olayapman)</option>
                            <option value="OUTGOING">Qarz Berdim (Men berayapman)</option>
                        </select>
                    </div>

                    <div>
                        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Shaxs ismi</label>
                        <input type="text" className="glass-input" placeholder="Kimdan/Kimga" value={form.person_name} onChange={e => setForm({...form, person_name: e.target.value})} required />
                    </div>

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

                    <div>
                        <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Eslatma</label>
                        <input type="text" className="glass-input" placeholder="Izoh..." value={form.note} onChange={e => setForm({...form, note: e.target.value})} />
                    </div>

                    <div style={{ padding: '12px', background: form.direction === 'INCOMING' ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', border: `1px solid ${form.direction === 'INCOMING' ? 'var(--success)' : 'var(--danger)'}`, fontSize: '13px', color: 'var(--text-muted)' }}>
                        💡 {form.direction === 'INCOMING'
                            ? "Qarz olganingizda pul asosiy balansga qo'shiladi"
                            : "Qarz berganingizda pul asosiy balansdan yechiladi"
                        }
                    </div>

                    <button disabled={isSubmitting} type="submit" className="btn-primary" style={{ marginTop: '8px', opacity: isSubmitting ? 0.5 : 1 }}>{isSubmitting ? 'Saqlanmoqda...' : 'Saqlash'}</button>
                </form>
            </div>

            {/* LIST */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <h1 className="text-gradient" style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: 0 }}>
                    <CreditCard size={32} /> Qarzlar ro'yxati
                </h1>

                <div className="glass-panel" style={{ padding: '24px' }}>
                    <div style={{ display: 'grid', gap: '16px' }}>
                        {loans.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>Hozircha qarzlar yo'q...</p> :
                        loans.map(d => {
                            const percent = d.repayment_percent || Math.min(100, Math.round((parseFloat(d.amount_paid) / parseFloat(d.amount)) * 100));
                            const isOutgoing = d.direction === 'OUTGOING';
                            const remaining = parseFloat(d.remaining_amount || (d.amount - d.amount_paid));
                            const historyItems = loanHistory[d.id] || [];
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
                                        <div style={{ fontSize: '18px', fontWeight: 'bold', color: isOutgoing ? 'var(--success)' : 'var(--danger)' }}>
                                            {d.person_name} {isOutgoing ? '(Berdim)' : '(Oldim)'}
                                        </div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>
                                            Berilgan sana: {d.date || "Noma'lum"}
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
                                        {d.note && (
                                            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                                                📝 {d.note}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '20px', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
                                            {formatMoney(d.amount)} so'm
                                            <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                                                <button onClick={() => openEditModal(d)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                                    <Edit2 size={18} />
                                                </button>
                                                <button onClick={() => setDeleteModalData(d.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: 0.8 }}>
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
                                                Qoldi: {formatMoney(remaining)} so'm
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.1)', height: '8px', borderRadius: '4px', overflow: 'hidden' }}>
                                        <div style={{ width: `${percent}%`, background: isOutgoing ? 'var(--success)' : 'var(--danger)', height: '100%', transition: 'width 0.3s ease' }} />
                                    </div>
                                    <div style={{ fontSize: '14px', color: 'var(--text-muted)', minWidth: '40px' }}>{percent}%</div>
                                </div>

                                {d.status === 'ACTIVE' && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                                        <button
                                            onClick={() => toggleHistory(d.id)}
                                            style={{ background: 'transparent', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: '14px' }}
                                        >
                                            {openHistory === d.id ? 'Tarixni yopish' : 'Tarixni ko\'rish'}
                                        </button>
                                        <button onClick={() => openPaymentModal(d)} className="btn-primary" style={{ padding: '6px 16px', fontSize: '14px', width: 'auto' }}>
                                            <DollarSign size={16} /> To'lov qo'shish
                                        </button>
                                    </div>
                                )}

                                {openHistory === d.id && (
                                    <div style={{ marginTop: '12px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
                                        <div style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px' }}>Tranzaksiyalar tarixi:</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {historyItems.length === 0 ? (
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Hozircha tarix mavjud emas</div>
                                            ) : (
                                                historyItems.map(t => (
                                                    <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                        <div>
                                                            <span style={{ color: 'var(--text-muted)' }}>{t.date}</span>
                                                            <span style={{ marginLeft: '8px', color: 'var(--text-muted)', fontSize: '12px' }}>{t.type_display}</span>
                                                        </div>
                                                        <span style={{ fontWeight: '500', color: t.type === 'LOAN_IN' ? 'var(--success)' : (t.type === 'LOAN_REPAY' ? 'var(--accent)' : 'var(--danger)') }}>
                                                            {t.type === 'LOAN_IN' || (t.type === 'LOAN_REPAY' && d.direction === 'OUTGOING') ? '+' : '-'}
                                                            {formatMoney(t.amount)} so'm
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
                            {paymentModalData.person_name}<br/>
                            Umumiy: {formatMoney(paymentModalData.amount)} so'm<br/>
                            To'langan: {formatMoney(paymentModalData.amount_paid)} so'm<br/>
                            <strong>Qolgan: {formatMoney(parseFloat(paymentModalData.remaining_amount || (paymentModalData.amount - paymentModalData.amount_paid)))} so'm</strong>
                        </p>
                        <div style={{ padding: '10px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
                            💡 {paymentModalData.direction === 'INCOMING'
                                ? "To'lov asosiy balansdan yechiladi (siz qaytarayapsiz)"
                                : "To'lov asosiy balansga qo'shiladi (sizga qaytarishyapti)"
                            }
                        </div>
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
                            <div style={{ marginBottom: '16px' }}>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Eslatma</label>
                                <input type="text" className="glass-input" placeholder="Izoh..." value={paymentNote} onChange={e => setPaymentNote(e.target.value)} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button disabled={isSubmitting} type="submit" className="btn-primary" style={{ flex: 1, opacity: isSubmitting ? 0.5 : 1 }}>{isSubmitting ? '...' : 'Tasdiqlash'}</button>
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
                        <h3 style={{ marginBottom: '24px' }}>Qarzni tahrirlash</h3>
                        <form onSubmit={handleEditSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Turi</label>
                                <select className="glass-input" value={editForm.direction} onChange={e => setEditForm({...editForm, direction: e.target.value})}>
                                    <option value="INCOMING">Qarz Oldim</option>
                                    <option value="OUTGOING">Qarz Berdim</option>
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
                            <div>
                                <label style={{ display: 'block', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px' }}>Eslatma</label>
                                <input type="text" className="glass-input" value={editForm.note} onChange={e => setEditForm({...editForm, note: e.target.value})} />
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                <button disabled={isSubmitting} type="submit" className="btn-primary" style={{ flex: 1, opacity: isSubmitting ? 0.5 : 1 }}>{isSubmitting ? '...' : 'Saqlash'}</button>
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
                            Ushbu qarz ro'yxati va unga bog'liq barcha ma'lumotlar o'chiriladi. Bu jarayon balansingizda avtomatik hisob-kitob qilinadi.
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
    );
}
