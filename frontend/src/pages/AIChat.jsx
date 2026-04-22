import React, { useState, useEffect, useRef } from 'react';
import { Bot, Send, Sparkles, TrendingUp, TrendingDown, Loader2, PiggyBank, AlertTriangle, RefreshCw, Cpu, Zap } from 'lucide-react';
import api from '../api';
import { formatMoney } from '../utils/format';

// Predefined quick actions
const QUICK_ACTIONS = [
    { icon: <TrendingDown size={16} />, label: "Xarajatlarimni tahlil qil", prompt: "Mening oxirgi xarajatlarimni tahlil qilib, qaysi kategoriyada ko'p sarf qilayotganimni aytib ber" },
    { icon: <TrendingUp size={16} />, label: "Tejash bo'yicha maslahat", prompt: "Mening moliyaviy holatimga qarab, qanday qilib ko'proq tejashim mumkinligini maslahat ber" },
    { icon: <PiggyBank size={16} />, label: "Jamg'arma strategiyasi", prompt: "Mening daromad va xarajatlarimga qarab, optimal jamg'arma strategiyasini tavsiya qil" },
    { icon: <AlertTriangle size={16} />, label: "Moliyaviy sog'liq", prompt: "Mening umumiy moliyaviy holatimni baholab ber. Yaxshi va yomon tomonlari, tavsiyalar" },
];

