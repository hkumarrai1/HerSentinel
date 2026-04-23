/**
 * API Configuration
 * Update these values when the backend URL changes
 */

const ENV = {
  dev: {
    API_BASE_URL: 'http://192.168.1.34:4000/api', // Update this when laptop WiFi IP changes
  },
  prod: {
    API_BASE_URL: 'https://hersentinel.onrender.com/api', // Production backend URL
  },
};

const getEnvVars = () => {
  return __DEV__ ? ENV.dev : ENV.prod;
};

export default getEnvVars();
