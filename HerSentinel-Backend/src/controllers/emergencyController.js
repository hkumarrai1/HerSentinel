const { validationResult } = require("express-validator");
const EmergencyEvent = require("../models/EmergencyEvent");
const User = require("../models/User");
const env = require("../config/env");
const { uploadBufferToCloudinary } = require("../services/cloudStorageService");

const EVIDENCE_RETENTION_DAYS = 7;
const EVIDENCE_RETENTION_MS = EVIDENCE_RETENTION_DAYS * 24 * 60 * 60 * 1000;

const getEvidenceCutoffDate = () =>
  new Date(Date.now() - EVIDENCE_RETENTION_MS);

const toDownloadUrl = (mediaUrl) => {
  if (!mediaUrl) {
    return null;
  }

  if (!mediaUrl.includes("/uploads/evidence/")) {
    return mediaUrl;
  }

  return mediaUrl.replace("/uploads/evidence/", "/uploads/evidence/download/");
};

const toStreamUrl = (mediaUrl, mediaMimeType) => {
  if (!mediaUrl) {
    return null;
  }

  if (!mediaUrl.includes("/uploads/evidence/")) {
    return mediaUrl;
  }

  const baseUrl = mediaUrl.replace(
    "/uploads/evidence/",
    "/uploads/evidence/stream/",
  );
  if (!mediaMimeType) {
    return baseUrl;
  }

  return `${baseUrl}?mime=${encodeURIComponent(mediaMimeType)}`;
};

const getRetainedEvidence = (evidence = []) => {
  const cutoff = getEvidenceCutoffDate();
  return evidence.filter(
    (item) => item.createdAt && new Date(item.createdAt) >= cutoff,
  );
};

const getVisibleEvidenceForGuardian = (evidence = [], guardianId) => {
  const retainedEvidence = getRetainedEvidence(evidence);
  if (!guardianId) {
    return retainedEvidence;
  }

  return retainedEvidence.filter((item) => {
    const hiddenFor = item.hiddenForGuardianIds || [];
    return !hiddenFor.some(
      (guardianObjectId) =>
        guardianObjectId.toString() === guardianId.toString(),
    );
  });
};

const mapEvidenceItem = (item) => ({
  id: item._id,
  type: item.type,
  text: item.text || null,
  mediaUrl: item.mediaUrl || null,
  streamUrl: toStreamUrl(item.mediaUrl || null, item.mediaMimeType || null),
  downloadUrl: toDownloadUrl(item.mediaUrl || null),
  mediaMimeType: item.mediaMimeType || null,
  mediaName: item.mediaName || null,
  createdAt: item.createdAt,
});

const mapEmergencyEvent = (event, options = {}) => {
  const visibleEvidence = getVisibleEvidenceForGuardian(
    event.evidence || [],
    options.guardianId,
  );

  return {
    id: event._id,
    status: event.status,
    statusLabel: event.status === "ACTIVE" ? "ONGOING" : "EXPIRED",
    isActive: event.status === "ACTIVE",
    triggeredAt: event.triggeredAt,
    resolvedAt: event.resolvedAt || null,
    lastLocation: event.lastLocation || null,
    locationHistory: (event.locationHistory || []).map((item) => ({
      latitude: item.latitude,
      longitude: item.longitude,
      accuracy: item.accuracy,
      address: item.address || null,
      timestamp: item.timestamp,
    })),
    evidenceCount: visibleEvidence.length,
    recentEvidence: visibleEvidence.slice(-3).map(mapEvidenceItem),
    user: event.userId
      ? {
          id: event.userId._id || event.userId,
          name: event.userId.name,
          email: event.userId.email,
          phone: event.userId.phone,
        }
      : undefined,
  };
};

