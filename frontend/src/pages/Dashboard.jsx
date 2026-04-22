import React, { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ArrowUpRight, ArrowDownRight, Activity, CreditCard, PiggyBank, ChevronLeft, ChevronRight, Wallet, TrendingUp } from 'lucide-react';
import api from '../api';
import { formatMoney } from '../utils/format';

const MONTHS = ['Yanvar', 'Fevral', 'Mart', 'Aprel', 'May', 'Iyun', 'Iyul', 'Avgust', 'Sentabr', 'Oktabr', 'Noyabr', 'Dekabr'];

export default function Dashboard() {
    const [transactions, setTransactions] = useState([]);
    const [loans, setLoans] = useState([]);
    const [savings, setSavings] = useState([]);
    const [mainBalance, setMainBalance] = useState(null);
    const [loading, setLoading] = useState(true);

    const now = new Date();
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

    useEffect(() => {
        const fetchAll = async () => {
            try {
                const [txRes, loanRes, savRes, balRes] = await Promise.all([
                    api.get('finance/transactions/'),
                    api.get('finance/loans/'),
                    api.get('finance/savings/'),
                    api.get('finance/balance/')
                ]);
                setTransactions(txRes.data.results || txRes.data);
                setLoans(loanRes.data);
                setSavings(savRes.data);
                setMainBalance(balRes.data);
            } catch (e) { console.error(e); }
            finally { setLoading(false); }
        };
        fetchAll();
    }, []);

    if (loading) return <div style={{ color: 'white', padding: '40px', textAlign: 'center' }}>Yuklanmoqda...</div>;

    // Filter by selected month
    const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
    const monthTx = transactions.filter(t => (t.date || '').startsWith(monthKey));

    const totalIncome = monthTx.filter(t => t.type === 'INCOME').reduce((s, t) => s + parseFloat(t.amount), 0);
    const totalExpense = monthTx.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + parseFloat(t.amount), 0);
    const totalSavingsDeposit = monthTx.filter(t => t.type === 'SAVINGS_DEPOSIT').reduce((s, t) => s + parseFloat(t.amount), 0);
    const balance = totalIncome - totalExpense;

    // Loans summary
    const totalBorrowed = loans.filter(d => d.direction === 'INCOMING' && d.status === 'ACTIVE')
        .reduce((s, d) => s + (parseFloat(d.amount) - parseFloat(d.amount_paid)), 0);
    const totalLent = loans.filter(d => d.direction === 'OUTGOING' && d.status === 'ACTIVE')
        .reduce((s, d) => s + (parseFloat(d.amount) - parseFloat(d.amount_paid)), 0);

    // Savings
    const poolSavings = savings.reduce((s, sv) => s + parseFloat(sv.current_amount), 0);
    const goalsSavings = savings.reduce((s, sv) => {
        return s + (sv.goals || []).reduce((gSum, g) => gSum + parseFloat(g.current_amount || 0), 0);
    }, 0);
    
    // For Dashboard card display: only show the main pool balance
    const totalSaved = poolSavings;
    
    // For Net Worth Calculation: Pool + Goals
    const totalSavingsValue = poolSavings + goalsSavings;

    // Main balance value
    const mainBalanceAmount = mainBalance ? parseFloat(mainBalance.total_amount) : 0;

    // Net worth = main balance + total savings value + money owed to us - money we owe
    const netWorth = mainBalanceAmount + totalSavingsValue + totalLent - totalBorrowed;

    // Weekly calculations
    const last7Days = new Date(now);
    last7Days.setDate(last7Days.getDate() - 7);
    const splitDate = last7Days.toISOString().split('T')[0];

    const weekTx = transactions.filter(t => t.date && t.date >= splitDate);
    const weekIncome = weekTx.filter(t => t.type === 'INCOME').reduce((s,t) => s + parseFloat(t.amount), 0);
    const weekExpense = weekTx.filter(t => t.type === 'EXPENSE').reduce((s,t) => s + parseFloat(t.amount), 0);

    // Category breakdown for pie chart
    const expenseTx = monthTx.filter(t => t.type === 'EXPENSE');
    const categoryMap = {};
    expenseTx.forEach(t => {
        const name = t.category_name || 'Boshqa';
        categoryMap[name] = (categoryMap[name] || 0) + parseFloat(t.amount);
    });
    const pieData = Object.entries(categoryMap).map(([name, value]) => ({ name, value }));
    const pieColors = ['#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#3b82f6', '#14b8a6'];

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

            {/* ASOSIY BALANS — BOSH KARTA */}
            <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px', background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(6,182,212,0.1))', border: '1px solid rgba(139,92,246,0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '4px' }}>💰 Asosiy Balans</p>
                        <h2 style={{ margin: 0, fontSize: '32px' }} className="text-gradient">{formatMoney(mainBalanceAmount)} so'm</h2>
                        {mainBalance && mainBalance.weekly_change && (
                            <p style={{ color: parseFloat(mainBalance.weekly_change) >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: '14px', marginTop: '8px' }}>
                                {parseFloat(mainBalance.weekly_change) >= 0 ? '↑' : '↓'} Haftalik o'zgarish: {formatMoney(Math.abs(parseFloat(mainBalance.weekly_change)))} so'm
                            </p>
                        )}
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '4px' }}>📊 Umumiy boylik</p>
                        <h3 style={{ margin: 0, color: netWorth >= 0 ? 'var(--success)' : 'var(--danger)' }}>{formatMoney(netWorth)} so'm</h3>
                        <p style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px' }}>Balans + Jamg'arma + Qarzdorlar - Qarzlar</p>
                    </div>
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
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '4px' }}>Oylik sof</p>
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
                <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '10px', border: '1px solid rgba(139,92,246,0.3)', background: 'linear-gradient(135deg, rgba(139,92,246,0.1), rgba(6,182,212,0.05))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ background: 'rgba(139, 92, 246, 0.15)', padding: '10px', borderRadius: '50%', color: 'var(--primary)' }}>
                            <PiggyBank size={20} />
                        </div>
                        <p style={{ color: 'var(--text-muted)', fontSize: '13px', margin: 0 }}>Asosiy Jamg'arma</p>
                    </div>
                    <h3 style={{ margin: 0, color: 'var(--primary)', fontSize: '20px' }}>{formatMoney(totalSavingsValue)} so'm</h3>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Asosiy jamg'arma:</span>
                            <span style={{ color: 'var(--success)', fontWeight: '600' }}>{formatMoney(poolSavings)}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>Maqsadlarga yo'naltirilgan:</span>
                            <span style={{ color: 'var(--accent)', fontWeight: '600' }}>{formatMoney(goalsSavings)}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* WEEKLY REPORT */}
            <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px', background: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <TrendingUp size={20} color="var(--accent)"/> Oxirgi 7 kunlik hisobot
                    </h3>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                    <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Haftalik Daromad</p>
                        <h3 style={{ margin: '8px 0 0', color: 'var(--success)' }}>+{formatMoney(weekIncome)}</h3>
                    </div>
                    <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Haftalik Xarajat</p>
                        <h3 style={{ margin: '8px 0 0', color: 'var(--danger)' }}>-{formatMoney(weekExpense)}</h3>
                    </div>
                    <div style={{ background: 'rgba(15, 23, 42, 0.4)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border)' }}>
                        <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-muted)' }}>Haftalik Sof Foyda</p>
                        <h3 style={{ margin: '8px 0 0', color: weekIncome - weekExpense >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                            {weekIncome - weekExpense >= 0 ? '+' : ''}{formatMoney(weekIncome - weekExpense)}
                        </h3>
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
