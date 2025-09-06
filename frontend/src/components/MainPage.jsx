// frontend/src/components/MainPage.jsx

import React, { useState, useEffect, useCallback, useRef } from 'react';
import MonacoEditor from "@monaco-editor/react";   // ✅ Monaco editor
import { useAuth } from '../contexts/AuthContext';
import { apiService } from '../api';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LogOut, Save, Share2,Trash2, RefreshCw, Play, Loader2, Terminal } from 'lucide-react';
import { useParams } from 'react-router-dom';
const languageMap = {
  python: { monaco: "python", name: 'Python', interactive: true },
  c: { monaco: "c", name: 'C', interactive: false },
  cpp: { monaco: "cpp", name: 'C++', interactive: false },
  java: { monaco: "java", name: 'Java', interactive: false },
  javascript: { monaco: "javascript", name: 'JavaScript', interactive: true },
};

const defaultCode = {
  python: `def greet(name):\n    print(f"Hello, {name}!")\n\ngreet("World")`,
  c: `#include <stdio.h>\n\nint main() {\n    printf("Hello from C!\\n");\n    return 0;\n}`,
  cpp: `#include <iostream>\n\nint main() {\n    std::cout << "Hello from C++!" << std::endl;\n    return 0;\n}`,
  java: `public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello from Java!");\n    }\n}`,
  javascript: `function greet(name) {\n    console.log(\`Hello, \${name}!\`);\n}\ngreet("World");`
};

// ---------------- InteractiveTerminal component stays unchanged ----------------
import { Terminal as XTerm } from "xterm";
import "xterm/css/xterm.css";

const InteractiveTerminal = ({ language, onExit, token }) => {
  const terminalContainerRef = useRef(null);
  const xtermRef = useRef(null);
  const ws = useRef(null);

  useEffect(() => {
    const xterm = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      theme: {
        background: "#0f172a", // slate-900
        foreground: "#e2e8f0", // slate-200
      },
    });
    xterm.open(terminalContainerRef.current);
    xtermRef.current = xterm;

    const startSession = async () => {
      try {
        const sessionData = await apiService.request("/repl/start", {
          method: "POST",
          body: JSON.stringify({ language }),
          token,
        });
        const { session_id } = sessionData;

        const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
        const wsUrl = `${wsProtocol}//${window.location.host}/api/ws/interactive/${session_id}`;

        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
          xterm.writeln("Interactive session started...\r\n");
        };

        ws.current.onmessage = (event) => {
          xterm.write(event.data);
        };

        ws.current.onerror = (error) => {
          console.error("WebSocket error:", error);
          xterm.writeln("\r\nError: Could not connect to interactive session.\r\n");
        };

        ws.current.onclose = () => {
          xterm.writeln("\r\nInteractive session closed.\r\n");
        };

        // Forward user keystrokes into WebSocket
        xterm.onData((data) => {
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(data);
          }
        });
      } catch (error) {
        xterm.writeln(`Error starting session: ${error.message}\r\n`);
      }
    };

    startSession();

    return () => {
      if (ws.current) ws.current.close();
      if (xtermRef.current) xtermRef.current.dispose();
    };
  }, [language, token]);

  return (
    <div className="flex-1 flex flex-col bg-slate-800 rounded-lg border border-slate-700 shadow-lg p-4">
      <div className="flex justify-between items-center mb-2">
        <h4 className="font-semibold text-slate-300">Interactive Terminal</h4>
        <Button variant="destructive" size="sm" onClick={onExit}>
          Exit Session
        </Button>
      </div>
      {/* Terminal container */}
      <div
        ref={terminalContainerRef}
        className="flex-grow bg-slate-900 rounded-md p-2 text-sm font-mono overflow-hidden"
      />
    </div>
  );
};

// ---------------- MainPage ----------------
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

// ✅ Save handler (now returns the saved file object)
const handleSave = async () => {
  const filename = prompt("Enter a filename (without extension):");
  if (!filename) return null;

  try {
    const savedFile = await apiService.request('/files', {
      method: 'POST',
      body: JSON.stringify({ filename, language, code }),
      token,
    });
    alert("File saved!");
    fetchFiles();
  } catch (error) {
    alert(`Error saving file: ${error.message}`);
    return null;
  }
};

