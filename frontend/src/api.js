import axios from 'axios';

const api = axios.create({
    // Render'ga yuklaganda ishlaydigan moslashuvchan manzil
    baseURL: import.meta.env.MODE === 'production' ? '/api/' : 'http://127.0.0.1:8000/api/',
});

// Request interceptor to add the auth token header to requests
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// Response interceptor for catching 401s
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response && error.response.status === 401) {
            // Optional: Implement refresh token logic here
            // For now, redirect to login
            localStorage.removeItem('access_token');
            localStorage.removeItem('refresh_token');
            if (window.location.pathname !== '/login') {
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;
