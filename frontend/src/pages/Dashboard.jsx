import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Activity, CreditCard, PiggyBank, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api';
import { formatMoney } from '../utils/format';

const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

export default function Dashboard() {
    const [transactions, setTransactions] = useState([]);
    const [debts, setDebts] = useState([]);
    const [savings, setSavings] = useState([]);
    const [loading, setLoading] = useState(true);

    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth()); // 0-indexed

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [txRes, debtRes, savRes] = await Promise.all([
                    api.get('finance/transactions/'),
                    api.get('finance/debts/'),
                    api.get('finance/savings/')
                ]);
                setTransactions(txRes.data.results || txRes.data);
                setDebts(debtRes.data);
                setSavings(savRes.data);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchAll();
    }, []);

    if (loading) return <div style={{ color: 'white' }}>Yuklanmoqda...</div>;

    // Filter by selected month
    const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    const monthTx = transactions.filter(t => (t.date || '').startsWith(monthKey));

    const totalIncome = monthTx.filter(t => t.type === 'INCOME').reduce((s, t) => s + parseFloat(t.amount), 0);
    const totalExpense = monthTx.filter(t => t.type === 'EXPENSE' || t.type === 'SAVING').reduce((s, t) => s + parseFloat(t.amount), 0);
    const balance = totalIncome - totalExpense;

    // Debts summary
    const totalBorrowed = debts.filter(d => d.type === 'BORROWED' && d.status === 'ACTIVE').reduce((s, d) => s + (d.amount - d.amount_paid), 0);
    const totalLent = debts.filter(d => d.type === 'LENT' && d.status === 'ACTIVE').reduce((s, d) => s + (d.amount - d.amount_paid), 0);

    // Savings
    const totalSaved = savings.reduce((s, sv) => s + parseFloat(sv.current_amount), 0);

    // Category breakdown for pie chart (expenses + savings, current month)
    const expenseTx = monthTx.filter(t => t.type === 'EXPENSE' || t.type === 'SAVING');
    const categoryMap = {};
    expenseTx.forEach(t => {
        const name = t.type === 'SAVING' ? 'Jamg\'arma' : (t.category_name || 'Boshqa');
        categoryMap[name] = (categoryMap[name] || 0) + parseFloat(t.amount);
    });
    const pieData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));
    const pieColors = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6', '#14b8a6'];

    // Custom label for pie
    const renderLabel = ({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`;

    const prevMonth = () => {
        if (selectedMonth === 0) { setSelectedMonth(11); setSelectedYear(selectedYear - 1); }
        else setSelectedMonth(selectedMonth - 1);
    };
    const nextMonth = () => {
        if (selectedMonth === 11) { setSelectedMonth(0); setSelectedYear(selectedYear + 1); }
        else setSelectedMonth(selectedMonth + 1);
    };

    return (
        <div>
            {/* MONTH PICKER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <h1 style={{ margin: 0 }}>Asosiy Panel</h1>
                <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '8px 20px', borderRadius: '12px' }}>
                    <button onClick={prevMonth} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}>
                        <ChevronLeft size={20} />
                    </button>
                    <span style={{ fontWeight: '600', fontSize: '16px', minWidth: '140px', textAlign: 'center' }}>
                        {MONTHS[selectedMonth]} {selectedYear}
                    </span>
                    <button onClick={nextMonth} style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', cursor: 'pointer' }}>
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* STAT CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
                <div className="glass-panel stat-card">
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '14px', borderRadius: '50%', color: 'var(--success)' }}>
                        <ArrowUpRight size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>Daromad</p>
                        <h3 style={{ margin: 0 }}>{formatMoney(totalIncome)} so'm</h3>
                    </div>
                </div>
                <div className="glass-panel stat-card">
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '14px', borderRadius: '50%', color: 'var(--danger)' }}>
                        <ArrowDownRight size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>Xarajat</p>
                        <h3 style={{ margin: 0 }}>{formatMoney(totalExpense)} so'm</h3>
                    </div>
                </div>
                <div className="glass-panel stat-card">
                    <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '14px', borderRadius: '50%', color: 'var(--primary)' }}>
                        <Activity size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>Balans</p>
                        <h3 style={{ margin: 0, color: balance >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatMoney(balance)} so'm</h3>
                    </div>
                </div>
                <div className="glass-panel stat-card">
                    <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '14px', borderRadius: '50%', color: 'var(--danger)' }}>
                        <CreditCard size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>Qarzlarim</p>
                        <h3 style={{ margin: 0 }}>{formatMoney(totalBorrowed)} so'm</h3>
                    </div>
                </div>
                <div className="glass-panel stat-card">
                    <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '14px', borderRadius: '50%', color: 'var(--success)' }}>
                        <CreditCard size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>Menga qarzi</p>
                        <h3 style={{ margin: 0 }}>{formatMoney(totalLent)} so'm</h3>
                    </div>
                </div>
                <div className="glass-panel stat-card">
                    <div style={{ background: 'rgba(139, 92, 246, 0.1)', padding: '14px', borderRadius: '50%', color: 'var(--primary)' }}>
                        <PiggyBank size={24} />
                    </div>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>Jamg'arma</p>
                        <h3 style={{ margin: 0 }}>{formatMoney(totalSaved)} so'm</h3>
                    </div>
                </div>
            </div>

            {/* PIE CHART */}
            <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ marginBottom: '24px' }}>Xarajatlar taqsimoti — {MONTHS[selectedMonth]} {selectedYear}</h3>
                {pieData.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px 0' }}>Bu oyda xarajatlar yo'q</p>
                ) : (
                    <div style={{ height: '350px', width: '100%' }}>
                        <ResponsiveContainer>
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    innerRadius={70}
                                    outerRadius={120}
                                    paddingAngle={4}
                                    dataKey="value"
                                    label={renderLabel}
                                    labelLine={true}
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={pieColors[index % pieColors.length]} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ background: 'var(--bg-dark)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                    formatter={(value) => [`${formatMoney(value)} so'm`, '']}
                                />
                                <Legend
                                    verticalAlign="bottom"
                                    iconType="circle"
                                    formatter={(value) => <span style={{ color: 'var(--text-main)' }}>{value}</span>}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>
        </div>
    );
}
