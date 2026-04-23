import React, { useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Linking,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Video from 'react-native-video';
import { createGlobalStyles } from '../styles/globalStyles';
import { useAppTheme } from '../context/ThemeContext';

const GuardianMediaPlayerScreen = ({ navigation, route }) => {
  const { theme } = useAppTheme();
  const globalStyles = useMemo(() => createGlobalStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const mediaUrl = route.params?.mediaUrl;
  const downloadUrl = route.params?.downloadUrl;
  const mediaType = route.params?.mediaType;
  const title = route.params?.title;
  const [isBuffering, setIsBuffering] = useState(false);
  const [playbackError, setPlaybackError] = useState('');
  const isVideo = mediaType === 'VIDEO';

  const handleOpenExternally = async () => {
    const targetUrl = downloadUrl || mediaUrl;
    if (!targetUrl) {
      return;
    }

    try {
      await Linking.openURL(targetUrl);
    } catch (error) {
      Alert.alert(
        'Cannot Open Media',
        error?.message || 'Failed to open media externally.',
      );
    }
  };

  if (!mediaUrl) {
    return (
      <SafeAreaView style={globalStyles.safeArea}>
        <View style={[globalStyles.container, styles.centered]}>
          <Text style={styles.errorText}>Media URL missing.</Text>
          <TouchableOpacity
            style={[globalStyles.buttonBase, globalStyles.buttonOutline, styles.backButton]}
            onPress={() => navigation.goBack()}
          >
            <Text style={globalStyles.buttonTextOutline}>Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      <View style={globalStyles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[globalStyles.buttonBase, globalStyles.buttonOutline, styles.headerButton]}
            onPress={() => navigation.goBack()}
          >
            <Text style={globalStyles.buttonTextOutline}>Back</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[globalStyles.buttonBase, globalStyles.buttonPrimary, styles.headerButton]}
            onPress={handleOpenExternally}
          >
            <Text style={globalStyles.buttonTextPrimary}>Open Externally</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.playerWrap}>
          <Text style={styles.playerTitle}>{title || 'Evidence media'}</Text>
          <Video
            source={{ uri: mediaUrl }}
            controls
            paused={false}
            resizeMode={isVideo ? 'contain' : 'cover'}
            playInBackground={false}
            playWhenInactive={false}
            ignoreSilentSwitch="ignore"
            onBuffer={({ isBuffering: nextBuffering }) => {
              setIsBuffering(!!nextBuffering);
            }}
            onLoadStart={() => {
              setPlaybackError('');
              setIsBuffering(true);
            }}
            onLoad={() => {
              setIsBuffering(false);
            }}
            onError={event => {
              setIsBuffering(false);
              const message =
                event?.error?.localizedDescription ||
                event?.error?.errorString ||
                'Playback failed. Use Open Externally.';
              setPlaybackError(message);
            }}
            style={isVideo ? styles.videoPlayer : styles.audioPlayer}
          />

          {isBuffering ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator color={theme.colors.primary} />
              <Text style={styles.loadingText}>Buffering media...</Text>
            </View>
          ) : null}

          {playbackError ? (
            <Text style={styles.errorText}>{playbackError}</Text>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
};

const createStyles = theme =>
  StyleSheet.create({
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  errorText: {
    ...theme.typography.body,
    color: theme.colors.accentEmergency,
  },
  backButton: {
    paddingHorizontal: 20,
  },
  headerRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  headerButton: {
    flex: 1,
  },
  playerWrap: {
    flex: 1,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    padding: 12,
    backgroundColor: '#111827',
    justifyContent: 'center',
  },
  playerTitle: {
    ...theme.typography.body,
    color: theme.colors.white,
    marginBottom: 10,
    fontWeight: '600',
  },
  videoPlayer: {
    width: '100%',
    height: 280,
    backgroundColor: '#000',
    borderRadius: theme.radius.sm,
  },
  audioPlayer: {
    width: '100%',
    height: 80,
    backgroundColor: '#000',
    borderRadius: theme.radius.sm,
  },
  loadingRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
  },
  });

export default GuardianMediaPlayerScreen;
