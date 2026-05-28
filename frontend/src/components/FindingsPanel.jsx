import { useState, useMemo } from 'react';
import { Search, Bug, AlertTriangle, Info, ArrowRight, ShieldAlert } from 'lucide-react';

const SEVERITY_CONFIG = {
  CRITICAL: { label: 'Critical', cls: 'badge-critical', icon: <Bug size={10} /> },
  WARNING:  { label: 'Warning',  cls: 'badge-warning',  icon: <AlertTriangle size={10} /> },
  INFO:     { label: 'Info',     cls: 'badge-info',     icon: <Info size={10} /> },
};

export default function FindingsPanel({ findings, onNavigate }) {
  const [search, setSearch]     = useState('');
  const [filter, setFilter]     = useState('ALL');

  const filtered = useMemo(() => findings.filter(f => {
    const q = search.toLowerCase();
    const matchSearch = f.file_path.toLowerCase().includes(q)
      || f.message.toLowerCase().includes(q)
      || f.rule_id.toLowerCase().includes(q);
    return matchSearch && (filter === 'ALL' || f.severity === filter);
  }), [findings, search, filter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        padding: '10px 14px', borderBottom: '1px solid var(--gh-border)',
        background: 'var(--gh-canvas-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginRight: 'auto' }}>
          <ShieldAlert size={14} color="var(--gh-fg-muted)" />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gh-fg)' }}>
            {filtered.length} finding{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Search */}
        <div style={{ position: 'relative' }}>
          <Search size={13} color="var(--gh-fg-subtle)" style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)' }} />
          <input className="gh-input" type="text"
            placeholder="Search findings..."
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ paddingLeft: 28, width: 220 }} />
        </div>

        {/* Severity filter */}
        <div style={{ display: 'flex', gap: 2, background: 'var(--gh-canvas-inset)', border: '1px solid var(--gh-border)', borderRadius: 6, padding: 2 }}>
          {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map(s => (
            <button key={s} onClick={() => setFilter(s)}
              style={{
                padding: '3px 10px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                cursor: 'pointer', border: 'none',
                background: filter === s ? 'var(--gh-canvas-subtle)' : 'transparent',
                color: filter === s ? 'var(--gh-fg)' : 'var(--gh-fg-muted)',
              }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 8, color: 'var(--gh-fg-muted)' }}>
            <ShieldAlert size={32} color="var(--gh-border)" />
            <p style={{ fontSize: 13 }}>No findings match your search.</p>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: 'var(--gh-canvas-subtle)', borderBottom: '1px solid var(--gh-border)' }}>
                {['Severity', 'File', 'Rule', 'Message', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--gh-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((f, i) => {
                const cfg = SEVERITY_CONFIG[f.severity] || SEVERITY_CONFIG.INFO;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--gh-border-muted)' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = ''}>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <span className={`badge ${cfg.cls}`}>{cfg.icon}{cfg.label}</span>
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <span style={{ fontFamily: 'var(--gh-font-mono)', color: 'var(--gh-fg)', fontSize: 11 }}>{f.file_path}</span>
                      <span style={{ color: 'var(--gh-fg-muted)', fontSize: 11, marginLeft: 6 }}>:{f.line_number}</span>
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <code style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: 'var(--gh-canvas-inset)', border: '1px solid var(--gh-border)', color: 'var(--gh-fg-muted)' }}>
                        {f.rule_id}
                      </code>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--gh-fg)', maxWidth: 380 }}>
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                        {f.message}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: 11 }}
                        onClick={() => onNavigate(f.file_path, f.line_number, f)}>
                        View <ArrowRight size={11} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
