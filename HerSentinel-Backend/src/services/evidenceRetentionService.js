const fs = require("fs");
const path = require("path");
const EmergencyEvent = require("../models/EmergencyEvent");

const EVIDENCE_RETENTION_DAYS = 7;
const EVIDENCE_RETENTION_MS = EVIDENCE_RETENTION_DAYS * 24 * 60 * 60 * 1000;
const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;

const uploadsDir = path.join(__dirname, "..", "..", "uploads", "evidence");

const getCutoffDate = () => new Date(Date.now() - EVIDENCE_RETENTION_MS);

const cleanupExpiredEvidence = async () => {
  const cutoff = getCutoffDate();

  await EmergencyEvent.updateMany(
    { "evidence.createdAt": { $lt: cutoff } },
    {
      $pull: {
        evidence: {
          createdAt: { $lt: cutoff },
        },
      },
    },
  );

  if (!fs.existsSync(uploadsDir)) {
    return;
  }

  const files = fs.readdirSync(uploadsDir);

  files.forEach((fileName) => {
    const filePath = path.join(uploadsDir, fileName);

    try {
      const stats = fs.statSync(filePath);
      if (stats.isFile() && stats.mtime < cutoff) {
        fs.unlinkSync(filePath);
      }
    } catch (_error) {
      // Ignore cleanup failures for individual files.
    }
  });
};

const startEvidenceRetentionJob = () => {
  cleanupExpiredEvidence().catch((error) => {
    console.error("Initial evidence cleanup failed", error);
  });

  setInterval(() => {
    cleanupExpiredEvidence().catch((error) => {
      console.error("Scheduled evidence cleanup failed", error);
    });
  }, CLEANUP_INTERVAL_MS);
};

module.exports = {
  startEvidenceRetentionJob,
};
