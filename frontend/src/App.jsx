import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './components/AuthPage';
import MainPage from './components/MainPage';
import './App.css';

function AppContent() {
    const { user } = useAuth();
    return user ? <MainPage /> : <AuthPage />;
}

function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}

export default App;
