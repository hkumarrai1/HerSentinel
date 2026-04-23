const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const env = require("../config/env");

const hashToken = (token) =>
  crypto.createHash("sha256").update(token).digest("hex");

const signAccessToken = (user) =>
  jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role,
      email: user.email,
    },
    env.accessTokenSecret,
    { expiresIn: env.accessTokenExpiresIn },
  );

const signRefreshToken = (payload) =>
  jwt.sign(payload, env.refreshTokenSecret, {
    expiresIn: env.refreshTokenExpiresIn,
  });

module.exports = {
  hashToken,
  signAccessToken,
  signRefreshToken,
};