export default function AIChat() {
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [financialData, setFinancialData] = useState(null);
    const [dataLoading, setDataLoading] = useState(true);
    const [apiKey, setApiKey] = useState(localStorage.getItem('gemini_api_key') || '');
    const [showApiKeyInput, setShowApiKeyInput] = useState(false);
    const [aiSource, setAiSource] = useState(null); // 'gemini' or 'local'
    const messagesEndRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => { fetchFinancialData(); }, []);
    useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

    const fetchFinancialData = async () => {
        try {
            const [txRes, balRes, savRes, loanRes] = await Promise.all([
                api.get('finance/transactions/?page_size=100'),
                api.get('finance/balance/'),
                api.get('finance/savings/'),
                api.get('finance/loans/'),
            ]);

            const txs = txRes.data.results || txRes.data;
            const now = new Date();
            const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
            const monthTx = txs.filter(t => (t.date || '').startsWith(monthKey));

            const totalIncome = monthTx.filter(t => t.type === 'INCOME').reduce((s, t) => s + parseFloat(t.amount), 0);
            const totalExpense = monthTx.filter(t => t.type === 'EXPENSE').reduce((s, t) => s + parseFloat(t.amount), 0);

            // Category breakdown
            const categoryMap = {};
            monthTx.filter(t => t.type === 'EXPENSE').forEach(t => {
                const name = t.category_name || 'Boshqa';
                categoryMap[name] = (categoryMap[name] || 0) + parseFloat(t.amount);
            });

            const savings = savRes.data;
            const totalSavings = savings.reduce((s, sv) => s + parseFloat(sv.current_amount), 0);
            const goalsSavings = savings.reduce((s, sv) => s + (sv.goals || []).reduce((gs, g) => gs + parseFloat(g.current_amount || 0), 0), 0);

            const loans = loanRes.data;
            const myDebt = loans.filter(l => l.direction === 'INCOMING' && l.status === 'ACTIVE').reduce((s, l) => s + parseFloat(l.amount) - parseFloat(l.amount_paid), 0);
            const owedMe = loans.filter(l => l.direction === 'OUTGOING' && l.status === 'ACTIVE').reduce((s, l) => s + parseFloat(l.amount) - parseFloat(l.amount_paid), 0);

            const data = {
                balance: parseFloat(balRes.data.total_amount),
                monthlyIncome: totalIncome,
                monthlyExpense: totalExpense,
                monthlySavingsRate: totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome * 100).toFixed(1) : 0,
                totalSavings,
                goalsSavings,
                myDebt,
                owedMe,
                categoryBreakdown: categoryMap,
                recentTransactions: txs.slice(0, 20),
                goals: savings.flatMap(s => (s.goals || []).map(g => ({ name: g.name, target: g.target_amount, current: g.current_amount, percent: g.target_amount > 0 ? Math.round(g.current_amount / g.target_amount * 100) : 0 }))),
            };

            setFinancialData(data);

            // Auto welcome message
            setMessages([{
                role: 'assistant',
                content: `Assalomu alaykum! 👋 Men sizning shaxsiy moliyaviy maslahatchi AI botingizman.\n\nMen sizning hozirgi moliyaviy holatlaringizni ko'rib chiqishim va tavsiyalar berishim mumkin. Quyidagi tugmalardan foydalaning yoki menga savolingizni yozing!`
            }]);
        } catch (e) {
            console.error(e);
            setMessages([{
                role: 'assistant',
                content: '❌ Moliyaviy ma\'lumotlarni yuklashda xatolik yuz berdi. Iltimos, sahifani yangilang.'
            }]);
        }
        finally { setDataLoading(false); }
    };

    const saveApiKey = () => {
        if (apiKey.trim()) {
            localStorage.setItem('gemini_api_key', apiKey.trim());
            setShowApiKeyInput(false);
        }
    };

    const clearApiKey = () => {
        localStorage.removeItem('gemini_api_key');
        setApiKey('');
    };

    const formatMarkdown = (text) => {
        // Bold text **text** -> <strong>
        let formatted = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
        return formatted;
    };

    const sendMessage = async (text) => {
        if (!text.trim() || loading) return;

        const key = localStorage.getItem('gemini_api_key') || '';

        const userMsg = { role: 'user', content: text };
        const updatedMessages = [...messages, userMsg];
        setMessages(updatedMessages);
        setInput('');
        setLoading(true);

        try {
            const headers = {};
            if (key) {
                headers['X-Gemini-Key'] = key;
            }

            const response = await api.post('finance/ai-chat/', {
                message: text,
                history: messages
            }, { headers });

            const aiText = response.data.reply || 'Javob olib bo\'lmadi.';
            const source = response.data.source || 'unknown';
            const note = response.data.note || '';

            setAiSource(source);

            const msgContent = note
                ? `${aiText}\n\n---\n⚡ _${note}_`
                : aiText;

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: msgContent,
                source: source
            }]);
        } catch (e) {
            console.error(e);
            let errMsg = 'AI bilan bog\'lanib bo\'lmadi';
            if (e.response && e.response.data && e.response.data.error) {
                errMsg = e.response.data.error;
            }
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: `❌ Xatolik: ${errMsg}`,
                isError: true
            }]);
        }
        finally { setLoading(false); inputRef.current?.focus(); }
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        sendMessage(input);
    };

    if (dataLoading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh', color: 'var(--text-muted)' }}>
                <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
                <span style={{ marginLeft: '12px' }}>Ma'lumotlar yuklanmoqda...</span>
            </div>
        );
    }

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 64px)', maxHeight: 'calc(100vh - 64px)' }}>
            {/* HEADER */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexShrink: 0 }}>
                <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: 'linear-gradient(135deg, var(--primary), var(--accent))', padding: '10px', borderRadius: '12px', color: 'white', display: 'flex' }}>
                        <Sparkles size={24} />
                    </div>
                    <span className="text-gradient">AI Moliyaviy Maslahatchi</span>
                </h1>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {/* AI source badge */}
                    {aiSource && (
                        <div style={{
                            padding: '6px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: '600',
                            display: 'flex', alignItems: 'center', gap: '6px',
                            background: aiSource === 'gemini' ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
                            color: aiSource === 'gemini' ? '#10b981' : '#f59e0b',
                            border: `1px solid ${aiSource === 'gemini' ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)'}`
                        }}>
                            {aiSource === 'gemini' ? <Zap size={12} /> : <Cpu size={12} />}
                            {aiSource === 'gemini' ? 'Gemini AI' : 'Lokal AI'}
                        </div>
                    )}
                    <button onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                        style={{ padding: '8px 14px', fontSize: '13px', background: 'rgba(139,92,246,0.1)', border: '1px solid var(--primary)', color: 'var(--primary)', borderRadius: '8px', cursor: 'pointer' }}>
                        ⚙️ API Kalit
                    </button>
                    <button onClick={() => { setMessages([]); setAiSource(null); fetchFinancialData(); }}
                        style={{ padding: '8px 14px', fontSize: '13px', background: 'rgba(6,182,212,0.1)', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <RefreshCw size={14} /> Yangilash
                    </button>
                </div>
            </div>

            {/* API KEY INPUT */}
            {showApiKeyInput && (
                <div className="glass-panel" style={{ padding: '16px', marginBottom: '16px', flexShrink: 0 }}>
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                        <Sparkles size={20} color="var(--primary)" style={{ marginTop: '4px' }} />
                        <div style={{ flex: 1 }}>
                            <label style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
                                Gemini API kalitingizni kiriting (<a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>bu yerdan oling</a>)
                            </label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <input type="password" className="glass-input" placeholder="AIza..." value={apiKey} onChange={e => setApiKey(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && saveApiKey()} style={{ flex: 1 }} />
                                <button onClick={saveApiKey} className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }}>Saqlash</button>
                                {apiKey && (
                                    <button onClick={clearApiKey} style={{
                                        padding: '10px 16px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                                        color: '#ef4444', borderRadius: '8px', cursor: 'pointer', fontSize: '13px'
                                    }}>O'chirish</button>
                                )}
                            </div>
                            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '8px 0 0' }}>
                                💡 API kalitsiz ham ishlaydi — lokal moliyaviy tahlil tizimi orqali javob olasiz.
                                Gemini AI orqali kengroq javob olish uchun o'z kalitingizni kiriting.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* FINANCIAL SUMMARY BAR */}
            {financialData && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '16px', flexShrink: 0 }}>
                    {[
                        { label: 'Balans', value: formatMoney(financialData.balance), color: 'var(--primary)' },
                        { label: 'Oylik daromad', value: `+${formatMoney(financialData.monthlyIncome)}`, color: 'var(--success)' },
                        { label: 'Oylik xarajat', value: `-${formatMoney(financialData.monthlyExpense)}`, color: 'var(--danger)' },
                        { label: 'Tejamkorlik', value: `${financialData.monthlySavingsRate}%`, color: parseFloat(financialData.monthlySavingsRate) >= 20 ? 'var(--success)' : '#f59e0b' },
                    ].map((item, i) => (
                        <div key={i} style={{ padding: '10px 14px', background: 'rgba(15,23,42,0.5)', borderRadius: '10px', border: '1px solid var(--border)' }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' }}>{item.label}</div>
                            <div style={{ fontSize: '14px', fontWeight: '700', color: item.color }}>{item.value}</div>
                        </div>
                    ))}
                </div>
            )}

            {/* CHAT MESSAGES */}
            <div className="glass-panel" style={{
                flex: 1, padding: '20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '16px',
                minHeight: 0,
                scrollbarWidth: 'thin', scrollbarColor: 'rgba(139,92,246,0.3) transparent'
            }}>
                {messages.map((msg, i) => (
                    <div key={i} style={{
                        display: 'flex', gap: '12px',
                        flexDirection: msg.role === 'user' ? 'row-reverse' : 'row',
                        alignItems: 'flex-start',
                        animation: 'fadeSlideIn 0.3s ease-out'
                    }}>
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                            background: msg.role === 'user' ? 'rgba(139,92,246,0.2)' :
                                msg.isError ? 'rgba(239,68,68,0.2)' :
                                msg.source === 'local' ? 'linear-gradient(135deg, rgba(245,158,11,0.2), rgba(139,92,246,0.2))' :
                                'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(139,92,246,0.2))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: msg.role === 'user' ? 'var(--primary)' :
                                msg.isError ? '#ef4444' :
                                msg.source === 'local' ? '#f59e0b' : 'var(--accent)'
                        }}>
                            {msg.role === 'user' ? '👤' :
                                msg.isError ? <AlertTriangle size={16} /> :
                                msg.source === 'local' ? <Cpu size={16} /> :
                                <Bot size={18} />}
                        </div>
                        <div style={{
                            maxWidth: '80%', padding: '14px 18px', borderRadius: '16px',
                            background: msg.role === 'user'
                                ? 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(139,92,246,0.08))'
                                : msg.isError
                                    ? 'rgba(239,68,68,0.08)'
                                    : 'rgba(15,23,42,0.5)',
                            border: `1px solid ${
                                msg.role === 'user' ? 'rgba(139,92,246,0.3)' :
                                msg.isError ? 'rgba(239,68,68,0.3)' :
                                'var(--border)'
                            }`,
                            fontSize: '14px', lineHeight: '1.7', whiteSpace: 'pre-wrap', color: 'var(--text-main)'
                        }}>
                            <span dangerouslySetInnerHTML={{ __html: formatMarkdown(msg.content) }} />
                        </div>
                    </div>
                ))}

                {loading && (
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                        <div style={{
                            width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                            background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(139,92,246,0.2))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)'
                        }}>
                            <Bot size={18} />
                        </div>
                        <div style={{
                            padding: '14px 18px', borderRadius: '16px',
                            background: 'rgba(15,23,42,0.5)', border: '1px solid var(--border)', color: 'var(--text-muted)'
                        }}>
                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1s ease-in-out infinite' }} />
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1s ease-in-out 0.2s infinite' }} />
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)', animation: 'pulse 1s ease-in-out 0.4s infinite' }} />
                                <span style={{ marginLeft: '8px', fontSize: '13px' }}>Tahlil qilmoqda...</span>
                            </div>
                        </div>
                    </div>
                )}

                {/* Quick Actions — show only at start */}
                {messages.length <= 1 && !loading && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '8px' }}>
                        {QUICK_ACTIONS.map((action, i) => (
                            <button key={i} onClick={() => sendMessage(action.prompt)}
                                style={{
                                    padding: '14px 16px', background: 'rgba(15,23,42,0.4)', border: '1px solid var(--border)',
                                    borderRadius: '12px', color: 'var(--text-main)', cursor: 'pointer',
                                    display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px', fontWeight: '500',
                                    textAlign: 'left', transition: 'all 0.2s'
                                }}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.background = 'rgba(139,92,246,0.08)'; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'rgba(15,23,42,0.4)'; }}
                            >
                                <span style={{ color: 'var(--accent)' }}>{action.icon}</span>
                                {action.label}
                            </button>
                        ))}
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* INPUT */}
            <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '12px', marginTop: '16px', flexShrink: 0 }}>
                <input
                    ref={inputRef}
                    type="text"
                    className="glass-input"
                    placeholder="Savolingizni yozing..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    disabled={loading}
                    style={{ flex: 1, fontSize: '15px', padding: '14px 20px' }}
                />
                <button type="submit" disabled={loading || !input.trim()} className="btn-primary"
                    style={{ width: 'auto', padding: '14px 24px', opacity: (loading || !input.trim()) ? 0.5 : 1 }}>
                    {loading ? <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} /> : <Send size={20} />}
                </button>
            </form>

            <style>{`
                @keyframes pulse {
                    0%, 100% { opacity: 0.3; transform: scale(0.8); }
                    50% { opacity: 1; transform: scale(1.2); }
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                @keyframes fadeSlideIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}
            </style>
        </div>
    );
}
