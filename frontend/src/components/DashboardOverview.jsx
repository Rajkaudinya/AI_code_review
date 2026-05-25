import React, { useMemo } from 'react';
import { ShieldCheck, Bug, AlertTriangle, Info, Terminal, Activity, FileText, CheckCircle2 } from 'lucide-react';

export default function DashboardOverview({ result }) {
  const {
    files_analyzed = [],
    findings = [],
    ast_metrics = {},
    linter_summary = {},
    test_summary = {},
    validation_status = 'unvalidated',
    history = []
  } = result || {};

  // Compute counts
  const criticalCount = useMemo(() => findings.filter(f => f.severity === 'CRITICAL').length, [findings]);
  const warningCount = useMemo(() => findings.filter(f => f.severity === 'WARNING').length, [findings]);
  const infoCount = useMemo(() => findings.filter(f => f.severity === 'INFO').length, [findings]);

  // Compute average AST cyclomatic complexity
  const avgComplexity = useMemo(() => {
    const reports = Object.values(ast_metrics);
    if (reports.length === 0) return 0;
    const sum = reports.reduce((acc, curr) => acc + (curr.average_complexity || 0), 0);
    return (sum / reports.length).toFixed(2);
  }, [ast_metrics]);

  const testPassRate = useMemo(() => {
    const passed = test_summary.passed || 0;
    const total = test_summary.total || 0;
    if (total === 0) return 0;
    return Math.round((passed / total) * 100);
  }, [test_summary]);

  const getValidationBadge = (status) => {
    switch (status) {
      case 'verified_clean':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#00f5a0]/15 border border-[#00f5a0]/40 text-[#00f5a0] shadow-sm shadow-[#00f5a0]/10">
            <CheckCircle2 className="w-3.5 h-3.5" />
            VERIFIED SECURE
          </span>
        );
      case 'failed_tests':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#ff0055]/15 border border-[#ff0055]/40 text-[#ff0055]">
            <Bug className="w-3.5 h-3.5" />
            TESTS FAILING
          </span>
        );
      case 'failed_lint':
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#ffb300]/15 border border-[#ffb300]/40 text-[#ffb300]">
            <AlertTriangle className="w-3.5 h-3.5" />
            LINT WARNINGS INTRODUCED
          </span>
        );
      case 'unvalidated':
      default:
        return (
          <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-slate-800 border border-slate-700 text-slate-400">
            UNVALIDATED SUGGESTIONS
          </span>
        );
    }
  };

  return (
    <div className="p-4 space-y-6 overflow-y-auto h-full custom-scrollbar bg-[#070912]">
      {/* Upper Grid: Status & Core Summary */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 bg-white/[0.01] p-4 rounded-xl border border-white/[0.03]">
        <div>
          <h2 className="text-xl font-bold text-slate-100 flex items-center gap-2">
            <Activity className="w-5 h-5 text-[#00f2fe]" />
            Agent Analysis Summary
          </h2>
          <p className="text-xs text-slate-400 mt-1">Review outcomes, AST complexity and test validations.</p>
        </div>
        <div>
          {getValidationBadge(validation_status)}
        </div>
      </div>

      {/* Metrics Widgets Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total issues widget */}
        <div className="glass-panel p-4 flex items-center gap-4 bg-slate-900/40">
          <div className="p-3 rounded-lg bg-[#00f2fe]/10 border border-[#00f2fe]/20">
            <ShieldCheck className="w-6 h-6 text-[#00f2fe]" />
          </div>
          <div>
            <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">Total Findings</div>
            <div className="text-2xl font-bold text-slate-100 mt-0.5">{findings.length}</div>
          </div>
        </div>

        {/* Critical issues widget */}
        <div className="glass-panel p-4 flex items-center gap-4 bg-slate-900/40">
          <div className="p-3 rounded-lg bg-[#ff0055]/10 border border-[#ff0055]/20">
            <Bug className="w-6 h-6 text-[#ff0055]" />
          </div>
          <div>
            <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">Critical Bugs</div>
            <div className="text-2xl font-bold text-slate-100 mt-0.5">{criticalCount}</div>
          </div>
        </div>

        {/* Warning issues widget */}
        <div className="glass-panel p-4 flex items-center gap-4 bg-slate-900/40">
          <div className="p-3 rounded-lg bg-[#ffb300]/10 border border-[#ffb300]/20">
            <AlertTriangle className="w-6 h-6 text-[#ffb300]" />
          </div>
          <div>
            <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">Linter Warnings</div>
            <div className="text-2xl font-bold text-slate-100 mt-0.5">{warningCount}</div>
          </div>
        </div>

        {/* Info issues widget */}
        <div className="glass-panel p-4 flex items-center gap-4 bg-slate-900/40">
          <div className="p-3 rounded-lg bg-[#00b0ff]/10 border border-[#00b0ff]/20">
            <Info className="w-6 h-6 text-[#00b0ff]" />
          </div>
          <div>
            <div className="text-slate-400 text-xs font-medium uppercase tracking-wider">Style Details</div>
            <div className="text-2xl font-bold text-slate-100 mt-0.5">{infoCount}</div>
          </div>
        </div>
      </div>

      {/* Middle Grid: Detailed tool widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Test runner status card */}
        <div className="glass-panel p-5 flex flex-col justify-between border-white/[0.04] bg-slate-950/40">
          <div>
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider border-b border-white/[0.04] pb-2 mb-3">
              Pytest Runner Status
            </h3>
            {test_summary.total > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Unit Tests Discovered</span>
                  <span className="text-xs font-bold text-slate-200">{test_summary.total}</span>
                </div>
                <div className="flex items-center justify-between text-[#00f5a0]">
                  <span className="text-xs">Tests Passing</span>
                  <span className="text-xs font-bold">{test_summary.passed}</span>
                </div>
                <div className={`flex items-center justify-between ${test_summary.failed > 0 ? 'text-[#ff0055]' : 'text-slate-500'}`}>
                  <span className="text-xs">Tests Failing</span>
                  <span className="text-xs font-bold">{test_summary.failed}</span>
                </div>

                {/* Progress bar gauge */}
                <div className="space-y-1 pt-2">
                  <div className="flex justify-between text-[10px] font-mono text-slate-500">
                    <span>SUCCESS RATE</span>
                    <span>{testPassRate}%</span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${testPassRate === 100 ? 'bg-[#00f5a0]' : 'bg-[#ff0055]'}`} 
                      style={{ width: `${testPassRate}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs text-slate-500 font-mono py-6 text-center">No unit tests ran in target codebase.</div>
            )}
          </div>
        </div>

        {/* Linter Summary & Files Analyzed */}
        <div className="glass-panel p-5 flex flex-col justify-between border-white/[0.04] bg-slate-950/40">
          <div>
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider border-b border-white/[0.04] pb-2 mb-3">
              Static Code Parameters
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  Files Analyzed
                </span>
                <span className="text-xs font-bold text-slate-200">{files_analyzed.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Static Violations Found</span>
                <span className="text-xs font-bold text-[#ffb300]">{linter_summary.total_issues || 0}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Mean Cyclomatic Complexity</span>
                <span className="text-xs font-bold text-[#00b0ff]">{avgComplexity}</span>
              </div>
              <div className="text-[10px] text-slate-500 leading-relaxed italic border-t border-white/[0.03] pt-2 mt-2">
                AST measures logical branching statements. Optimal complexity is below 4.0.
              </div>
            </div>
          </div>
        </div>

        {/* LangGraph Iteration History logs (Vertical Audit Trail) */}
        <div className="glass-panel p-5 flex flex-col border-white/[0.04] bg-slate-950/40">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider border-b border-white/[0.04] pb-2 mb-3 flex items-center gap-1.5">
            <Terminal className="w-4 h-4 text-[#00f2fe]" />
            Agent Validation Trail
          </h3>
          <div className="flex-1 overflow-y-auto max-h-[160px] custom-scrollbar pr-1">
            {history.length === 0 ? (
              <div className="text-xs text-slate-500 font-mono py-6 text-center">
                {validation_status === 'unvalidated' ? 'Auto-fixes disabled. Review only.' : 'Pending first validation run...'}
              </div>
            ) : (
              <div className="relative pl-4 border-l border-white/[0.05] space-y-4 py-1">
                {history.map((entry, idx) => {
                  const pass = entry.tests_failed === 0;
                  return (
                    <div key={idx} className="relative text-xs">
                      {/* Timeline dot marker */}
                      <span className={`absolute -left-[21px] top-0.5 w-2.5 h-2.5 rounded-full ${pass ? 'bg-[#00f5a0]' : 'bg-[#ff0055]'}`} />
                      <div className="font-semibold text-slate-300">Validation Round {entry.iteration + 1}</div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Lints: {entry.linter_issues_count} issues | Tests: {entry.tests_passed} / {entry.tests_passed + entry.tests_failed} passed
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
