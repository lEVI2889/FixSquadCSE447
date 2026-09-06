import React from 'react';
import { Layers, CheckCircle2, XCircle, Link2 } from 'lucide-react';

export default function StatsCards({ stats, totalLoaded }) {
  const total = stats?.total_categories ?? totalLoaded ?? 0;
  const active = stats?.active_categories ?? 0;
  const inactive = stats?.inactive_categories ?? 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center space-x-4">
        <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
          <Layers className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Total Categories</p>
          <p className="text-2xl font-bold text-white mt-0.5">{total}</p>
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center space-x-4">
        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Active Categories</p>
          <p className="text-2xl font-bold text-emerald-400 mt-0.5">{active}</p>
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center space-x-4">
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
          <XCircle className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Inactive Categories</p>
          <p className="text-2xl font-bold text-amber-400 mt-0.5">{inactive}</p>
        </div>
      </div>

      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex items-center space-x-4">
        <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400">
          <Link2 className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">FK Target Key</p>
          <p className="text-sm font-semibold text-purple-300 mt-1 font-mono">categories.id (INT)</p>
        </div>
      </div>
    </div>
  );
}
