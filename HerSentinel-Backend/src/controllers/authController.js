const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { validationResult } = require("express-validator");
const User = require("../models/User");
const RefreshToken = require("../models/RefreshToken");
const env = require("../config/env");
const {
  hashToken,
  signAccessToken,
  signRefreshToken,
} = require("../utils/tokens");

const BCRYPT_ROUNDS = 12;

const addRefreshTokenRecord = async (userId, refreshToken) => {
  const decoded = jwt.verify(refreshToken, env.refreshTokenSecret);
  const expiresAt = new Date(decoded.exp * 1000);
  const tokenHash = hashToken(refreshToken);

  await RefreshToken.create({
    userId,
    tokenHash,
    jti: decoded.jti,
    expiresAt,
  });
};

const buildAuthResponse = (user) => ({
  user: {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
  },
});

const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res
      .status(400)
      .json({ message: "Invalid input", errors: errors.array() });
  }

  const { name, email, password, phone, role } = req.body;
  const normalizedEmail = email.toLowerCase().trim();
  const normalizedRole = role === "GUARDIAN" ? "GUARDIAN" : "USER";

  const existingUser = await User.findOne({ email: normalizedEmail });
  if (existingUser) {
    return res.status(400).json({ message: "Unable to process credentials" });
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    passwordHash,
    phone: phone?.trim() || undefined,
    role: normalizedRole,
  });

  return res.status(201).json({
    message: "Account created successfully",
    ...buildAuthResponse(user),
  });
};

const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res
      .status(400)
      .json({ message: "Invalid input", errors: errors.array() });
  }

  const { email, password } = req.body;
  const normalizedEmail = email.toLowerCase().trim();

  const user = await User.findOne({ email: normalizedEmail });
  if (!user) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return res.status(401).json({ message: "Invalid email or password" });
  }

  const accessToken = signAccessToken(user);
  const refreshPayload = {
    sub: user._id.toString(),
    jti: crypto.randomUUID(),
  };
  const refreshToken = signRefreshToken(refreshPayload);
  await addRefreshTokenRecord(user._id, refreshToken);

  return res.status(200).json({
    accessToken,
    refreshToken,
    ...buildAuthResponse(user),
  });
};

const refresh = async (req, res) => {
  const refreshToken = req.body.refreshToken;
  if (!refreshToken) {
    return res.status(401).json({ message: "Refresh token required" });
  }

  let decoded;
  try {
    decoded = jwt.verify(refreshToken, env.refreshTokenSecret);
  } catch (error) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  const tokenHash = hashToken(refreshToken);
  const tokenRecord = await RefreshToken.findOne({ tokenHash, revoked: false });

  if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  const user = await User.findById(decoded.sub);
  if (!user) {
    return res.status(401).json({ message: "Invalid refresh token" });
  }

  tokenRecord.revoked = true;
  await tokenRecord.save();

  const newAccessToken = signAccessToken(user);
  const newRefreshToken = signRefreshToken({
    sub: user._id.toString(),
    jti: crypto.randomUUID(),
  });

  await addRefreshTokenRecord(user._id, newRefreshToken);

  return res.status(200).json({
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  });
};

const logout = async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    const tokenHash = hashToken(refreshToken);
    await RefreshToken.updateOne({ tokenHash }, { revoked: true });
  }

  return res.status(200).json({ message: "Logged out" });
};

const me = async (req, res) => {
  return res.status(200).json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
};

module.exports = {
  register,
  login,
  refresh,
  logout,
  me,
};
