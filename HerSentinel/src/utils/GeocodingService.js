// Geocoding Service - Converts Lat/Long to readable address
// Uses Google Maps Geocoding API (requires API key in .env)

import axios from 'axios';

const GEOCODING_API_KEY = process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '';

// Function to get address from coordinates (reverse geocoding)
export const getAddressFromCoordinates = async (latitude, longitude) => {
  try {
    // If no API key is configured, return formatted coordinates
    if (!GEOCODING_API_KEY) {
      console.log(
        'Google Maps API key not configured. Using coordinates format.',
      );
      return null;
    }

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          latlng: `${latitude},${longitude}`,
          key: GEOCODING_API_KEY,
        },
      },
    );

    if (response.data.results && response.data.results.length > 0) {
      // Return the most specific address (first result)
      const result = response.data.results[0];

      // Extract useful address components
      const formatted = result.formatted_address;
      const addressComponents = result.address_components || [];

      // Try to find street, city, state components
      let street = '';
      let city = '';
      let state = '';

      addressComponents.forEach(component => {
        if (component.types.includes('route')) {
          street = component.long_name;
        }
        if (component.types.includes('locality')) {
          city = component.long_name;
        }
        if (component.types.includes('administrative_area_level_1')) {
          state = component.short_name;
        }
      });

      // Build a short, readable address
      let shortAddress = street;
      if (city) {
        shortAddress = shortAddress ? `${shortAddress}, ${city}` : city;
      }
      if (state && state !== city) {
        shortAddress = `${shortAddress}, ${state}`;
      }

      return {
        full: formatted,
        short: shortAddress || formatted,
        street,
        city,
        state,
      };
    }

    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
};

// Function to get coordinates from address (forward geocoding)
export const getCoordinatesFromAddress = async address => {
  try {
    if (!GEOCODING_API_KEY) {
      console.log(
        'Google Maps API key not configured. Cannot geocode address.',
      );
      return null;
    }

    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/geocode/json',
      {
        params: {
          address,
          key: GEOCODING_API_KEY,
        },
      },
    );

    if (response.data.results && response.data.results.length > 0) {
      const location = response.data.results[0].geometry.location;
      return {
        latitude: location.lat,
        longitude: location.lng,
      };
    }

    return null;
  } catch (error) {
    console.error('Forward geocoding error:', error);
    return null;
  }
};

export default {
  getAddressFromCoordinates,
  getCoordinatesFromAddress,
};