const triggerEmergency = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res
      .status(400)
      .json({ message: "Invalid input", errors: errors.array() });
  }

  const userId = req.user._id;
  const existingActiveEvents = await EmergencyEvent.find({
    userId,
    status: "ACTIVE",
  }).sort({ triggeredAt: -1 });

  if (existingActiveEvents.length > 0) {
    const autoResolvedAt = new Date();

    for (const activeEvent of existingActiveEvents) {
      activeEvent.evidence.push({
        type: "TEXT",
        text: "Resolved note: Auto-resolved due to new SOS trigger",
        createdAt: autoResolvedAt,
      });
      activeEvent.status = "RESOLVED";
      activeEvent.resolvedAt = autoResolvedAt;
      await activeEvent.save();
    }
  }

  const locationInput = req.body.location;
  const location = locationInput
    ? {
        latitude: locationInput.latitude,
        longitude: locationInput.longitude,
        accuracy: locationInput.accuracy,
        address: locationInput.address,
        timestamp: new Date(),
      }
    : null;

  const event = await EmergencyEvent.create({
    userId,
    status: "ACTIVE",
    triggeredAt: new Date(),
    lastLocation: location || undefined,
    locationHistory: location ? [location] : [],
    evidence: [],
  });

  const populatedEvent = await EmergencyEvent.findById(event._id).populate(
    "userId",
    "_id name email phone",
  );

  return res.status(201).json({
    message:
      existingActiveEvents.length > 0
        ? "Previous active SOS auto-ended. New SOS triggered successfully"
        : "Emergency triggered successfully",
    event: mapEmergencyEvent(populatedEvent),
  });
};

const getMyActiveEmergency = async (req, res) => {
  const userId = req.user._id;

  const activeEmergency = await EmergencyEvent.findOne({
    userId,
    status: "ACTIVE",
  })
    .populate("userId", "_id name email phone")
    .sort({ triggeredAt: -1 });

  if (!activeEmergency) {
    return res.status(200).json({
      message: "No active emergency",
      event: null,
    });
  }

  return res.status(200).json({
    message: "Active emergency retrieved",
    event: mapEmergencyEvent(activeEmergency),
  });
};

const getMyEmergencyTimeline = async (req, res) => {
  const userId = req.user._id;

  const events = await EmergencyEvent.find({
    userId,
    status: { $in: ["ACTIVE", "RESOLVED"] },
  })
    .populate("userId", "_id name email phone")
    .sort({ triggeredAt: -1 })
    .limit(50);

  return res.status(200).json({
    message: "Emergency timeline retrieved successfully",
    events: events.map((event) => mapEmergencyEvent(event)),
  });
};

const updateEmergencyLocation = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res
      .status(400)
      .json({ message: "Invalid input", errors: errors.array() });
  }

  const userId = req.user._id;
  const { eventId } = req.params;
  const { latitude, longitude, accuracy, address } = req.body;

  const event = await EmergencyEvent.findOne({
    _id: eventId,
    userId,
    status: "ACTIVE",
  });

  if (!event) {
    return res.status(404).json({
      message: "Active emergency not found",
    });
  }

  const nextLocation = {
    latitude,
    longitude,
    accuracy,
    address,
    timestamp: new Date(),
  };

  event.lastLocation = nextLocation;
  event.locationHistory.push(nextLocation);

  if (event.locationHistory.length > 100) {
    event.locationHistory = event.locationHistory.slice(-100);
  }

  await event.save();

  return res.status(200).json({
    message: "Location updated successfully",
    eventId: event._id,
    lastLocation: event.lastLocation,
  });
};

const addEmergencyEvidence = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res
      .status(400)
      .json({ message: "Invalid input", errors: errors.array() });
  }

  const userId = req.user._id;
  const { eventId } = req.params;
  const { type, text, mediaUrl } = req.body;
  const uploadedFile = req.file;
  let uploadedMediaUrl = null;
  let uploadedMediaMimeType = uploadedFile?.mimetype || undefined;
  let uploadedMediaName = uploadedFile?.originalname || undefined;

  if (uploadedFile) {
    if (env.storageProvider === "cloudinary") {
      const cloudUpload = await uploadBufferToCloudinary(uploadedFile);
      uploadedMediaUrl = cloudUpload?.mediaUrl || null;
      uploadedMediaMimeType =
        cloudUpload?.mediaMimeType || uploadedMediaMimeType;
      uploadedMediaName = cloudUpload?.mediaName || uploadedMediaName;
    } else {
      uploadedMediaUrl = `${req.protocol}://${req.get("host")}/uploads/evidence/${uploadedFile.filename}`;
    }
  }

  const normalizedMediaUrl = uploadedMediaUrl || mediaUrl?.trim();

  let normalizedType = type;
  if (!normalizedType && uploadedFile?.mimetype) {
    if (uploadedFile.mimetype.startsWith("image/")) {
      normalizedType = "PHOTO";
    } else if (uploadedFile.mimetype.startsWith("video/")) {
      normalizedType = "VIDEO";
    } else if (uploadedFile.mimetype.startsWith("audio/")) {
      normalizedType = "AUDIO";
    }
  }

  if (!text?.trim() && !normalizedMediaUrl) {
    return res.status(400).json({
      message: "Evidence must include text or mediaUrl",
    });
  }

  const event = await EmergencyEvent.findOne({
    _id: eventId,
    userId,
    status: "ACTIVE",
  });

  if (!event) {
    return res.status(404).json({
      message: "Active emergency not found",
    });
  }

  event.evidence.push({
    type: normalizedType || "TEXT",
    text: text?.trim() || undefined,
    mediaUrl: normalizedMediaUrl || undefined,
    mediaMimeType: uploadedMediaMimeType,
    mediaName: uploadedMediaName,
    createdAt: new Date(),
  });

  event.evidence = getRetainedEvidence(event.evidence);

  if (event.evidence.length > 100) {
    event.evidence = event.evidence.slice(-100);
  }

  await event.save();

  const latestEvidence = event.evidence[event.evidence.length - 1];

  return res.status(201).json({
    message: "Evidence added successfully",
    eventId: event._id,
    evidence: mapEvidenceItem(latestEvidence),
  });
};

