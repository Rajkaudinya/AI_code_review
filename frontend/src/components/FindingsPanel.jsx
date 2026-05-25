import React, { useState, useMemo } from 'react';
import { Search, ShieldAlert, Bug, AlertTriangle, Info, ArrowRight, Filter } from 'lucide-react';

export default function FindingsPanel({ findings, onNavigate }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');

  // Filter findings based on search term and selected severity filter
  const filteredFindings = useMemo(() => {
    return findings.filter(f => {
      const matchesSearch = f.file_path.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            f.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            f.rule_id.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesSeverity = severityFilter === 'ALL' || f.severity === severityFilter;
      
      return matchesSearch && matchesSeverity;
    });
  }, [findings, searchTerm, severityFilter]);

  const getSeverityBadge = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-[#ff0055]/10 border border-[#ff0055]/30 text-[#ff0055]">
            <Bug className="w-3 h-3" />
            CRITICAL
          </span>
        );
      case 'WARNING':
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-[#ffb300]/10 border border-[#ffb300]/30 text-[#ffb300]">
            <AlertTriangle className="w-3 h-3" />
            WARNING
          </span>
        );
      case 'INFO':
      default:
        return (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold bg-[#00b0ff]/10 border border-[#00b0ff]/30 text-[#00b0ff]">
            <Info className="w-3 h-3" />
            INFO
          </span>
        );
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#0a0d18] rounded-xl border border-white/[0.04]">
      {/* Header and Controls */}
      <div className="p-4 border-b border-white/[0.04] bg-white/[0.01] flex flex-col md:flex-row justify-between gap-3 items-center">
        <div className="flex items-center gap-2 mr-auto">
          <ShieldAlert className="w-4 h-4 text-[#00f2fe]" />
          <span className="font-semibold text-sm tracking-wide text-slate-300">Code Quality Findings ({filteredFindings.length})</span>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Search Box */}
          <div className="relative flex-1 md:flex-initial">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder="Search findings, files, or rules..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full md:w-60 bg-black/40 border border-white/[0.06] rounded-md pl-9 pr-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-[#00f2fe] focus:ring-1 focus:ring-[#00f2fe]/20"
            />
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-1 rounded bg-black/40 border border-white/[0.06] p-0.5">
            {['ALL', 'CRITICAL', 'WARNING', 'INFO'].map(sev => (
              <button
                key={sev}
                onClick={() => setSeverityFilter(sev)}
                className={`px-2.5 py-1 rounded text-[10px] font-semibold transition-all border-none cursor-pointer ${
                  severityFilter === sev 
                    ? 'bg-[#00f2fe]/15 text-[#00f2fe]' 
                    : 'text-slate-500 hover:text-slate-300 bg-transparent'
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Findings Table List */}
      <div className="flex-1 overflow-auto custom-scrollbar">
        {filteredFindings.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 font-mono text-xs py-20">
            <ShieldAlert className="w-8 h-8 opacity-20 mb-2" />
            <span>No matching code quality findings discovered.</span>
          </div>
        ) : (
          <div className="min-w-full inline-block align-middle">
            <table className="min-w-full divide-y divide-white/[0.03]">
              <thead className="bg-black/20 text-slate-500 text-[10px] font-semibold uppercase tracking-wider text-left">
                <tr>
                  <th className="px-4 py-3">Severity</th>
                  <th className="px-4 py-3">File Location</th>
                  <th className="px-4 py-3">Rule ID</th>
                  <th className="px-4 py-3">Issue Message</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.02] text-xs">
                {filteredFindings.map((finding, idx) => (
                  <tr 
                    key={idx}
                    className="hover:bg-white/[0.02] transition-colors"
                  >
                    <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                      {getSeverityBadge(finding.severity)}
                    </td>
                    <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                      <span className="font-mono text-slate-300 font-medium">{finding.file_path}</span>
                      <span className="text-slate-500 text-[11px] ml-1">line {finding.line_number}</span>
                    </td>
                    <td className="px-4 py-3.5 align-middle whitespace-nowrap">
                      <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700/50 text-slate-400">
                        {finding.rule_id}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 align-middle text-slate-300 font-sans leading-relaxed max-w-sm xl:max-w-xl break-words">
                      {finding.message}
                    </td>
                    <td className="px-4 py-3.5 align-middle text-right whitespace-nowrap">
                      <button
                        onClick={() => onNavigate(finding.file_path, finding.line_number, finding)}
                        className="btn-cyber-outline py-1 px-2.5 text-[10px] gap-1 hover:bg-[#00f2fe] hover:text-[#06070c] transition-all cursor-pointer"
                      >
                        Inspect Location
                        <ArrowRight className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
