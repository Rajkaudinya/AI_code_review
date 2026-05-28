import { useEffect, useRef } from 'react';
import { Terminal, CheckCircle, XCircle, Loader } from 'lucide-react';

const classify = (line) => {
  if (/SUCCESS|passed|cloned|completed|clean/i.test(line))  return 'log-success';
  if (/ERROR|CRITICAL|failed|SyntaxError/i.test(line))      return 'log-error';
  if (/Warning|anti-pattern|linter warning/i.test(line))    return 'log-warning';
  if (/Step \d|Querying|Executing|Cloning/i.test(line))     return 'log-step';
  return 'log-default';
};

const STATUS_CONFIG = {
  RUNNING:   { icon: <Loader size={13} className="spin" />, label: 'Running',   color: 'var(--gh-accent)' },
  COMPLETED: { icon: <CheckCircle size={13} />,              label: 'Completed', color: 'var(--gh-success)' },
  FAILED:    { icon: <XCircle size={13} />,                  label: 'Failed',    color: 'var(--gh-danger)' },
  IDLE:      { icon: null,                                    label: 'Idle',      color: 'var(--gh-fg-subtle)' },
};

export default function AgentConsole({ logs, status }) {
  const bottomRef = useRef(null);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.IDLE;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Title bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '6px 12px', background: 'var(--gh-canvas-subtle)',
        border: '1px solid var(--gh-border)', borderBottom: 'none',
        borderRadius: '6px 6px 0 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Terminal size={13} color="var(--gh-fg-muted)" />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gh-fg-muted)' }}>Agent Console</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: cfg.color, fontSize: 12, fontWeight: 600 }}>
          {cfg.icon}
          {cfg.label}
        </div>
      </div>

      {/* Log output */}
      <div className="log-terminal" style={{ flex: 1, overflowY: 'auto', borderRadius: '0 0 6px 6px' }}>
        {logs.length === 0 ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--gh-fg-subtle)', fontSize: 12 }}>
            Console ready. Start a review to see live logs.
          </div>
        ) : (
          <>
            {logs.map((line, i) => (
              <div key={i} className={`log-line ${classify(line)}`}>
                <span className="log-num">{i + 1}</span>
                <span className="log-text">{line}</span>
              </div>
            ))}
            {status === 'RUNNING' && (
              <div className="log-line log-step" style={{ paddingTop: 4 }}>
                <span className="log-num">&nbsp;</span>
                <span>Processing<span className="cursor-blink" /></span>
              </div>
            )}
            <div ref={bottomRef} />
          </>
        )}
      </div>
    </div>
  );
}
