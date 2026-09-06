/**
 * Global Category Manager API Client Wrapper
 * Relative path /api/categories ensures smooth integration with backend proxy & production deployments.
 */
const BASE_URL = '/api/categories';

export const categoryApi = {
  /**
   * Fetch all categories with optional search and active status filters
   */
  async getAll(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.is_active !== undefined && params.is_active !== '') query.append('is_active', params.is_active);
    if (params.sort) query.append('sort', params.sort);
    if (params.order) query.append('order', params.order);

    const url = `${BASE_URL}${query.toString() ? '?' + query.toString() : ''}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch categories');
    return data;
  },

  /**
   * Get Category Statistics
   */
  async getStats() {
    const res = await fetch(`${BASE_URL}/stats`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to fetch statistics');
    return data;
  },

  /**
   * Get single category by ID
   */
  async getById(id) {
    const res = await fetch(`${BASE_URL}/${id}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Failed to fetch category #${id}`);
    return data;
  },

  /**
   * Create new category
   */
  async create(categoryData) {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(categoryData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'Failed to create category');
    return data;
  },

  /**
   * Update category by ID
   */
  async update(id, categoryData) {
    const res = await fetch(`${BASE_URL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(categoryData)
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Failed to update category #${id}`);
    return data;
  },

  /**
   * Delete category by ID
   */
  async delete(id) {
    const res = await fetch(`${BASE_URL}/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || `Failed to delete category #${id}`);
    return data;
  }
};
