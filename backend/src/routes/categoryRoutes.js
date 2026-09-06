const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

// Aggregate statistics
router.get('/stats', categoryController.getCategoryStats);

// Main collection endpoints
router.route('/')
  .get(categoryController.getAllCategories)
  .post(categoryController.createCategory);

// Individual category resource endpoints
router.route('/:id')
  .get(categoryController.getCategoryById)
  .put(categoryController.updateCategory)
  .delete(categoryController.deleteCategory);

module.exports = router;
