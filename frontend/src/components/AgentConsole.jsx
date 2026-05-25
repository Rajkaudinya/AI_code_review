import React, { useEffect, useRef } from 'react';
import { Terminal, Cpu, CheckCircle, AlertTriangle } from 'lucide-react';

export default function AgentConsole({ logs, status }) {
  const terminalEndRef = useRef(null);

  // Auto-scroll to bottom of terminal when logs are added
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Color coordinate logs based on their content
  const formatLogLine = (line, idx) => {
    let colorClass = 'text-slate-300';
    let icon = null;

    if (line.includes('SUCCESS') || line.includes('passed') || line.includes('cloned') || line.includes('completed')) {
      colorClass = 'text-[#00f5a0]'; // Success Emerald
    } else if (line.includes('ERROR') || line.includes('failed') || line.includes('SyntaxError') || line.includes('CRITICAL')) {
      colorClass = 'text-[#ff0055] font-semibold'; // Hot Coral Red
    } else if (line.includes('Warning') || line.includes('anti-pattern') || line.includes('smells') || line.includes('linter warnings')) {
      colorClass = 'text-[#ffb300]'; // Vivid Amber
    } else if (line.includes('Step') || line.includes('Querying') || line.includes('Executing')) {
      colorClass = 'text-[#00f2fe]'; // Neon Cyan
    }

    return (
      <div key={idx} className={`py-1 px-3 border-b border-white/[0.02] flex items-start gap-2 font-mono text-sm leading-relaxed ${colorClass}`}>
        <span className="text-slate-600 select-none font-sans text-xs pt-0.5">[{idx + 1}]</span>
        <span className="flex-1 whitespace-pre-wrap">{line}</span>
      </div>
    );
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'RUNNING':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#00f2fe]/10 border border-[#00f2fe]/30 text-[#00f2fe] text-xs font-semibold tracking-wider">
            <span className="dot-glow dot-cyan animate-pulse"></span>
            AGENT ACTIVE
          </span>
        );
      case 'COMPLETED':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#00f5a0]/10 border border-[#00f5a0]/30 text-[#00f5a0] text-xs font-semibold tracking-wider">
            <CheckCircle className="w-3.5 h-3.5" />
            COMPLETED
          </span>
        );
      case 'FAILED':
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#ff0055]/10 border border-[#ff0055]/30 text-[#ff0055] text-xs font-semibold tracking-wider">
            <AlertTriangle className="w-3.5 h-3.5" />
            FAILED
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-slate-400 text-xs font-semibold tracking-wider">
            STANDBY
          </span>
        );
    }
  };

  return (
    <div className="glass-panel h-full flex flex-col overflow-hidden border-white/[0.04] bg-slate-950/80">
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.05] bg-black/40">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-[#00f2fe]" />
          <span className="font-semibold text-sm tracking-wide text-slate-300">LangGraph Agent Loop Console</span>
          <Cpu className="w-3.5 h-3.5 text-slate-500 animate-spin" style={{ animationDuration: '4s' }} />
        </div>
        <div>
          {getStatusBadge()}
        </div>
      </div>

      {/* Terminal Log Output Area */}
      <div className="flex-1 overflow-y-auto p-2 bg-black/60 custom-scrollbar min-h-[160px]">
        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 font-mono text-sm py-10">
            <Terminal className="w-8 h-8 opacity-20 mb-2" />
            <span>Console ready. Initiate code review to view streaming logs...</span>
            <span className="cursor-blink mt-1"></span>
          </div>
        ) : (
          <div>
            {logs.map((log, idx) => formatLogLine(log, idx))}
            {status === 'RUNNING' && (
              <div className="py-2 px-3 flex items-center gap-2 font-mono text-sm text-[#00f2fe]/80 animate-pulse">
                <span>&gt; Ingesting execution states...</span>
                <span className="cursor-blink"></span>
              </div>
            )}
            <div ref={terminalEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
