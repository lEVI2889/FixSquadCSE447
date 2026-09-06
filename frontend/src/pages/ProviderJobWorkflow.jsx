import { useEffect, useState } from 'react';
import MessagingModal from '../components/MessagingModal';
import { fetchProviderBookings, updateBookingStatus } from '../services/bookingApi';

// Mirrors the backend's VALID_TRANSITIONS in controllers/bookingController.js.
// Each entry is the button label paired with the status it moves the
// booking to next.
const ACTIONS_BY_STATUS = {
  Pending: [
    { label: 'Accept', next: 'Accepted' },
    { label: 'Reject', next: 'Rejected' }
  ],
  Accepted: [
    { label: 'Start Job', next: 'In-Progress' },
    { label: 'Cancel', next: 'Cancelled' }
  ],
  'In-Progress': [
    { label: 'Mark Completed', next: 'Completed' },
    { label: 'Report Dispute', next: 'Disputed' }
  ]
};

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return Number.isNaN(d.getTime()) ? dateStr : d.toLocaleDateString();
}

export default function ProviderJobWorkflow() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [updatingId, setUpdatingId] = useState(null);
  const [activeMessageBookingId, setActiveMessageBookingId] = useState(null);

  const loadBookings = () => {
    setLoading(true);
    return fetchProviderBookings()
      .then(setBookings)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const handleAction = async (bookingId, nextStatus) => {
    setUpdatingId(bookingId);
    setError(null);
    try {
      await updateBookingStatus(bookingId, nextStatus);
      await loadBookings();
    } catch (err) {
      setError(err.message);
    } finally {
      setUpdatingId(null);
    }
  };

  if (loading) return <div className="container max-w-5xl mx-auto py-12 px-6 text-center text-gray-500">Loading your jobs...</div>;

  return (
    <main className="container max-w-5xl mx-auto py-12 px-6">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-indigo-700">Job Workflow</h1>
      </div>
      
      {error && <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-lg">{error}</div>}

      {bookings.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 text-gray-500 italic border-2 border-dashed border-gray-200 rounded-xl">
              No bookings yet.
          </div>
      )}

      <div className="space-y-6">
        {bookings.map((booking) => {
          const actions = ACTIONS_BY_STATUS[booking.status] || [];
          return (
            <div key={booking.id} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:shadow-md transition-shadow">
              
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="font-bold text-xl text-slate-900">{booking.service_name}</h2>
                  <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-bold uppercase tracking-wide">
                    {booking.status}
                  </span>
                </div>
                <div className="text-gray-600 mb-2">Customer: <span className="font-medium text-slate-900">{booking.customer_name}</span></div>
                <div className="flex items-center text-sm text-gray-500 bg-gray-50 inline-flex p-2 rounded">
                  <svg className="w-4 h-4 mr-2 text-indigo-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  {formatDate(booking.scheduled_date)} at {booking.scheduled_time}
                </div>
              </div>

              <div className="flex gap-2 w-full mt-3">
                {(booking.status === 'Accepted' || booking.status === 'In-Progress') && (
                  <button onClick={() => setActiveMessageBookingId(booking.id)} className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded text-sm font-semibold hover:bg-indigo-100 transition-colors">
                    Message Customer
                  </button>
                )}
              </div>
              {actions.length > 0 && (
                <div className="flex gap-3 md:flex-col lg:flex-row md:shrink-0 border-t md:border-t-0 pt-4 md:pt-0 border-gray-100">
                  {actions.map((action) => (
                    <button
                      key={action.next}
                      type="button"
                      disabled={updatingId === booking.id}
                      className="flex-1 lg:flex-none px-6 py-2.5 bg-indigo-700 text-white rounded-lg font-medium hover:bg-indigo-700/90 disabled:opacity-50 transition-colors"
                      onClick={() => handleAction(booking.id, action.next)}
                    >
                      {updatingId === booking.id ? 'Updating...' : action.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {activeMessageBookingId && <MessagingModal bookingId={activeMessageBookingId} onClose={() => setActiveMessageBookingId(null)} />}
    </main>
  );
}
