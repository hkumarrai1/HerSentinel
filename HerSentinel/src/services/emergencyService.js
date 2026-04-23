import apiClient from './apiClient';
import offlineSyncService from './offlineSyncService';

const isRetryableSyncError = error => {
  if (!error) {
    return false;
  }

  if (!error.response) {
    return true;
  }

  return error.response.status >= 500;
};

const emergencyService = {
  async triggerEmergency(location) {
    try {
      const payload = location ? { location } : {};
      const response = await apiClient.post('/emergencies/trigger', payload);

      return {
        success: true,
        event: response.data.event,
        message: response.data.message,
      };
    } catch (error) {
      console.warn('⚠️ Trigger emergency error:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
      });

      return {
        success: false,
        message:
          error.response?.data?.message ||
          error.message ||
          'Failed to trigger emergency',
      };
    }
  },

  async getMyActiveEmergency() {
    try {
      const response = await apiClient.get('/emergencies/me/active');

      return {
        success: true,
        event: response.data.event,
        message: response.data.message,
      };
    } catch (error) {
      console.warn('⚠️ Get active emergency error:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
      });

      return {
        success: false,
        event: null,
        message:
          error.response?.data?.message ||
          error.message ||
          'Failed to load active emergency',
      };
    }
  },

  async getMyEmergencyTimeline() {
    try {
      const response = await apiClient.get('/emergencies/me/timeline');

      return {
        success: true,
        events: response.data.events || [],
        message: response.data.message,
      };
    } catch (error) {
      console.warn('⚠️ Get emergency timeline error:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
      });

      return {
        success: false,
        events: [],
        message:
          error.response?.data?.message ||
          error.message ||
          'Failed to load emergency timeline',
      };
    }
  },

  async updateEmergencyLocation(eventId, location, options = {}) {
    const queueOnFailure = options.queueOnFailure !== false;

    try {
      const response = await apiClient.post(
        `/emergencies/${eventId}/location`,
        {
          ...location,
        },
      );

      return {
        success: true,
        lastLocation: response.data.lastLocation,
        message: response.data.message,
      };
    } catch (error) {
      console.warn('⚠️ Update emergency location error:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
      });

      if (queueOnFailure && isRetryableSyncError(error)) {
        await offlineSyncService.enqueue({
          type: 'location',
          eventId,
          payload: location,
        });

        return {
          success: true,
          queued: true,
          lastLocation: location,
          message: 'Location update queued for sync',
        };
      }

      return {
        success: false,
        message:
          error.response?.data?.message ||
          error.message ||
          'Failed to update emergency location',
      };
    }
  },

  async addEmergencyEvidence(eventId, evidence, options = {}) {
    const queueOnFailure = options.queueOnFailure !== false;

    try {
      let response;

      if (evidence?.file) {
        const formData = new FormData();

        if (evidence.type) {
          formData.append('type', evidence.type);
        }

        if (evidence.text) {
          formData.append('text', evidence.text);
        }

        if (evidence.mediaUrl) {
          formData.append('mediaUrl', evidence.mediaUrl);
        }

        formData.append('file', {
          uri: evidence.file.uri,
          type: evidence.file.type || 'application/octet-stream',
          name: evidence.file.name || `evidence-${Date.now()}`,
        });

        response = await apiClient.post(
          `/emergencies/${eventId}/evidence`,
          formData,
          {
            headers: {
              'Content-Type': 'multipart/form-data',
            },
          },
        );
      } else {
        response = await apiClient.post(`/emergencies/${eventId}/evidence`, {
          ...evidence,
        });
      }

      return {
        success: true,
        evidence: response.data.evidence,
        message: response.data.message,
      };
    } catch (error) {
      console.warn('⚠️ Add emergency evidence error:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
      });

      if (queueOnFailure && isRetryableSyncError(error)) {
        await offlineSyncService.enqueue({
          type: 'evidence',
          eventId,
          payload: evidence,
        });

        return {
          success: true,
          queued: true,
          message: 'Evidence queued for sync',
        };
      }

      return {
        success: false,
        message:
          error.response?.data?.message ||
          error.message ||
          'Failed to add evidence',
      };
    }
  },

  async resolveEmergency(eventId, note) {
    try {
      const response = await apiClient.post(`/emergencies/${eventId}/resolve`, {
        note,
      });

      return {
        success: true,
        event: response.data.event,
        message: response.data.message,
      };
    } catch (error) {
      console.warn('⚠️ Resolve emergency error:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
      });

      return {
        success: false,
        message:
          error.response?.data?.message ||
          error.message ||
          'Failed to resolve emergency',
      };
    }
  },

  async getGuardianLiveFeed() {
    try {
      const response = await apiClient.get('/emergencies/guardian/live');

      return {
        success: true,
        linkedUsers: response.data.linkedUsers || [],
        alerts: response.data.alerts || [],
        metrics: response.data.metrics || {
          activeSosCount: 0,
          linkedUsersCount: 0,
          evidenceFeedCount: 0,
        },
        message: response.data.message,
      };
    } catch (error) {
      console.warn('⚠️ Get guardian live feed error:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
      });

      return {
        success: false,
        linkedUsers: [],
        alerts: [],
        metrics: {
          activeSosCount: 0,
          linkedUsersCount: 0,
          evidenceFeedCount: 0,
        },
        message:
          error.response?.data?.message ||
          error.message ||
          'Failed to load guardian live feed',
      };
    }
  },

  async getGuardianEvidenceFeed(userId) {
    try {
      const response = await apiClient.get(`/emergencies/guardian/${userId}/evidence`);

      return {
        success: true,
        event: response.data.event,
        evidence: response.data.evidence || [],
        monitoredUser: response.data.monitoredUser,
        message: response.data.message,
      };
    } catch (error) {
      console.warn('⚠️ Get guardian evidence feed error:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
      });

      return {
        success: false,
        event: null,
        evidence: [],
        monitoredUser: null,
        message:
          error.response?.data?.message ||
          error.message ||
          'Failed to load guardian evidence feed',
      };
    }
  },

  async hideGuardianEvidence(userId, evidenceId) {
    try {
      const response = await apiClient.post(
        `/emergencies/guardian/${userId}/evidence/${evidenceId}/hide`,
      );

      return {
        success: true,
        message: response.data.message,
        evidenceId: response.data.evidenceId,
      };
    } catch (error) {
      console.warn('⚠️ Hide guardian evidence error:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
      });

      return {
        success: false,
        message:
          error.response?.data?.message ||
          error.message ||
          'Failed to remove evidence from feed',
      };
    }
  },

  async unhideGuardianEvidence(userId, evidenceId) {
    try {
      const response = await apiClient.post(
        `/emergencies/guardian/${userId}/evidence/${evidenceId}/unhide`,
      );

      return {
        success: true,
        message: response.data.message,
        evidenceId: response.data.evidenceId,
      };
    } catch (error) {
      console.warn('⚠️ Unhide guardian evidence error:', {
        status: error.response?.status,
        message: error.response?.data?.message || error.message,
      });

      return {
        success: false,
        message:
          error.response?.data?.message ||
          error.message ||
          'Failed to restore evidence to feed',
      };
    }
  },

  async flushOfflineQueue() {
    return offlineSyncService.flush();
  },

  async getOfflineQueueSize() {
    const pending = await offlineSyncService.getPendingCount();
    return pending;
  },
};

export default emergencyService;
