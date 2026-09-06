import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

export default function DeleteConfirmModal({ isOpen, onClose, onConfirm, category, loading }) {
  if (!isOpen || !category) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl p-6">
        <div className="flex items-center space-x-3 text-rose-400 mb-4">
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-base text-white">Delete Category</h3>
            <p className="text-xs text-slate-400">This action cannot be undone</p>
          </div>
        </div>

        <p className="text-sm text-slate-300 leading-relaxed mb-6">
          Are you sure you want to delete <span className="font-semibold text-white">"{category.name}"</span> (ID: <span className="font-mono text-indigo-400">#{category.id}</span>)? 
          Ensure no services in Rohan's <span className="font-mono text-xs text-purple-300">services.category_id</span> foreign key are currently referencing this category.
        </p>

        <div className="flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="px-5 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 rounded-xl transition-all shadow-lg shadow-rose-600/25 flex items-center space-x-1.5"
          >
            <Trash2 className="w-4 h-4" />
            <span>{loading ? 'Deleting...' : 'Confirm Delete'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
