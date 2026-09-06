import React, { useState, useEffect } from 'react';
import ServiceList from '../components/ServiceList';
import ServiceFormModal from '../components/ServiceFormModal';
import { fetchProviderServices, createService, updateService, deleteService, fetchCategories } from '../services/api';

const ProviderPortfolio = () => {
    const [services, setServices] = useState([]);
    const [categories, setCategories] = useState([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingService, setEditingService] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const loadData = async () => {
        setLoading(true);
        try {
            const [servicesRes, categoriesRes] = await Promise.all([
                fetchProviderServices(),
                fetchCategories()
            ]);
            setServices(servicesRes.data || []);
            setCategories(categoriesRes.data || []);
            setError(null);
        } catch (err) {
            setError('Failed to load portfolio data. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleOpenModal = (service = null) => {
        setEditingService(service);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingService(null);
    };

    const handleSubmit = async (formData) => {
        try {
            if (editingService) {
                await updateService(editingService.id, formData);
            } else {
                await createService(formData);
            }
            handleCloseModal();
            loadData(); // Refresh list
        } catch (err) {
            alert(`Error: ${err.message}`);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('Are you sure you want to delete this service?')) {
            try {
                await deleteService(id);
                loadData(); // Refresh list
            } catch (err) {
                alert(`Error: ${err.message}`);
            }
        }
    };

    if (loading) return <div>Loading your portfolio...</div>;

    return (
        <div style={{ padding: '20px', maxWidth: '1000px', margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h1>Service Portfolio Manager</h1>
                <button 
                    onClick={() => handleOpenModal()} 
                    style={{ padding: '10px 20px', backgroundColor: '#28a745', color: '#fff', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                >
                    + Add New Service
                </button>
            </div>
            
            {error && <div style={{ color: 'red', marginBottom: '20px' }}>{error}</div>}

            <ServiceList 
                services={services} 
                onEdit={handleOpenModal} 
                onDelete={handleDelete} 
            />

            <ServiceFormModal 
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                onSubmit={handleSubmit}
                initialData={editingService}
                categories={categories}
            />
        </div>
    );
};

export default ProviderPortfolio;
