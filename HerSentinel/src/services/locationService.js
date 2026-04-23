import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';

const LOCATION_OPTIONS = {
  enableHighAccuracy: true,
  timeout: 15000,
  maximumAge: 3000,
};

const FALLBACK_LOCATION_OPTIONS = {
  enableHighAccuracy: false,
  timeout: 10000,
  maximumAge: 60000,
};

Geolocation.setRNConfiguration({
  skipPermissionRequests: Platform.OS === 'android',
  authorizationLevel: 'whenInUse',
  locationProvider: 'playServices',
});

const normalizeLocation = position => ({
  latitude: position.coords.latitude,
  longitude: position.coords.longitude,
  accuracy: position.coords.accuracy,
});

const fetchPosition = options =>
  new Promise(resolve => {
    Geolocation.getCurrentPosition(
      position => {
        resolve({
          success: true,
          location: normalizeLocation(position),
        });
      },
      error => {
        resolve({
          success: false,
          code: error.code,
          message: error.message || 'Unable to fetch current location',
        });
      },
      options,
    );
  });

const requestLocationPermission = async () => {
  if (Platform.OS !== 'android') {
    return true;
  }

  const finePermission = PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION;
  const coarsePermission =
    PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION;

  const hasFinePermission = await PermissionsAndroid.check(finePermission);
  const hasCoarsePermission = await PermissionsAndroid.check(coarsePermission);

  if (hasFinePermission || hasCoarsePermission) {
    return true;
  }

  const result = await PermissionsAndroid.request(finePermission, {
    title: 'Location Permission Required',
    message:
      'HerSentinel needs your location to share live SOS updates with guardians.',
    buttonPositive: 'Allow',
    buttonNegative: 'Deny',
  });

  return result === PermissionsAndroid.RESULTS.GRANTED;
};

const getCurrentLocation = async () => {
  try {
    const granted = await requestLocationPermission();

    if (!granted) {
      return {
        success: false,
        code: 1,
        message: 'Location permission denied',
      };
    }

    const primaryLocationResult = await fetchPosition(LOCATION_OPTIONS);
    if (primaryLocationResult.success) {
      return primaryLocationResult;
    }

    if (primaryLocationResult.code === 2 || primaryLocationResult.code === 3) {
      const fallbackLocationResult = await fetchPosition(
        FALLBACK_LOCATION_OPTIONS,
      );
      if (fallbackLocationResult.success) {
        return fallbackLocationResult;
      }

      return fallbackLocationResult;
    }

    return primaryLocationResult;
  } catch (error) {
    return {
      success: false,
      code: 0,
      message: error.message || 'Unable to fetch current location',
    };
  }
};

const startLocationWatch = async ({ onLocation, onError }) => {
  const granted = await requestLocationPermission();

  if (!granted) {
    return {
      success: false,
      code: 1,
      message: 'Location permission denied',
    };
  }

  const watchId = Geolocation.watchPosition(
    position => {
      onLocation?.(normalizeLocation(position));
    },
    error => {
      onError?.(error.message || 'Location watch error');
    },
    {
      ...LOCATION_OPTIONS,
      distanceFilter: 10,
      interval: 10000,
      fastestInterval: 5000,
      showsBackgroundLocationIndicator: true,
    },
  );

  return {
    success: true,
    stop: () => Geolocation.clearWatch(watchId),
  };
};

const locationService = {
  requestLocationPermission,
  getCurrentLocation,
  startLocationWatch,
};

export default locationService;
