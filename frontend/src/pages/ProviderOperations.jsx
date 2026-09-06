import React, { useState, useEffect } from 'react';
import { 
    fetchPendingBookings, updateBookingStatus, 
    fetchAvailability, addAvailabilityBlock, removeAvailabilityBlock 
} from '../services/api';

const ProviderOperations = () => {
    const [bookings, setBookings] = useState([]);
    const [availability, setAvailability] = useState([]);
    const [loadingBookings, setLoadingBookings] = useState(true);
    const [loadingAvailability, setLoadingAvailability] = useState(true);
    
    const [blockForm, setBlockForm] = useState({ date: '', start_time: '', end_time: '' });

    useEffect(() => {
        loadBookings();
        loadAvailability();
    }, []);

    const loadBookings = async () => {
        setLoadingBookings(true);
        try {
            const res = await fetchPendingBookings();
            if (res.success) setBookings(res.data);
        } catch (error) {
            console.error('Failed to load bookings', error);
        } finally {
            setLoadingBookings(false);
        }
    };

    const loadAvailability = async () => {
        setLoadingAvailability(true);
        try {
            const res = await fetchAvailability();
            if (res.success) setAvailability(res.data);
        } catch (error) {
            console.error('Failed to load availability', error);
        } finally {
            setLoadingAvailability(false);
        }
    };

    const handleUpdateStatus = async (id, status) => {
        try {
            await updateBookingStatus(id, status);
            loadBookings(); // refresh list
        } catch (error) {
            console.error(`Failed to ${status} booking`, error);
        }
    };

    const handleAddBlock = async (e) => {
        e.preventDefault();
        try {
            await addAvailabilityBlock(blockForm);
            setBlockForm({ date: '', start_time: '', end_time: '' });
            loadAvailability();
        } catch (error) {
            console.error('Failed to add block', error);
        }
    };

    const handleRemoveBlock = async (id) => {
        try {
            await removeAvailabilityBlock(id);
            loadAvailability();
        } catch (error) {
            console.error('Failed to remove block', error);
        }
    };

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Provider Operations</h1>
                <p className="mt-2 text-sm text-gray-500">Manage your incoming booking requests and your calendar availability.</p>
            </div>

            <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Booking Requests (Feature 7)</h2>
                {loadingBookings ? (
                    <p>Loading bookings...</p>
                ) : bookings.length === 0 ? (
                    <p className="text-gray-500">No pending booking requests.</p>
                ) : (
                    <div className="overflow-x-auto shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                        <table className="min-w-full divide-y divide-gray-300">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900">Service</th>
                                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Customer</th>
                                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Date/Time</th>
                                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Price (BDT)</th>
                                    <th className="relative py-3.5 pl-3 pr-4 sm:pr-6"><span className="sr-only">Actions</span></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 bg-white">
                                {bookings.map((b) => (
                                    <tr key={b.id}>
                                        <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900">{b.service_name}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{b.customer_name}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{new Date(b.scheduled_date).toLocaleDateString()} {b.scheduled_time}</td>
                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">{b.total_price}</td>
                                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6 space-x-2">
                                            <button onClick={() => handleUpdateStatus(b.id, 'Accepted')} className="text-green-600 hover:text-green-900">Accept</button>
                                            <button onClick={() => handleUpdateStatus(b.id, 'Rejected')} className="text-red-600 hover:text-red-900">Reject</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section>
                <h2 className="text-2xl font-semibold text-gray-800 mb-4">Availability Calendar (Feature 8)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-white p-6 rounded-lg shadow border border-gray-200">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Block Out Time</h3>
                        <form onSubmit={handleAddBlock} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700">Date</label>
                                <input type="date" required value={blockForm.date} onChange={(e) => setBlockForm({...blockForm, date: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">Start Time</label>
                                    <input type="time" required value={blockForm.start_time} onChange={(e) => setBlockForm({...blockForm, start_time: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700">End Time</label>
                                    <input type="time" required value={blockForm.end_time} onChange={(e) => setBlockForm({...blockForm, end_time: e.target.value})} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm border p-2" />
                                </div>
                            </div>
                            <button type="submit" className="w-full inline-flex justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                                Add Block
                            </button>
                        </form>
                    </div>

                    <div>
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Blocked Dates</h3>
                        {loadingAvailability ? (
                            <p>Loading...</p>
                        ) : availability.length === 0 ? (
                            <p className="text-gray-500">No dates blocked.</p>
                        ) : (
                            <ul className="space-y-3">
                                {availability.map((block) => (
                                    <li key={block.id} className="bg-white shadow overflow-hidden rounded-md px-4 py-3 flex items-center justify-between border border-gray-200">
                                        <div>
                                            <p className="text-sm font-medium text-gray-900">{new Date(block.date).toLocaleDateString()}</p>
                                            <p className="text-sm text-gray-500">{block.start_time} - {block.end_time}</p>
                                        </div>
                                        <button onClick={() => handleRemoveBlock(block.id)} className="text-red-500 hover:text-red-700 text-sm font-medium">Remove</button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            </section>
        </div>
    );
};

export default ProviderOperations;
