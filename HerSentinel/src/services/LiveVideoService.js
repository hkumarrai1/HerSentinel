// Live Video Feed Service for SOS
// Enables real-time video call between user and guardian using WebRTC
// Handles peer connection, signaling, and media stream management

import io from 'socket.io-client';
import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
} from 'react-native-webrtc';
import { mediaDevices } from 'react-native-webrtc';

// WebRTC Configuration
const PEER_CONNECTION_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

class LiveVideoService {
  constructor(apiBaseURL) {
    this.socket = null;
    this.peerConnection = null;
    this.localStream = null;
    this.remoteStream = null;
    this.apiBaseURL = apiBaseURL;
    this.isConnected = false;
    this.currentEventId = null;
    this.onRemoteStreamReady = null;
    this.onConnectionStateChange = null;
    this.onError = null;
  }

  // ============================================
  // INITIALIZE SOCKET CONNECTION
  // ============================================

  initializeSocket = async () => {
    try {
      // Extract base URL without /api path
      const baseURL = this.apiBaseURL.replace('/api', '');

      this.socket = io(baseURL, {
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 5,
        transports: ['websocket'],
      });

      this.socket.on('connect', () => {
        console.log('✅ Socket connected for video streaming');
        this.isConnected = true;

        if (this.currentEventId) {
          this.socket.emit('video:join-event', {
            eventId: this.currentEventId,
          });
        }
      });

      this.socket.on('disconnect', () => {
        console.log('❌ Socket disconnected');
        this.isConnected = false;
        this.cleanup();
      });

      // Listen for signaling messages
      this.socket.on('video:offer', this.handleRemoteOffer);
      this.socket.on('video:answer', this.handleRemoteAnswer);
      this.socket.on('video:ice-candidate', this.handleRemoteICECandidate);
      this.socket.on('video:stream-ended', this.handleStreamEnded);

      return true;
    } catch (error) {
      console.error('Socket initialization error:', error);
      this.onError?.('Failed to initialize video connection');
      return false;
    }
  };

  // ============================================
  // GET LOCAL MEDIA STREAM
  // ============================================

  getLocalStream = async () => {
    try {
      if (this.localStream) {
        return this.localStream;
      }

      const mediaConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode: 'user', // Front camera
        },
      };

      const stream = await mediaDevices.getUserMedia(mediaConstraints);
      this.localStream = stream;

      console.log('✅ Local media stream acquired');
      console.log('Audio tracks:', stream.getAudioTracks().length);
      console.log('Video tracks:', stream.getVideoTracks().length);

