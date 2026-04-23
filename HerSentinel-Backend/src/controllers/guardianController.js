const User = require("../models/User");

/**
 * Add a user as a guardian
 * POST /api/guardians/add
 * Body: { guardianEmail: string }
 */
const addGuardian = async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware
    const { guardianEmail } = req.body;

    if (!guardianEmail || !guardianEmail.trim()) {
      return res.status(400).json({ message: "Guardian email is required" });
    }

    // Find the guardian user by email
    const normalizedGuardianEmail = guardianEmail.toLowerCase().trim();
    const guardian = await User.findOne({ email: normalizedGuardianEmail });
    if (!guardian) {
      return res.status(404).json({ message: "Guardian user not found" });
    }

    if (guardian.role !== "GUARDIAN") {
      return res.status(400).json({
        message: "Selected user is not registered as a guardian",
      });
    }

    // Prevent self-assignment
    if (guardian._id.toString() === userId) {
      return res
        .status(400)
        .json({ message: "Cannot add yourself as a guardian" });
    }

    // Get current user
    const user = await User.findById(userId);

    // Check if already a guardian
    if (user.guardians.includes(guardian._id)) {
      return res
        .status(400)
        .json({ message: "This user is already a guardian" });
    }

    // Add guardian to user's guardians array
    user.guardians.push(guardian._id);
    await user.save();

    // Add user to guardian's guardianOf array
    guardian.guardianOf.push(user._id);
    await guardian.save();

    return res.status(201).json({
      message: "Guardian added successfully",
      guardian: {
        _id: guardian._id,
        name: guardian.name,
        email: guardian.email,
        role: guardian.role,
      },
    });
  } catch (error) {
    console.error("Add guardian error:", error);
    return res.status(500).json({ message: "Failed to add guardian" });
  }
};

/**
 * Remove a user as a guardian
 * DELETE /api/guardians/:guardianId
 */
const removeGuardian = async (req, res) => {
  try {
    const userId = req.user.id;
    const { guardianId } = req.params;

    // Get current user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Check if guardian exists in user's list
    if (!user.guardians.includes(guardianId)) {
      return res
        .status(404)
        .json({ message: "Guardian not found in your list" });
    }

    // Remove guardian from user's array
    user.guardians = user.guardians.filter(
      (id) => id.toString() !== guardianId.toString(),
    );
    await user.save();

    // Remove user from guardian's guardianOf array
    const guardian = await User.findById(guardianId);
    if (guardian) {
      guardian.guardianOf = guardian.guardianOf.filter(
        (id) => id.toString() !== userId.toString(),
      );
      await guardian.save();
    }

    return res.json({ message: "Guardian removed successfully" });
  } catch (error) {
    console.error("Remove guardian error:", error);
    return res.status(500).json({ message: "Failed to remove guardian" });
  }
};

/**
 * Get list of guardians for current user
 * GET /api/guardians
 */
const getGuardians = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await User.findById(userId).populate("guardians", [
      "_id",
      "name",
      "email",
      "phone",
    ]);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      message: "Guardians retrieved successfully",
      guardians: user.guardians,
    });
  } catch (error) {
    console.error("Get guardians error:", error);
    return res.status(500).json({ message: "Failed to retrieve guardians" });
  }
};

/**
 * Get list of users this person is guarding
 * GET /api/guardians/guarding
 */
const getGuardingUsers = async (req, res) => {
  try {
    if (req.user.role !== "GUARDIAN") {
      return res
        .status(403)
        .json({ message: "Only guardians can access this" });
    }

    const userId = req.user.id;

    const user = await User.findById(userId).populate("guardianOf", [
      "_id",
      "name",
      "email",
      "phone",
    ]);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      message: "Guarding users retrieved successfully",
      users: user.guardianOf,
    });
  } catch (error) {
    console.error("Get guarding users error:", error);
    return res
      .status(500)
      .json({ message: "Failed to retrieve guarding users" });
  }
};

module.exports = {
  addGuardian,
  removeGuardian,
  getGuardians,
  getGuardingUsers,
};
