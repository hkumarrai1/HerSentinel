const express = require("express");
const { body, param } = require("express-validator");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");
const { uploadEmergencyEvidence } = require("../middlewares/uploadMiddleware");
const {
  triggerEmergency,
  getMyActiveEmergency,
  getMyEmergencyTimeline,
  updateEmergencyLocation,
  addEmergencyEvidence,
  resolveEmergency,
  getGuardianLiveFeed,
  getGuardianEvidenceFeed,
  hideGuardianEvidenceItem,
  unhideGuardianEvidenceItem,
} = require("../controllers/emergencyController");

const router = express.Router();

router.use(requireAuth);

router.post(
  "/trigger",
  requireRole(["USER"]),
  [
    body("location").optional().isObject(),
    body("location.latitude")
      .optional()
      .isFloat({ min: -90, max: 90 })
      .withMessage("Latitude must be between -90 and 90"),
    body("location.longitude")
      .optional()
      .isFloat({ min: -180, max: 180 })
      .withMessage("Longitude must be between -180 and 180"),
    body("location.accuracy").optional().isFloat({ min: 0 }),
    body("location.address").optional().isString(),
  ],
  triggerEmergency,
);

router.get("/me/active", requireRole(["USER"]), getMyActiveEmergency);
router.get("/me/timeline", requireRole(["USER"]), getMyEmergencyTimeline);

router.post(
  "/:eventId/location",
  requireRole(["USER"]),
  [
    param("eventId").isMongoId().withMessage("Invalid event id"),
    body("latitude")
      .isFloat({ min: -90, max: 90 })
      .withMessage("Latitude must be between -90 and 90"),
    body("longitude")
      .isFloat({ min: -180, max: 180 })
      .withMessage("Longitude must be between -180 and 180"),
    body("accuracy").optional().isFloat({ min: 0 }),
    body("address").optional().isString(),
  ],
  updateEmergencyLocation,
);

router.post(
  "/:eventId/evidence",
  requireRole(["USER"]),
  uploadEmergencyEvidence,
  [
    param("eventId").isMongoId().withMessage("Invalid event id"),
    body("type")
      .optional()
      .isIn(["TEXT", "PHOTO", "AUDIO", "VIDEO"])
      .withMessage("Invalid evidence type"),
    body("text").optional().isString(),
    body("mediaUrl").optional().isString(),
  ],
  addEmergencyEvidence,
);

router.post(
  "/:eventId/resolve",
  requireRole(["USER"]),
  [
    param("eventId").isMongoId().withMessage("Invalid event id"),
    body("note").optional().isString(),
  ],
  resolveEmergency,
);

router.get("/guardian/live", requireRole(["GUARDIAN"]), getGuardianLiveFeed);

router.get(
  "/guardian/:userId/evidence",
  requireRole(["GUARDIAN"]),
  [param("userId").isMongoId().withMessage("Invalid user id")],
  getGuardianEvidenceFeed,
);

router.post(
  "/guardian/:userId/evidence/:evidenceId/hide",
  requireRole(["GUARDIAN"]),
  [
    param("userId").isMongoId().withMessage("Invalid user id"),
    param("evidenceId").isMongoId().withMessage("Invalid evidence id"),
  ],
  hideGuardianEvidenceItem,
);

router.post(
  "/guardian/:userId/evidence/:evidenceId/unhide",
  requireRole(["GUARDIAN"]),
  [
    param("userId").isMongoId().withMessage("Invalid user id"),
    param("evidenceId").isMongoId().withMessage("Invalid evidence id"),
  ],
  unhideGuardianEvidenceItem,
);

module.exports = router;
