const notFoundHandler = (req, res) => {
  res.status(404).json({ message: "Route not found" });
};

const jsonParseErrorHandler = (err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({ message: "Malformed JSON payload" });
  }

  return next(err);
};

const globalErrorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || "Internal server error";

  if (statusCode >= 500) {
    console.error(err);
  }

  res.status(statusCode).json({ message });
};

module.exports = {
  notFoundHandler,
  jsonParseErrorHandler,
  globalErrorHandler,
};
