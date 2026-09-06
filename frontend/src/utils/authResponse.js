export const normalizeAuthResponse = (payload) => {
  const nestedData = payload?.data;
  const token =
    payload?.token ??
    payload?.accessToken ??
    nestedData?.token ??
    nestedData?.accessToken ??
    null;
  
  // Try to get user from payload.user or nestedData.user,
  // If not, maybe the user properties are directly on nestedData (e.g. nestedData.id, nestedData.role)
  let user = payload?.user ?? nestedData?.user;
  if (!user && nestedData && (nestedData.id || nestedData.name || nestedData.email)) {
    // Exclude token from the flat user object
    const { token: _token, accessToken: _accessToken, ...rest } = nestedData;
    user = rest;
  } else if (!user) {
    user = null;
  }

  return { token, user };
};

export const getApiErrorMessage = (error, fallback) =>
  error.response?.data?.message ||
  error.response?.data?.error ||
  (error.request
    ? 'We could not reach the server. Check your connection and try again.'
    : error.message) ||
  fallback;
