import { useMemo, useState } from 'react';
import { ShieldAlert, ShieldCheck, AlertTriangle, Info, Filter } from 'lucide-react';

const SEV_CONFIG = {
  HIGH:   { cls: 'badge-critical', color: 'var(--gh-danger)',    bg: 'rgba(248,81,73,0.08)',  icon: <ShieldAlert size={12} /> },
  MEDIUM: { cls: 'badge-warning',  color: 'var(--gh-attention)', bg: 'rgba(210,153,34,0.08)', icon: <AlertTriangle size={12} /> },
  LOW:    { cls: 'badge-info',     color: 'var(--gh-accent)',    bg: 'rgba(88,166,255,0.08)', icon: <Info size={12} /> },
};

const CONF_COLOR = {
  HIGH:   'var(--gh-danger)',
  MEDIUM: 'var(--gh-attention)',
  LOW:    'var(--gh-fg-muted)',
};

export default function SecurityPanel({ securityFindings = [] }) {
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [expandedIdx, setExpandedIdx]       = useState(null);

  const counts = useMemo(() => ({
    HIGH:   securityFindings.filter(f => f.severity === 'HIGH').length,
    MEDIUM: securityFindings.filter(f => f.severity === 'MEDIUM').length,
    LOW:    securityFindings.filter(f => f.severity === 'LOW').length,
  }), [securityFindings]);

  const filtered = useMemo(() => (
    severityFilter === 'ALL'
      ? securityFindings
      : securityFindings.filter(f => f.severity === severityFilter)
  ), [securityFindings, severityFilter]);

  if (securityFindings.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 12, color: 'var(--gh-fg-muted)' }}>
        <ShieldCheck size={48} color="var(--gh-success)" />
        <p style={{ fontWeight: 600, fontSize: 15, color: 'var(--gh-fg)' }}>No security issues found</p>
        <p style={{ fontSize: 13, color: 'var(--gh-fg-subtle)' }}>Bandit found no vulnerabilities in the scanned files.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gh-border)', flexShrink: 0, background: 'var(--gh-canvas-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShieldAlert size={16} color="var(--gh-danger)" />
            <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--gh-fg)' }}>
              Security Findings
            </span>
            <span className="badge badge-neutral">{securityFindings.length} total</span>
          </div>
          <span style={{ fontSize: 11, color: 'var(--gh-fg-subtle)' }}>Powered by Bandit</span>
        </div>

        {/* Summary badges */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          {['HIGH', 'MEDIUM', 'LOW'].map(sev => {
            const cfg = SEV_CONFIG[sev];
            return (
              <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20, background: cfg.bg, border: `1px solid ${cfg.color}33` }}>
                {cfg.icon}
                <span style={{ fontSize: 11, fontWeight: 700, color: cfg.color }}>{sev}</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--gh-fg)' }}>{counts[sev]}</span>
              </div>
            );
          })}
        </div>

        {/* Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Filter size={12} color="var(--gh-fg-muted)" />
          <span style={{ fontSize: 11, color: 'var(--gh-fg-muted)' }}>Filter:</span>
          {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map(f => (
            <button
              key={f}
              onClick={() => setSeverityFilter(f)}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 20,
                border: '1px solid var(--gh-border)',
                cursor: 'pointer',
                background: severityFilter === f ? 'var(--gh-accent)' : 'transparent',
                color: severityFilter === f ? '#fff' : 'var(--gh-fg-muted)',
                transition: 'all 0.15s',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 16px' }}>
        {filtered.length === 0 ? (
          <p style={{ textAlign: 'center', color: 'var(--gh-fg-subtle)', fontSize: 12, padding: 24 }}>
            No {severityFilter} severity issues.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filtered.map((finding, idx) => {
              const cfg     = SEV_CONFIG[finding.severity] || SEV_CONFIG.LOW;
              const isOpen  = expandedIdx === idx;

              return (
                <div
                  key={idx}
                  style={{
                    border: `1px solid var(--gh-border)`,
                    borderLeft: `3px solid ${cfg.color}`,
                    borderRadius: 6,
                    background: 'var(--gh-canvas-subtle)',
                    overflow: 'hidden',
                  }}
                >
                  {/* Row header (always visible) */}
                  <div
                    onClick={() => setExpandedIdx(isOpen ? null : idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      padding: '10px 12px',
                      cursor: 'pointer',
                    }}
                  >
                    {/* Severity badge */}
                    <span className={`badge ${cfg.cls}`} style={{ flexShrink: 0, marginTop: 1 }}>
                      {cfg.icon} {finding.severity}
                    </span>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 3 }}>
                        <code style={{ fontSize: 11, color: 'var(--gh-accent)', fontFamily: 'var(--gh-font-mono)' }}>
                          {finding.file_path}:{finding.line_number}
                        </code>
                        <span style={{ fontSize: 10, color: 'var(--gh-fg-muted)', fontFamily: 'var(--gh-font-mono)' }}>
                          [{finding.test_id}]
                        </span>
                        {finding.cwe && (
                          <span style={{ fontSize: 10, color: 'var(--gh-fg-subtle)', background: 'var(--gh-canvas)', padding: '1px 6px', borderRadius: 10, border: '1px solid var(--gh-border)' }}>
                            CWE-{finding.cwe}
                          </span>
                        )}
                        <span style={{ marginLeft: 'auto', fontSize: 10, color: CONF_COLOR[finding.confidence] || 'var(--gh-fg-muted)', fontWeight: 600 }}>
                          Confidence: {finding.confidence}
                        </span>
                      </div>
                      <p style={{ fontSize: 12, color: 'var(--gh-fg)', margin: 0, lineHeight: 1.5 }}>
                        {finding.issue_text}
                      </p>
                      <p style={{ fontSize: 11, color: 'var(--gh-fg-muted)', margin: '2px 0 0', fontFamily: 'var(--gh-font-mono)' }}>
                        {finding.test_name}
                      </p>
                    </div>

                    {/* Expand arrow */}
                    <span style={{ color: 'var(--gh-fg-subtle)', fontSize: 10, marginTop: 2 }}>
                      {isOpen ? '▲' : '▼'}
                    </span>
                  </div>

                  {/* Expanded: code snippet */}
                  {isOpen && finding.code && (
                    <div style={{
                      borderTop: '1px solid var(--gh-border)',
                      background: 'var(--gh-canvas)',
                      padding: '10px 12px',
                    }}>
                      <p style={{ fontSize: 10, color: 'var(--gh-fg-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                        Code context
                      </p>
                      <pre style={{
                        margin: 0,
                        fontFamily: 'var(--gh-font-mono)',
                        fontSize: 12,
                        color: 'var(--gh-fg)',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                        background: 'rgba(0,0,0,0.15)',
                        padding: '8px 10px',
                        borderRadius: 4,
                        lineHeight: 1.6,
                      }}>
                        {finding.code}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
