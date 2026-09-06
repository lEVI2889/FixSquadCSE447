import React, { useState } from 'react';
import { X, Copy, Check, Database, Code, FileText, CheckCircle2 } from 'lucide-react';

export default function ContractInspectorModal({ isOpen, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const rawSqlSchema = `CREATE TABLE categories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  icon VARCHAR(100) DEFAULT 'folder',
  is_active TINYINT(1) DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);`;

  const copyContract = () => {
    navigator.clipboard.writeText(rawSqlSchema);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/60">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Integration Contract: Week 1 (Feature 12)</h2>
              <p className="text-xs text-slate-400">Naim • Global Category Manager • Target Contract for Rohan, Shan & Wasik</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center">
                <Database className="w-4 h-4 mr-1.5" />
                1. Exact Database Schema (Raw SQL)
              </h3>
              <button
                onClick={copyContract}
                className="text-xs flex items-center space-x-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied SQL' : 'Copy DDL'}</span>
              </button>
            </div>
            <pre className="p-4 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-indigo-200 overflow-x-auto">
              {rawSqlSchema}
            </pre>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-400 mb-2 flex items-center">
              <Code className="w-4 h-4 mr-1.5" />
              2. Teammate Foreign Key Alignment
            </h3>
            <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
              <p>
                <strong className="text-white">Rohan's Feature 6 (`services` table):</strong>
              </p>
              <p className="font-mono text-purple-300 bg-purple-950/30 p-2 rounded border border-purple-800/30">
                category_id INT FOREIGN KEY REFERENCES categories(id)
              </p>
              <p className="text-slate-400">
                Guaranteed: Table is <code className="text-white">categories</code>, PK is <code className="text-white">id</code> (type <code className="text-white">INT</code>), name column is <code className="text-white">name</code> (type <code className="text-white">VARCHAR</code>).
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
              3. API Endpoints Catalog
            </h3>
            <div className="space-y-2 text-xs font-mono">
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-emerald-400">GET /api/categories</span>
                <span className="text-slate-400 font-sans text-[11px]">Returns array of all categories</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-emerald-400">GET /api/categories/:id</span>
                <span className="text-slate-400 font-sans text-[11px]">Returns single category by ID</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-indigo-400">POST /api/categories</span>
                <span className="text-slate-400 font-sans text-[11px]">Creates a new category</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-amber-400">PUT /api/categories/:id</span>
                <span className="text-slate-400 font-sans text-[11px]">Updates existing category</span>
              </div>
              <div className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between">
                <span className="text-rose-400">DELETE /api/categories/:id</span>
                <span className="text-slate-400 font-sans text-[11px]">Deletes category (FK protected)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
          <span>File: <code className="text-indigo-300">Week1_Naim_CONTRACT.md</code> (Excluded from Git)</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg font-medium transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}
