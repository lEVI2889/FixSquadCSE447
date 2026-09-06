const db = require('../config/db');

/**
 * @desc    Fetch all categories with optional search and active status filters
 * @route   GET /api/categories
 * @access  Public / Teammate Integration
 */
async function getAllCategories(req, res, next) {
  try {
    const { search, is_active, sort = 'id', order = 'ASC' } = req.query;

    let sql = 'SELECT id, name, description, icon, is_active, created_at, updated_at FROM categories';
    const params = [];
    const whereConditions = [];

    // Filter by search query (name or description)
    if (search && search.trim()) {
      whereConditions.push('(name LIKE ? OR description LIKE ?)');
      const wildcard = `%${search.trim()}%`;
      params.push(wildcard, wildcard);
    }

    // Filter by active status (1 or 0)
    if (is_active !== undefined && is_active !== '') {
      whereConditions.push('is_active = ?');
      params.push(is_active === 'true' || is_active === '1' ? 1 : 0);
    }

    if (whereConditions.length > 0) {
      sql += ' WHERE ' + whereConditions.join(' AND ');
    }

    // Order clause
    const validSortCols = ['id', 'name', 'created_at'];
    const validOrder = ['ASC', 'DESC'];
    const sortCol = validSortCols.includes(sort) ? sort : 'id';
    const sortOrder = validOrder.includes(order.toUpperCase()) ? order.toUpperCase() : 'ASC';

    sql += ` ORDER BY ${sortCol} ${sortOrder}`;

    const categories = await db.query(sql, params);

    return res.status(200).json({
      success: true,
      count: categories.length,
      data: categories
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Fetch single category by ID
 * @route   GET /api/categories/:id
 * @access  Public / Teammate Integration
 */
async function getCategoryById(req, res, next) {
  try {
    const categoryId = parseInt(req.params.id, 10);
    if (isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID provided.'
      });
    }

    const sql = 'SELECT id, name, description, icon, is_active, created_at, updated_at FROM categories WHERE id = ?';
    const results = await db.query(sql, [categoryId]);

    if (!results || results.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Category with ID ${categoryId} not found.`
      });
    }

    return res.status(200).json({
      success: true,
      data: results[0]
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Create a new category
 * @route   POST /api/categories
 * @access  Admin / Authenticated
 */
async function createCategory(req, res, next) {
  try {
    const { name, description = '', icon = 'folder', is_active = 1 } = req.body;

    // Validate name
    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required.'
      });
    }

    const trimmedName = name.trim();

    // Check duplicate name using raw SQL
    const checkSql = 'SELECT id FROM categories WHERE name = ?';
    const existing = await db.query(checkSql, [trimmedName]);

    if (existing && existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: `A category with the name "${trimmedName}" already exists.`
      });
    }

    // Insert new category using raw SQL
    const insertSql = 'INSERT INTO categories (name, description, icon, is_active) VALUES (?, ?, ?, ?)';
    const activeValue = (is_active === true || is_active === 1 || is_active === '1') ? 1 : 0;
    const result = await db.query(insertSql, [trimmedName, description ? description.trim() : '', icon ? icon.trim() : 'folder', activeValue]);

    // Fetch the newly created record
    const fetchSql = 'SELECT id, name, description, icon, is_active, created_at, updated_at FROM categories WHERE id = ?';
    const newCategory = await db.query(fetchSql, [result.insertId]);

    return res.status(201).json({
      success: true,
      message: 'Category created successfully.',
      data: newCategory[0]
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'A category with this name already exists.'
      });
    }
    next(error);
  }
}

/**
 * @desc    Update an existing category
 * @route   PUT /api/categories/:id
 * @access  Admin / Authenticated
 */
async function updateCategory(req, res, next) {
  try {
    const categoryId = parseInt(req.params.id, 10);
    if (isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID provided.'
      });
    }

    const { name, description, icon, is_active } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Category name is required.'
      });
    }

    const trimmedName = name.trim();

    // Check if category exists
    const checkSql = 'SELECT id, name, description, icon, is_active FROM categories WHERE id = ?';
    const existing = await db.query(checkSql, [categoryId]);

    if (!existing || existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Category with ID ${categoryId} not found.`
      });
    }

    // Check for duplicate name across other records
    const dupCheckSql = 'SELECT id FROM categories WHERE name = ? AND id != ?';
    const duplicate = await db.query(dupCheckSql, [trimmedName, categoryId]);

    if (duplicate && duplicate.length > 0) {
      return res.status(409).json({
        success: false,
        message: `Another category with the name "${trimmedName}" already exists.`
      });
    }

    const current = existing[0];
    const newDesc = description !== undefined ? description.trim() : current.description;
    const newIcon = icon !== undefined ? icon.trim() : current.icon;
    const newActive = is_active !== undefined ? ((is_active === true || is_active === 1 || is_active === '1') ? 1 : 0) : current.is_active;

    // Execute raw SQL update
    const updateSql = 'UPDATE categories SET name = ?, description = ?, icon = ?, is_active = ? WHERE id = ?';
    await db.query(updateSql, [trimmedName, newDesc, newIcon, newActive, categoryId]);

    // Fetch updated record
    const fetchSql = 'SELECT id, name, description, icon, is_active, created_at, updated_at FROM categories WHERE id = ?';
    const updatedCategory = await db.query(fetchSql, [categoryId]);

    return res.status(200).json({
      success: true,
      message: 'Category updated successfully.',
      data: updatedCategory[0]
    });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'A category with this name already exists.'
      });
    }
    next(error);
  }
}

