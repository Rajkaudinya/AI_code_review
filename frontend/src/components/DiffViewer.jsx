import React, { useMemo } from 'react';
import { Eye, ArrowRight, Sparkles, CheckCircle2 } from 'lucide-react';

export default function DiffViewer({ finding }) {
  if (!finding || finding.refactored_code === null) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 font-mono text-xs py-16 bg-[#0a0d18]">
        <Eye className="w-10 h-10 opacity-10 mb-2" />
        <span>No active refactoring suggestion selected.</span>
        <span>Click "Compare Refactored Diff" inside the Code Viewer to see comparisons.</span>
      </div>
    );
  }

  const originalLines = useMemo(() => {
    return finding.code_snippet.split('\n');
  }, [finding.code_snippet]);

  const refactoredLines = useMemo(() => {
    return finding.refactored_code.split('\n');
  }, [finding.refactored_code]);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#070911]">
      {/* Title bar details */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.04] bg-white/[0.01]">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#00f5a0]" />
          <span className="font-semibold text-sm text-slate-300">Side-by-Side Refactoring Preview</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">File:</span>
          <span className="font-mono font-semibold text-slate-400">{finding.file_path}</span>
          <span className="text-slate-500">at line {finding.line_number}</span>
        </div>
      </div>

      {/* Side-by-Side Diff Panels */}
      <div className="flex-1 grid grid-cols-2 gap-px bg-white/[0.03] overflow-auto custom-scrollbar p-2">
        {/* Left Side: Original (Red Deletions) */}
        <div className="flex flex-col bg-[#0b0c16] rounded-l-lg overflow-hidden border border-white/[0.02]">
          <div className="px-3.5 py-1.5 border-b border-white/[0.04] bg-[#ff0055]/5 text-xs font-semibold text-[#ff0055] tracking-wider uppercase">
            Original Code Snippet
          </div>
          <div className="flex-1 p-3 font-mono text-sm leading-relaxed overflow-x-auto select-text min-w-max">
            {originalLines.map((line, idx) => (
              <div key={idx} className="flex px-2 py-0.5 rounded bg-[#ff0055]/5 hover:bg-[#ff0055]/10 text-slate-300 border-l-2 border-[#ff0055]/60 mb-0.5">
                <span className="w-8 text-[#ff0055]/50 select-none text-xs text-right pr-2.5 font-sans">-</span>
                <span className="whitespace-pre">{line}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right Side: Suggested Refactored (Green Additions) */}
        <div className="flex flex-col bg-[#0a0d17] rounded-r-lg overflow-hidden border border-white/[0.02]">
          <div className="px-3.5 py-1.5 border-b border-white/[0.04] bg-[#00f5a0]/5 text-xs font-semibold text-[#00f5a0] tracking-wider uppercase">
            Suggested AI Refactoring
          </div>
          <div className="flex-1 p-3 font-mono text-sm leading-relaxed overflow-x-auto select-text min-w-max">
            {refactoredLines.map((line, idx) => (
              <div key={idx} className="flex px-2 py-0.5 rounded bg-[#00f5a0]/5 hover:bg-[#00f5a0]/10 text-[#00f5a0] border-l-2 border-[#00f5a0]/60 mb-0.5">
                <span className="w-8 text-[#00f5a0]/50 select-none text-xs text-right pr-2.5 font-sans">+</span>
                <span className="whitespace-pre">{line}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Explanatory annotation section */}
      <div className="p-4 border-t border-white/[0.04] bg-white/[0.01]">
        <div className="flex items-start gap-3 p-3.5 rounded-lg bg-[#00f5a0]/5 border border-[#00f5a0]/15 max-w-5xl">
          <CheckCircle2 className="w-5 h-5 text-[#00f5a0] flex-shrink-0 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-[#00f5a0] mb-1">Refactoring Rationale</h4>
            <p className="text-xs text-slate-300 leading-relaxed mb-2">
              {finding.message}
            </p>
            <div className="text-[11px] text-slate-400 font-sans border-t border-white/[0.05] pt-2">
              <span className="font-semibold text-slate-300">Technical Improvement: </span>
              {finding.suggestion}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
