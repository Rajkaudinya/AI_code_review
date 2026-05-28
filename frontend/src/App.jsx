import { useState, useEffect } from 'react';
import {
  GitBranch, Play, RefreshCw, Server, Layers,
  ShieldAlert, Code, GitCompare, LayoutDashboard,
  Download, GitPullRequest, Shield,
} from 'lucide-react';

import DashboardOverview from './components/DashboardOverview';
import FileTree          from './components/FileTree';
import CodeViewer        from './components/CodeViewer';
import DiffViewer        from './components/DiffViewer';
import FindingsPanel     from './components/FindingsPanel';
import AgentConsole      from './components/AgentConsole';
import SecurityPanel     from './components/SecurityPanel';

const API_BASE = 'http://localhost:8000/api';

export default function App() {
  const [activeTab, setActiveTab]         = useState('dashboard');
  const [repoUrl, setRepoUrl]             = useState('');
  const [apiKey, setApiKey]               = useState('');
  const [autoFix, setAutoFix]             = useState(true);
  const [status, setStatus]               = useState('IDLE');
  const [logs, setLogs]                   = useState([]);
  const [taskId, setTaskId]               = useState(null);
  const [result, setResult]               = useState(null);
  const [backendOnline, setBackendOnline] = useState(true);
  const [selectedFile, setSelectedFile]   = useState('');
  const [fileContent, setFileContent]     = useState('');
  const [selectedFinding, setSelectedFinding] = useState(null);

  // PR creation state
  const [prLoading, setPrLoading]   = useState(false);
  const [prResult, setPrResult]     = useState(null);
  const [prError, setPrError]       = useState(null);
  const [githubToken, setGithubToken] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/review/status/test`)
      .then(() => setBackendOnline(true))
      .catch(() => setBackendOnline(false));
  }, []);

  useEffect(() => {
    if (!selectedFile || !taskId) return;
    fetch(`${API_BASE}/file?path=${encodeURIComponent(selectedFile)}&task_id=${taskId}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(d => setFileContent(d.content))
      .catch(() => setFileContent('# Error loading file.'));
  }, [selectedFile, taskId]);

  const handleStartReview = async (e) => {
    e.preventDefault();
    if (status === 'RUNNING') return;

    setStatus('RUNNING');
    setLogs(['Initiating code review...']);
    setResult(null);
    setTaskId(null);
    setSelectedFile('');
    setFileContent('');
    setSelectedFinding(null);
    setPrResult(null);
    setPrError(null);
    setActiveTab('dashboard');

    try {
      const res = await fetch(`${API_BASE}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Gemini-API-Key': apiKey || '' },
        body: JSON.stringify({ repo_url: repoUrl || null, auto_fix: autoFix, max_iterations: 2 }),
      });
      if (!res.ok) throw new Error('Review request failed');
      const { task_id: tId } = await res.json();
      setTaskId(tId);
      setLogs(prev => [...prev, `Task queued: ${tId}`]);

      const es = new EventSource(`${API_BASE}/review/stream/${tId}`);
      es.onmessage = async (event) => {
        const payload = JSON.parse(event.data);
        if (payload.message) setLogs(prev => [...prev, payload.message]);
        if (payload.done) {
          es.close();
          setStatus(payload.status);
          if (payload.status === 'COMPLETED') {
            const data = await fetch(`${API_BASE}/review/result/${tId}`).then(r => r.json());
            setResult(data);
            const first = data.files_analyzed?.find(f => f.includes('sample.py')) || data.files_analyzed?.[0];
            if (first) setSelectedFile(first);
          }
        }
      };
      es.onerror = () => setLogs(prev => [...prev, 'Warning: SSE stream disconnected.']);
    } catch (err) {
      setStatus('FAILED');
      setLogs(prev => [...prev, `Error: ${err.message}`]);
    }
  };

  const navigateToCode = (filePath, _line, finding) => {
    setSelectedFile(filePath);
    setSelectedFinding(finding);
    setActiveTab('code');
  };

  const openDiff = (finding) => {
    setSelectedFinding(finding);
    setActiveTab('diff');
  };

  // US-12: Download unified patch file
  const handleDownloadPatch = async () => {
    if (!taskId) return;
    try {
      const patches = await fetch(`${API_BASE}/review/patches/${taskId}`).then(r => {
        if (!r.ok) throw new Error('No patches available.');
        return r.json();
      });
      const combined = Object.entries(patches)
        .map(([, diff]) => diff)
        .join('\n\n');
      const blob = new Blob([combined], { type: 'text/plain' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `git-ai-${taskId.slice(0, 8)}.patch`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    }
  };

  // US-18: Create GitHub PR
  const handleCreatePR = async () => {
    if (!taskId || prLoading) return;
    setPrLoading(true);
    setPrError(null);
    setPrResult(null);
    try {
      const data = await fetch(`${API_BASE}/review/create-pr/${taskId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ github_token: githubToken || null }),
      }).then(async r => {
        if (!r.ok) {
          const err = await r.json();
          throw new Error(err.detail || 'PR creation failed.');
        }
        return r.json();
      });
      setPrResult(data);
    } catch (err) {
      setPrError(err.message);
    } finally {
      setPrLoading(false);
    }
  };

  // Determine which action buttons to show
  const hasPatch  = result && result.diff_patches && Object.keys(result.diff_patches).length > 0;
  const hasGithub = result && result.repo_url && result.repo_url.includes('github.com');
  const hasFixes  = result && result.refactored_files && Object.keys(result.refactored_files).length > 0;
  const showPR    = hasGithub && hasFixes;

  const securityCount = result?.security_findings?.length ?? null;

  const TABS = [
    { id: 'dashboard', label: 'Overview',  icon: LayoutDashboard, count: null },
    { id: 'findings',  label: 'Findings',  icon: ShieldAlert,     count: result?.findings?.length ?? null },
    { id: 'security',  label: 'Security',  icon: Shield,          count: securityCount },
    { id: 'code',      label: 'Code',       icon: Code,            count: null, disabled: !selectedFile },
    { id: 'diff',      label: 'Diff',       icon: GitCompare,      count: null, disabled: !selectedFinding },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--gh-canvas)' }}>

      {/* ── Header ── */}
      <header style={{
        background: 'var(--gh-canvas-subtle)',
        borderBottom: '1px solid var(--gh-border)',
        padding: '0 24px',
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        zIndex: 40,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: 32, height: 32, borderRadius: 6,
            background: 'var(--gh-success-em)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <GitBranch size={18} color="#fff" />
          </div>
          <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--gh-fg)' }}>Git AI</span>
          <span style={{
            fontSize: 11, fontWeight: 600, padding: '1px 7px',
            border: '1px solid var(--gh-border)', borderRadius: 20,
            color: 'var(--gh-fg-muted)',
          }}>v1.0</span>
          <span style={{ color: 'var(--gh-fg-subtle)', fontSize: 12, marginLeft: 4 }}>
            AI-Powered Code Review
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`status-dot ${backendOnline ? 'status-online' : 'status-offline'}`} />
          <span style={{ fontSize: 12, color: backendOnline ? 'var(--gh-success)' : 'var(--gh-danger)', fontFamily: 'var(--gh-font-mono)' }}>
            {backendOnline ? 'Backend online' : 'Backend offline :8000'}
          </span>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Sidebar ── */}
        <aside style={{
          width: 280,
          flexShrink: 0,
          borderRight: '1px solid var(--gh-border)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          background: 'var(--gh-canvas-subtle)',
        }}>

          {/* Config form */}
          <form onSubmit={handleStartReview} style={{ padding: '16px', borderBottom: '1px solid var(--gh-border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 16 }}>
              <Server size={14} color="var(--gh-fg-muted)" />
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gh-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                Configure Review
              </span>
            </div>

            <div style={{ marginBottom: 12 }}>
              <button type="button" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
                onClick={() => { setRepoUrl(''); setAutoFix(true); }}>
                <Layers size={13} />
                Use Sandbox Demo
              </button>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label className="gh-label">Repository URL</label>
              <input className="gh-input" type="text"
                placeholder="https://github.com/user/repo"
                value={repoUrl} onChange={e => setRepoUrl(e.target.value)} />
              <span style={{ fontSize: 11, color: 'var(--gh-fg-subtle)', display: 'block', marginTop: 4 }}>
                Leave empty for sandbox demo
              </span>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="gh-label">Gemini API Key</label>
              <input className="gh-input" type="password"
                placeholder="AIza... (optional override)"
                value={apiKey} onChange={e => setApiKey(e.target.value)}
                style={{ fontFamily: 'var(--gh-font-mono)' }} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, padding: '8px 0', borderTop: '1px solid var(--gh-border)' }}>
              <span style={{ fontSize: 13, color: 'var(--gh-fg)' }}>Auto-refactor</span>
              <label className="toggle">
                <input type="checkbox" checked={autoFix} onChange={e => setAutoFix(e.target.checked)} />
                <div className="toggle-track"></div>
                <div className="toggle-thumb"></div>
              </label>
            </div>

            <button type="submit" disabled={status === 'RUNNING'}
              className="btn btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '8px 16px', fontSize: 13 }}>
              {status === 'RUNNING'
                ? <><RefreshCw size={14} className="spin" /> Analyzing...</>
                : <><Play size={14} /> Run Code Review</>}
            </button>
          </form>

          {/* US-12: Download Patch button */}
          {hasPatch && (
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--gh-border)' }}>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
                onClick={handleDownloadPatch}
              >
                <Download size={13} />
                Download Patch (.patch)
              </button>
            </div>
          )}

          {/* US-18: Create PR section */}
          {showPR && (
            <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--gh-border)' }}>
              <div style={{ marginBottom: 8 }}>
                <label className="gh-label">GitHub Token (for PR)</label>
                <input
                  className="gh-input"
                  type="password"
                  placeholder="ghp_... (optional if env set)"
                  value={githubToken}
                  onChange={e => setGithubToken(e.target.value)}
                  style={{ fontFamily: 'var(--gh-font-mono)', fontSize: 11 }}
                />
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
                onClick={handleCreatePR}
                disabled={prLoading}
              >
                {prLoading
                  ? <><RefreshCw size={13} className="spin" /> Creating PR...</>
                  : <><GitPullRequest size={13} /> Create GitHub PR</>}
              </button>
              {prResult && (
                <div style={{ marginTop: 8, padding: '8px', background: 'rgba(63,185,80,0.1)', border: '1px solid var(--gh-success)', borderRadius: 6 }}>
                  <p style={{ fontSize: 11, color: 'var(--gh-success)', marginBottom: 4, fontWeight: 700 }}>PR Created!</p>
                  <a
                    href={prResult.pr_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 11, color: 'var(--gh-accent)', wordBreak: 'break-all', display: 'block' }}
                  >
                    PR #{prResult.pr_number} — {prResult.branch}
                  </a>
                </div>
              )}
              {prError && (
                <div style={{ marginTop: 8, padding: '8px', background: 'rgba(248,81,73,0.1)', border: '1px solid var(--gh-danger)', borderRadius: 6 }}>
                  <p style={{ fontSize: 11, color: 'var(--gh-danger)', margin: 0 }}>{prError}</p>
                </div>
              )}
            </div>
          )}

          {/* File tree */}
          {result && (
            <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
              <FileTree
                files={result.files_analyzed}
                findings={result.findings}
                selectedFile={selectedFile}
                onSelectFile={f => { setSelectedFile(f); setSelectedFinding(null); setActiveTab('code'); }}
              />
            </div>
          )}
        </aside>

        {/* ── Main ── */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

          {/* Agent console */}
          <div style={{ height: 220, flexShrink: 0, padding: '12px 16px 0', borderBottom: '1px solid var(--gh-border)' }}>
            <AgentConsole logs={logs} status={status} />
          </div>

          {/* Tab bar + content */}
          {result ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <div className="tab-bar">
                {TABS.map(({ id, label, icon: Icon, count, disabled }) => (
                  <button key={id} disabled={disabled}
                    className={`tab ${activeTab === id ? 'tab-active' : ''}`}
                    onClick={() => !disabled && setActiveTab(id)}>
                    <Icon size={14} />
                    {label}
                    {count !== null && <span className="tab-count">{count}</span>}
                  </button>
                ))}
              </div>

              <div style={{ flex: 1, overflow: 'hidden' }}>
                {activeTab === 'dashboard' && <DashboardOverview result={result} />}
                {activeTab === 'findings'  && <FindingsPanel findings={result.findings} onNavigate={navigateToCode} />}
                {activeTab === 'security'  && <SecurityPanel securityFindings={result.security_findings || []} />}
                {activeTab === 'code' && selectedFile && (
                  <CodeViewer filePath={selectedFile} code={fileContent} findings={result.findings} onOpenDiff={openDiff} />
                )}
                {activeTab === 'diff' && selectedFinding && <DiffViewer finding={selectedFinding} />}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--gh-fg-muted)' }}>
              <GitBranch size={40} color="var(--gh-border)" />
              <p style={{ fontWeight: 600, color: 'var(--gh-fg-muted)', fontSize: 14 }}>No review running</p>
              <p style={{ fontSize: 13, color: 'var(--gh-fg-subtle)' }}>Select the sandbox demo or paste a repo URL and click Run.</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
