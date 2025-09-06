import React, { useState, useEffect, createContext, useContext } from 'react';
import { apiService } from '../api';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [token, setToken] = useState(localStorage.getItem('token'));
    const [user, setUser] = useState(null);

    const logout = React.useCallback(() => {
        setToken(null);
    }, []);

    useEffect(() => {
        const fetchUser = async () => {
            if (token) {
                localStorage.setItem('token', token);
                try {
                    const data = await apiService.request('/users/me', { token });
                    setUser(data);
                } catch (error) {
                    console.error("Failed to fetch user, logging out.", error);
                    logout();
                }
            } else {
                localStorage.removeItem('token');
                setUser(null);
            }
        };
        fetchUser();
    }, [token, logout]);

    const login = (newToken) => {
        setToken(newToken);
    };

    const value = { token, user, login, logout };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
