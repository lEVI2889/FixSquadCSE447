import React from 'react';
import { 
  Sparkles, Wrench, Zap, Hammer, Palette, Cpu, Shield, 
  Scissors, Folder, Edit3, Trash2, Calendar
} from 'lucide-react';

const iconMap = {
  sparkles: Sparkles,
  wrench: Wrench,
  zap: Zap,
  hammer: Hammer,
  palette: Palette,
  cpu: Cpu,
  shield: Shield,
  scissors: Scissors,
  folder: Folder
};

export default function CategoryTable({ categories, onEdit, onDelete }) {
  return (
    <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-xl">
      <table className="w-full text-left text-sm text-slate-300">
        <thead className="bg-slate-950/60 text-xs uppercase font-semibold text-slate-400 border-b border-slate-800">
          <tr>
            <th scope="col" className="px-6 py-4">ID (FK Key)</th>
            <th scope="col" className="px-6 py-4">Category Name</th>
            <th scope="col" className="px-6 py-4">Description</th>
            <th scope="col" className="px-6 py-4">Status</th>
            <th scope="col" className="px-6 py-4">Created</th>
            <th scope="col" className="px-6 py-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800">
          {categories.map((cat) => {
            const IconComponent = iconMap[cat.icon] || Folder;
            const isActive = Boolean(cat.is_active);
            const formattedDate = cat.created_at 
              ? new Date(cat.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
              : '-';

            return (
              <tr key={cat.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="px-6 py-4 font-mono font-bold text-indigo-400">
                  #{cat.id}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
                      <IconComponent className="w-4 h-4" />
                    </div>
                    <span className="font-semibold text-white">{cat.name}</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-slate-400 max-w-xs truncate">
                  {cat.description || '-'}
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full border ${
                    isActive 
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                      : 'bg-slate-800 text-slate-400 border-slate-700'
                  }`}>
                    {isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500 text-xs">
                  {formattedDate}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => onEdit(cat)}
                      className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
                      title="Edit Category"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(cat)}
                      className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                      title="Delete Category"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
