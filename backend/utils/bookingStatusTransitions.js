// Shared status-transition rules for the Job Workflow Controller.
// Import this into the EXISTING updateBookingStatus handler in
// controllers/bookingController.js (see Week2_Shan_CONTRACT.md,
// "Integration Notes") instead of hardcoding the logic there — this
// keeps Rohan's already-shipped Accept/Reject behavior intact while
// extending it to In-Progress and Completed.

const VALID_TRANSITIONS = {
  Pending: ['Accepted', 'Rejected'],
  Accepted: ['In-Progress', 'Cancelled'],
  'In-Progress': ['Completed', 'Disputed'],
  Rejected: [],
  Completed: [],
  Cancelled: [],
  Disputed: []
};

const STATUS_MESSAGES = {
  Accepted: 'Booking accepted successfully',
  Rejected: 'Booking rejected successfully',
  'In-Progress': 'Booking marked as in-progress',
  Completed: 'Booking marked as completed',
  Cancelled: 'Booking cancelled successfully',
  Disputed: 'Booking marked as disputed'
};

function isKnownStatus(status) {
  return Object.prototype.hasOwnProperty.call(VALID_TRANSITIONS, status);
}

function isValidTransition(currentStatus, nextStatus) {
  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  return allowed.includes(nextStatus);
}

function messageFor(status) {
  return STATUS_MESSAGES[status] || 'Booking status updated successfully';
}

module.exports = { VALID_TRANSITIONS, isKnownStatus, isValidTransition, messageFor };