/**
 * @desc    Delete a category by ID
 * @route   DELETE /api/categories/:id
 * @access  Admin / Authenticated
 */
async function deleteCategory(req, res, next) {
  try {
    const categoryId = parseInt(req.params.id, 10);
    if (isNaN(categoryId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid category ID provided.'
      });
    }

    // Check if category exists
    const checkSql = 'SELECT id, name FROM categories WHERE id = ?';
    const existing = await db.query(checkSql, [categoryId]);

    if (!existing || existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: `Category with ID ${categoryId} not found.`
      });
    }

    // Check foreign key dependencies in services table if table exists
    try {
      const fkCheckSql = 'SELECT COUNT(*) AS service_count FROM services WHERE category_id = ?';
      const fkResults = await db.query(fkCheckSql, [categoryId]);
      if (fkResults && fkResults[0] && fkResults[0].service_count > 0) {
        return res.status(409).json({
          success: false,
          message: `Cannot delete category "${existing[0].name}" because ${fkResults[0].service_count} service(s) are linked to it. Please reassign or delete linked services first.`
        });
      }
    } catch (fkErr) {
      // If services table doesn't exist yet in standalone development, continue with delete
    }

    // Execute raw SQL delete
    const deleteSql = 'DELETE FROM categories WHERE id = ?';
    await db.query(deleteSql, [categoryId]);

    return res.status(200).json({
      success: true,
      message: `Category "${existing[0].name}" (ID: ${categoryId}) deleted successfully.`
    });
  } catch (error) {
    if (error.code === 'ER_ROW_IS_REFERENCED_2') {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete category because it is currently referenced by existing services in the database.'
      });
    }
    next(error);
  }
}

/**
 * @desc    Get category analytics and summary stats
 * @route   GET /api/categories/stats
 * @access  Public / Admin
 */
async function getCategoryStats(req, res, next) {
  try {
    const allSql = 'SELECT id, is_active FROM categories';
    const categories = await db.query(allSql);

    const total = categories.length;
    const active = categories.filter(c => c.is_active == 1).length;
    const inactive = total - active;

    return res.status(200).json({
      success: true,
      data: {
        total_categories: total,
        active_categories: active,
        inactive_categories: inactive
      }
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryStats
};
