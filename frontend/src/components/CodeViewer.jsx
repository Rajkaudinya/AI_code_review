import React, { useMemo } from 'react';
import { Bug, AlertTriangle, Info, Eye, ArrowRight } from 'lucide-react';

export default function CodeViewer({ filePath, code, findings, onOpenDiff }) {
  // Map findings by line number for rapid lookups
  const findingsByLine = useMemo(() => {
    const map = {};
    findings.forEach(f => {
      if (f.file_path === filePath) {
        const line = f.line_number;
        if (!map[line]) {
          map[line] = [];
        }
        map[line].push(f);
      }
    });
    return map;
  }, [findings, filePath]);

  const lines = useMemo(() => {
    if (!code) return [];
    return code.split('\n');
  }, [code]);

  const getSeverityStyles = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return {
          border: 'border-[#ff0055]/30',
          bg: 'bg-[#ff0055]/10',
          text: 'text-[#ff0055]',
          icon: <Bug className="w-4 h-4 text-[#ff0055]" />,
          glow: 'code-line-critical'
        };
      case 'WARNING':
        return {
          border: 'border-[#ffb300]/30',
          bg: 'bg-[#ffb300]/10',
          text: 'text-[#ffb300]',
          icon: <AlertTriangle className="w-4 h-4 text-[#ffb300]" />,
          glow: 'code-line-warning'
        };
      case 'INFO':
        default:
        return {
          border: 'border-[#00b0ff]/30',
          bg: 'bg-[#00b0ff]/10',
          text: 'text-[#00b0ff]',
          icon: <Info className="w-4 h-4 text-[#00b0ff]" />,
          glow: 'code-line-info'
        };
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0a0d18]">
      {/* Code Header Bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.04] bg-white/[0.01]">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs text-slate-500">active file:</span>
          <span className="font-mono text-xs font-semibold text-slate-300">{filePath}</span>
        </div>
        <div className="flex items-center gap-4 text-xs text-slate-500">
          <span>{lines.length} lines</span>
          <span>{findings.filter(f => f.file_path === filePath).length} issues</span>
        </div>
      </div>

      {/* Editor Content Area */}
      <div className="flex-1 overflow-auto custom-scrollbar p-2 font-mono text-sm leading-relaxed select-text">
        {lines.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-600 font-mono text-xs py-10">
            Empty file or loading error.
          </div>
        ) : (
          <div className="min-w-max">
            {lines.map((line, idx) => {
              const lineNo = idx + 1;
              const lineFindings = findingsByLine[lineNo];
              
              // Determine line highlighting style
              let lineHighlightClass = '';
              if (lineFindings && lineFindings.length > 0) {
                const priority = lineFindings.some(f => f.severity === 'CRITICAL') 
                  ? 'CRITICAL' 
                  : lineFindings.some(f => f.severity === 'WARNING') ? 'WARNING' : 'INFO';
                lineHighlightClass = getSeverityStyles(priority).glow;
              }

              return (
                <React.Fragment key={idx}>
                  {/* Source Code Line */}
                  <div className={`code-line ${lineHighlightClass}`}>
                    <span className="code-line-num">{lineNo}</span>
                    <span className="code-line-content">{line}</span>
                  </div>

                  {/* Inline Issue Banner Panel */}
                  {lineFindings && lineFindings.map((finding, fidx) => {
                    const styles = getSeverityStyles(finding.severity);
                    return (
                      <div 
                        key={fidx} 
                        className={`ml-16 mr-4 my-2 p-3 rounded-lg border ${styles.border} ${styles.bg} backdrop-blur-md`}
                      >
                        {/* Header details */}
                        <div className="flex items-center justify-between gap-3 border-b border-white/[0.05] pb-1.5 mb-2">
                          <div className="flex items-center gap-1.5 font-sans">
                            {styles.icon}
                            <span className={`text-xs font-bold tracking-wider ${styles.text} uppercase`}>
                              {finding.severity} FINDING
                            </span>
                            <span className="px-1.5 py-0.5 rounded bg-white/[0.05] border border-white/[0.05] font-mono text-[10px] text-slate-400">
                              {finding.rule_id}
                            </span>
                          </div>
                          
                          {/* Go to diff viewer if auto-fixable */}
                          {finding.refactored_code !== null && (
                            <button
                              onClick={() => onOpenDiff(finding)}
                              className="flex items-center gap-1 font-sans text-xs text-[#00f2fe] hover:text-white font-medium hover:underline transition-all bg-transparent border-none cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              Compare Refactored Diff
                              <ArrowRight className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        {/* Finding Message Description */}
                        <div className="font-sans text-sm text-slate-200 mb-2 leading-relaxed">
                          {finding.message}
                        </div>

                        {/* Coding Suggestion */}
                        <div className="font-sans text-xs text-slate-400 bg-black/30 p-2 rounded border border-white/[0.03]">
                          <span className="font-semibold text-slate-300">Suggestion: </span>
                          {finding.suggestion}
                        </div>
                      </div>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
