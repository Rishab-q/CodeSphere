const API_URL_PREFIX = '/api';

export const apiService = {
    async request(endpoint, options = {}) {
        const headers = { 'Content-Type': 'application/json', ...options.headers };
        if (options.token) {
            headers['Authorization'] = `Bearer ${options.token}`;
        }

        const response = await fetch(`${API_URL_PREFIX}${endpoint}`, { ...options, headers });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ detail: 'An unknown server error occurred' }));
            throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
        }

        if (response.status === 204) {
            return null;
        }
        return response.json();
    }
};