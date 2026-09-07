export function notFound(req, res) {
  res.status(404).json({
    ok: false,
    error: { code: "NOT_FOUND", message: "Route not found" }
  });
}

export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  res.status(status).json({
    ok: false,
    error: {
      code: err.code || "SERVER_ERROR",
      message: err.message || "Unexpected error"
    }
  });
}
