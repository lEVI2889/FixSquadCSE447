import { useEffect, useState } from 'react';
import api from '../services/api';
import MessagingModal from '../components/MessagingModal';
import { fetchCustomerBookings } from '../services/bookingApi';

const COLUMNS = ['Pending', 'Accepted', 'In-Progress', 'Completed'];

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString();
}

function BookingCard({ booking, onMessage, onInvoice }) {
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 mb-4 hover:shadow-md transition-shadow">
      <div className="font-bold text-lg text-slate-900 mb-1">{booking.service_name}</div>
      <div className="text-gray-600 text-sm mb-3">Provider: <span className="font-medium text-slate-900">{booking.provider_name}</span></div>
      
      <div className="flex items-center text-sm text-gray-500 mb-4 bg-gray-50 p-2 rounded">
        <svg className="w-4 h-4 mr-2 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
        {formatDate(booking.scheduled_date)} at {booking.scheduled_time}
      </div>
      
      {booking.total_price != null && (
        <div className="flex justify-between items-center mt-2 pt-3 border-t border-gray-100">
            <span className="text-gray-500 text-sm">Total</span>
            <span className="font-bold text-indigo-700 text-lg">${Number(booking.total_price).toFixed(2)}</span>
        </div>
      )}
      <div className="flex gap-2 mt-3">
        {(booking.status === 'Accepted' || booking.status === 'In-Progress') && (
          <button onClick={() => onMessage(booking.id)} className="w-full py-2 bg-indigo-50 text-indigo-700 rounded text-sm font-semibold hover:bg-indigo-100 transition-colors">
            Message Provider
          </button>
        )}
        {booking.status === 'Completed' && (
          <button onClick={() => onInvoice(booking.id)} className="w-full py-2 bg-green-50 text-green-700 rounded text-sm font-semibold hover:bg-green-100 transition-colors">
            Download Invoice
          </button>
        )}
      </div>
    </div>
  );
}

export default function CustomerBookingDashboard() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeMessageBookingId, setActiveMessageBookingId] = useState(null);

  const handleDownloadInvoice = async (bookingId) => {
    try {
      const response = await api.get(`/invoices/${bookingId}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `invoice-${bookingId}.pdf`);
      document.body.appendChild(link);
      link.click();
    } catch (err) {
      console.error('Failed to download invoice:', err);
    }
  };

  useEffect(() => {
    let cancelled = false;

    fetchCustomerBookings()
      .then((data) => {
        if (!cancelled) setBookings(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <div className="container max-w-7xl mx-auto py-12 px-6 text-center text-gray-500">Loading your bookings...</div>;
  if (error) return <div className="container max-w-7xl mx-auto py-12 px-6 text-center text-red-600 bg-red-50 p-4 rounded-lg">{error}</div>;

  const byStatus = COLUMNS.reduce((acc, status) => {
    acc[status] = bookings.filter((b) => b.status === status);
    return acc;
  }, {});

  const otherStatuses = bookings.filter((b) => !COLUMNS.includes(b.status));

  return (
    <main className="container max-w-7xl mx-auto py-12 px-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-indigo-700">My Bookings</h1>
        <span className="px-4 py-1 bg-green-100 text-indigo-700 rounded-full text-sm font-semibold">{bookings.length} Total Bookings</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {COLUMNS.map((status) => (
          <div key={status} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-200">
                <h2 className="font-bold text-slate-900">{status}</h2>
                <span className="bg-white px-2 py-1 rounded text-xs font-bold text-gray-500 shadow-sm">{byStatus[status].length}</span>
            </div>
            
            <div className="min-h-[200px]">
                {byStatus[status].length === 0 && (
                    <div className="flex flex-col items-center justify-center h-32 text-gray-400 text-sm italic border-2 border-dashed border-gray-200 rounded-lg">
                        Nothing here yet.
                    </div>
                )}
                {byStatus[status].map((booking) => (
                <BookingCard key={booking.id} booking={booking} onMessage={setActiveMessageBookingId} onInvoice={handleDownloadInvoice} />
                ))}
            </div>
          </div>
        ))}
      </div>

      {otherStatuses.length > 0 && (
        <div className="mt-12 bg-gray-50 rounded-xl p-6 border border-gray-200">
          <h2 className="text-xl font-bold text-slate-900 mb-6 border-b pb-2">Other History</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {otherStatuses.map((booking) => (
              <BookingCard key={booking.id} booking={booking} onMessage={setActiveMessageBookingId} onInvoice={handleDownloadInvoice} />
            ))}
          </div>
        </div>
      )}
      {activeMessageBookingId && <MessagingModal bookingId={activeMessageBookingId} onClose={() => setActiveMessageBookingId(null)} />}
    </main>
  );
}
