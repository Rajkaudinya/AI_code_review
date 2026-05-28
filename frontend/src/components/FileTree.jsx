import { useState, useMemo } from 'react';
import { Folder, FolderOpen, FileCode, ChevronRight, ChevronDown } from 'lucide-react';

export default function FileTree({ files, findings, selectedFile, onSelectFile }) {
  const [collapsed, setCollapsed] = useState({});

  const findingsByFile = useMemo(() => {
    const map = {};
    findings.forEach(f => {
      if (!map[f.file_path]) map[f.file_path] = { CRITICAL: 0, WARNING: 0, INFO: 0 };
      map[f.file_path][f.severity]++;
    });
    return map;
  }, [findings]);

  const tree = useMemo(() => {
    const root = { isFolder: true, path: '', children: {} };
    files.forEach(file => {
      const parts = file.split('/');
      let cur = root;
      parts.forEach((part, i) => {
        const isLast = i === parts.length - 1;
        const path   = parts.slice(0, i + 1).join('/');
        if (!cur.children[part]) {
          cur.children[part] = { name: part, path, isFolder: !isLast, children: isLast ? null : {} };
        }
        cur = cur.children[part];
      });
    });
    return root;
  }, [files]);

  const toggle = (path) => setCollapsed(prev => ({ ...prev, [path]: !prev[path] }));

  const renderNode = (node, depth = 0) => {
    if (!node) return null;
    const indent = depth * 14 + 8;

    if (node.isFolder) {
      const open = !collapsed[node.path];
      const sorted = Object.values(node.children).sort((a, b) => {
        if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      return (
        <div key={node.path}>
          <div className="tree-item" style={{ paddingLeft: indent }} onClick={() => toggle(node.path)}>
            {open ? <ChevronDown size={13} color="var(--gh-fg-subtle)" /> : <ChevronRight size={13} color="var(--gh-fg-subtle)" />}
            {open
              ? <FolderOpen size={14} color="#58a6ff" />
              : <Folder size={14} color="#58a6ff" />
            }
            <span style={{ fontSize: 13 }}>{node.name}</span>
          </div>
          {open && sorted.map(c => renderNode(c, depth + 1))}
        </div>
      );
    }

    const active = selectedFile === node.path;
    const fc     = findingsByFile[node.path];
    return (
      <div key={node.path}
        className={`tree-item ${active ? 'tree-item-active' : ''}`}
        style={{ paddingLeft: indent + 18 }}
        onClick={() => onSelectFile(node.path)}>
        <FileCode size={13} color={active ? 'var(--gh-accent)' : 'var(--gh-fg-subtle)'} />
        <span style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {node.name}
        </span>
        {fc && (
          <span style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
            {fc.CRITICAL > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '0 5px', borderRadius: 10, background: 'rgba(248,81,73,0.15)', color: 'var(--gh-danger)' }}>
                {fc.CRITICAL}
              </span>
            )}
            {fc.WARNING > 0 && (
              <span style={{ fontSize: 10, fontWeight: 700, padding: '0 5px', borderRadius: 10, background: 'rgba(210,153,34,0.15)', color: 'var(--gh-attention)' }}>
                {fc.WARNING}
              </span>
            )}
          </span>
        )}
      </div>
    );
  };

  const roots = Object.values(tree.children).sort((a, b) => {
    if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--gh-border)' }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gh-fg-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          Repository Files
        </span>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 4px' }}>
        {files.length === 0
          ? <p style={{ fontSize: 12, color: 'var(--gh-fg-subtle)', textAlign: 'center', padding: 16 }}>No files loaded.</p>
          : roots.map(n => renderNode(n))
        }
      </div>
    </div>
  );
}
