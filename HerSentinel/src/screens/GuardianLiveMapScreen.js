import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { createGlobalStyles } from '../styles/globalStyles';
import { useAppTheme } from '../context/ThemeContext';
import emergencyService from '../services/emergencyService';

const normalizePoint = point => {
  const latitude = Number(point?.latitude);
  const longitude = Number(point?.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  return {
    latitude,
    longitude,
    timestamp: point?.timestamp || null,
  };
};

const buildMapHtml = ({ points, userName }) => {
  const pointsJson = JSON.stringify(points);
  const safeUserName = (userName || 'User').replace(/</g, '&lt;');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
    <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
    <style>
      html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; }
      .leaflet-control-attribution { font-size: 10px; }
    </style>
  </head>
  <body>
    <div id="map"></div>
    <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
    <script>
      const points = ${pointsJson};
      const map = L.map('map', { zoomControl: true });
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      if (!points.length) {
        map.setView([20.5937, 78.9629], 4);
      } else {
        const latLngs = points.map(p => [p.latitude, p.longitude]);
        const route = L.polyline(latLngs, {
          color: '#d62828',
          weight: 5,
          opacity: 0.85,
        }).addTo(map);

        const latest = points[points.length - 1];
        L.marker([latest.latitude, latest.longitude])
          .addTo(map)
          .bindPopup('${safeUserName} current location')
          .openPopup();

        map.fitBounds(route.getBounds(), { padding: [20, 20] });
      }
    </script>
  </body>
</html>`;
};

const GuardianLiveMapScreen = ({ route }) => {
  const { theme } = useAppTheme();
  const globalStyles = useMemo(() => createGlobalStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const userId = route?.params?.userId;
  const userName = route?.params?.userName || 'User';
  const initialAlert = route?.params?.alert || null;

  const [alertData, setAlertData] = useState(initialAlert);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [webError, setWebError] = useState('');
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);

  const points = useMemo(() => {
    const historyPoints = (alertData?.locationHistory || [])
      .map(normalizePoint)
      .filter(Boolean);

    if (historyPoints.length > 0) {
      return historyPoints;
    }

    const fallbackPoint = normalizePoint(alertData?.lastLocation);
    return fallbackPoint ? [fallbackPoint] : [];
  }, [alertData]);

  const mapHtml = useMemo(
    () => buildMapHtml({ points, userName }),
    [points, userName],
  );

  const fetchAlert = async ({ silent = false } = {}) => {
    if (!silent) {
      setIsLoading(true);
    }

    const result = await emergencyService.getGuardianLiveFeed();

    if (!result.success) {
      setError(result.message || 'Unable to refresh map location right now.');
      if (!silent) {
        setIsLoading(false);
      }
      return;
    }

    const matchedAlert = (result.alerts || []).find(item => {
      const matchedUserId = item?.user?.id || item?.user?._id;
      return matchedUserId?.toString() === userId?.toString();
    });

    if (!matchedAlert) {
      setAlertData(null);
      setError('No active SOS for this user at the moment.');
      if (!silent) {
        setIsLoading(false);
      }
      return;
    }

    setAlertData(matchedAlert);
    setError('');
    setWebError('');
    setLastUpdatedAt(new Date());

    if (!silent) {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAlert();

    const intervalId = setInterval(() => {
      fetchAlert({ silent: true });
    }, 8000);

    return () => clearInterval(intervalId);
  }, [userId]);

  const handleOpenDirections = async () => {
    const destination = points[points.length - 1];
    if (!destination) {
      Alert.alert(
        'Navigation unavailable',
        'No live location to navigate yet.',
      );
      return;
    }

    const lat = destination.latitude;
    const lng = destination.longitude;
    const label = encodeURIComponent(`${userName} live location`);

    const candidateUrls = [
      `google.navigation:q=${lat},${lng}`,
      `geo:0,0?q=${lat},${lng}(${label})`,
      `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`,
    ];

    for (const url of candidateUrls) {
      try {
        await Linking.openURL(url);
        return;
      } catch (openError) {
        // Try next URL strategy.
      }
    }

    Alert.alert(
      'Navigation unavailable',
      'Unable to open map directions app on this device right now.',
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={globalStyles.safeArea}>
        <View style={[globalStyles.container, styles.loadingWrap]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      <View style={globalStyles.container}>
        <View style={styles.headerRow}>
          <Text style={theme.typography.headingLarge}>Live Guardian Map</Text>
          <TouchableOpacity
            style={[globalStyles.buttonBase, globalStyles.buttonOutline]}
            onPress={() => fetchAlert()}
          >
            <Text style={globalStyles.buttonTextOutline}>Refresh</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subHeading}>Tracking {userName}</Text>
        <Text style={styles.metaText}>
          {lastUpdatedAt
            ? `Updated ${lastUpdatedAt.toLocaleTimeString()}`
            : 'Waiting for location updates'}
        </Text>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.mapWrap}>
          {points.length > 0 ? (
            <>
              <WebView
                source={{ html: mapHtml, baseUrl: 'https://unpkg.com' }}
                originWhitelist={['*']}
                javaScriptEnabled
                domStorageEnabled
                mixedContentMode="always"
                startInLoadingState
                onLoadEnd={() => {
                  setIsMapLoaded(true);
                  setWebError('');
                }}
                onError={event => {
                  const message =
                    event?.nativeEvent?.description ||
                    'Map failed to load on this device.';
                  setWebError(message);
                }}
                onHttpError={event => {
                  const status = event?.nativeEvent?.statusCode;
                  setWebError(
                    `Map service error${status ? ` (${status})` : ''}.`,
                  );
                }}
                setSupportMultipleWindows={false}
                style={styles.webView}
              />

              {!isMapLoaded && !webError ? (
                <View style={styles.mapOverlayCenter}>
                  <ActivityIndicator
                    size="large"
                    color={theme.colors.primary}
                  />
                  <Text style={styles.mapOverlayText}>Loading live map...</Text>
                </View>
              ) : null}

              {webError ? (
                <View style={styles.mapOverlayCenter}>
                  <Text style={styles.mapOverlayErrorTitle}>
                    Map unavailable
                  </Text>
                  <Text style={styles.mapOverlayText}>{webError}</Text>
                  <Text style={styles.mapOverlayHint}>
                    You can still open real-time turn-by-turn directions below.
                  </Text>
                </View>
              ) : null}
            </>
          ) : (
            <View style={styles.emptyMapState}>
              <Text style={styles.emptyMapText}>
                Waiting for real-time location points from active SOS.
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[
            globalStyles.buttonBase,
            globalStyles.buttonPrimary,
            styles.cta,
          ]}
          onPress={handleOpenDirections}
          disabled={points.length === 0}
        >
          <Text style={globalStyles.buttonTextPrimary}>
            Open Turn-by-Turn Directions
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const createStyles = theme =>
  StyleSheet.create({
  loadingWrap: {
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  subHeading: {
    ...theme.typography.headingMedium,
    marginTop: 10,
  },
  metaText: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  errorCard: {
    marginTop: 10,
    backgroundColor: theme.colors.accentEmergency + '18',
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.accentEmergency,
    padding: 10,
    borderRadius: 8,
  },
  errorText: {
    ...theme.typography.small,
    color: theme.colors.accentEmergency,
  },
  mapWrap: {
    marginTop: 12,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.colors.border,
    minHeight: 380,
    backgroundColor: theme.colors.white,
    position: 'relative',
  },
  webView: {
    flex: 1,
    backgroundColor: theme.colors.white,
  },
  mapOverlayCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#ffffffee',
  },
  mapOverlayText: {
    ...theme.typography.small,
    textAlign: 'center',
    color: theme.colors.textSecondary,
    marginTop: 10,
  },
  mapOverlayErrorTitle: {
    ...theme.typography.headingMedium,
    color: theme.colors.accentEmergency,
    textAlign: 'center',
  },
  mapOverlayHint: {
    ...theme.typography.small,
    textAlign: 'center',
    color: theme.colors.textSecondary,
    marginTop: 8,
  },
  emptyMapState: {
    flex: 1,
    minHeight: 380,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emptyMapText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  cta: {
    marginTop: 12,
  },
  });

export default GuardianLiveMapScreen;
