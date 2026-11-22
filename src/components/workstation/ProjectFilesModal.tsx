import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, FileCode, Folder, Search, X } from 'lucide-react';
import type { ProjectFile } from '../../types/onecore';
import { cn } from '../../utils/cn';

interface DirectoryNode {
  name: string;
  path: string;
  directories: DirectoryNode[];
  files: ProjectFile[];
}

interface ProjectFilesModalProps {
  open: boolean;
  files: ProjectFile[];
  selectedFilePath: string;
  onClose: () => void;
  onSelectFile: (path: string) => void;
}

function buildDirectoryTree(files: ProjectFile[]): DirectoryNode {
  const root: DirectoryNode = { name: 'Проект', path: '.', directories: [], files: [] };
  const nodes = new Map<string, DirectoryNode>([[root.path, root]]);

  for (const file of files) {
    const segments = (file.folder || '.').replace(/\\/g, '/').split('/').filter((segment) => segment && segment !== '.');
    let parent = root;
    let directoryPath = '';

    for (const segment of segments) {
      directoryPath = directoryPath ? `${directoryPath}/${segment}` : segment;
      let directory = nodes.get(directoryPath);
      if (!directory) {
        directory = { name: segment, path: directoryPath, directories: [], files: [] };
        nodes.set(directoryPath, directory);
        parent.directories.push(directory);
      }
      parent = directory;
    }

    parent.files.push(file);
  }

  const sortTree = (node: DirectoryNode) => {
    node.directories.sort((left, right) => left.name.localeCompare(right.name));
    node.files.sort((left, right) => left.name.localeCompare(right.name));
    node.directories.forEach(sortTree);
  };
  sortTree(root);
  return root;
}

export const ProjectFilesModal: React.FC<ProjectFilesModalProps> = ({
  open,
  files,
  selectedFilePath,
  onClose,
  onSelectFile,
}) => {
  const [query, setQuery] = useState('');
  const [collapsedDirectories, setCollapsedDirectories] = useState<Record<string, boolean>>({});
  const tree = useMemo(() => buildDirectoryTree(files), [files]);

  if (!open) return null;

  const normalizedQuery = query.trim().toLowerCase();
  const fileMatches = (file: ProjectFile) =>
    !normalizedQuery ||
    file.name.toLowerCase().includes(normalizedQuery) ||
    file.path.toLowerCase().includes(normalizedQuery);

  const renderDirectory = (directory: DirectoryNode, depth: number): React.ReactNode => {
    const visibleFiles = directory.files.filter(fileMatches);
    const visibleDirectories = directory.directories.filter((child) =>
      normalizedQuery
        ? child.files.some(fileMatches) || child.directories.some(hasMatchingFile)
        : true,
    );
    if (normalizedQuery && visibleFiles.length === 0 && visibleDirectories.length === 0) return null;

    const collapsed = collapsedDirectories[directory.path] ?? false;
    return (
      <div key={directory.path}>
        {directory !== tree && (
          <button
            type="button"
            onClick={() =>
              setCollapsedDirectories((current) => ({
                ...current,
                [directory.path]: !collapsed,
              }))
            }
            aria-expanded={!collapsed}
            className="w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            style={{ paddingLeft: `${8 + depth * 16}px` }}
          >
            {collapsed ? <ChevronRight className="w-3.5 h-3.5 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 shrink-0" />}
            <Folder className="w-4 h-4 shrink-0 text-amber-500" />
            <span className="truncate">{directory.name}</span>
          </button>
        )}
        {!(directory !== tree && collapsed) && (
          <div>
            {visibleDirectories.map((child) => renderDirectory(child, depth + 1))}
            {visibleFiles.map((file) => (
              <button
                key={file.path}
                type="button"
                onClick={() => {
                  onSelectFile(file.path);
                  onClose();
                }}
                aria-current={selectedFilePath === file.path ? 'true' : undefined}
                className={cn(
                  'w-full flex items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors',
                  selectedFilePath === file.path
                    ? 'bg-blue-600/10 text-blue-700 dark:text-blue-300'
                    : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800',
                )}
                style={{ paddingLeft: `${28 + depth * 16}px` }}
              >
                <FileCode className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{file.name}</span>
                <span className="ml-auto shrink-0 text-[10px] font-mono text-zinc-400">
                  {file.content !== file.originalContent ? 'M' : file.inContext ? 'CTX' : ''}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  function hasMatchingFile(directory: DirectoryNode): boolean {
    return directory.files.some(fileMatches) || directory.directories.some(hasMatchingFile);
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="project-files-title"
        className="w-full max-w-3xl max-h-[85vh] flex flex-col overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#141418] shadow-2xl"
      >
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
          <div className="min-w-0">
            <h2 id="project-files-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              Файлы проекта
            </h2>
            <p className="mt-0.5 text-[11px] text-zinc-500">{files.length} файлов · выберите файл для просмотра</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрыть окно файлов"
            className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        <div className="p-3 border-b border-zinc-200 dark:border-zinc-800">
          <label className="relative block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по файлам и папкам"
              className="w-full h-8 pl-8 pr-2 border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-xs text-zinc-800 dark:text-zinc-200"
            />
          </label>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto p-2">
          {files.length ? (
            renderDirectory(tree, 0)
          ) : (
            <p className="p-6 text-center text-xs text-zinc-500">В проекте нет доступных файлов.</p>
          )}
        </div>
      </section>
    </div>
  );
};
