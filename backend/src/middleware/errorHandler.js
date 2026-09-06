/**
 * Global API Error Handling Middleware
 */
function errorHandler(err, req, res, next) {
  console.error(`[Error Handler] ${req.method} ${req.originalUrl}:`, err);

  const statusCode = res.statusCode !== 200 ? res.statusCode : (err.status || 500);

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? {
      code: err.code,
      stack: err.stack
    } : undefined
  });
}

/**
 * 404 Not Found Middleware
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
