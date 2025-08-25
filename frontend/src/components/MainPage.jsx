// frontend/src/components/MainPage.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-javascript';
import 'prismjs/themes/prism-okaidia.css';

import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../api';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LogOut, Save, Trash2, RefreshCw, Play, Loader2, Terminal } from 'lucide-react';

const languageMap = {
  python: { prism: languages.python, name: 'Python', interactive: true },
  c: { prism: languages.c, name: 'C', interactive: false },
  cpp: { prism: languages.cpp, name: 'C++', interactive: false },
  java: { prism: languages.java, name: 'Java', interactive: false },
  javascript: { prism: languages.javascript, name: 'JavaScript', interactive: true },
};

const defaultCode = {
  python: `def greet(name):\n    print(f"Hello, {name}!")\n\ngreet("World")`,
  c: `#include <stdio.h>\n\nint main() {\n    printf("Hello from C!\\n");\n    return 0;\n}`,
  cpp: `#include <iostream>\n\nint main() {\n    std::cout << "Hello from C++!" << std::endl;\n    return 0;\n}`,
  java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java!");\n    }\n}`,
  javascript: `function greet(name) {\n    console.log(\`Hello, \${name}!\`);\n}\ngreet("World");`
};

// New component for the interactive terminal
const InteractiveTerminal = ({ language, onExit, token }) => {
    const [output, setOutput] = useState('Initializing session...');
    const ws = useRef(null);
    const terminalRef = useRef(null);
    const inputRef = useRef(null);

    useEffect(() => {
        const startSession = async () => {
            try {
                // Step 1: Get a session ID from the backend
                const sessionData = await apiService.request('/repl/start', {
                    method: 'POST',
                    body: JSON.stringify({ language }),
                    token
                });
                const { session_id } = sessionData;

                // Step 2: Connect to the REPL service with the session ID
                const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = `${wsProtocol}//${window.location.host}/api/ws/interactive/${session_id}`;
                
                ws.current = new WebSocket(wsUrl);

                ws.current.onopen = () => {
                    setOutput('Interactive session started...\n');
                    if (inputRef.current) inputRef.current.focus();
                };

                ws.current.onmessage = (event) => {
                    setOutput(prev => prev + event.data);
                };

                ws.current.onerror = (error) => {
                    console.error("WebSocket error:", error);
                    setOutput(prev => prev + '\nError: Could not connect to interactive session.\n');
                };

                ws.current.onclose = () => {
                    setOutput(prev => prev + '\nInteractive session closed.\n');
                };

            } catch (error) {
                setOutput(`Error starting session: ${error.message}`);
            }
        };

        startSession();

        return () => {
            if (ws.current) ws.current.close();
        };
    }, [language, token]);

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [output]);

    const handleInput = (e) => {
        if (e.key === 'Enter') {
            if (ws.current && ws.current.readyState === WebSocket.OPEN) {
                ws.current.send(e.target.value);
                setOutput(prev => prev + e.target.value + '\n');
                e.target.value = '';
            }
        }
    };

    return (
        <div className="flex-1 flex flex-col bg-slate-800 rounded-lg border border-slate-700 shadow-lg p-4">
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-semibold text-slate-300">Interactive Terminal</h4>
                <Button variant="destructive" size="sm" onClick={onExit}>Exit Session</Button>
            </div>
            <pre ref={terminalRef} className="flex-grow bg-slate-900 rounded-md p-2 text-sm font-mono overflow-auto whitespace-pre-wrap">{output}</pre>
            <Input ref={inputRef} type="text" onKeyDown={handleInput} placeholder="Type here and press Enter..." className="bg-slate-900 border-slate-600 mt-2 font-mono focus:ring-violet-500" />
        </div>
    );
};


