import React, { useState, useEffect } from 'react';
import { checkAvailability, createBooking } from '../services/api';
import { useAuth } from '../context/useAuth';
import { useNavigate } from 'react-router-dom';

function BookingModal({ service, onClose, onSuccess }) {
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  // Initial date: tomorrow formatted as YYYY-MM-DD
  const getTomorrowDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const getTodayDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const [selectedDate, setSelectedDate] = useState(getTomorrowDate());
  const [selectedTime, setSelectedTime] = useState('');
  const [notes, setNotes] = useState('');
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [bookingSuccess, setBookingSuccess] = useState(null);

  // Fetch slots whenever selectedDate or service changes
  useEffect(() => {
    if (!service?.provider_id || !selectedDate) return;

    let isMounted = true;
    setLoadingSlots(true);
    setError(null);
    setSelectedTime('');

    checkAvailability(service.provider_id, selectedDate)
      .then((res) => {
        if (isMounted && res.success) {
          setSlots(res.slots || []);
          // Auto-select first available slot if any
          const firstAvail = (res.slots || []).find((s) => s.available);
          if (firstAvail) {
            setSelectedTime(firstAvail.time);
          }
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Error fetching availability:', err);
          // Fallback slots if network failure
          const fallback = [
            { time: '09:00:00', label: '9:00 AM', available: true },
            { time: '11:00:00', label: '11:00 AM', available: true },
            { time: '14:00:00', label: '2:00 PM', available: true },
            { time: '16:00:00', label: '4:00 PM', available: true },
            { time: '18:00:00', label: '6:00 PM', available: true }
          ];
          setSlots(fallback);
          setSelectedTime(fallback[0].time);
        }
      })
      .finally(() => {
        if (isMounted) setLoadingSlots(false);
      });

    return () => {
      isMounted = false;
    };
  }, [service?.provider_id, selectedDate]);

  const handleBookingSubmit = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (!selectedDate || !selectedTime) {
      setError('Please select both a date and an available time slot.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const payload = {
        service_id: service.id,
        provider_id: service.provider_id,
        scheduled_date: selectedDate,
        scheduled_time: selectedTime,
        notes: notes.trim()
      };

      const response = await createBooking(payload);
      if (response.success) {
        setBookingSuccess(response.data);
        if (onSuccess) {
          onSuccess(response.data);
        }
      } else {
        setError(response.message || 'Failed to submit booking request.');
      }
    } catch (err) {
      console.error('Booking submission error:', err);
      setError(
        err.response?.data?.message ||
        'Unable to complete booking. Please verify the slot availability and try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!service) return null;

  return (
    <div className="booking-modal-overlay" onClick={onClose}>
      <div className="booking-modal" onClick={(e) => e.stopPropagation()}>
        <button
          className="modal-close-btn"
          type="button"
          onClick={onClose}
          aria-label="Close modal"
        >
          ✕
        </button>

        {bookingSuccess ? (
          <div className="booking-success-view">
            <div className="success-icon">✓</div>
            <h2>Booking Confirmed!</h2>
            <p className="success-lead">
              Your service request for <strong>{service.name}</strong> has been submitted.
            </p>

            <div className="booking-summary-receipt">
              <div className="receipt-row">
                <span>Booking Reference:</span>
                <strong>#{bookingSuccess.id}</strong>
              </div>
              <div className="receipt-row">
                <span>Provider:</span>
                <strong>{service.provider_name || 'Assigned Professional'}</strong>
              </div>
              <div className="receipt-row">
                <span>Scheduled Date:</span>
                <strong>{bookingSuccess.scheduled_date}</strong>
              </div>
              <div className="receipt-row">
                <span>Scheduled Time:</span>
                <strong>{bookingSuccess.scheduled_time}</strong>
              </div>
              <div className="receipt-row">
                <span>Status:</span>
                <span className="badge badge--pending">{bookingSuccess.status}</span>
              </div>
              <div className="receipt-row receipt-row--total">
                <span>Total Amount:</span>
                <strong>৳{Number(bookingSuccess.total_price || service.base_price).toFixed(2)}</strong>
              </div>
            </div>

            <div className="success-actions">
              <button
                className="button button--primary"
                type="button"
                onClick={() => {
                  onClose();
                  navigate('/dashboard');
                }}
              >
                Go to My Dashboard
              </button>
              <button
                className="button button--ghost"
                type="button"
                onClick={onClose}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form className="booking-form" onSubmit={handleBookingSubmit}>
            <div className="modal-header">
              <span className="eyebrow">
                <span /> Interactive Booking Engine
              </span>
              <h2>Schedule Service</h2>
            </div>

            {/* Service Summary Card */}
            <div className="booking-service-preview">
              <div className="preview-icon">{service.category_icon || '🛠'}</div>
              <div className="preview-details">
                <h3>{service.name}</h3>
                <p className="preview-provider">
                  Provided by <strong>{service.provider_name || 'Verified Professional'}</strong>
                  {service.provider_rating && (
                    <span className="rating-badge">★ {service.provider_rating}</span>
                  )}
                </p>
              </div>
              <div className="preview-price">
                <small>Fixed Price</small>
                <strong>৳{Number(service.base_price).toFixed(2)}</strong>
              </div>
            </div>

            {error && <div className="form-alert">{error}</div>}

            {/* Date Selection */}
            <div className="booking-section">
              <label className="section-label" htmlFor="booking-date">
                <strong>1. Select Date</strong>
                <small>Choose your preferred service day</small>
              </label>
              <input
                id="booking-date"
                type="date"
                min={getTodayDate()}
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                required
                className="date-input"
              />
            </div>

            {/* Time Slot Selection */}
            <div className="booking-section">
              <div className="slot-header">
                <label className="section-label">
                  <strong>2. Select Time Slot</strong>
                  <small>Real-time slot availability check</small>
                </label>
                {loadingSlots && <span className="slot-loading">Checking availability...</span>}
              </div>

              <div className="slots-grid">
                {slots.map((slot) => {
                  const isSelected = selectedTime === slot.time;
                  return (
                    <button
                      key={slot.time}
                      type="button"
                      disabled={!slot.available}
                      className={`slot-pill ${isSelected ? 'slot-pill--selected' : ''} ${
                        !slot.available ? 'slot-pill--disabled' : ''
                      }`}
                      onClick={() => setSelectedTime(slot.time)}
                      title={slot.reason}
                    >
                      <span className="slot-time">{slot.label}</span>
                      <span className="slot-status">
                        {slot.available ? 'Available' : 'Unavailable'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes / Special Instructions */}
            <div className="booking-section">
              <label className="section-label" htmlFor="booking-notes">
                <strong>3. Notes / Specific Requirements (Optional)</strong>
              </label>
              <textarea
                id="booking-notes"
                rows="2"
                placeholder="e.g. Please bring extra 10A switch boxes or bring a tall ladder..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="notes-textarea"
              />
            </div>

            {/* Pricing Summary */}
            <div className="booking-bill-summary">
              <div className="bill-row">
                <span>Service Fee:</span>
                <span>৳{Number(service.base_price).toFixed(2)}</span>
              </div>
              <div className="bill-row">
                <span>Convenience & Booking Fee:</span>
                <span>৳0.00 (Free)</span>
              </div>
              <div className="bill-row bill-row--total">
                <strong>Total Payable (Pay on Service):</strong>
                <strong>৳{Number(service.base_price).toFixed(2)}</strong>
              </div>
            </div>

            <div className="modal-actions">
              <button
                className="button button--ghost"
                type="button"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                className="button button--primary"
                type="submit"
                disabled={submitting || !selectedTime}
              >
                {submitting ? 'Confirming Booking...' : 'Confirm & Request Booking'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export default BookingModal;
