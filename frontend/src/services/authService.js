import api from './api';

const AUTH_ROUTES = {
  login: '/auth/login',
  register: '/auth/register',
};

export const loginUser = async (credentials) => {
  const response = await api.post(AUTH_ROUTES.login, credentials);
  return response.data;
};

export const registerUser = async (userData) => {
  const response = await api.post(AUTH_ROUTES.register, userData);
  return response.data;
};
