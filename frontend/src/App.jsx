import React, { useState, useEffect } from 'react';
import { 
  Play, Shield, Settings, Server, RefreshCw, Cpu, 
  Terminal, ShieldAlert, Code, Sparkles, BookOpen, Layers
} from 'lucide-react';

import DashboardOverview from './components/DashboardOverview';
import FileTree from './components/FileTree';
import CodeViewer from './components/CodeViewer';
import DiffViewer from './components/DiffViewer';
import FindingsPanel from './components/FindingsPanel';
import AgentConsole from './components/AgentConsole';

const API_BASE = 'http://localhost:8000/api';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'code' | 'diff' | 'findings'
  const [repoUrl, setRepoUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [autoFix, setAutoFix] = useState(true);
  
  // Real-time status hooks
  const [status, setStatus] = useState('IDLE'); // 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED'
  const [logs, setLogs] = useState([]);
  const [taskId, setTaskId] = useState(null);
  const [result, setResult] = useState(null);
  const [backendOnline, setBackendOnline] = useState(true);
  
  // Active viewing hooks
  const [selectedFile, setSelectedFile] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [selectedFinding, setSelectedFinding] = useState(null);

  // Ping backend on startup to verify online status
  useEffect(() => {
    fetch(`${API_BASE}/review/status/test`)
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));
  }, []);

  // Fetch target file source code when file tree navigation triggers
  useEffect(() => {
    if (selectedFile && taskId) {
      fetch(`${API_BASE}/file?path=${encodeURIComponent(selectedFile)}&task_id=${taskId}`)
        .then(res => {
          if (!res.ok) throw new Error("Could not read file");
          return res.json();
        })
        .then(data => setFileContent(data.content))
        .catch(err => {
          console.error(err);
          setFileContent("# Error loading file content from backend storage.");
        });
    }
  }, [selectedFile, taskId]);

  const loadSandboxPreset = () => {
    // Empty repo URL defaults to our prebuilt backend sandbox path!
    setRepoUrl('');
    setAutoFix(true);
  };

  const handleStartReview = async (e) => {
    e.preventDefault();
    if (status === 'RUNNING') return;

    setStatus('RUNNING');
    setLogs(['Initiating code review job...']);
    setResult(null);
    setTaskId(null);
    setSelectedFile('');
    setFileContent('');
    setSelectedFinding(null);
    setActiveTab('dashboard');

    try {
      const response = await fetch(`${API_BASE}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Gemini-API-Key': apiKey || ''
        },
        body: JSON.stringify({
          repo_url: repoUrl || null, // null defaults to sandbox
          auto_fix: autoFix,
          max_iterations: 2
        })
      });

      if (!response.ok) throw new Error("Review request failed");
      const data = await response.json();
      
      const tId = data.task_id;
      setTaskId(tId);
      setLogs(prev => [...prev, `Task successfully queued on backend with ID: ${tId}`]);
      
      // Establish Server-Sent Events stream connection to display logs in real-time
      const eventSource = new EventSource(`${API_BASE}/review/stream/${tId}`);
      
      eventSource.onmessage = async (event) => {
        const payload = JSON.parse(event.data);
        
        if (payload.message) {
          setLogs(prev => [...prev, payload.message]);
        }
        
        if (payload.done) {
          eventSource.close();
          setStatus(payload.status);
          
          if (payload.status === 'COMPLETED') {
            // Retrieve completed structural analysis findings
            const resVal = await fetch(`${API_BASE}/review/result/${tId}`);
            const resultData = await resVal.json();
            setResult(resultData);
            
            // Auto-select first analyzed file if available
            if (resultData.files_analyzed && resultData.files_analyzed.length > 0) {
              // Try to find sample.py or first file
              const sample = resultData.files_analyzed.find(f => f.includes('sample.py')) || resultData.files_analyzed[0];
              setSelectedFile(sample);
            }
          }
        }
      };

      eventSource.onerror = (err) => {
        console.error("SSE EventSource connection failed", err);
        setLogs(prev => [...prev, "Warning: SSE Stream disconnected. Reconnecting logs..."]);
      };

    } catch (err) {
      console.error(err);
      setStatus('FAILED');
      setLogs(prev => [...prev, `CRITICAL: Could not trigger review backend server. Error: ${err.message}`]);
    }
  };

  const handleNavigateToCode = (filePath, lineNumber, finding) => {
    setSelectedFile(filePath);
    setSelectedFinding(finding);
    setActiveTab('code');
  };

  const handleOpenDiffCompare = (finding) => {
    setSelectedFinding(finding);
    setActiveTab('diff');
  };

  return (
    <div className="min-h-screen bg-[#05060b] flex flex-col antialiased">
      {/* Premium Cyber Top Navigation Bar */}
      <header className="px-6 py-4 border-b border-white/[0.04] bg-[#070911]/90 backdrop-blur-md sticky top-0 z-40 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-lg bg-gradient-to-br from-[#00f2fe] to-[#7f00ff] shadow-lg shadow-[#00f2fe]/20">
            <Cpu className="w-5 h-5 text-[#05060b]" />
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#00f5a0] animate-ping" />
          </div>
          <div>
            <h1 className="text-md font-bold tracking-wider bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent flex items-center gap-1.5 uppercase">
              ANTIGRAVITY REVIEW
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.05] text-[#00f2fe] font-medium tracking-normal normal-case">v1.0.0</span>
            </h1>
            <p className="text-[10px] text-slate-500 font-medium">Agentic Static Code Quality & Auto-Refactor Suite</p>
          </div>
        </div>

        {/* Backend Status indicator */}
        <div className="flex items-center gap-4">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded bg-black/40 border border-white/[0.05] text-[11px] font-mono ${backendOnline ? 'text-[#00f5a0]' : 'text-[#ff0055]'}`}>
            <Server className={`w-3.5 h-3.5 ${backendOnline ? 'animate-pulse' : ''}`} />
            {backendOnline ? 'BACKEND: ONLINE' : 'BACKEND: OFFLINE (PORT 8000)'}
          </div>
        </div>
      </header>

      {/* Main App grid content */}
      <main className="flex-1 max-w-[1700px] w-full mx-auto p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 items-stretch">
        
        {/* Sidebar Configuration panel */}
        <section className="lg:col-span-1 flex flex-col gap-6">
          <form onSubmit={handleStartReview} className="glass-panel p-5 space-y-4 bg-slate-900/40">
            <div className="flex items-center gap-2 border-b border-white/[0.05] pb-2 mb-3">
              <Settings className="w-4 h-4 text-[#00f2fe]" />
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Agent Configuration</h2>
            </div>

            {/* preset switcher button */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Demo Presets</label>
              <button
                type="button"
                onClick={loadSandboxPreset}
                className="w-full btn-cyber-outline text-[11px] py-2 justify-center bg-white/[0.02] border-white/[0.08] hover:border-[#00f2fe] hover:bg-[#00f2fe]/5 text-slate-300 font-medium"
              >
                <Layers className="w-3.5 h-3.5" />
                Select Playground Sandbox
              </button>
            </div>

            {/* git repository url */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">GitHub Repo URL / Local Path</label>
              <input
                type="text"
                placeholder="https://github.com/user/repo or leave blank"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                className="w-full bg-black/40 border border-white/[0.08] rounded-md px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-[#00f2fe] placeholder-slate-600"
              />
              <span className="text-[9px] text-slate-500 leading-normal block">
                Leave empty to review the pre-loaded ZeroDivisionError sandbox playground.
              </span>
            </div>

            {/* user gemini key override */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Gemini API Key (Optional)</label>
              <input
                type="password"
                placeholder="AI key override (starts with AIza...)"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full bg-black/40 border border-white/[0.08] rounded-md px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-[#00f2fe] placeholder-slate-600 font-mono"
              />
              <span className="text-[9px] text-slate-500 leading-normal block">
                Overrides backend `.env` variables if provided directly.
              </span>
            </div>

            {/* auto-fix toggles */}
            <div className="flex items-center justify-between py-2 border-y border-white/[0.03]">
              <span className="text-xs text-slate-400 font-medium">Verify Auto-Refactoring</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={autoFix} 
                  onChange={(e) => setAutoFix(e.target.checked)} 
                  className="sr-only peer"
                />
                <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-slate-400 after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#00f2fe] peer-checked:after:bg-[#05060b]"></div>
              </label>
            </div>

            {/* Submit Trigger Button */}
            <button
              type="submit"
              disabled={status === 'RUNNING'}
              className="w-full btn-cyber justify-center py-2.5 disabled:opacity-40 disabled:cursor-not-allowed font-semibold tracking-wide text-xs"
            >
              {status === 'RUNNING' ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  ANALYZING CODE...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  RUN CODE REVIEW
                </>
              )}
            </button>
          </form>

          {/* Collapsible Sidebar File tree viewer */}
          {result && (
            <div className="glass-panel flex-1 bg-slate-900/20 border-white/[0.04]">
              <FileTree 
                files={result.files_analyzed} 
                findings={result.findings}
                selectedFile={selectedFile}
                onSelectFile={(f) => {
                  setSelectedFile(f);
                  setSelectedFinding(null);
                  setActiveTab('code');
                }}
              />
            </div>
          )}
        </section>

        {/* Dashboard Main Visual and Tab panel area */}
        <section className="lg:col-span-3 flex flex-col gap-6">
          
          {/* Real-time streaming log terminal panel */}
          <div className="h-[250px] flex-shrink-0">
            <AgentConsole logs={logs} status={status} />
          </div>

          {/* Code Review tabs results panel */}
          {result ? (
            <div className="flex-1 flex flex-col min-h-[450px]">
              
              {/* Tab Navigation header */}
              <div className="flex items-center gap-1 border-b border-white/[0.05] bg-black/20 p-1 rounded-t-xl">
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all border-none cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'dashboard'
                      ? 'bg-gradient-to-r from-[#00f2fe] to-[#7f00ff] text-[#05060b]'
                      : 'text-slate-400 hover:text-slate-200 bg-transparent'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Dashboard Summary
                </button>

                <button
                  onClick={() => setActiveTab('findings')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all border-none cursor-pointer flex items-center gap-1.5 ${
                    activeTab === 'findings'
                      ? 'bg-gradient-to-r from-[#00f2fe] to-[#7f00ff] text-[#05060b]'
                      : 'text-slate-400 hover:text-slate-200 bg-transparent'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Code Findings ({result.findings.length})
                </button>

                <button
                  disabled={!selectedFile}
                  onClick={() => setActiveTab('code')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all border-none cursor-pointer flex items-center gap-1.5 ${
                    !selectedFile ? 'opacity-30 cursor-not-allowed' : ''
                  } ${
                    activeTab === 'code'
                      ? 'bg-gradient-to-r from-[#00f2fe] to-[#7f00ff] text-[#05060b]'
                      : 'text-slate-400 hover:text-slate-200 bg-transparent'
                  }`}
                >
                  <Code className="w-3.5 h-3.5" />
                  Source Code Viewer
                </button>

                <button
                  disabled={!selectedFinding}
                  onClick={() => setActiveTab('diff')}
                  className={`px-4 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all border-none cursor-pointer flex items-center gap-1.5 ${
                    !selectedFinding ? 'opacity-30 cursor-not-allowed' : ''
                  } ${
                    activeTab === 'diff'
                      ? 'bg-gradient-to-r from-[#00f2fe] to-[#7f00ff] text-[#05060b]'
                      : 'text-slate-400 hover:text-slate-200 bg-transparent'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Compare Refactorings
                </button>
              </div>

              {/* Tab Render panels content */}
              <div className="flex-1 glass-panel rounded-t-none border-t-none overflow-hidden relative min-h-[380px]">
                {activeTab === 'dashboard' && (
                  <DashboardOverview result={result} />
                )}

                {activeTab === 'findings' && (
                  <FindingsPanel 
                    findings={result.findings} 
                    onNavigate={handleNavigateToCode}
                  />
                )}

                {activeTab === 'code' && selectedFile && (
                  <CodeViewer
                    filePath={selectedFile}
                    code={fileContent}
                    findings={result.findings}
                    onOpenDiff={handleOpenDiffCompare}
                  />
                )}

                {activeTab === 'diff' && selectedFinding && (
                  <DiffViewer finding={selectedFinding} />
                )}
              </div>

            </div>
          ) : (
            <div className="flex-1 glass-panel p-10 flex flex-col items-center justify-center text-slate-500 font-mono text-xs border-white/[0.04] bg-slate-900/10 min-h-[350px]">
              <BookOpen className="w-12 h-12 text-[#00f2fe] opacity-10 mb-3" />
              <span className="font-sans font-semibold text-slate-400 mb-1">Code Review Report Pending</span>
              <span>Select the Playground Sandbox preset or input a repository URL, then click "Run Code Review".</span>
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
