const express = require("express");
const path = require("path");
const helmet = require("helmet");
const cors = require("cors");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");
const env = require("./config/env");
const authRoutes = require("./routes/authRoutes");
const guardianRoutes = require("./routes/guardianRoutes");
const emergencyRoutes = require("./routes/emergencyRoutes");
const healthRoutes = require("./routes/healthRoutes");
const {
  jsonParseErrorHandler,
  notFoundHandler,
  globalErrorHandler,
} = require("./middlewares/errorMiddleware");

const app = express();

app.set("trust proxy", 1);

app.use((req, res, next) => {
  if (env.nodeEnv === "production" && !req.secure) {
    return res.status(400).json({ message: "HTTPS is required" });
  }

  return next();
});

app.use(
  helmet({
    hsts:
      env.nodeEnv === "production"
        ? { maxAge: 31536000, includeSubDomains: true }
        : false,
  }),
);

app.use(
  cors({
    origin: env.clientOrigin,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: false,
  }),
);

app.use(express.json({ limit: "100kb" }));
app.use(jsonParseErrorHandler);

if (env.storageProvider !== "cloudinary") {
  app.get("/uploads/evidence/stream/:fileName", (req, res) => {
    const safeFileName = path.basename(req.params.fileName || "");
    const evidenceDir = path.join(__dirname, "..", "uploads", "evidence");
    const evidenceFilePath = path.join(evidenceDir, safeFileName);

    if (!safeFileName || !evidenceFilePath.startsWith(evidenceDir)) {
      return res.status(400).json({ message: "Invalid file name" });
    }

    const mimeFromQuery = (req.query.mime || "").toString().trim();
    const isValidMime = /^[a-z]+\/[a-z0-9.+-]+$/i.test(mimeFromQuery);
    if (isValidMime) {
      res.setHeader("Content-Type", mimeFromQuery);
    }

    res.setHeader(
      "Content-Disposition",
      `inline; filename=\"${safeFileName}\"`,
    );

    return res.sendFile(evidenceFilePath, (error) => {
      if (error && !res.headersSent) {
        return res.status(404).json({ message: "File not found" });
      }

      return undefined;
    });
  });

  app.get("/uploads/evidence/download/:fileName", (req, res) => {
    const safeFileName = path.basename(req.params.fileName || "");
    const evidenceFilePath = path.join(
      __dirname,
      "..",
      "uploads",
      "evidence",
      safeFileName,
    );

    if (
      !safeFileName ||
      !evidenceFilePath.startsWith(
        path.join(__dirname, "..", "uploads", "evidence"),
      )
    ) {
      return res.status(400).json({ message: "Invalid file name" });
    }

    if (!path.extname(safeFileName)) {
      return res.status(404).json({ message: "File not found" });
    }

    return res.download(evidenceFilePath, safeFileName, (error) => {
      if (error && !res.headersSent) {
        return res.status(404).json({ message: "File not found" });
      }

      return undefined;
    });
  });

  app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
}

if (env.nodeEnv !== "production") {
  app.use(morgan("dev"));
}

const globalLimiter = rateLimit({
  windowMs: env.rateLimitWindowMs,
  max: env.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, try again later" },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many authentication attempts, try again later" },
});

app.use("/api", globalLimiter);
app.use("/api/auth", authLimiter);

app.use("/api/health", healthRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/guardians", guardianRoutes);
app.use("/api/emergencies", emergencyRoutes);

app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
