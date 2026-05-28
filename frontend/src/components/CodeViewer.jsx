import React, { useMemo } from 'react';
import { Bug, AlertTriangle, Info, GitCompare } from 'lucide-react';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/themes/prism-tomorrow.css';

const SEVERITY = {
  CRITICAL: { cls: 'code-line-critical annotation-critical', badge: 'badge-critical', icon: <Bug size={12} />,        color: 'var(--gh-danger)' },
  WARNING:  { cls: 'code-line-warning  annotation-warning',  badge: 'badge-warning',  icon: <AlertTriangle size={12} />, color: 'var(--gh-attention)' },
  INFO:     { cls: 'code-line-info     annotation-info',     badge: 'badge-info',     icon: <Info size={12} />,        color: 'var(--gh-accent)' },
};

function highlightLine(line) {
  if (!line || !line.trim()) return { __html: line || ' ' };
  try {
    const highlighted = Prism.highlight(line, Prism.languages.python, 'python');
    return { __html: highlighted };
  } catch {
    return { __html: line };
  }
}

export default function CodeViewer({ filePath, code, findings, onOpenDiff }) {
  const isPython = filePath?.endsWith('.py');

  const byLine = useMemo(() => {
    const map = {};
    findings.filter(f => f.file_path === filePath).forEach(f => {
      (map[f.line_number] = map[f.line_number] || []).push(f);
    });
    return map;
  }, [findings, filePath]);

  const lines = useMemo(() => code ? code.split('\n') : [], [code]);
  const issueCount = findings.filter(f => f.file_path === filePath).length;

  return (
    <div className="code-viewer" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* File header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 12px',
        background: 'var(--gh-canvas-subtle)',
        borderBottom: '1px solid var(--gh-border)',
        flexShrink: 0,
      }}>
        <code style={{ fontSize: 12, color: 'var(--gh-fg)' }}>{filePath}</code>
        <span style={{ fontSize: 11, color: 'var(--gh-fg-muted)', fontFamily: 'var(--gh-font-mono)' }}>
          {lines.length} lines · {issueCount} issue{issueCount !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Code content */}
      <div style={{ flex: 1, overflowY: 'auto', overflowX: 'auto' }}>
        {lines.length === 0 ? (
          <p style={{ padding: 24, textAlign: 'center', color: 'var(--gh-fg-subtle)', fontSize: 12 }}>
            Empty file or loading error.
          </p>
        ) : (
          <div style={{ minWidth: 'max-content' }}>
            {lines.map((line, idx) => {
              const lineNo     = idx + 1;
              const lineIssues = byLine[lineNo];
              const priority   = lineIssues?.some(f => f.severity === 'CRITICAL') ? 'CRITICAL'
                               : lineIssues?.some(f => f.severity === 'WARNING')  ? 'WARNING'
                               : lineIssues ? 'INFO' : null;
              const sev = priority ? SEVERITY[priority] : null;

              return (
                <React.Fragment key={idx}>
                  <div className={`code-line ${sev ? sev.cls.split(' ')[0] : ''}`}>
                    <span className="code-line-num">{lineNo}</span>
                    {isPython ? (
                      <span
                        className="code-line-content"
                        dangerouslySetInnerHTML={highlightLine(line)}
                        style={{ display: 'inline' }}
                      />
                    ) : (
                      <span className="code-line-content">{line || ' '}</span>
                    )}
                  </div>

                  {lineIssues?.map((f, fi) => {
                    const s = SEVERITY[f.severity] || SEVERITY.INFO;
                    return (
                      <div key={fi} className={`annotation ${s.cls.split(' ')[1]}`}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span className={`badge ${s.badge}`}>{s.icon} {f.severity}</span>
                          <span style={{ fontFamily: 'var(--gh-font-mono)', fontSize: 10, color: 'var(--gh-fg-muted)' }}>{f.rule_id}</span>
                          {f.refactored_code !== null && (
                            <button className="btn btn-ghost" style={{ padding: '3px 8px', fontSize: 11, gap: 4 }}
                              onClick={() => onOpenDiff(f)}>
                              <GitCompare size={11} />
                              View diff
                            </button>
                          )}
                        </div>
                        <p style={{ fontSize: 12, color: 'var(--gh-fg)', marginBottom: 6 }}>{f.message}</p>
                        <p style={{ fontSize: 11, color: 'var(--gh-fg-muted)', padding: '6px 8px', background: 'rgba(0,0,0,0.2)', borderRadius: 4 }}>
                          <strong style={{ color: 'var(--gh-fg-muted)', fontWeight: 600 }}>Suggestion: </strong>
                          {f.suggestion}
                        </p>
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