const resolveEmergency = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res
      .status(400)
      .json({ message: "Invalid input", errors: errors.array() });
  }

  const userId = req.user._id;
  const { eventId } = req.params;
  const { note } = req.body;

  const event = await EmergencyEvent.findOne({
    _id: eventId,
    userId,
    status: "ACTIVE",
  }).populate("userId", "_id name email phone");

  if (!event) {
    return res.status(404).json({
      message: "Active emergency not found",
    });
  }

  if (note?.trim()) {
    event.evidence.push({
      type: "TEXT",
      text: `Resolved note: ${note.trim()}`,
      createdAt: new Date(),
    });
  }

  event.status = "RESOLVED";
  event.resolvedAt = new Date();

  await event.save();

  return res.status(200).json({
    message: "Emergency resolved",
    event: mapEmergencyEvent(event),
  });
};

const getGuardianLiveFeed = async (req, res) => {
  const guardianId = req.user._id;

  const guardian = await User.findById(guardianId)
    .select("_id name email guardianOf")
    .populate("guardianOf", "_id name email phone");

  if (!guardian) {
    return res.status(404).json({ message: "Guardian user not found" });
  }

  const guardedUsers = guardian.guardianOf || [];
  const guardedUserIds = guardedUsers.map((item) => item._id);

  if (guardedUserIds.length === 0) {
    return res.status(200).json({
      message: "Guardian live feed retrieved successfully",
      linkedUsers: [],
      alerts: [],
      metrics: {
        activeSosCount: 0,
        linkedUsersCount: 0,
        evidenceFeedCount: 0,
      },
    });
  }

  const trackedEvents = await EmergencyEvent.find({
    userId: { $in: guardedUserIds },
    status: { $in: ["ACTIVE", "RESOLVED"] },
  })
    .populate("userId", "_id name email phone")
    .sort({ triggeredAt: -1 });

  const latestEventsByUserId = new Map();
  trackedEvents.forEach((event) => {
    const userId = event.userId?._id || event.userId;
    const userKey = userId?.toString();
    if (!userKey || latestEventsByUserId.has(userKey)) {
      return;
    }

    latestEventsByUserId.set(userKey, event);
  });

  const alerts = Array.from(latestEventsByUserId.values()).map((event) =>
    mapEmergencyEvent(event, { guardianId }),
  );

  const activeEvents = alerts.filter(
    (alertItem) => alertItem.status === "ACTIVE",
  );
  const evidenceFeedCount = alerts.reduce(
    (sum, alertItem) => sum + (alertItem.evidenceCount || 0),
    0,
  );

  return res.status(200).json({
    message: "Guardian live feed retrieved successfully",
    linkedUsers: guardedUsers.map((linkedUser) => ({
      _id: linkedUser._id,
      name: linkedUser.name,
      email: linkedUser.email,
      phone: linkedUser.phone,
    })),
    alerts,
    metrics: {
      activeSosCount: activeEvents.length,
      linkedUsersCount: guardedUsers.length,
      evidenceFeedCount,
    },
  });
};

