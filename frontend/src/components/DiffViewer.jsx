import { useMemo } from 'react';
import { GitCompare, CheckCircle } from 'lucide-react';

export default function DiffViewer({ finding }) {
  // Hooks must be called before any early return (Rules of Hooks).
  const originalLines   = useMemo(() => finding?.code_snippet?.split('\n')    ?? [], [finding?.code_snippet]);
  const refactoredLines = useMemo(() => finding?.refactored_code?.split('\n') ?? [], [finding?.refactored_code]);

  if (!finding || finding.refactored_code === null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--gh-fg-muted)' }}>
        <GitCompare size={36} color="var(--gh-border)" />
        <p style={{ fontSize: 13 }}>No diff selected.</p>
        <p style={{ fontSize: 12, color: 'var(--gh-fg-subtle)' }}>Click "View diff" on a finding in the Code tab.</p>
      </div>
    );
  }

  const lineStyle = (type) => ({
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '2px 12px',
    fontFamily: 'var(--gh-font-mono)',
    fontSize: 12,
    lineHeight: 1.6,
    ...(type === 'remove' ? { background: 'rgba(248,81,73,0.08)', borderLeft: '3px solid var(--gh-danger)' } : {}),
    ...(type === 'add'    ? { background: 'rgba(63,185,80,0.08)',  borderLeft: '3px solid var(--gh-success)' } : {}),
  });

  const marker = (type) => ({
    color: type === 'remove' ? 'var(--gh-danger)' : 'var(--gh-success)',
    fontWeight: 700, userSelect: 'none', width: 14, flexShrink: 0,
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', background: 'var(--gh-canvas)' }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 14px',
        background: 'var(--gh-canvas-subtle)',
        borderBottom: '1px solid var(--gh-border)',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <GitCompare size={14} color="var(--gh-fg-muted)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gh-fg)' }}>Diff Preview</span>
        </div>
        <span style={{ fontSize: 11, fontFamily: 'var(--gh-font-mono)', color: 'var(--gh-fg-muted)' }}>
          {finding.file_path} :{finding.line_number}
        </span>
      </div>

      {/* Side-by-side panels */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1, overflow: 'auto', background: 'var(--gh-border)' }}>

        {/* Original */}
        <div style={{ background: 'var(--gh-canvas)', overflow: 'auto' }}>
          <div style={{ padding: '6px 12px', background: 'var(--gh-canvas-subtle)', borderBottom: '1px solid var(--gh-border)', fontSize: 11, fontWeight: 700, color: 'var(--gh-danger)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Before
          </div>
          <div>
            {originalLines.map((line, i) => (
              <div key={i} style={lineStyle('remove')}>
                <span style={marker('remove')}>−</span>
                <span style={{ whiteSpace: 'pre', color: 'var(--gh-fg)' }}>{line}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Refactored */}
        <div style={{ background: 'var(--gh-canvas)', overflow: 'auto' }}>
          <div style={{ padding: '6px 12px', background: 'var(--gh-canvas-subtle)', borderBottom: '1px solid var(--gh-border)', fontSize: 11, fontWeight: 700, color: 'var(--gh-success)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            After (AI suggestion)
          </div>
          <div>
            {refactoredLines.map((line, i) => (
              <div key={i} style={lineStyle('add')}>
                <span style={marker('add')}>+</span>
                <span style={{ whiteSpace: 'pre', color: 'var(--gh-fg)' }}>{line}</span>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Rationale */}
      <div style={{ padding: '12px 14px', borderTop: '1px solid var(--gh-border)', background: 'var(--gh-canvas-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 14px', borderRadius: 6, border: '1px solid rgba(63,185,80,0.3)', background: 'rgba(63,185,80,0.06)' }}>
          <CheckCircle size={16} color="var(--gh-success)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--gh-success)', marginBottom: 4 }}>Refactoring Rationale</p>
            <p style={{ fontSize: 12, color: 'var(--gh-fg)', marginBottom: 6 }}>{finding.message}</p>
            <p style={{ fontSize: 11, color: 'var(--gh-fg-muted)' }}>
              <strong style={{ color: 'var(--gh-fg-muted)', fontWeight: 600 }}>Suggestion: </strong>
              {finding.suggestion}
            </p>
          </div>
        </div>
      </div>

    </div>
  );
}
