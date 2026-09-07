import api from './api';

const AUTH_ROUTES = {
  login: '/auth/login',
  register: '/auth/register',
  verify2fa: '/auth/verify-2fa',
};

export const loginUser = async (credentials) => {
  const response = await api.post(AUTH_ROUTES.login, credentials);
  return response.data;
};

export const registerUser = async (userData) => {
  const response = await api.post(AUTH_ROUTES.register, userData);
  return response.data;
};

export const verify2faCode = async (data) => {
  const response = await api.post(AUTH_ROUTES.verify2fa, data);
  return response.data;
};
