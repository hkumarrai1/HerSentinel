const mongoose = require("mongoose");

const locationSchema = new mongoose.Schema(
  {
    latitude: {
      type: Number,
      required: true,
    },
    longitude: {
      type: Number,
      required: true,
    },
    accuracy: {
      type: Number,
    },
    address: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const evidenceSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["TEXT", "PHOTO", "AUDIO", "VIDEO"],
      default: "TEXT",
    },
    text: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    mediaUrl: {
      type: String,
      trim: true,
      maxlength: 2048,
    },
    mediaMimeType: {
      type: String,
      trim: true,
      maxlength: 150,
    },
    mediaName: {
      type: String,
      trim: true,
      maxlength: 255,
    },
    hiddenForGuardianIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: "User",
      default: [],
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: true },
);

const emergencyEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["ACTIVE", "RESOLVED"],
      default: "ACTIVE",
      index: true,
    },
    triggeredAt: {
      type: Date,
      default: Date.now,
    },
    resolvedAt: {
      type: Date,
    },
    lastLocation: {
      type: locationSchema,
    },
    locationHistory: {
      type: [locationSchema],
      default: [],
    },
    evidence: {
      type: [evidenceSchema],
      default: [],
    },
  },
  { timestamps: true },
);

emergencyEventSchema.index({ userId: 1, status: 1, triggeredAt: -1 });

module.exports = mongoose.model("EmergencyEvent", emergencyEventSchema);
