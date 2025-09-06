import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import logo from '../assets/codesphere.png'; // Ensure you have a logo image in the specified path

const GitHubIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
    </svg>
);

// A simple SVG icon component for Google
const GoogleIcon = (props) => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
        <path d="M22 12c0-6.627-5.373-12-12-12S0 5.373 0 12s5.373 12 12 12 12-5.373 12-12z"></path>
        <path d="M22 12c0-6.627-5.373-12-12-12s-5.373 5.5-5.373 12c0 1.481.272 2.898.765 4.204"></path>
        <path d="M21.235 16.204c-1.28-1.56-3.07-2.64-5.235-3.204-2.165-.563-4.51-.125-6.38 1.16"></path>
        <path d="M3.529 8.529C5.088 6.71 7.378 5.5 10 5.5c1.18 0 2.3.25 3.32.68"></path>
    </svg>
);


const API_URL_PREFIX = '/api';

const AuthPage = () => {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            if (isLogin) {
                const formData = new URLSearchParams({ username, password });
                const response = await fetch(`${API_URL_PREFIX}/token`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: formData,
                });
                const data = await response.json();
                if (data.access_token) {
                    login(data.access_token);
                } else {
                    throw new Error(data.detail || 'Login failed');
                }
            } else {
                await fetch(`${API_URL_PREFIX}/register`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password }),
                });
                alert('Registration successful! Please log in.');
                setIsLogin(true);
                setUsername('');
                setPassword('');
            }
        } catch (err) {
            setError(err.message);
        }
    };

   return (
        <div className="relative flex flex-col items-center justify-center min-h-screen bg-[#0A0A0A] text-white overflow-hidden p-4">
            {/* Background pattern */}
            <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(120,119,198,0.3),rgba(255,255,255,0))]"></div>

            <div className="relative z-10 flex flex-col items-center w-full">
                {/* Logo & App Name */}
                <div className="flex flex-col items-center mb-6 text-center">
                    
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight flex items-center gap-4">
    <img src={logo} alt="Codesphere Logo" className="w-10 h-10" />
    Codesphere
</h1>

                    <p className="text-gray-400 mt-2 text-md">Code, run & share instantly</p>
                </div>

                {/* Auth Card */}
                <Card className="w-full max-w-sm bg-gray-900/50 border-gray-700 shadow-2xl backdrop-blur-lg">
                    <CardHeader className="text-center">
                        <CardTitle className="text-2xl">{isLogin ? 'Welcome Back' : 'Create an Account'}</CardTitle>
                        <CardDescription className="text-gray-400">Enter your credentials to continue.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit}>
                            <div className="grid w-full items-center gap-4">
                                <div className="flex flex-col space-y-1.5">
                                    <Label htmlFor="username">Username</Label>
                                    <Input id="username" placeholder="Your username" value={username} onChange={(e) => setUsername(e.target.value)} required className="bg-gray-800 border-gray-600 placeholder-gray-500" />
                                </div>
                                <div className="flex flex-col space-y-1.5">
                                    <Label htmlFor="password">Password</Label>
                                    <Input id="password" type="password" placeholder="Your password" value={password} onChange={(e) => setPassword(e.target.value)} required className="bg-gray-800 border-gray-600 placeholder-gray-500" />
                                </div>
                            </div>
                            {error && <p className="text-red-500 text-sm mt-4 text-center">{error}</p>}
                            <Button type="submit" className="w-full mt-6 bg-orange-600 hover:bg-orange-700 text-white font-bold">
                                {isLogin ? 'Log In' : 'Register'}
                            </Button>
                        </form>

                        <div className="relative my-6">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t border-gray-600" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-gray-900 px-2 text-gray-400">Or continue with</span>
                            </div>
                        </div>
                        <div className="mt-4 text-center text-sm">
                            {isLogin ? (
                                <>
                                    Need an account?{' '}
                                    <button onClick={() => setIsLogin(false)} className="underline hover:text-orange-500">Register</button>
                                </>
                            ) : (
                                <>
                                    Have an account?{' '}
                                    <button onClick={() => setIsLogin(true)} className="underline hover:text-orange-500">Login</button>
                                </>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Footer */}
                <p className="text-gray-500 text-xs mt-8">© {new Date().getFullYear()} Codesphere. All rights reserved.</p>
            </div>
        </div>
    );
};

export default AuthPage;