const getGuardianEvidenceFeed = async (req, res) => {
  const guardianId = req.user._id;
  const { userId } = req.params;

  const guardian = await User.findById(guardianId)
    .select("_id name email guardianOf")
    .populate("guardianOf", "_id name email phone");

  if (!guardian) {
    return res.status(404).json({ message: "Guardian user not found" });
  }

  const guardedUsers = guardian.guardianOf || [];
  const monitoredUser = guardedUsers.find(
    (item) => item._id.toString() === userId.toString(),
  );

  if (!monitoredUser) {
    return res
      .status(403)
      .json({ message: "User is not linked to this guardian" });
  }

  const events = await EmergencyEvent.find({ userId })
    .populate("userId", "_id name email phone")
    .sort({ triggeredAt: -1 });

  if (!events.length) {
    return res.status(200).json({
      message: "No emergency evidence found",
      event: null,
      evidence: [],
      monitoredUser: {
        id: monitoredUser._id,
        name: monitoredUser.name,
        email: monitoredUser.email,
        phone: monitoredUser.phone,
      },
    });
  }

  const latestEvent = events[0];
  const evidence = events
    .flatMap((event) =>
      getVisibleEvidenceForGuardian(event.evidence || [], guardianId).map(
        (item) => ({
          ...mapEvidenceItem(item),
          sourceEventId: event._id,
          sourceStatus: event.status,
          sourceTriggeredAt: event.triggeredAt,
          sourceResolvedAt: event.resolvedAt || null,
        }),
      ),
    )
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return res.status(200).json({
    message: "Guardian evidence feed retrieved successfully",
    monitoredUser: {
      id: monitoredUser._id,
      name: monitoredUser.name,
      email: monitoredUser.email,
      phone: monitoredUser.phone,
    },
    event: latestEvent ? mapEmergencyEvent(latestEvent, { guardianId }) : null,
    evidence,
  });
};

const hideGuardianEvidenceItem = async (req, res) => {
  const guardianId = req.user._id;
  const { userId, evidenceId } = req.params;

  const guardian = await User.findById(guardianId)
    .select("_id guardianOf")
    .populate("guardianOf", "_id");

  if (!guardian) {
    return res.status(404).json({ message: "Guardian user not found" });
  }

  const isLinkedGuardian = (guardian.guardianOf || []).some(
    (item) => item._id.toString() === userId.toString(),
  );

  if (!isLinkedGuardian) {
    return res
      .status(403)
      .json({ message: "User is not linked to this guardian" });
  }

  const event = await EmergencyEvent.findOne({
    userId,
    status: { $in: ["ACTIVE", "RESOLVED"] },
    "evidence._id": evidenceId,
  }).sort({ triggeredAt: -1 });

  if (!event) {
    return res.status(404).json({ message: "Evidence item not found" });
  }

  const evidenceItem = event.evidence.id(evidenceId);
  if (!evidenceItem) {
    return res.status(404).json({ message: "Evidence item not found" });
  }

  const alreadyHidden = (evidenceItem.hiddenForGuardianIds || []).some(
    (id) => id.toString() === guardianId.toString(),
  );

  if (!alreadyHidden) {
    evidenceItem.hiddenForGuardianIds.push(guardianId);
    await event.save();
  }

  return res.status(200).json({
    message: "Evidence removed from guardian feed",
    evidenceId,
  });
};

const unhideGuardianEvidenceItem = async (req, res) => {
  const guardianId = req.user._id;
  const { userId, evidenceId } = req.params;

  const guardian = await User.findById(guardianId)
    .select("_id guardianOf")
    .populate("guardianOf", "_id");

  if (!guardian) {
    return res.status(404).json({ message: "Guardian user not found" });
  }

  const isLinkedGuardian = (guardian.guardianOf || []).some(
    (item) => item._id.toString() === userId.toString(),
  );

  if (!isLinkedGuardian) {
    return res
      .status(403)
      .json({ message: "User is not linked to this guardian" });
  }

  const event = await EmergencyEvent.findOne({
    userId,
    status: { $in: ["ACTIVE", "RESOLVED"] },
    "evidence._id": evidenceId,
  }).sort({ triggeredAt: -1 });

  if (!event) {
    return res.status(404).json({ message: "Evidence item not found" });
  }

  const evidenceItem = event.evidence.id(evidenceId);
  if (!evidenceItem) {
    return res.status(404).json({ message: "Evidence item not found" });
  }

  evidenceItem.hiddenForGuardianIds = (
    evidenceItem.hiddenForGuardianIds || []
  ).filter((id) => id.toString() !== guardianId.toString());

  await event.save();

  return res.status(200).json({
    message: "Evidence restored to guardian feed",
    evidenceId,
  });
};

module.exports = {
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
};
