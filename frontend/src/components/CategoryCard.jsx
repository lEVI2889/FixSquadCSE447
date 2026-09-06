import React from 'react';
import { 
  Sparkles, Wrench, Zap, Hammer, Palette, Cpu, Shield, 
  Scissors, Folder, Edit3, Trash2, Calendar, CheckCircle2, XCircle
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

export default function CategoryCard({ category, onEdit, onDelete }) {
  const IconComponent = iconMap[category.icon] || Folder;
  const isActive = Boolean(category.is_active);

  const formattedDate = category.created_at 
    ? new Date(category.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : 'Recently';

  return (
    <div className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-5 flex flex-col justify-between transition-all duration-200 hover:shadow-xl hover:shadow-indigo-500/5 group">
      <div>
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500/20 group-hover:text-indigo-300 transition-colors">
              <IconComponent className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs text-slate-500 bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-700">
                  ID: #{category.id}
                </span>
                <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                  isActive 
                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                    : 'bg-slate-800 text-slate-400 border-slate-700'
                }`}>
                  {isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <h3 className="font-semibold text-base text-white mt-1 group-hover:text-indigo-200 transition-colors">
                {category.name}
              </h3>
            </div>
          </div>
        </div>

        <p className="text-sm text-slate-400 mt-3 line-clamp-2 leading-relaxed">
          {category.description || 'No description provided.'}
        </p>
      </div>

      <div className="mt-5 pt-4 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center">
          <Calendar className="w-3.5 h-3.5 mr-1" />
          {formattedDate}
        </span>

        <div className="flex items-center space-x-1">
          <button
            onClick={() => onEdit(category)}
            className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded-lg transition-colors"
            title="Edit category"
          >
            <Edit3 className="w-4 h-4" />
          </button>
          <button
            onClick={() => onDelete(category)}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            title="Delete category"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