const handleShare = async (fileId) => {
  try {
    const shareData = await apiService.request(`/files/share/${fileId}`, {
      method: "POST",
      token,
    });

    navigator.clipboard.writeText(shareData.share_url);
    alert(`Shareable link copied to clipboard!\n${shareData.share_url}`);
  } catch (error) {
    alert(`Error generating shareable link: ${error.message}`);
  }
};



const { shareId } = useParams();

useEffect(() => {
  const loadSharedFromUrl = async () => {
    if (!shareId) return;

    try {
      const sharedFile = await apiService.request(`/files/${shareId}`, {
        method: "GET",
      });

      setLanguage(sharedFile.language);
      setCode(sharedFile.code);
      setStdin("");
      setOutput("");
      setStatus(`Loaded shared file: ${sharedFile.filename}`);
    } catch (error) {
      alert(`Error loading shared file: ${error.message}`);
    }
  };

  loadSharedFromUrl();
}, [shareId]);




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
  if (!jobId) return;

  const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const wsUrl = `${wsProtocol}//${window.location.host}/api/ws/status/${jobId}`;
  const ws = new WebSocket(wsUrl);

  ws.onopen = () => {
    console.log("WS connected for job", jobId);
    setStatus("Waiting for updates...");
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.error) {
        setStatus("Error");
        setOutput(data.error);
        ws.close();
        setIsLoading(false);
        return;
      }
      setStatus(data.status);
      if (data.output) setOutput(data.output);
      if (data.status === "completed" || data.status === "error") {
        setIsLoading(false);
        ws.close();
      }
    } catch (err) {
      console.error("Bad WS message:", event.data, err);
    }
  };

  ws.onerror = (err) => {
    console.error("WS error", err);
    setStatus("Error");
    setIsLoading(false);
  };

  ws.onclose = () => {
    console.log("WS closed for job", jobId);
  };

  return () => {
    ws.close();
  };
}, [jobId, token]);


  return (
    <div className="flex h-screen bg-slate-900 text-slate-300 font-sans">
      {/* Sidebar stays the same */}
      <aside className="w-72 bg-slate-800/50 border-r border-slate-700 flex flex-col shrink-0">
  <h2 className="p-4 font-bold text-lg text-slate-200 border-b border-slate-700">
    Saved Files
  </h2>

  <div className="flex-1 overflow-y-auto">
    {savedFiles.length === 0 ? (
      <p className="p-4 text-slate-400">No files saved yet.</p>
    ) : (
      <ul>
        {savedFiles.map((file) => (
          <li
            key={file.id}
            onClick={() => loadFile(file)}
            className="flex justify-between items-center px-4 py-2 hover:bg-slate-700 cursor-pointer group"
          >
            <span>{file.filename}.{file.language}</span>
            <button
        onClick={() => handleShare(file.id)}
        className="text-blue-500 hover:text-blue-700"
      >
        <Share2 size={18} />
      </button>
            <button
              onClick={(e) => handleDelete(file, e)}
              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600"
            >
              🗑
            </button>
          </li>
        ))}
      </ul>
    )}
  </div>
</aside>

      <main className="flex-grow flex flex-col overflow-hidden">
        {/* Header stays same */}
        <header className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
          <h1 className="text-2xl font-bold text-white tracking-wider">Code Executor</h1>
          <div className="flex items-center gap-4">
            <span className="text-slate-400">Welcome, {user.username}</span>
            <Button variant="outline" onClick={logout} className="bg-transparent border-slate-600 hover:bg-slate-700 hover:border-slate-500 transition-colors">
              <LogOut className="mr-2 h-4 w-4" /> Logout
            </Button>
          </div>
        </header>

        {/* Controls */}
        <div className="p-3 flex items-center gap-4 border-b border-slate-700 bg-slate-800/30">
          <Select value={language} onValueChange={handleLanguageChange}>
            <SelectTrigger className="w-[180px] bg-slate-700 border-slate-600 focus:ring-violet-500">
              <SelectValue placeholder="Select Language" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700 text-white">
              {Object.keys(languageMap).map(lang => (
                <SelectItem key={lang} value={lang} className="hover:bg-slate-700 focus:bg-violet-500/20">
                  {languageMap[lang].name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={handleSave} variant="secondary" className="bg-slate-700 hover:bg-slate-600 transition-colors">
            <Save className="mr-2 h-4 w-4" /> Save
          </Button>
          
          <div className="ml-auto flex items-center p-1 bg-slate-700/50 rounded-lg">
            <Button onClick={() => setIsInteractive(false)} variant={!isInteractive ? 'secondary' : 'ghost'}>
              <Play className="mr-2 h-4 w-4" /> Run Code
            </Button>
            <Button 
              onClick={() => setIsInteractive(true)} 
              variant={isInteractive ? 'secondary' : 'ghost'} 
              disabled={!languageMap[language].interactive}
            >
              <Terminal className="mr-2 h-4 w-4" /> Interactive
            </Button>
          </div>

          {!isInteractive && (
            <Button onClick={handleSubmit} disabled={isLoading} className="bg-violet-600 hover:bg-violet-700 text-white font-bold px-6 py-2">
              {isLoading ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Play className="mr-2 h-5 w-5" />}
              {isLoading ? 'Running...' : 'Run Code'}
            </Button>
          )}
        </div>

        {/* Workspace */}
        <div className="flex-grow flex p-4 gap-4 overflow-hidden">
          {isInteractive ? (
            // 🔹 FULL SCREEN TERMINAL
            <div className="flex-1 flex">
              <InteractiveTerminal language={language} onExit={() => setIsInteractive(false)} token={token} />
            </div>
          ) : (
            // 🔹 Normal mode: editor + stdin/output
            <>
              <div className="flex-[3] flex flex-col min-w-0 bg-[#282a36] rounded-lg border border-slate-700 shadow-2xl shadow-slate-950/50 overflow-hidden">
                <MonacoEditor
                  height="100%"
                  language={languageMap[language].monaco}
                  value={code}
                  onChange={(value) => setCode(value ?? "")}
                  theme="dracula-plus"
                  options={{
                    fontSize: 15,
                    minimap: { enabled: false },
                    automaticLayout: true,
                    scrollBeyondLastLine: false,
                    padding: { top: 12, bottom: 12 },
                  }}
                  beforeMount={(monaco) => {
                    monaco.editor.defineTheme("dracula-plus", {
                      base: "vs-dark",
                      inherit: true,
                      rules: [],
                      colors: {
                        "editor.background": "#1e1e2e",
                        "editorLineNumber.foreground": "#6d6d85",
                        "editorCursor.foreground": "#f38ba8",
                      },
                    });
                  }}
                />
              </div>

              <div className="flex-[1] flex flex-col gap-4 min-w-[300px]">
  <div className="flex-1 flex flex-col bg-slate-800 rounded-lg border border-slate-700 shadow-lg p-4 min-h-0">
    <h4 className="font-semibold mb-2 text-slate-300">Standard Input (stdin)</h4>
    <Textarea
      value={stdin}
      onChange={(e) => setStdin(e.target.value)}
      className="bg-slate-900 border border-slate-600 font-mono w-full flex-grow p-2 rounded-md resize-none text-white overflow-auto"
      style={{ whiteSpace: "pre", lineHeight: "1.4" }}
    />
  </div>
  <div className="flex-1 flex flex-col bg-slate-800 rounded-lg border border-slate-700 shadow-lg p-4 min-h-0">
    <div className="flex justify-between items-center mb-2">
      <h4 className="font-semibold text-slate-300">Output</h4>
      <span className="text-sm text-slate-400">Status: {status}</span>
    </div>
    <pre className="flex-grow bg-slate-900 rounded-md p-2 text-sm font-mono overflow-auto whitespace-pre">{output}</pre>
  </div>
</div>

            </>
          )}
        </div>
      </main>
    </div>
  );
};

export default MainPage;
