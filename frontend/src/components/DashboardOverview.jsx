import { useMemo } from 'react';
import { ShieldCheck, Bug, AlertTriangle, Info, FileText, CheckCircle, XCircle, Minus, Code2 } from 'lucide-react';

function GradeCircle({ grade }) {
  const colors = {
    A: { text: 'var(--gh-success)',    bg: 'rgba(63,185,80,0.12)',   border: 'var(--gh-success)' },
    B: { text: 'var(--gh-accent)',     bg: 'rgba(88,166,255,0.12)',  border: 'var(--gh-accent)' },
    C: { text: 'var(--gh-attention)',  bg: 'rgba(210,153,34,0.12)',  border: 'var(--gh-attention)' },
    D: { text: 'var(--gh-danger)',     bg: 'rgba(248,81,73,0.12)',   border: 'var(--gh-danger)' },
    F: { text: 'var(--gh-danger)',     bg: 'rgba(248,81,73,0.18)',   border: 'var(--gh-danger)' },
  };
  const c = colors[grade] || colors['F'];
  return (
    <div style={{
      width: 48, height: 48,
      borderRadius: '50%',
      border: `2px solid ${c.border}`,
      background: c.bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 20, fontWeight: 800, color: c.text,
      flexShrink: 0,
    }}>
      {grade}
    </div>
  );
}

function ScoreBar({ label, score, color }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--gh-fg-muted)', marginBottom: 3 }}>
        <span>{label}</span>
        <span style={{ fontWeight: 700, color: color || 'var(--gh-fg)' }}>{score}%</span>
      </div>
      <div className="progress-bar">
        <div className="progress-bar-fill" style={{
          width: `${score}%`,
          background: score >= 80 ? 'var(--gh-success)' : score >= 60 ? 'var(--gh-attention)' : 'var(--gh-danger)',
        }} />
      </div>
    </div>
  );
}

