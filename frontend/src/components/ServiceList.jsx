import React from 'react';

const ServiceList = ({ services, onEdit, onDelete }) => {
    if (!services || services.length === 0) {
        return <p>No services found. Add your first service to get started.</p>;
    }

    return (
        <div className="service-list">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                    <tr style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
                        <th style={{ padding: '10px' }}>Name</th>
                        <th style={{ padding: '10px' }}>Category</th>
                        <th style={{ padding: '10px' }}>Description</th>
                        <th style={{ padding: '10px' }}>Base Price</th>
                        <th style={{ padding: '10px' }}>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    {services.map((service) => (
                        <tr key={service.id} style={{ borderBottom: '1px solid #eee' }}>
                            <td style={{ padding: '10px' }}>{service.name}</td>
                            <td style={{ padding: '10px' }}>{service.category_name}</td>
                            <td style={{ padding: '10px' }}>{service.description}</td>
                            <td style={{ padding: '10px' }}>BDT {parseFloat(service.base_price).toFixed(2)}</td>
                            <td style={{ padding: '10px' }}>
                                <button 
                                    onClick={() => onEdit(service)}
                                    style={{ marginRight: '10px', padding: '5px 10px' }}
                                >
                                    Edit
                                </button>
                                <button 
                                    onClick={() => onDelete(service.id)}
                                    style={{ padding: '5px 10px', color: 'red' }}
                                >
                                    Delete
                                </button>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default ServiceList;
