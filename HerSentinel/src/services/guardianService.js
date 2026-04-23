import apiClient from './apiClient';

const guardianService = {
  /**
   * Add a user as a guardian by email
   */
  async addGuardian(guardianEmail) {
    try {
      console.log('📝 Adding guardian:', { guardianEmail });
      const response = await apiClient.post('/guardians/add', {
        guardianEmail,
      });

      console.log('✅ Guardian added:', response.data);
      const guardian = response.data.guardian;
      return {
        success: true,
        guardian: {
          ...guardian,
          _id: guardian._id || guardian.id,
        },
        message: response.data.message,
      };
    } catch (error) {
      console.warn('⚠️ Add guardian error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      return {
        success: false,
        message:
          error.response?.data?.message ||
          error.message ||
          'Failed to add guardian',
      };
    }
  },

  /**
   * Remove a guardian
   */
  async removeGuardian(guardianId) {
    try {
      console.log('📝 Removing guardian:', { guardianId });
      const response = await apiClient.delete(`/guardians/${guardianId}`);

      console.log('✅ Guardian removed:', response.data);
      return {
        success: true,
        message: response.data.message,
      };
    } catch (error) {
      console.warn('⚠️ Remove guardian error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      return {
        success: false,
        message:
          error.response?.data?.message ||
          error.message ||
          'Failed to remove guardian',
      };
    }
  },

  /**
   * Get list of guardians for current user
   */
  async getGuardians() {
    try {
      console.log('🔍 Fetching guardians...');
      const response = await apiClient.get('/guardians');

      console.log('✅ Guardians retrieved:', response.data);
      return {
        success: true,
        guardians: response.data.guardians,
      };
    } catch (error) {
      console.warn('⚠️ Get guardians error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      return {
        success: false,
        guardians: [],
        message:
          error.response?.data?.message ||
          error.message ||
          'Failed to fetch guardians',
      };
    }
  },

  /**
   * Get list of users this person is guarding
   */
  async getGuardingUsers() {
    try {
      console.log('🔍 Fetching users being guarded...');
      const response = await apiClient.get('/guardians/guarding');

      console.log('✅ Guarding users retrieved:', response.data);
      return {
        success: true,
        users: response.data.users,
      };
    } catch (error) {
      console.warn('⚠️ Get guarding users error:', {
        status: error.response?.status,
        data: error.response?.data,
        message: error.message,
      });
      return {
        success: false,
        users: [],
        message:
          error.response?.data?.message ||
          error.message ||
          'Failed to fetch users',
      };
    }
  },
};

export default guardianService;
