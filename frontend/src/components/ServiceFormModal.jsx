import React, { useState, useEffect } from 'react';

const ServiceFormModal = ({ isOpen, onClose, onSubmit, initialData, categories }) => {
    const [formData, setFormData] = useState({
        name: '',
        category_id: '',
        description: '',
        base_price: ''
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                name: initialData.name || '',
                category_id: initialData.category_id || '',
                description: initialData.description || '',
                base_price: initialData.base_price || ''
            });
        } else {
            setFormData({ name: '', category_id: '', description: '', base_price: '' });
        }
    }, [initialData, isOpen]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSubmit(formData);
    };

    if (!isOpen) return null;

    return (
        <div style={styles.overlay}>
            <div style={styles.modal}>
                <h2>{initialData ? 'Edit Service' : 'Add New Service'}</h2>
                <form onSubmit={handleSubmit} style={styles.form}>
                    
                    <div style={styles.formGroup}>
                        <label>Service Name</label>
                        <input 
                            type="text" 
                            name="name"
                            value={formData.name} 
                            onChange={handleChange} 
                            required 
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.formGroup}>
                        <label>Category</label>
                        <select 
                            name="category_id"
                            value={formData.category_id} 
                            onChange={handleChange} 
                            required
                            style={styles.input}
                        >
                            <option value="">Select a category</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    <div style={styles.formGroup}>
                        <label>Base Price (BDT)</label>
                        <input 
                            type="number" 
                            name="base_price"
                            min="0"
                            step="0.01"
                            value={formData.base_price} 
                            onChange={handleChange} 
                            required 
                            style={styles.input}
                        />
                    </div>

                    <div style={styles.formGroup}>
                        <label>Description</label>
                        <textarea 
                            name="description"
                            value={formData.description} 
                            onChange={handleChange} 
                            style={{ ...styles.input, minHeight: '80px' }}
                        />
                    </div>

                    <div style={styles.actions}>
                        <button type="button" onClick={onClose} style={styles.cancelBtn}>Cancel</button>
                        <button type="submit" style={styles.submitBtn}>
                            {initialData ? 'Update Service' : 'Create Service'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const styles = {
    overlay: {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000
    },
    modal: {
        backgroundColor: '#fff', padding: '20px', borderRadius: '8px',
        width: '100%', maxWidth: '500px',
        boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
    },
    form: { display: 'flex', flexDirection: 'column', gap: '15px' },
    formGroup: { display: 'flex', flexDirection: 'column', gap: '5px' },
    input: { padding: '8px', border: '1px solid #ccc', borderRadius: '4px' },
    actions: { display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' },
    cancelBtn: { padding: '8px 16px', border: '1px solid #ccc', backgroundColor: '#fff', cursor: 'pointer' },
    submitBtn: { padding: '8px 16px', border: 'none', backgroundColor: '#007bff', color: '#fff', cursor: 'pointer', borderRadius: '4px' }
};

export default ServiceFormModal;
