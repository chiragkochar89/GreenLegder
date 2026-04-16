import axios from 'axios';

const API_BASE = 'http://192.168.1.8:5000/api';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

export const ApiService = {
  health: () => api.get('/health'),
  farmerLogin: (phone: string) => api.post('/register/farmer-login', { phone }),
  submitApplication: (formData: FormData) =>
    api.post('/register/apply', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  getFarm: (farmId: string) => api.get(`/farms/${farmId}`),
  getFarmByPhone: (phone: string) => api.get(`/farms/by-phone/${phone}`),
  updateBankDetails: (farmId: string, data: any) => api.patch(`/farms/${farmId}/bank-details`, data),
  getLiveSensor: (farmId: string) => api.get(`/sensors/live/${farmId}`),
  getSensorHistory: (farmId: string, limit = 48) => api.get(`/sensors/history/${farmId}?limit=${limit}`),
  getAlerts: (farmId: string) => api.get(`/sensors/alerts?farm_id=${farmId}`),
  resolveAlert: (alertId: string) => api.patch(`/sensors/alerts/${alertId}/resolve`),
  getCredits: (farmId: string) => api.get(`/credits/?farm_id=${farmId}`),
  getSeasons: (farmId: string) => api.get(`/seasons/farm/${farmId}`),
  getActiveSeason: (farmId: string) => api.get(`/seasons/farm/${farmId}/active`),
  createSeason: (data: any) => api.post('/seasons/', data),
};

export default ApiService;
