import React, { useState, useMemo } from 'react';
import { Folder, FolderOpen, FileCode, ChevronDown, ChevronRight, Bug, AlertTriangle, Info } from 'lucide-react';

export default function FileTree({ files, findings, selectedFile, onSelectFile }) {
  const [collapsedFolders, setCollapsedFolders] = useState({});

  // Group findings by file path to calculate counts for badges
  const findingsSummaryByFile = useMemo(() => {
    const summary = {};
    findings.forEach(f => {
      const path = f.file_path;
      if (!summary[path]) {
        summary[path] = { CRITICAL: 0, WARNING: 0, INFO: 0, total: 0 };
      }
      summary[path][f.severity] = (summary[path][f.severity] || 0) + 1;
      summary[path].total += 1;
    });
    return summary;
  }, [findings]);

  // Nested folder structure generator
  const fileTreeRoot = useMemo(() => {
    const root = { name: 'root', isFolder: true, path: '', children: {} };
    
    files.forEach(file => {
      const parts = file.split('/');
      let current = root;
      
      parts.forEach((part, index) => {
        const isLast = index === parts.length - 1;
        const currentPath = parts.slice(0, index + 1).join('/');
        
        if (!current.children[part]) {
          current.children[part] = {
            name: part,
            path: currentPath,
            isFolder: !isLast,
            children: isLast ? null : {}
          };
        }
        current = current.children[part];
      });
    });
    
    return root;
  }, [files]);

  const toggleFolder = (path) => {
    setCollapsedFolders(prev => ({
      ...prev,
      [path]: !prev[path]
    }));
  };

  // Render tree node recursively
  const renderNode = (node) => {
    if (!node) return null;

    if (node.isFolder) {
      const isCollapsed = collapsedFolders[node.path];
      const childrenList = Object.values(node.children).sort((a, b) => {
        // Sort folders before files, then alphabetically
        if (a.isFolder && !b.isFolder) return -1;
        if (!a.isFolder && b.isFolder) return 1;
        return a.name.localeCompare(b.name);
      });

      return (
        <div key={node.path} className="pl-3.5">
          <div 
            onClick={() => toggleFolder(node.path)}
            className="flex items-center gap-1.5 py-1 px-2 rounded hover:bg-white/[0.04] cursor-pointer text-slate-300 hover:text-white transition-colors text-sm font-medium"
          >
            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
            {isCollapsed ? <Folder className="w-4 h-4 text-sky-400" /> : <FolderOpen className="w-4 h-4 text-sky-400" />}
            <span className="truncate">{node.name}</span>
          </div>
          
          {!isCollapsed && (
            <div className="border-l border-white/[0.05] ml-3.5">
              {childrenList.map(child => renderNode(child))}
            </div>
          )}
        </div>
      );
    } else {
      const isSelected = selectedFile === node.path;
      const fileFindings = findingsSummaryByFile[node.path];

      return (
        <div 
          key={node.path}
          onClick={() => onSelectFile(node.path)}
          className={`flex items-center justify-between py-1 px-2.5 ml-3.5 rounded cursor-pointer transition-all text-sm group ${
            isSelected 
              ? 'bg-[#00f2fe]/10 text-white font-medium border-l-2 border-[#00f2fe]' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.02]'
          }`}
        >
          <div className="flex items-center gap-2 truncate">
            <FileCode className={`w-4 h-4 flex-shrink-0 ${isSelected ? 'text-[#00f2fe]' : 'text-slate-500 group-hover:text-slate-400'}`} />
            <span className="truncate">{node.name}</span>
          </div>

          {/* Severity Badges Count */}
          {fileFindings && (
            <div className="flex items-center gap-1 pl-2">
              {fileFindings.CRITICAL > 0 && (
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[#ff0055]/15 border border-[#ff0055]/30 text-[#ff0055] text-[9px] font-bold">
                  {fileFindings.CRITICAL}
                </span>
              )}
              {fileFindings.WARNING > 0 && (
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[#ffb300]/15 border border-[#ffb300]/30 text-[#ffb300] text-[9px] font-bold">
                  {fileFindings.WARNING}
                </span>
              )}
              {fileFindings.INFO > 0 && (
                <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[#00b0ff]/15 border border-[#00b0ff]/30 text-[#00b0ff] text-[9px] font-bold">
                  {fileFindings.INFO}
                </span>
              )}
            </div>
          )}
        </div>
      );
    }
  };

  const rootNodes = Object.values(fileTreeRoot.children).sort((a, b) => {
    if (a.isFolder && !b.isFolder) return -1;
    if (!a.isFolder && b.isFolder) return 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3.5 py-2.5 border-b border-white/[0.04] bg-white/[0.01]">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Repository Structure</h3>
      </div>
      <div className="flex-1 overflow-y-auto py-2 pr-2 custom-scrollbar">
        {files.length === 0 ? (
          <div className="text-xs text-slate-600 text-center py-6 font-mono">No repository loaded.</div>
        ) : (
          <div className="pl-0.5">
            {rootNodes.map(node => renderNode(node))}
          </div>
        )}
      </div>
    </div>
  );
}
