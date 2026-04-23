const app = require("./app");
const env = require("./config/env");
const connectDatabase = require("./config/db");
const os = require("os");
const http = require("http");
const { Server } = require("socket.io");
const EmergencyEvent = require("./models/EmergencyEvent");
const User = require("./models/User");
const {
  startEvidenceRetentionJob,
} = require("./services/evidenceRetentionService");

const getLanIp = () => {
  const interfaces = os.networkInterfaces();

  for (const interfaceName of Object.keys(interfaces)) {
    for (const iface of interfaces[interfaceName] || []) {
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }

  return "localhost";
};

const startServer = async () => {
  try {
    await connectDatabase();
    startEvidenceRetentionJob();
    const lanIp = getLanIp();

    const server = http.createServer(app);
    const io = new Server(server, {
      cors: {
        origin: env.clientOrigin,
        methods: ["GET", "POST"],
      },
      transports: ["websocket", "polling"],
    });

    io.on("connection", (socket) => {
      console.log(`🔌 Socket connected: ${socket.id}`);

      socket.on("video:register", ({ userId, role }) => {
        if (!userId) {
          return;
        }

        socket.join(`user:${userId}`);
        if (role) {
          socket.join(`role:${role}`);
        }
      });

      socket.on("video:join-event", ({ eventId, userId, role }) => {
        if (!eventId) {
          return;
        }

        socket.join(`event:${eventId}`);
        if (userId) {
          socket.join(`user:${userId}`);
        }
        if (role) {
          socket.join(`role:${role}`);
        }
      });

      socket.on("video:initiate-call", async (payload = {}) => {
        const { eventId, offer, userDetails } = payload;
        if (!eventId || !offer) {
          return;
        }

        socket.join(`event:${eventId}`);

        let guardianIds = [];
        const providedGuardianId = userDetails?.guardianId;

        if (providedGuardianId) {
          guardianIds = [String(providedGuardianId)];
        } else {
          const event = await EmergencyEvent.findById(eventId).select("userId");
          if (event?.userId) {
            const user = await User.findById(event.userId).select("guardians");
            guardianIds = (user?.guardians || []).map((id) => String(id));
          }
        }

        const outboundPayload = {
          eventId,
          offer,
          userDetails,
          initiatedAt: new Date().toISOString(),
        };

        if (guardianIds.length > 0) {
          guardianIds.forEach((guardianId) => {
            io.to(`user:${guardianId}`).emit("video:offer", outboundPayload);
          });
        } else {
          socket.to(`event:${eventId}`).emit("video:offer", outboundPayload);
          io.to("role:GUARDIAN").emit("video:offer", outboundPayload);
        }
      });

      socket.on("video:answer", (payload = {}) => {
        const { eventId } = payload;
        if (!eventId) {
          return;
        }

        socket.to(`event:${eventId}`).emit("video:answer", payload);
      });

      socket.on("video:ice-candidate", (payload = {}) => {
        const { eventId } = payload;
        if (!eventId) {
          return;
        }

        socket.to(`event:${eventId}`).emit("video:ice-candidate", payload);
      });

      socket.on("video:end-call", (payload = {}) => {
        const { eventId } = payload;
        if (!eventId) {
          return;
        }

        io.to(`event:${eventId}`).emit("video:stream-ended", { eventId });
      });

      socket.on("disconnect", () => {
        console.log(`🔌 Socket disconnected: ${socket.id}`);
      });
    });

    server.listen(env.port, "0.0.0.0", () => {
      console.log(
        `HerSentinel backend listening on http://0.0.0.0:${env.port}`,
      );
      console.log(`🌐 Accessible from: http://${lanIp}:${env.port}`);
    });
  } catch (error) {
    console.error("Failed to start server", error);
    process.exit(1);
  }
};

startServer();