const MainPage = () => {
    const { user, logout, token } = useAuth();
    const [language, setLanguage] = useState('python');
    const [code, setCode] = useState(defaultCode.python);
    const [stdin, setStdin] = useState('');
    const [output, setOutput] = useState('');
    const [jobId, setJobId] = useState(null);
    const [status, setStatus] = useState('Idle');
    const [isLoading, setIsLoading] = useState(false);
    const [savedFiles, setSavedFiles] = useState([]);
    const [isInteractive, setIsInteractive] = useState(false);

    const handleLanguageChange = (lang) => {
        setLanguage(lang);
        setCode(defaultCode[lang]);
        // Automatically switch to 'Run Code' mode if the language doesn't support interactive
        if (!languageMap[lang].interactive) {
            setIsInteractive(false);
        }
    };

    const fetchFiles = useCallback(async () => {
        try {
            setSavedFiles(await apiService.request('/files', { token }));
        } catch (error) {
            console.error("Failed to fetch saved files:", error);
        }
    }, [token]);

    useEffect(() => {
        fetchFiles();
    }, [fetchFiles]);

    const handleSave = async () => {
        const filename = prompt("Enter a filename (without extension):");
        if (!filename) return;

        try {
            await apiService.request('/files', { method: 'POST', body: JSON.stringify({ filename, language, code }), token });
            alert("File saved!");
            fetchFiles();
        } catch (error) {
            alert(`Error saving file: ${error.message}`);
        }
    };

    const loadFile = async (file) => {
        try {
            const data = await apiService.request(`/files/${file.id}`, { token });
            setLanguage(data.language);
            setCode(data.code);
            setStdin('');
            setOutput('');
            setStatus('Loaded from file');
        } catch (error) {
            alert(`Error loading file: ${error.message}`);
        }
    };

    const handleDelete = async (file, event) => {
        event.stopPropagation();
        if (!window.confirm(`Are you sure you want to delete ${file.filename}?`)) return;

        try {
            await apiService.request(`/files/${file.id}`, { method: 'DELETE', token });
            alert("File deleted!");
            fetchFiles();
        } catch (error) {
            alert(`Error deleting file: ${error.message}`);
        }
    };

    const handleSubmit = async () => {
        setIsLoading(true); setOutput(''); setJobId(null); setStatus('Submitting...');
        try {
            const data = await apiService.request('/submit', { method: 'POST', body: JSON.stringify({ code, language, stdin }), token });
            setJobId(data.id); setStatus('Queued');
        } catch (error) { setOutput(`Error: ${error.message}`); setStatus('Error'); setIsLoading(false); }
    };

    useEffect(() => {
        if (!jobId || status === 'completed' || status === 'error') return;
        const interval = setInterval(async () => {
            try {
                const data = await apiService.request(`/status/${jobId}`, { token });
                setStatus(data.status);
                if (data.status === 'completed' || data.status === 'error') {
                    setOutput(data.output || 'No output.'); setIsLoading(false); clearInterval(interval);
                }
            } catch (error) { setStatus('Error fetching status'); setIsLoading(false); clearInterval(interval); }
        }, 2000);
        return () => clearInterval(interval);
    }, [jobId, token, status]);

    return (
        <div className="flex h-screen bg-slate-900 text-slate-300 font-sans">
            <aside className="w-72 bg-slate-800/50 border-r border-slate-700 flex flex-col shrink-0">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center">
                    <h3 className="font-semibold text-lg text-white">Saved Files</h3>
                    <Button variant="ghost" size="icon" onClick={fetchFiles} className="text-slate-400 hover:text-white hover:bg-slate-700 transition-colors">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex-grow overflow-y-auto">
                    {savedFiles.map(file => (
                        <div key={file.id} className="p-3 border-b border-slate-700 cursor-pointer hover:bg-violet-500/10 flex justify-between items-center text-sm transition-colors group" onClick={() => loadFile(file)}>
                            <div>
                                <span className="font-mono text-violet-400 mr-2">{file.language}</span>
                                <span className="text-slate-300 group-hover:text-white">{file.filename}</span>
                            </div>
                            <Button variant="ghost" size="icon" onClick={(e) => handleDelete(file, e)} className="text-slate-500 hover:text-red-500 hover:bg-red-500/10 transition-colors">
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>
                    ))}
                </div>
            </aside>

            <main className="flex-grow flex flex-col overflow-hidden">
                <header className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                    <h1 className="text-2xl font-bold text-white tracking-wider">Code Execujutor</h1>
                    <div className="flex items-center gap-4">
                        <span className="text-slate-400">Welcome, {user.username}</span>
                        <Button variant="outline" onClick={logout} className="bg-transparent border-slate-600 hover:bg-slate-700 hover:border-slate-500 transition-colors">
                            <LogOut className="mr-2 h-4 w-4" /> Logout
                        </Button>
                    </div>
                </header>

                <div className="p-3 flex items-center gap-4 border-b border-slate-700 bg-slate-800/30">
                    <Select value={language} onValueChange={handleLanguageChange}>
                        <SelectTrigger className="w-[180px] bg-slate-700 border-slate-600 focus:ring-violet-500">
                            <SelectValue placeholder="Select Language" />
                        </SelectTrigger>
                        <SelectContent className="bg-slate-800 border-slate-700 text-white">
                            {Object.keys(languageMap).map(lang => (<SelectItem key={lang} value={lang} className="hover:bg-slate-700 focus:bg-violet-500/20">{languageMap[lang].name}</SelectItem>))}
                        </SelectContent>
                    </Select>
                    <Button onClick={handleSave} variant="secondary" className="bg-slate-700 hover:bg-slate-600 transition-colors">
                        <Save className="mr-2 h-4 w-4" /> Save
                    </Button>
                    
                    <div className="ml-auto flex items-center p-1 bg-slate-700/50 rounded-lg">
                        <Button onClick={() => setIsInteractive(false)} variant={!isInteractive ? 'secondary' : 'ghost'} className="data-[state=active]:bg-slate-600 data-[state=active]:text-white">
                            <Play className="mr-2 h-4 w-4" /> Run Code
                        </Button>
                        <Button onClick={() => setIsInteractive(true)} variant={isInteractive ? 'secondary' : 'ghost'} disabled={!languageMap[language].interactive} className="data-[state=active]:bg-slate-600 data-[state=active]:text-white">
                            <Terminal className="mr-2 h-4 w-4" /> Interactive
                        </Button>
                    </div>
                    
                    {!isInteractive && (
                        <Button onClick={handleSubmit} disabled={isLoading} className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-6 py-2 transition-all duration-300 ease-in-out transform hover:scale-105">
                            {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5" />}
                            {isLoading ? 'Running...' : 'Run Code'}
                        </Button>
                    )}
                </div>

                <div className="flex-grow flex p-4 gap-4 overflow-hidden">
                    <div className="flex-[3] flex flex-col min-w-0 bg-[#282a36] rounded-lg border border-slate-700 shadow-2xl shadow-slate-950/50 overflow-hidden">
  <Editor
    value={code}
    onValueChange={setCode}
    highlight={code => highlight(code, languageMap[language].prism, language)}
    padding={15}
    className="flex-grow font-mono text-base p-2 !outline-none overflow-auto"
    style={{
      fontFamily: '"Fira Code", "Fira Mono", monospace',
      fontSize: 15,
      height: "100%",
      overflow: "auto",
      whiteSpace: "pre",
    }}
  />
</div>

                    
                    <div className="flex-[1] flex flex-col gap-4 min-w-[300px]">
                        {isInteractive ? (
                            <InteractiveTerminal language={language} onExit={() => setIsInteractive(false)} token={token} />
                        ) : (
                            <>
                                <div className="flex-1 flex flex-col bg-slate-800 rounded-lg border border-slate-700 shadow-lg p-4 min-h-0">
                                    <h4 className="font-semibold mb-2 text-slate-300">Standard Input (stdin)</h4>
                                    <Textarea
                                        value={stdin}
                                        onChange={(e) => setStdin(e.target.value)}
                                        className="bg-slate-900 border border-slate-600 font-mono w-full flex-grow overflow-y-auto p-2 rounded-md resize-none text-white"
                                        style={{ whiteSpace: "pre", lineHeight: "1.4" }}
                                    />
                                </div>
                                <div className="flex-1 flex flex-col bg-slate-800 rounded-lg border border-slate-700 shadow-lg p-4">
                                    <div className="flex justify-between items-center mb-2">
                                        <h4 className="font-semibold text-slate-300">Output</h4>
                                        <span className="text-sm text-slate-400">Status: {status}</span>
                                    </div>
                                    <pre className="flex-grow bg-slate-900 rounded-md p-2 text-sm font-mono overflow-auto whitespace-pre-wrap">{output}</pre>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
};

export default MainPage;
