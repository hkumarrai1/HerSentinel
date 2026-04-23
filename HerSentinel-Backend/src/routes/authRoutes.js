const express = require("express");
const { body } = require("express-validator");
const {
  register,
  login,
  refresh,
  logout,
  me,
} = require("../controllers/authController");
const { requireAuth } = require("../middlewares/authMiddleware");

const router = express.Router();

const strongPasswordRule = body("password")
  .isLength({ min: 8, max: 64 })
  .withMessage("Password must be 8 to 64 characters long")
  .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/)
  .withMessage(
    "Password must include uppercase, lowercase, number, and special character",
  );

router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").isEmail().withMessage("Valid email is required"),
    strongPasswordRule,
    body("phone").optional().isString(),
    body("role")
      .optional()
      .isIn(["USER", "GUARDIAN"])
      .withMessage("Role must be USER or GUARDIAN"),
  ],
  register,
);

router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email is required"),
    body("password").isString().notEmpty().withMessage("Password is required"),
  ],
  login,
);

router.post("/refresh", [body("refreshToken").isString().notEmpty()], refresh);
router.post("/logout", [body("refreshToken").optional().isString()], logout);
router.get("/me", requireAuth, me);

module.exports = router;