      return stream;
    } catch (error) {
      console.error('Error getting local stream:', error);
      this.onError?.('Unable to access camera/microphone');
      throw error;
    }
  };

  // ============================================
  // START VIDEO CALL (USER/SOS SIDE)
  // ============================================

  startVideoCall = async (eventId, guardianId, userDetails) => {
    try {
      console.log('🚀 Starting video call...');
      this.currentEventId = eventId;

      // Step 1: Initialize socket
      if (!this.isConnected) {
        const socketReady = await this.initializeSocket();
        if (!socketReady) throw new Error('Socket failed to initialize');
      }

      this.socket.emit('video:register', {
        userId: userDetails?.id,
        role: 'USER',
      });

      this.socket.emit('video:join-event', {
        eventId,
        userId: userDetails?.id,
        role: 'USER',
      });

      // Step 2: Get local media
      const localStream = await this.getLocalStream();

      // Step 3: Create peer connection
      const peerConnection = new RTCPeerConnection(PEER_CONNECTION_CONFIG);
      this.peerConnection = peerConnection;

      // Add local stream tracks to peer connection
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });

      // Handle remote stream
      peerConnection.ontrack = event => {
        console.log('📹 Remote stream received');
        this.remoteStream = event.streams[0];
        this.onRemoteStreamReady?.(this.remoteStream);
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = event => {
        if (event.candidate) {
          this.socket.emit('video:ice-candidate', {
            eventId,
            candidate: event.candidate,
          });
        }
      };

      // Handle connection state changes
      peerConnection.onconnectionstatechange = () => {
        const state = peerConnection.connectionState;
        if (!this.peerConnection) {
          return;
        }

        console.log('Connection state:', state);

        if (state === 'connected' || state === 'completed') {
          console.log('✅ Video connection established');
          this.onConnectionStateChange?.('connected');
        } else if (state === 'failed' || state === 'disconnected') {
          console.log('❌ Video connection failed');
          this.onConnectionStateChange?.('failed');
          this.cleanup();
        } else if (state === 'connecting') {
          this.onConnectionStateChange?.('connecting');
        }
      };

      // Step 4: Create and send offer
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });

      await peerConnection.setLocalDescription(offer);

      // Send offer to guardian via socket
      this.socket.emit('video:initiate-call', {
        eventId,
        offer: offer,
        userDetails: {
          id: userDetails.id,
          name: userDetails.name,
          guardianId: guardianId,
        },
      });

      console.log('📤 Offer sent to guardian');

      return {
        success: true,
        localStream: this.localStream,
        message: 'Video call initiated, waiting for guardian response...',
      };
    } catch (error) {
      console.error('Error starting video call:', error);
      this.onError?.(error.message || 'Failed to start video call');
      this.cleanup();
      return {
        success: false,
        error: error.message,
      };
    }
  };

  // ============================================
  // RECEIVE CALL (GUARDIAN SIDE)
  // ============================================

  receiveVideoCall = async (eventId, offer, callDetails) => {
    try {
      console.log('📞 Receiving video call from user...');
      this.currentEventId = eventId;

      // Step 1: Initialize socket
      if (!this.isConnected) {
        const socketReady = await this.initializeSocket();
        if (!socketReady) throw new Error('Socket failed to initialize');
      }

      this.socket.emit('video:register', {
        userId: callDetails?.guardianId,
        role: 'GUARDIAN',
      });

      this.socket.emit('video:join-event', {
        eventId,
        userId: callDetails?.guardianId,
        role: 'GUARDIAN',
      });

      // Step 2: Get local media
      const localStream = await this.getLocalStream();

      // Step 3: Create peer connection
      const peerConnection = new RTCPeerConnection(PEER_CONNECTION_CONFIG);
      this.peerConnection = peerConnection;

      // Add local stream
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });

      // Handle remote stream
      peerConnection.ontrack = event => {
        console.log('📹 Remote stream received from user');
        this.remoteStream = event.streams[0];
        this.onRemoteStreamReady?.(this.remoteStream);
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = event => {
        if (event.candidate) {
          this.socket.emit('video:ice-candidate', {
            eventId,
            candidate: event.candidate,
          });
        }
      };

      // Step 4: Set remote description (offer from user)
      const remoteDesc = new RTCSessionDescription(offer);
      await peerConnection.setRemoteDescription(remoteDesc);

      // Step 5: Create and send answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      // Send answer back to user
      this.socket.emit('video:answer', {
        eventId,
        answer: answer,
      });

      console.log('📤 Answer sent to user');

      return {
        success: true,
        localStream: this.localStream,
        message: 'Connected to user video stream',
      };
    } catch (error) {
      console.error('Error receiving video call:', error);
      this.onError?.(error.message || 'Failed to receive video call');
      this.cleanup();
      return {
        success: false,
        error: error.message,
      };
    }
  };

  // ============================================
  // HANDLE SIGNALING MESSAGES
  // ============================================

  handleRemoteOffer = async data => {
    try {
      console.log('📨 Received offer');
      const { offer } = data;

      if (!this.peerConnection) {
        throw new Error('Peer connection not initialized');
      }

      const remoteDesc = new RTCSessionDescription(offer);
      await this.peerConnection.setRemoteDescription(remoteDesc);

      const answer = await this.peerConnection.createAnswer();
      await this.peerConnection.setLocalDescription(answer);

      this.socket.emit('video:answer', {
        eventId: this.currentEventId,
        answer,
      });
    } catch (error) {
      console.error('Error handling remote offer:', error);
      this.onError?.(error.message);
    }
  };

  handleRemoteAnswer = async data => {
    try {
      console.log('📨 Received answer');
      const { answer } = data;

      if (!this.peerConnection) {
        throw new Error('Peer connection not initialized');
      }

      const remoteDesc = new RTCSessionDescription(answer);
      await this.peerConnection.setRemoteDescription(remoteDesc);
    } catch (error) {
      console.error('Error handling remote answer:', error);
      this.onError?.(error.message);
    }
  };

  handleRemoteICECandidate = async data => {
    try {
      const { candidate } = data;

      if (!this.peerConnection) {
        console.log('Ignoring ICE candidate (no peer connection)');
        return;
      }

      await this.peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error adding ICE candidate:', error);
    }
  };

  handleStreamEnded = () => {
    console.log('📵 Remote user ended video stream');
    this.onConnectionStateChange?.('disconnected');
    this.cleanup();
  };

  // ============================================
  // CONTROL FUNCTIONS
  // ============================================

  toggleAudio = enabled => {
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = enabled;
      });
      console.log(`🔊 Audio ${enabled ? 'enabled' : 'muted'}`);
    }
  };

  toggleVideo = enabled => {
    if (this.localStream) {
      this.localStream.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
      console.log(`📹 Video ${enabled ? 'enabled' : 'disabled'}`);
    }
  };

  switchCamera = async () => {
    try {
      if (!this.localStream) return;

      const videoTrack = this.localStream.getVideoTracks()[0];
      if (!videoTrack) return;

      // Switch to back camera
      const constraints = {
        audio: false,
        video: {
          facingMode: 'environment', // Back camera
        },
      };

      const newStream = await mediaDevices.getUserMedia(constraints);
      const newVideoTrack = newStream.getVideoTracks()[0];

      if (this.peerConnection) {
        const sender = this.peerConnection
          .getSenders()
          .find(s => s.track?.kind === 'video');
        if (sender) {
          await sender.replaceTrack(newVideoTrack);
        }
      }

      videoTrack.stop();
      this.localStream.removeTrack(videoTrack);
      this.localStream.addTrack(newVideoTrack);

      console.log('📷 Switched to back camera');
    } catch (error) {
      console.error('Error switching camera:', error);
      this.onError?.('Failed to switch camera');
    }
  };

  // ============================================
  // END CALL & CLEANUP
  // ============================================

  endVideoCall = async () => {
    try {
      console.log('📵 Ending video call...');

      // Notify other party
      if (this.socket && this.currentEventId) {
        this.socket.emit('video:end-call', {
          eventId: this.currentEventId,
        });
      }

      this.cleanup();
      this.onConnectionStateChange?.('ended');

      return { success: true };
    } catch (error) {
      console.error('Error ending video call:', error);
      return { success: false, error: error.message };
    }
  };

  cleanup = () => {
    console.log('🧹 Cleaning up resources...');

    // Stop local tracks
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    this.remoteStream = null;
    this.currentEventId = null;
  };

  // ============================================
  // GETTERS
  // ============================================

  getCurrentLocalStream = () => this.localStream;
  getCurrentRemoteStream = () => this.remoteStream;
  isConnectionActive = () =>
    this.peerConnection &&
    (this.peerConnection.connectionState === 'connected' ||
      this.peerConnection.connectionState === 'completed');
}

export default LiveVideoService;
