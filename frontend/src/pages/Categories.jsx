import React, { useEffect, useState } from 'react';
import { Tags, Plus, Trash2, Edit2 } from 'lucide-react';
import api from '../api';

export default function Categories() {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newName, setNewName] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState('');

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const res = await api.get('finance/categories/');
            setCategories(res.data);
        } catch (error) {
            console.error("Xatolik", error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        if (!newName.trim()) return;
        try {
            const res = await api.post('finance/categories/', { name: newName });
            setCategories([res.data, ...categories]);
            setNewName('');
        } catch (e) {
            alert("Kategoriya yaratishda xatolik!");
        }
    };

    const handleUpdate = async (e, id) => {
        e.preventDefault();
        if (!editName.trim()) return;
        try {
            const res = await api.put(`finance/categories/${id}/`, { name: editName });
            setCategories(categories.map(c => c.id === id ? res.data : c));
            setEditingId(null);
            setEditName('');
        } catch (e) {
            alert("Nomni o'zgartirishda xatolik");
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Rostdan ham o'chirilsinmi?")) {
            try {
                await api.delete(`finance/categories/${id}/`);
                setCategories(categories.filter(c => c.id !== id));
            } catch (e) {
                console.error(e);
            }
        }
    };

    if (loading) return <div>Yuklanmoqda...</div>;

    return (
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h1 className="text-gradient" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Tags size={32} /> Kategoriyalar
            </h1>

            <form onSubmit={handleCreate} className="glass-panel" style={{ padding: '24px', marginBottom: '32px', display: 'flex', gap: '16px' }}>
                <input 
                    type="text" 
                    className="glass-input" 
                    placeholder="Yangi kategoriya nomi..." 
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    required
                    style={{ flex: 1 }}
                />
                <button type="submit" className="btn-primary" style={{ width: 'auto' }}>
                    <Plus size={20} /> Qo'shish
                </button>
            </form>

            <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
                    {categories.length === 0 ? <p style={{ color: 'var(--text-muted)' }}>Kategoriyalar yo'q</p> : 
                    categories.map(c => (
                        <div key={c.id} style={{ 
                            background: 'rgba(15, 23, 42, 0.4)', 
                            border: '1px solid var(--border)', 
                            borderRadius: '12px', 
                            padding: '16px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            {editingId === c.id ? (
                                <form onSubmit={(e) => handleUpdate(e, c.id)} style={{ display: 'flex', flex: 1, gap: '8px' }}>
                                    <input 
                                        type="text" 
                                        className="glass-input" 
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        autoFocus
                                        style={{ padding: '8px', fontSize: '14px' }}
                                    />
                                    <button type="submit" className="btn-primary" style={{ padding: '8px', width: 'auto' }}>Saqlash</button>
                                    <button type="button" onClick={() => setEditingId(null)} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Bekor</button>
                                </form>
                            ) : (
                                <>
                                    <span style={{ fontSize: '16px', fontWeight: '500' }}>{c.name}</span>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => { setEditingId(c.id); setEditName(c.name); }} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', transition: 'color 0.2s' }}>
                                            <Edit2 size={18} />
                                        </button>
                                        <button onClick={() => handleDelete(c.id)} style={{ background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', opacity: 0.8 }}>
                                            <Trash2 size={18} />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
