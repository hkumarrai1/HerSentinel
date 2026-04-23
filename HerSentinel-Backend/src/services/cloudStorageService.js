const { v2: cloudinary } = require("cloudinary");
const env = require("../config/env");

let configured = false;

const isCloudinaryEnabled = () => {
  return (
    env.storageProvider === "cloudinary" &&
    !!env.cloudinaryCloudName &&
    !!env.cloudinaryApiKey &&
    !!env.cloudinaryApiSecret
  );
};

const ensureCloudinaryConfig = () => {
  if (configured) {
    return;
  }

  cloudinary.config({
    cloud_name: env.cloudinaryCloudName,
    api_key: env.cloudinaryApiKey,
    api_secret: env.cloudinaryApiSecret,
    secure: true,
  });

  configured = true;
};

const uploadBufferToCloudinary = async (file) => {
  if (!file || !file.buffer) {
    return null;
  }

  if (!isCloudinaryEnabled()) {
    throw new Error(
      "Cloudinary is not configured. Set CLOUDINARY_* variables or use STORAGE_PROVIDER=local.",
    );
  }

  ensureCloudinaryConfig();

  const originalName = file.originalname || "evidence";
  const mimeType = file.mimetype || "application/octet-stream";

  const result = await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: env.cloudinaryFolder,
        resource_type: "auto",
        use_filename: true,
        unique_filename: true,
        overwrite: false,
      },
      (error, uploadResult) => {
        if (error) {
          return reject(error);
        }

        return resolve(uploadResult);
      },
    );

    stream.end(file.buffer);
  });

  return {
    mediaUrl: result.secure_url,
    mediaName: originalName,
    mediaMimeType: mimeType,
    storageProvider: "cloudinary",
  };
};

module.exports = {
  isCloudinaryEnabled,
  uploadBufferToCloudinary,
};
