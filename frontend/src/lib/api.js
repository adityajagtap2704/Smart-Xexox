import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  headers: { 'Content-Type': 'application/json' },
});

// Attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  verifyOTP: (data) => api.post('/auth/verify-otp', data),
  getProfile: () => api.get('/auth/profile'),
  forgotPassword: (email) => api.post('/auth/forgot-password', { email }),
  resetPassword: (data) => api.post('/auth/reset-password', data),
};

// Orders
export const orderAPI = {
  create: (data) => api.post('/orders', data, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getAll: () => api.get('/orders'),
  getById: (id) => api.get(`/orders/${id}`),
  updateStatus: (id, status) => api.put(`/orders/${id}/status`, { status }),
  cancel: (id) => api.delete(`/orders/${id}`),
  getMyOrders: () => api.get('/orders/my-orders'),
  verifyPickup: (id, data) => api.post(`/orders/${id}/verify-pickup`, data),
  extendExpiry: (id) => api.post(`/orders/${id}/extend-expiry`),
};

// Shops
export const shopAPI = {
  getAll: () => api.get('/shops'),
  getById: (id) => api.get(`/shops/${id}`),
  create: (data) => api.post('/shops', data),
  update: (id, data) => api.put(`/shops/${id}`, data),
  delete: (id) => api.delete(`/shops/${id}`),
  getMyShop: () => api.get('/shops/my-shop'),
  updatePricing: (id, data) => api.put(`/shops/${id}/pricing`, data),
  getShopOrders: () => api.get('/shops/orders'),
};

// Payments
export const paymentAPI = {
  createOrder: (data) => api.post('/payments/create-order', data),
  verify: (data) => api.post('/payments/verify', data),
};

// Admin
export const adminAPI = {
  getDashboard: () => api.get('/admin/dashboard'),
  getUsers: () => api.get('/admin/users'),
  getShops: () => api.get('/admin/shops'),
  getOrders: () => api.get('/admin/orders'),
  updateMargin: (data) => api.put('/admin/margin', data),
  approveShop: (id) => api.put(`/admin/shops/${id}/approve`),
  blockUser: (id) => api.put(`/admin/users/${id}/block`),
};

// Upload
export const uploadAPI = {
  uploadFile: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
  },
  getSignedUrl: (key) => api.get(`/upload/signed-url/${key}`),
};

export default api;
