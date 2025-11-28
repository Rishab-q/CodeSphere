import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AuthPage from './components/AuthPage';
import MainPage from './components/MainPage';
import './App.css';
import { Routes, Route } from 'react-router-dom';



function AppContent() {
  const { user } = useAuth();

  if (!user) return <AuthPage />;

  return (
    <Routes>
      {/* Normal route */}
      <Route path="/" element={<MainPage />} />
      {/* Route with shareId param */}
      <Route path="/files/shared/:shareId" element={<MainPage />} />
    </Routes>
  );
}

function App() {
    return (
        <AuthProvider>
            <AppContent />
        </AuthProvider>
    );
}

export default App;