export default function DashboardOverview({ result }) {
  const {
    files_analyzed = [],
    findings = [],
    ast_metrics = {},
    linter_summary = {},
    test_summary = {},
    validation_status = 'unvalidated',
    history = [],
    style_report = {},
  } = result || {};

  const critical = useMemo(() => findings.filter(f => f.severity === 'CRITICAL').length, [findings]);
  const warning  = useMemo(() => findings.filter(f => f.severity === 'WARNING').length,  [findings]);
  const info     = useMemo(() => findings.filter(f => f.severity === 'INFO').length,     [findings]);

  const avgComplexity = useMemo(() => {
    const vals = Object.values(ast_metrics);
    if (!vals.length) return '—';
    return (vals.reduce((s, r) => s + (r.average_complexity || 0), 0) / vals.length).toFixed(2);
  }, [ast_metrics]);

  const testPassRate = useMemo(() => {
    const { passed = 0, total = 0 } = test_summary;
    return total ? Math.round((passed / total) * 100) : 0;
  }, [test_summary]);

  const validationBadge = {
    verified_clean: { label: 'Verified clean', cls: 'badge-success', icon: <CheckCircle size={11} /> },
    failed_tests:   { label: 'Tests failing',  cls: 'badge-critical', icon: <XCircle size={11} /> },
    failed_lint:    { label: 'Lint warnings',  cls: 'badge-warning',  icon: <AlertTriangle size={11} /> },
    unvalidated:    { label: 'Unvalidated',    cls: 'badge-neutral',  icon: <Minus size={11} /> },
  }[validation_status] || { label: 'Unvalidated', cls: 'badge-neutral', icon: <Minus size={11} /> };

  const metrics = [
    { label: 'Total Findings', value: findings.length, color: 'var(--gh-accent)',    bg: 'rgba(88,166,255,0.1)',   icon: <ShieldCheck size={18} color="var(--gh-accent)" /> },
    { label: 'Critical',       value: critical,        color: 'var(--gh-danger)',    bg: 'rgba(248,81,73,0.1)',    icon: <Bug size={18} color="var(--gh-danger)" /> },
    { label: 'Warnings',       value: warning,         color: 'var(--gh-attention)', bg: 'rgba(210,153,34,0.1)',   icon: <AlertTriangle size={18} color="var(--gh-attention)" /> },
    { label: 'Info',           value: info,            color: 'var(--gh-fg-muted)',  bg: 'rgba(110,118,129,0.1)', icon: <Info size={18} color="var(--gh-fg-muted)" /> },
  ];

  const overall   = style_report?.overall   || null;
  const perFile   = style_report?.per_file  || {};
  const hasStyle  = overall !== null;

  return (
    <div style={{ overflowY: 'auto', height: '100%', padding: 16 }}>

      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--gh-fg)' }}>Analysis Summary</h2>
          <p style={{ fontSize: 12, color: 'var(--gh-fg-muted)', marginTop: 2 }}>
            {files_analyzed.length} file{files_analyzed.length !== 1 ? 's' : ''} reviewed
          </p>
        </div>
        <span className={`badge ${validationBadge.cls}`} style={{ gap: 5 }}>
          {validationBadge.icon}
          {validationBadge.label}
        </span>
      </div>

      {/* Metric cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {metrics.map(m => (
          <div key={m.label} className="metric-card">
            <div className="metric-icon" style={{ background: m.bg }}>
              {m.icon}
            </div>
            <div>
              <div style={{ fontSize: 11, color: 'var(--gh-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                {m.label}
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--gh-fg)', lineHeight: 1.2, marginTop: 2 }}>
                {m.value}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Detail cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: hasStyle ? 16 : 0 }}>

        {/* Test runner */}
        <div className="gh-panel" style={{ padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--gh-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
            Test Runner
          </p>
          {test_summary.total > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['Total tests', test_summary.total, 'var(--gh-fg)'],
                ['Passing',     test_summary.passed, 'var(--gh-success)'],
                ['Failing',     test_summary.failed, test_summary.failed > 0 ? 'var(--gh-danger)' : 'var(--gh-fg-muted)'],
              ].map(([lbl, val, clr]) => (
                <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: 'var(--gh-fg-muted)' }}>{lbl}</span>
                  <span style={{ fontWeight: 700, color: clr }}>{val}</span>
                </div>
              ))}
              <div style={{ marginTop: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--gh-fg-subtle)', marginBottom: 4 }}>
                  <span>Pass rate</span>
                  <span>{testPassRate}%</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-bar-fill"
                    style={{ width: `${testPassRate}%`, background: testPassRate === 100 ? 'var(--gh-success)' : 'var(--gh-danger)' }} />
                </div>
              </div>
            </div>
          ) : (
            <p style={{ fontSize: 12, color: 'var(--gh-fg-subtle)', textAlign: 'center', padding: '12px 0' }}>
              No tests found
            </p>
          )}
        </div>

        {/* Static analysis */}
        <div className="gh-panel" style={{ padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--gh-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
            Static Analysis
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              ['Files analyzed',     files_analyzed.length,          'var(--gh-fg)'],
              ['Linter violations',  linter_summary.total_issues || 0, 'var(--gh-attention)'],
              ['Avg complexity',     avgComplexity,                  'var(--gh-accent)'],
            ].map(([lbl, val, clr]) => (
              <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 12 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--gh-fg-muted)' }}>
                  <FileText size={12} />
                  {lbl}
                </span>
                <span style={{ fontWeight: 700, color: clr }}>{val}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Validation history */}
        <div className="gh-panel" style={{ padding: 16 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--gh-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 12 }}>
            Validation Trail
          </p>
          {history.length === 0 ? (
            <p style={{ fontSize: 12, color: 'var(--gh-fg-subtle)', textAlign: 'center', padding: '12px 0' }}>
              {validation_status === 'unvalidated' ? 'Auto-fix disabled' : 'No iterations yet'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingLeft: 12, borderLeft: '2px solid var(--gh-border)' }}>
              {history.map((h, i) => {
                const ok = h.tests_failed === 0;
                return (
                  <div key={i} style={{ position: 'relative' }}>
                    <span style={{
                      position: 'absolute', left: -18, top: 3,
                      width: 10, height: 10, borderRadius: '50%',
                      background: ok ? 'var(--gh-success)' : 'var(--gh-danger)',
                      border: '2px solid var(--gh-canvas-subtle)',
                    }} />
                    <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--gh-fg)' }}>Round {h.iteration + 1}</p>
                    <p style={{ fontSize: 11, color: 'var(--gh-fg-muted)', fontFamily: 'var(--gh-font-mono)' }}>
                      {h.tests_passed}/{h.tests_passed + h.tests_failed} tests · {h.linter_issues_count} lints
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>

      {/* US-19: Code Style / Quality section */}
      {hasStyle && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <Code2 size={14} color="var(--gh-fg-muted)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gh-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Code Quality &amp; Style
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 10 }}>

            {/* Overall grade card */}
            <div className="gh-panel" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 16 }}>
              <GradeCircle grade={overall.grade} />
              <div>
                <p style={{ fontSize: 11, color: 'var(--gh-fg-muted)', marginBottom: 2 }}>Overall Grade</p>
                <p style={{ fontSize: 20, fontWeight: 800, color: 'var(--gh-fg)', lineHeight: 1 }}>
                  {overall.composite_score}
                  <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--gh-fg-muted)', marginLeft: 3 }}>/100</span>
                </p>
                <p style={{ fontSize: 11, color: 'var(--gh-fg-subtle)', marginTop: 2 }}>
                  {Object.keys(perFile).length} file{Object.keys(perFile).length !== 1 ? 's' : ''} scored
                </p>
              </div>
            </div>

            {/* Score breakdown */}
            <div className="gh-panel" style={{ padding: 16 }}>
              <ScoreBar label="Naming Conventions"    score={overall.naming_score}     />
              <ScoreBar label="Documentation Coverage" score={overall.doc_score}        />
              <ScoreBar label="Complexity Score"       score={overall.complexity_score} />
              <ScoreBar label="Line Length (PEP 8)"    score={overall.line_len_score}   />
            </div>
          </div>

          {/* Per-file table */}
          {Object.keys(perFile).length > 0 && (
            <div className="gh-panel" style={{ marginTop: 10, overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--gh-border)', background: 'var(--gh-canvas-subtle)' }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gh-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Per-file Style Scores
                </span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--gh-border)', background: 'var(--gh-canvas-subtle)' }}>
                      {['File', 'Grade', 'Score', 'Naming', 'Docs', 'Complexity', 'Line Length'].map(h => (
                        <th key={h} style={{ padding: '6px 12px', textAlign: 'left', fontSize: 10, fontWeight: 700, color: 'var(--gh-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(perFile).map(([path, scores], i) => (
                      <tr key={path} style={{ borderBottom: '1px solid var(--gh-border)', background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                        <td style={{ padding: '7px 12px', fontFamily: 'var(--gh-font-mono)', color: 'var(--gh-accent)', whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {path}
                        </td>
                        <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                          <GradeCircle grade={scores.grade} />
                        </td>
                        <td style={{ padding: '7px 12px', fontWeight: 700, color: 'var(--gh-fg)' }}>
                          {scores.composite_score}
                        </td>
                        <td style={{ padding: '7px 12px', color: 'var(--gh-fg-muted)' }}>{scores.naming_score}%</td>
                        <td style={{ padding: '7px 12px', color: 'var(--gh-fg-muted)' }}>{scores.doc_score}%</td>
                        <td style={{ padding: '7px 12px', color: 'var(--gh-fg-muted)' }}>{scores.complexity_score}%</td>
                        <td style={{ padding: '7px 12px', color: 'var(--gh-fg-muted)' }}>{scores.line_len_score}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
