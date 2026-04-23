const express = require("express");
const { requireAuth, requireRole } = require("../middlewares/authMiddleware");
const {
  addGuardian,
  removeGuardian,
  getGuardians,
  getGuardingUsers,
} = require("../controllers/guardianController");

const router = express.Router();

// All guardian routes require authentication
router.use(requireAuth);

/**
 * Add a guardian
 * POST /api/guardians/add
 */
router.post("/add", addGuardian);

/**
 * Remove a guardian
 * DELETE /api/guardians/:guardianId
 */
router.delete("/:guardianId", removeGuardian);

/**
 * Get list of guardians for current user
 * GET /api/guardians
 */
router.get("/", getGuardians);

/**
 * Get list of users this person is guarding
 * GET /api/guardians/guarding
 */
router.get("/guarding", requireRole(["GUARDIAN"]), getGuardingUsers);

module.exports = router;
