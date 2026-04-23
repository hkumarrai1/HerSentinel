import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { launchCamera } from 'react-native-image-picker';
import Sound from 'react-native-nitro-sound';
import { createGlobalStyles } from '../styles/globalStyles';
import { useAppTheme } from '../context/ThemeContext';
import { AuthContext } from '../context/AuthContext';
import emergencyService from '../services/emergencyService';
import locationService from '../services/locationService';
import LiveVideoService from '../services/LiveVideoService';
import apiConfig from '../config/api';

// Try to import RTCView if available
let RTCView = null;
try {
  const rtcModule = require('react-native-webrtc');
  RTCView = rtcModule.RTCView;
} catch (e) {
  console.log('RTCView not available yet (react-native-webrtc not installed)');
}

const EVIDENCE_TYPES = ['TEXT', 'PHOTO', 'AUDIO', 'VIDEO'];

const EmergencyActiveScreen = ({ navigation, route }) => {
  const { theme } = useAppTheme();
  const { user } = useContext(AuthContext);
  const globalStyles = useMemo(() => createGlobalStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [event, setEvent] = useState(route.params?.event || null);
  const [isLoading, setIsLoading] = useState(!route.params?.event);
  const [isStopping, setIsStopping] = useState(false);
  const [isSavingEvidence, setIsSavingEvidence] = useState(false);
  const [selectedEvidenceType, setSelectedEvidenceType] = useState('TEXT');
  const [evidenceNote, setEvidenceNote] = useState('');
  const [evidenceMediaUrl, setEvidenceMediaUrl] = useState('');
  const [pendingEvidenceFile, setPendingEvidenceFile] = useState(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingPath, setRecordingPath] = useState('');
  const [pendingSyncCount, setPendingSyncCount] = useState(0);
  const [locationStatus, setLocationStatus] = useState(
    route.params?.event?.lastLocation
      ? 'Live location synced'
      : 'Locating device...',
  );

  // Video streaming state
  const [showVideoUI, setShowVideoUI] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [videoConnected, setVideoConnected] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [videoInitializing, setVideoInitializing] = useState(false);

  const locationWatcherRef = useRef(null);
  const liveVideoServiceRef = useRef(null);
  const hasSyncedLocationRef = useRef(!!route.params?.event?.lastLocation);

  useEffect(() => {
    const loadActiveEvent = async () => {
      if (route.params?.event) {
        return;
      }

      setIsLoading(true);
      const result = await emergencyService.getMyActiveEmergency();

      if (result.success && result.event) {
        setEvent(result.event);
      }

      setIsLoading(false);
    };

    loadActiveEvent();
  }, [route.params?.event]);

  const activeEventId = event?.id || event?._id;

  const requestAndroidPermissions = async ({
    needsCamera = false,
    needsAudio = false,
  } = {}) => {
    if (Platform.OS !== 'android') {
      return true;
    }

    const permissions = [];
    if (needsCamera) {
      permissions.push(PermissionsAndroid.PERMISSIONS.CAMERA);
    }
    if (needsAudio) {
      permissions.push(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    }

    if (permissions.length === 0) {
      return true;
    }

    const result = await PermissionsAndroid.requestMultiple(permissions);

    return permissions.every(
      permission => result[permission] === PermissionsAndroid.RESULTS.GRANTED,
    );
  };

  const buildUploadFile = (uri, mimeType, fallbackPrefix) => {
    const normalizedUri = uri?.startsWith('file://') ? uri : `file://${uri}`;
    const uriPath = (uri || '').split('?')[0];
    const uriExtension = uriPath.includes('.')
      ? uriPath.split('.').pop()
      : null;
    const mimeExtension = mimeType?.split('/')[1] || null;
    const extension = (uriExtension || mimeExtension || 'bin').replace(
      /[^a-zA-Z0-9]/g,
      '',
    );

    return {
      uri: normalizedUri,
      type: mimeType || 'application/octet-stream',
      name: `${fallbackPrefix}-${Date.now()}.${extension}`,
    };
  };

  const handleCaptureMedia = async mediaType => {
    const hasPermissions = await requestAndroidPermissions({
      needsCamera: true,
      needsAudio: mediaType === 'video',
    });

    if (!hasPermissions) {
      Alert.alert(
        'Permission Needed',
        'Camera/microphone permission is required to capture evidence.',
      );
      return;
    }

    const pickerOptions = {
      mediaType,
      quality: 0.8,
      saveToPhotos: false,
      ...(mediaType === 'video' ? { durationLimit: 120 } : {}),
    };

    const pickerResult = await launchCamera(pickerOptions);

    if (pickerResult.didCancel) {
      return;
    }

    if (pickerResult.errorCode) {
      Alert.alert(
        'Capture Failed',
        pickerResult.errorMessage || 'Unable to capture media right now.',
      );
      return;
    }

    const asset = pickerResult.assets?.[0];
    if (!asset?.uri) {
      Alert.alert('Capture Failed', 'Captured file URI is missing.');
      return;
    }

    const mimeType =
      asset.type || (mediaType === 'photo' ? 'image/jpeg' : 'video/mp4');
    const prefix = mediaType === 'photo' ? 'photo-evidence' : 'video-evidence';

    setPendingEvidenceFile(buildUploadFile(asset.uri, mimeType, prefix));
    setEvidenceMediaUrl('');
  };

  const handleStartAudioRecording = async () => {
    if (isRecordingAudio) {
      return;
    }

    const hasPermissions = await requestAndroidPermissions({
      needsAudio: true,
    });

    if (!hasPermissions) {
      Alert.alert(
        'Permission Needed',
        'Microphone permission is required to record audio evidence.',
      );
      return;
    }

    try {
      const path = await Sound.startRecorder();
      setRecordingPath(path || '');
      setIsRecordingAudio(true);
      setPendingEvidenceFile(null);
      setEvidenceMediaUrl('');
    } catch (error) {
      Alert.alert(
        'Recording Failed',
        error?.message || 'Unable to start audio recording.',
      );
    }
  };

  const handleStopAudioRecording = async () => {
    if (!isRecordingAudio) {
      return;
    }

    try {
      const outputPath = await Sound.stopRecorder();
      const resolvedPath = outputPath || recordingPath;

      if (!resolvedPath) {
        Alert.alert('Recording Failed', 'Audio file path is missing.');
        return;
      }

      setPendingEvidenceFile(
        buildUploadFile(resolvedPath, 'audio/m4a', 'audio-evidence'),
      );
      setRecordingPath('');
    } catch (error) {
      Alert.alert(
        'Recording Failed',
        error?.message || 'Unable to stop audio recording.',
      );
    } finally {
      setIsRecordingAudio(false);
    }
  };

  useEffect(() => {
    if (event?.lastLocation) {
      hasSyncedLocationRef.current = true;
      setLocationStatus('Live location synced');
    }
  }, [event?.lastLocation]);

  useEffect(() => {
    let active = true;

    const refreshPendingSyncCount = async () => {
      try {
        await emergencyService.flushOfflineQueue();
      } catch (_error) {
        // Keep the emergency flow moving even if the queue cannot be flushed yet.
      }

      const pending = await emergencyService.getOfflineQueueSize();
      if (active) {
        setPendingSyncCount(pending);
      }
    };

    refreshPendingSyncCount();
    const timer = setInterval(refreshPendingSyncCount, 4000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    setPendingEvidenceFile(null);
    setEvidenceMediaUrl('');
  }, [selectedEvidenceType]);

  useEffect(() => {
    return () => {
      Sound.stopRecorder().catch(() => {
        // noop
      });
    };
  }, []);

  useEffect(() => {
    let isCancelled = false;

    const startLiveLocationSync = async () => {
      if (!activeEventId) {
        return;
      }

      const syncLocationToEmergency = async nextLocation => {
        if (!nextLocation || !activeEventId || isCancelled) {
          return;
        }

        const updateResult = await emergencyService.updateEmergencyLocation(
          activeEventId,
          nextLocation,
        );

        if (isCancelled) {
          return;
        }

        if (updateResult.success) {
          setEvent(prev =>
            prev
              ? {
                  ...prev,
                  lastLocation: updateResult.lastLocation || nextLocation,
                }
              : prev,
          );

          const pending = await emergencyService.getOfflineQueueSize();
          setPendingSyncCount(pending);

          hasSyncedLocationRef.current = true;
          if (updateResult.queued) {
            setLocationStatus(
              `Offline: location queued (${pending} pending sync item${
                pending === 1 ? '' : 's'
              })`,
            );
          } else if (pending > 0) {
            setLocationStatus(
              `Live location synced (${pending} pending sync item${
                pending === 1 ? '' : 's'
              })`,
            );
          } else {
            setLocationStatus('Live location synced');
          }
        } else {
          setLocationStatus(prevStatus => {
            if (hasSyncedLocationRef.current) {
              return 'Live location synced (using last known location)';
            }

            return (
              updateResult.message ||
              'Live location sync temporarily unavailable'
            );
          });
        }
      };

      const currentLocationResult = await locationService.getCurrentLocation();
      if (currentLocationResult.success) {
        await syncLocationToEmergency(currentLocationResult.location);
      } else {
        setLocationStatus(prevStatus => {
          if (hasSyncedLocationRef.current) {
            return 'Live location synced (using last known location)';
          }

          return currentLocationResult.message || 'Location unavailable';
        });
      }

      const watchResult = await locationService.startLocationWatch({
        onLocation: async location => {
          await syncLocationToEmergency(location);
        },
        onError: watchError => {
          if (!isCancelled) {
            setLocationStatus(prevStatus => {
              if (hasSyncedLocationRef.current) {
                return 'Live location synced (using last known location)';
              }

              return watchError || 'Location watch error';
            });
          }
        },
      });

      if (!isCancelled && watchResult.success) {
        locationWatcherRef.current = watchResult.stop;
      }

      if (!isCancelled && !watchResult.success) {
        setLocationStatus(prevStatus => {
          if (hasSyncedLocationRef.current) {
            return 'Live location synced (using last known location)';
          }

          return watchResult.message || 'Location watch not started';
        });
      }
    };

    startLiveLocationSync();

    return () => {
      isCancelled = true;
      if (locationWatcherRef.current) {
        locationWatcherRef.current();
        locationWatcherRef.current = null;
      }
    };
  }, [activeEventId]);

  const locationText = useMemo(() => {
    if (!event?.lastLocation) {
      return 'Awaiting live location update...';
    }

    const { latitude, longitude, address, accuracy } = event.lastLocation;

    // Show address if available, otherwise show coordinates
    if (address && address !== 'Live device GPS capture') {
      return `📍 ${address}`;
    }

    // Fallback to coordinates with better formatting
    const lat = latitude?.toFixed(4);
    const lng = longitude?.toFixed(4);
    const acc = accuracy ? ` ±${accuracy.toFixed(0)}m` : '';
    return `📍 Lat: ${lat}, Lng: ${lng}${acc}`;
  }, [event]);

  const triggeredAtText = useMemo(() => {
    if (!event?.triggeredAt) {
      return 'Triggered just now';
    }

    return `Triggered at: ${new Date(event.triggeredAt).toLocaleString()}`;
  }, [event]);

  const initializeVideoService = () => {
    if (liveVideoServiceRef.current) {
      return liveVideoServiceRef.current;
    }

    const service = new LiveVideoService(apiConfig.API_BASE_URL);

    service.onRemoteStreamReady = stream => {
      setRemoteStream(stream);
      setVideoConnected(true);
    };

    service.onConnectionStateChange = state => {
      if (state === 'connected' || state === 'completed') {
        setVideoConnected(true);
      } else if (state === 'connecting') {
        setVideoConnected(false);
      } else {
        setVideoConnected(false);
      }
    };

    service.onError = message => {
      Alert.alert('Video Error', message || 'Failed to start video call');
    };

    liveVideoServiceRef.current = service;
    return service;
  };

  const startVideoCall = async () => {
    if (!activeEventId) {
      Alert.alert('Video Call', 'Emergency event is not active yet.');
      return;
    }

    if (!RTCView) {
      Alert.alert(
        'Feature Unavailable',
        'react-native-webrtc is not installed. Install it to use live video.',
      );
      return;
    }

    setVideoInitializing(true);
    try {
      const service = initializeVideoService();
      const guardianId = event?.guardianId || event?.linkedGuardianId || null;
      const userDetails = {
        id: user?.id || event?.userId || 'user',
        name: user?.name || event?.userName || 'HerSentinel User',
      };

      const result = await service.startVideoCall(
        activeEventId,
        guardianId,
        userDetails,
      );

      if (!result.success) {
        Alert.alert(
          'Video Call Failed',
          result.error || 'Unable to start call',
        );
        return;
      }

      setLocalStream(result.localStream || null);
      setShowVideoUI(true);
    } catch (error) {
      Alert.alert('Video Call Error', error.message || 'Unable to start call');
    } finally {
      setVideoInitializing(false);
    }
  };

  const endVideoCall = async () => {
    if (liveVideoServiceRef.current) {
      await liveVideoServiceRef.current.endVideoCall();
    }

    setShowVideoUI(false);
    setLocalStream(null);
    setRemoteStream(null);
    setVideoConnected(false);
    setIsAudioMuted(false);
    setIsVideoOff(false);
    liveVideoServiceRef.current = null;
  };

  const toggleVideoAudio = () => {
    if (!liveVideoServiceRef.current) {
      return;
    }

    const nextMuted = !isAudioMuted;
    liveVideoServiceRef.current.toggleAudio(!nextMuted);
    setIsAudioMuted(nextMuted);
  };

  const toggleVideo = () => {
    if (!liveVideoServiceRef.current) {
      return;
    }

    const nextVideoOff = !isVideoOff;
    liveVideoServiceRef.current.toggleVideo(!nextVideoOff);
    setIsVideoOff(nextVideoOff);
  };

  const switchCamera = async () => {
    if (!liveVideoServiceRef.current) {
      return;
    }

    await liveVideoServiceRef.current.switchCamera();
  };

  useEffect(() => {
    return () => {
      if (liveVideoServiceRef.current) {
        liveVideoServiceRef.current.endVideoCall();
        liveVideoServiceRef.current = null;
      }
    };
  }, []);

  const handleStopEmergency = async () => {
    if (!activeEventId) {
      if (locationWatcherRef.current) {
        locationWatcherRef.current();
        locationWatcherRef.current = null;
      }
      navigation.navigate('Home');
      return;
    }

    setIsStopping(true);
    const result = await emergencyService.resolveEmergency(
      activeEventId,
      'Emergency stopped by user',
    );
    setIsStopping(false);

    if (!result.success) {
      Alert.alert('Unable to Stop Emergency', result.message || 'Try again');
      return;
    }

    if (locationWatcherRef.current) {
      locationWatcherRef.current();
      locationWatcherRef.current = null;
    }

    if (showVideoUI) {
      await endVideoCall();
    }

    Alert.alert('Emergency Stopped', 'Guardians have been notified.');
    navigation.navigate('Home');
  };

  const handleAddQuickEvidence = async () => {
    if (!activeEventId) {
      return;
    }

    setIsSavingEvidence(true);
    const result = await emergencyService.addEmergencyEvidence(activeEventId, {
      type: 'TEXT',
      text: 'Quick update: I can move and I am seeking safe space.',
    });
    setIsSavingEvidence(false);

    const pending = await emergencyService.getOfflineQueueSize();
    setPendingSyncCount(pending);

    if (!result.success) {
      Alert.alert('Unable to Add Evidence', result.message || 'Try again');
      return;
    }

    if (result.queued) {
      Alert.alert(
        'Evidence Queued',
        `Quick note saved offline and will sync automatically (${pending} pending).`,
      );
      return;
    }

    Alert.alert('Evidence Added', 'Quick note shared with guardians.');
  };

  const handleShareEvidence = async () => {
    if (!activeEventId) {
      return;
    }

    const trimmedNote = evidenceNote.trim();
    const trimmedMediaUrl = evidenceMediaUrl.trim();

    if (!trimmedNote && !trimmedMediaUrl && !pendingEvidenceFile) {
      Alert.alert(
        'Evidence Required',
        'Capture media, record audio, or add a note before sharing evidence.',
      );
      return;
    }

    setIsSavingEvidence(true);
    const result = await emergencyService.addEmergencyEvidence(activeEventId, {
      type: selectedEvidenceType,
      text: trimmedNote || undefined,
      mediaUrl: trimmedMediaUrl || undefined,
      file: pendingEvidenceFile || undefined,
    });
    setIsSavingEvidence(false);

    const pending = await emergencyService.getOfflineQueueSize();
    setPendingSyncCount(pending);

    if (!result.success) {
      Alert.alert('Unable to Add Evidence', result.message || 'Try again');
      return;
    }

    setEvidenceNote('');
    setEvidenceMediaUrl('');
    setPendingEvidenceFile(null);

    if (result.queued) {
      Alert.alert(
        'Evidence Queued',
        `${selectedEvidenceType} evidence saved offline and will sync automatically (${pending} pending).`,
      );
      return;
    }

    Alert.alert(
      'Evidence Shared',
      `${selectedEvidenceType} evidence was shared with guardians.`,
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={[globalStyles.safeArea, styles.dangerBg]}>
        <View style={[globalStyles.container, styles.loadingWrap]}>
          <ActivityIndicator
            size="large"
            color={theme.colors.accentEmergency}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[globalStyles.safeArea, styles.dangerBg]}>
      <ScrollView
        style={styles.dangerBg}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[globalStyles.section, styles.headerWrap]}>
          <Text style={styles.eyebrow}>Emergency Mode</Text>
          <Text style={theme.typography.headingLarge}>Emergency Active</Text>
          <Text style={styles.subText}>
            Assistance pipeline is active. Stay calm.
          </Text>
        </View>

        <View
          style={[globalStyles.card, globalStyles.section, styles.locationCard]}
        >
          <Text style={theme.typography.headingMedium}>Live Location</Text>
          <Text style={styles.locationText}>{locationText}</Text>
          <Text style={styles.locationSub}>
            Location updates are being shared with verified guardians.
          </Text>
          <Text style={styles.locationStatus}>{locationStatus}</Text>
          <Text style={styles.timer}>{triggeredAtText}</Text>
        </View>

        <View style={styles.cueRow}>
          <Text style={styles.securityCue}>🔒 Live sharing active</Text>
          <Text style={styles.securityCue}>🛡️ Encrypted relay</Text>
          <Text style={styles.securityCue}>
            ⏳ Pending sync: {pendingSyncCount}
          </Text>
        </View>

        {showVideoUI && RTCView ? (
          <View
            style={[globalStyles.card, globalStyles.section, styles.videoCard]}
          >
            <Text style={theme.typography.headingMedium}>Live Video</Text>

            {remoteStream ? (
              <View style={styles.remoteVideoContainer}>
                <RTCView
                  streamURL={remoteStream.toURL()}
                  style={styles.remoteVideo}
                />
                <Text style={styles.videoLabel}>Guardian</Text>
              </View>
            ) : (
              <View style={styles.remoteVideoContainer}>
                <View style={styles.videoPlaceholder}>
                  <Text style={styles.videoPlaceholderText}>
                    Waiting for guardian to join...
                  </Text>
                </View>
              </View>
            )}

            {localStream ? (
              <View style={styles.localVideoContainer}>
                <RTCView
                  streamURL={localStream.toURL()}
                  style={styles.localVideo}
                />
              </View>
            ) : null}

            <View style={styles.videoStatusRow}>
              <Text style={styles.videoStatus}>
                {videoConnected ? 'Connected' : 'Connecting...'}
              </Text>
            </View>

            <View style={styles.videoControlsRow}>
              <TouchableOpacity
                style={[
                  globalStyles.buttonBase,
                  globalStyles.buttonOutline,
                  styles.videoControlButton,
                ]}
                onPress={toggleVideoAudio}
              >
                <Text style={globalStyles.buttonTextOutline}>
                  {isAudioMuted ? 'Unmute' : 'Mute'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  globalStyles.buttonBase,
                  globalStyles.buttonOutline,
                  styles.videoControlButton,
                ]}
                onPress={toggleVideo}
              >
                <Text style={globalStyles.buttonTextOutline}>
                  {isVideoOff ? 'Camera On' : 'Camera Off'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  globalStyles.buttonBase,
                  globalStyles.buttonOutline,
                  styles.videoControlButton,
                ]}
                onPress={switchCamera}
              >
                <Text style={globalStyles.buttonTextOutline}>Switch</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  globalStyles.buttonBase,
                  globalStyles.buttonDanger,
                  styles.videoControlButton,
                ]}
                onPress={endVideoCall}
              >
                <Text style={globalStyles.buttonTextPrimary}>End Call</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity
            style={[
              globalStyles.buttonBase,
              globalStyles.buttonPrimary,
              styles.videoCallButton,
            ]}
            onPress={startVideoCall}
            disabled={videoInitializing}
          >
            {videoInitializing ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <Text style={globalStyles.buttonTextPrimary}>
                Start Live Video Call
              </Text>
            )}
          </TouchableOpacity>
        )}

        <View style={styles.quickActionCard}>
          <Text style={styles.quickActionTitle}>Quick Check-in</Text>
          <Text style={styles.quickActionSubtext}>
            Send a short status update instantly.
          </Text>

          <TouchableOpacity
            style={[
              globalStyles.buttonBase,
              globalStyles.buttonPrimary,
              styles.quickEvidenceButton,
              isSavingEvidence && styles.buttonDisabled,
            ]}
            onPress={handleAddQuickEvidence}
            disabled={isSavingEvidence}
          >
            {isSavingEvidence ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <Text style={globalStyles.buttonTextPrimary}>
                Share Quick Evidence Note
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <View style={[globalStyles.card, styles.evidenceCard]}>
          <Text style={styles.evidenceLabel}>Evidence Hub</Text>
          <Text style={theme.typography.headingMedium}>
            Share Detailed Evidence
          </Text>
          <Text style={styles.evidenceHint}>
            Capture media inside app and share it with guardians instantly.
          </Text>

          <View style={styles.typeRow}>
            {EVIDENCE_TYPES.map(type => {
              const isActive = selectedEvidenceType === type;
              return (
                <TouchableOpacity
                  key={type}
                  style={[styles.typePill, isActive && styles.typePillActive]}
                  onPress={() => setSelectedEvidenceType(type)}
                  disabled={isSavingEvidence}
                >
                  <Text
                    style={[
                      styles.typePillText,
                      isActive && styles.typePillTextActive,
                    ]}
                  >
                    {type}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.captureActionsWrap}>
            {selectedEvidenceType === 'PHOTO' ? (
              <TouchableOpacity
                style={[
                  globalStyles.buttonBase,
                  globalStyles.buttonOutline,
                  styles.captureActionButton,
                ]}
                onPress={() => handleCaptureMedia('photo')}
                disabled={isSavingEvidence}
              >
                <Text style={globalStyles.buttonTextOutline}>
                  Open Camera (Photo)
                </Text>
              </TouchableOpacity>
            ) : null}

            {selectedEvidenceType === 'VIDEO' ? (
              <TouchableOpacity
                style={[
                  globalStyles.buttonBase,
                  globalStyles.buttonOutline,
                  styles.captureActionButton,
                ]}
                onPress={() => handleCaptureMedia('video')}
                disabled={isSavingEvidence}
              >
                <Text style={globalStyles.buttonTextOutline}>
                  Open Camera (Video)
                </Text>
              </TouchableOpacity>
            ) : null}

            {selectedEvidenceType === 'AUDIO' ? (
              <View style={styles.audioRow}>
                <TouchableOpacity
                  style={[
                    globalStyles.buttonBase,
                    isRecordingAudio
                      ? globalStyles.buttonDanger
                      : globalStyles.buttonOutline,
                    styles.captureActionButton,
                    styles.audioControlButton,
                  ]}
                  onPress={
                    isRecordingAudio
                      ? handleStopAudioRecording
                      : handleStartAudioRecording
                  }
                  disabled={isSavingEvidence}
                >
                  <Text
                    style={
                      isRecordingAudio
                        ? globalStyles.buttonTextPrimary
                        : globalStyles.buttonTextOutline
                    }
                  >
                    {isRecordingAudio
                      ? 'Stop Recording'
                      : 'Start Audio Recording'}
                  </Text>
                </TouchableOpacity>

                <Text style={styles.audioStatusText}>
                  {isRecordingAudio
                    ? 'Recording in progress...'
                    : pendingEvidenceFile
                    ? 'Audio captured and ready to share.'
                    : 'Record a voice clip and then share.'}
                </Text>
              </View>
            ) : null}
          </View>

          {pendingEvidenceFile ? (
            <View style={styles.fileReadyCard}>
              <Text style={styles.fileReadyText}>
                Media ready: {pendingEvidenceFile.name}
              </Text>
              <TouchableOpacity
                onPress={() => setPendingEvidenceFile(null)}
                disabled={isSavingEvidence}
              >
                <Text style={styles.removeFileLink}>Remove</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          <TextInput
            style={[globalStyles.input, styles.inputSpacing]}
            placeholder="Describe what is happening (optional but recommended)"
            placeholderTextColor={theme.colors.textSecondary}
            multiline
            value={evidenceNote}
            onChangeText={setEvidenceNote}
            editable={!isSavingEvidence}
          />

          <TextInput
            style={globalStyles.input}
            placeholder="Media URL (optional fallback)"
            placeholderTextColor={theme.colors.textSecondary}
            autoCapitalize="none"
            value={evidenceMediaUrl}
            onChangeText={setEvidenceMediaUrl}
            editable={!isSavingEvidence}
          />

          <TouchableOpacity
            style={[
              globalStyles.buttonBase,
              globalStyles.buttonPrimary,
              styles.shareEvidenceButton,
              isSavingEvidence && styles.buttonDisabled,
            ]}
            onPress={handleShareEvidence}
            disabled={isSavingEvidence}
          >
            {isSavingEvidence ? (
              <ActivityIndicator color={theme.colors.white} />
            ) : (
              <Text style={globalStyles.buttonTextPrimary}>Share Evidence</Text>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            globalStyles.buttonBase,
            globalStyles.buttonDanger,
            styles.stopButton,
            isStopping && styles.buttonDisabled,
          ]}
          onPress={handleStopEmergency}
          disabled={isStopping}
        >
          {isStopping ? (
            <ActivityIndicator color={theme.colors.white} />
          ) : (
            <Text style={globalStyles.buttonTextPrimary}>Stop Emergency</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = theme =>
  StyleSheet.create({
    dangerBg: {
      backgroundColor: theme.colors.dangerTint,
    },
    headerWrap: {
      marginBottom: theme.spacing.md,
    },
    eyebrow: {
      ...theme.typography.small,
      color: theme.colors.accentEmergency,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 2,
    },
    loadingWrap: {
      justifyContent: 'center',
    },
    scrollContent: {
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.md,
      paddingBottom: theme.spacing.xl,
      backgroundColor: theme.colors.dangerTint,
    },
    subText: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      marginTop: theme.spacing.xs,
    },
    locationCard: {
      borderRadius: theme.radius.lg,
      backgroundColor: '#FFF8F8',
      borderColor: theme.colors.accentEmergency + '30',
      borderWidth: 1,
    },
    locationText: {
      ...theme.typography.body,
      marginTop: theme.spacing.sm,
      fontWeight: '600',
    },
    locationSub: {
      ...theme.typography.small,
      marginTop: theme.spacing.xs,
    },
    locationStatus: {
      ...theme.typography.small,
      marginTop: 6,
      color: theme.colors.primary,
      fontWeight: '600',
    },
    timer: {
      ...theme.typography.small,
      marginTop: theme.spacing.sm,
      color: theme.colors.accentEmergency,
      fontWeight: '600',
    },
    cueRow: {
      marginTop: theme.spacing.sm,
      gap: 8,
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    securityCue: {
      ...theme.typography.small,
      color: theme.colors.textSecondary,
      backgroundColor: theme.colors.white,
      borderWidth: 1,
      borderColor: theme.colors.border + '80',
      borderRadius: theme.radius.round,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    videoCard: {
      backgroundColor: theme.colors.card,
      borderColor: theme.colors.primary + '40',
      borderWidth: 1,
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    remoteVideoContainer: {
      width: '100%',
      height: 260,
      backgroundColor: theme.colors.black,
      borderRadius: theme.radius.md,
      overflow: 'hidden',
      marginTop: theme.spacing.sm,
      position: 'relative',
    },
    remoteVideo: {
      width: '100%',
      height: '100%',
    },
    videoPlaceholder: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 16,
    },
    videoPlaceholderText: {
      ...theme.typography.body,
      color: theme.colors.white,
      textAlign: 'center',
    },
    localVideoContainer: {
      width: 100,
      height: 120,
      backgroundColor: theme.colors.black,
      borderRadius: theme.radius.sm,
      overflow: 'hidden',
      position: 'absolute',
      right: 10,
      bottom: 10,
      borderWidth: 2,
      borderColor: theme.colors.primary,
    },
    localVideo: {
      width: '100%',
      height: '100%',
    },
    videoLabel: {
      ...theme.typography.small,
      color: theme.colors.white,
      position: 'absolute',
      left: 8,
      bottom: 8,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: theme.radius.sm,
      backgroundColor: 'rgba(0,0,0,0.6)',
      fontWeight: '700',
    },
    videoStatusRow: {
      marginTop: theme.spacing.sm,
      alignItems: 'center',
    },
    videoStatus: {
      ...theme.typography.small,
      color: theme.colors.primary,
      fontWeight: '700',
    },
    videoControlsRow: {
      marginTop: theme.spacing.sm,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    videoControlButton: {
      flex: 1,
      minWidth: 72,
      paddingVertical: 10,
    },
    videoCallButton: {
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.sm,
    },
    quickActionCard: {
      marginTop: theme.spacing.md,
      marginBottom: theme.spacing.sm,
      padding: theme.spacing.md,
      borderRadius: theme.radius.md,
      backgroundColor: theme.colors.white,
      borderWidth: 1,
      borderColor: theme.colors.border + '70',
      ...theme.shadow,
    },
    quickActionTitle: {
      ...theme.typography.headingMedium,
    },
    quickActionSubtext: {
      ...theme.typography.small,
      marginTop: 4,
      marginBottom: 10,
    },
    quickEvidenceButton: {
      marginTop: 2,
    },
    evidenceCard: {
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.sm,
      borderRadius: theme.radius.lg,
    },
    evidenceLabel: {
      ...theme.typography.small,
      color: theme.colors.primary,
      fontWeight: '700',
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 2,
    },
    evidenceHint: {
      ...theme.typography.small,
      color: theme.colors.textSecondary,
      marginTop: 6,
      marginBottom: 10,
    },
    typeRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginBottom: 10,
    },
    captureActionsWrap: {
      marginBottom: 10,
      gap: 8,
    },
    captureActionButton: {
      paddingHorizontal: 12,
    },
    audioRow: {
      gap: 8,
    },
    audioControlButton: {
      width: '100%',
    },
    audioStatusText: {
      ...theme.typography.small,
      color: theme.colors.textSecondary,
    },
    fileReadyCard: {
      borderWidth: 1,
      borderColor: theme.colors.primary + '50',
      borderRadius: theme.radius.sm,
      padding: 10,
      marginBottom: 10,
      backgroundColor: theme.colors.primary + '12',
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    fileReadyText: {
      ...theme.typography.small,
      color: theme.colors.textPrimary,
      flex: 1,
    },
    removeFileLink: {
      ...theme.typography.small,
      color: theme.colors.accentEmergency,
      fontWeight: '600',
    },
    typePill: {
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.round,
      paddingHorizontal: 10,
      paddingVertical: 6,
      backgroundColor: theme.colors.card,
    },
    typePillActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary + '18',
    },
    typePillText: {
      ...theme.typography.small,
      color: theme.colors.textSecondary,
      fontWeight: '600',
    },
    typePillTextActive: {
      color: theme.colors.primary,
    },
    inputSpacing: {
      marginBottom: 10,
      minHeight: 80,
      textAlignVertical: 'top',
    },
    shareEvidenceButton: {
      marginTop: 10,
    },
    stopButton: {
      marginTop: theme.spacing.sm,
      marginBottom: theme.spacing.md,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
  });

export default EmergencyActiveScreen;
