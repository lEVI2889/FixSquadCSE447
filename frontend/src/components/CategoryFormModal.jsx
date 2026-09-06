import React, { useState, useEffect } from 'react';
import { X, Sparkles, Wrench, Zap, Hammer, Palette, Cpu, Shield, Scissors, Folder, Check } from 'lucide-react';

const icons = [
  { id: 'sparkles', label: 'Cleaning / Sparkles', Icon: Sparkles },
  { id: 'wrench', label: 'Plumbing / Wrench', Icon: Wrench },
  { id: 'zap', label: 'Electrical / Zap', Icon: Zap },
  { id: 'hammer', label: 'Carpentry / Hammer', Icon: Hammer },
  { id: 'palette', label: 'Painting / Palette', Icon: Palette },
  { id: 'cpu', label: 'Appliance / CPU', Icon: Cpu },
  { id: 'shield', label: 'Pest / Security', Icon: Shield },
  { id: 'scissors', label: 'Lawn / Scissors', Icon: Scissors },
  { id: 'folder', label: 'General / Folder', Icon: Folder }
];

export default function CategoryFormModal({ isOpen, onClose, onSave, category }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('folder');
  const [isActive, setIsActive] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (category) {
      setName(category.name || '');
      setDescription(category.description || '');
      setIcon(category.icon || 'folder');
      setIsActive(Boolean(category.is_active));
    } else {
      setName('');
      setDescription('');
      setIcon('folder');
      setIsActive(true);
    }
    setError('');
  }, [category, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Category name is required.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        icon,
        is_active: isActive ? 1 : 0
      });
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save category.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-950/40">
          <div>
            <h2 className="text-lg font-bold text-white">
              {category ? `Edit Category #${category.id}` : 'Create New Category'}
            </h2>
            <p className="text-xs text-slate-400">
              {category ? 'Update category details and availability' : 'Add a global category for provider services'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-medium">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Category Name <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Home Cleaning, Solar Installation..."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the services offered under this category..."
              className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Category Icon
            </label>
            <div className="grid grid-cols-5 gap-2">
              {icons.map(({ id, Icon }) => {
                const isSelected = icon === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setIcon(id)}
                    className={`flex flex-col items-center justify-center p-2.5 rounded-xl border transition-all ${
                      isSelected
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300 ring-1 ring-indigo-500/50'
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] mt-1 truncate capitalize">{id}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="pt-2">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 bg-slate-950 border-slate-700"
              />
              <div>
                <span className="text-sm font-medium text-slate-200">Active Status</span>
                <p className="text-xs text-slate-500">Allow providers to select this category when creating services</p>
              </div>
            </label>
          </div>

          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 rounded-xl transition-all shadow-lg shadow-indigo-600/25 flex items-center space-x-1.5"
            >
              {loading ? (
                <span>Saving...</span>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>{category ? 'Update Category' : 'Create Category'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
