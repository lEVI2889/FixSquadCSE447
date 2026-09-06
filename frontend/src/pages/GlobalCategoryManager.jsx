import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Filter, LayoutGrid, List, RefreshCw, 
  AlertCircle, CheckCircle2, Link2, Sparkles, FolderPlus
} from 'lucide-react';
import { categoryApi } from '../api/categoryApi';
import StatsCards from '../components/StatsCards';
import CategoryCard from '../components/CategoryCard';
import CategoryTable from '../components/CategoryTable';
import CategoryFormModal from '../components/CategoryFormModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import ContractInspectorModal from '../components/ContractInspectorModal';

export default function GlobalCategoryManager() {
  const [categories, setCategories] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toast, setToast] = useState(null);

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('id');
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'

  // Modals state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [isContractOpen, setIsContractOpen] = useState(false);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');
      const [catRes, statsRes] = await Promise.all([
        categoryApi.getAll(),
        categoryApi.getStats()
      ]);
      setCategories(catRes.data || []);
      setStats(statsRes.data || null);
    } catch (err) {
      console.error('Failed to load categories:', err);
      setError(err.message || 'Unable to connect to backend server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateNew = () => {
    setSelectedCategory(null);
    setIsFormOpen(true);
  };

  const handleEdit = (category) => {
    setSelectedCategory(category);
    setIsFormOpen(true);
  };

  const handleDeletePrompt = (category) => {
    setCategoryToDelete(category);
    setIsDeleteOpen(true);
  };

  const handleSaveCategory = async (formData) => {
    if (selectedCategory) {
      // Update
      const res = await categoryApi.update(selectedCategory.id, formData);
      showToast(`Category "${res.data.name}" updated successfully.`);
    } else {
      // Create
      const res = await categoryApi.create(formData);
      showToast(`Category "${res.data.name}" created successfully.`);
    }
    loadData();
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;
    try {
      setDeleteLoading(true);
      await categoryApi.delete(categoryToDelete.id);
      showToast(`Category "${categoryToDelete.name}" deleted successfully.`);
      setIsDeleteOpen(false);
      setCategoryToDelete(null);
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to delete category.', 'error');
    } finally {
      setDeleteLoading(false);
    }
  };

  // Filter and sort categories
  const filteredCategories = useMemo(() => {
    return categories
      .filter((cat) => {
        const matchesSearch = 
          cat.name.toLowerCase().includes(search.toLowerCase()) ||
          (cat.description && cat.description.toLowerCase().includes(search.toLowerCase()));
        
        const matchesStatus = 
          statusFilter === 'all' 
            ? true 
            : statusFilter === 'active' 
              ? Boolean(cat.is_active) 
              : !Boolean(cat.is_active);

        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        if (sortBy === 'name') return a.name.localeCompare(b.name);
        if (sortBy === 'newest') return b.id - a.id;
        return a.id - b.id;
      });
  }, [categories, search, statusFilter, sortBy]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center space-x-2 px-4 py-3 rounded-xl border shadow-xl animate-in slide-in-from-bottom-4 duration-200 ${
          toast.type === 'error' 
            ? 'bg-rose-950/90 text-rose-200 border-rose-800' 
            : 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
        }`}>
          {toast.type === 'error' ? <AlertCircle className="w-5 h-5 text-rose-400" /> : <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          <span className="text-sm font-medium">{toast.message}</span>
        </div>
      )}

      {/* Hero / Header Banner */}
      <div className="bg-gradient-to-r from-indigo-900/40 via-purple-900/30 to-slate-900/50 border border-indigo-500/20 rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="relative z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>Core Foundation Architecture • Feature 12</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Global Service Category Manager
          </h2>
          <p className="text-slate-400 text-sm mt-2 max-w-2xl leading-relaxed">
            Manage global service categories using raw SQL queries with zero ORMs. 
            All records maintain strict foreign key compatibility for Rohan's <code className="text-indigo-300 bg-indigo-950/60 px-1.5 py-0.5 rounded font-mono text-xs">services.category_id</code> reference.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 relative z-10">
          <button
            onClick={() => setIsContractOpen(true)}
            className="px-4 py-2.5 bg-slate-800/80 hover:bg-slate-800 text-slate-200 hover:text-white border border-slate-700 rounded-xl text-sm font-medium transition-all shadow-sm flex items-center space-x-2"
          >
            <Link2 className="w-4 h-4 text-indigo-400" />
            <span>Contract Spec</span>
          </button>

          <button
            onClick={handleCreateNew}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-all shadow-lg shadow-indigo-600/30 flex items-center space-x-2 group"
          >
            <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-200" />
            <span>Add Category</span>
          </button>
        </div>
      </div>

      {/* Aggregate Statistics */}
      <StatsCards stats={stats} totalLoaded={categories.length} />

      {/* Search, Filter, and Controls Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Search Box */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search categories by name or description..."
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl text-sm text-white placeholder-slate-500 outline-none transition-all"
          />
        </div>

        {/* Filters and View Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Status Filter */}
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          {/* Sort By */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-slate-200 text-sm rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
          >
            <option value="id">Sort by ID (Ascending)</option>
            <option value="name">Sort by Name (A-Z)</option>
            <option value="newest">Sort by Newest</option>
          </select>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'grid' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Grid View"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`p-1.5 rounded-lg transition-colors ${
                viewMode === 'table' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
              title="Table View"
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 rounded-xl transition-colors disabled:opacity-50"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center space-x-3 text-rose-400 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold">Backend Connection Notice</p>
            <p className="text-xs text-rose-300/80 mt-0.5">{error}</p>
          </div>
          <button
            onClick={loadData}
            className="px-3 py-1 bg-rose-500/20 hover:bg-rose-500/30 rounded-lg text-xs font-semibold transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Category List Render */}
      {loading && categories.length === 0 ? (
        <div className="py-16 text-center">
          <RefreshCw className="w-8 h-8 animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Executing raw SQL query to load categories...</p>
        </div>
      ) : filteredCategories.length === 0 ? (
        <div className="py-16 text-center bg-slate-900/40 border border-slate-800 rounded-2xl p-8">
          <FolderPlus className="w-12 h-12 text-slate-600 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-white">No categories found</h3>
          <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto">
            {search ? `No categories match your search "${search}".` : 'Get started by creating your first service category.'}
          </p>
          <button
            onClick={handleCreateNew}
            className="mt-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-medium transition-colors inline-flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Category</span>
          </button>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {filteredCategories.map((category) => (
            <CategoryCard
              key={category.id}
              category={category}
              onEdit={handleEdit}
              onDelete={handleDeletePrompt}
            />
          ))}
        </div>
      ) : (
        <CategoryTable
          categories={filteredCategories}
          onEdit={handleEdit}
          onDelete={handleDeletePrompt}
        />
      )}

      {/* Modals */}
      <CategoryFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onSave={handleSaveCategory}
        category={selectedCategory}
      />

      <DeleteConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setCategoryToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        category={categoryToDelete}
        loading={deleteLoading}
      />

      <ContractInspectorModal
        isOpen={isContractOpen}
        onClose={() => setIsContractOpen(false)}
      />
    </div>
  );
}
