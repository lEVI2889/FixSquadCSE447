// Relative paths only (Week1_Rohan_CONTRACT.md, Section 3: no hardcoded
// localhost ports — the dev server must proxy /api to the backend).

const getToken = () => localStorage.getItem('token');

const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${getToken()}`
});

async function handleResponse(res) {
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || 'Request failed');
  }
  return data;
}

export async function fetchCustomerBookings() {
  const res = await fetch('/api/bookings/customer/mine', { headers: authHeaders() });
  const data = await handleResponse(res);
  return data.data;
}

export async function fetchProviderBookings() {
  const res = await fetch('/api/bookings/provider/mine', { headers: authHeaders() });
  const data = await handleResponse(res);
  return data.data;
}

export async function updateBookingStatus(bookingId, status) {
  const res = await fetch(`/api/bookings/${bookingId}/status`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify({ status })
  });
  return handleResponse(res);
}
