import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { createGlobalStyles } from '../styles/globalStyles';
import { useAppTheme } from '../context/ThemeContext';
import emergencyService from '../services/emergencyService';

const IMAGE_TYPES = new Set(['PHOTO']);

const GuardianEvidenceFeedScreen = ({ navigation, route }) => {
  const { theme } = useAppTheme();
  const globalStyles = useMemo(() => createGlobalStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const userId = route.params?.userId;
  const userNameParam = route.params?.userName;

  const [event, setEvent] = useState(null);
  const [evidence, setEvidence] = useState([]);
  const [monitoredUser, setMonitoredUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [hidingEvidenceIds, setHidingEvidenceIds] = useState({});
  const [undoEntry, setUndoEntry] = useState(null);

  const screenTitle = useMemo(() => {
    const displayName = monitoredUser?.name || userNameParam || 'User';
    return `${displayName}`;
  }, [monitoredUser?.name, userNameParam]);

  const loadEvidenceFeed = useCallback(
    async refreshOnly => {
      if (!userId) {
        setError('User ID is missing.');
        setIsLoading(false);
        return;
      }

      if (!refreshOnly) {
        setIsLoading(true);
      }

      const result = await emergencyService.getGuardianEvidenceFeed(userId);

      if (result.success) {
        setEvent(result.event || null);
        setEvidence(result.evidence || []);
        setMonitoredUser(result.monitoredUser || null);
        setError('');
      } else {
        setEvent(null);
        setEvidence([]);
        setError(result.message || 'Unable to load evidence feed.');
      }

      if (!refreshOnly) {
        setIsLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    loadEvidenceFeed(false);
  }, [loadEvidenceFeed]);

  useEffect(() => {
    return () => {
      if (undoEntry?.timeoutId) {
        clearTimeout(undoEntry.timeoutId);
      }
    };
  }, [undoEntry]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadEvidenceFeed(true);
    setIsRefreshing(false);
  };

  const openMedia = async item => {
    if (item?.type === 'AUDIO' || item?.type === 'VIDEO') {
      const streamUrl = item.streamUrl || item.mediaUrl;
      const downloadUrl = item.downloadUrl || item.mediaUrl;

      navigation.navigate('GuardianMediaPlayer', {
        mediaUrl: streamUrl,
        downloadUrl,
        mediaType: item.type,
        title: item.mediaName || `${item.type} evidence`,
      });
      return;
    }

    const url = item?.streamUrl || item?.mediaUrl;
    if (!url) {
      return;
    }

    try {
      await Linking.openURL(url);
    } catch (openError) {
      Alert.alert(
        'Cannot Open Media',
        openError?.message || 'Failed to open media URL.',
      );
    }
  };

  const downloadMedia = async url => {
    if (!url) {
      return;
    }

    try {
      await Linking.openURL(url);
    } catch (downloadError) {
      Alert.alert(
        'Cannot Download Media',
        downloadError?.message || 'Failed to start media download.',
      );
    }
  };

  const handleHideEvidence = item => {
    const evidenceId = (item?.id || '').toString();
    if (!userId || !evidenceId) {
      return;
    }

    Alert.alert(
      'Remove From Feed',
      'This will remove evidence from your guardian feed only. Backend keeps it for 7 days.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setHidingEvidenceIds(previous => ({
              ...previous,
              [evidenceId]: true,
            }));

            const result = await emergencyService.hideGuardianEvidence(
              userId,
              evidenceId,
            );

            setHidingEvidenceIds(previous => {
              const next = { ...previous };
              delete next[evidenceId];
              return next;
            });

            if (!result.success) {
              Alert.alert(
                'Unable to Remove',
                result.message || 'Please try again.',
              );
              return;
            }

            setEvidence(previous =>
              previous.filter(
                evidenceItem =>
                  (evidenceItem.id || '').toString() !== evidenceId,
              ),
            );

            if (undoEntry?.timeoutId) {
              clearTimeout(undoEntry.timeoutId);
            }

            const timeoutId = setTimeout(() => {
              setUndoEntry(current =>
                current?.evidenceId === evidenceId ? null : current,
              );
            }, 5000);

            setUndoEntry({
              evidenceId,
              item,
              timeoutId,
            });
          },
        },
      ],
    );
  };

  const handleUndoHide = async () => {
    if (!undoEntry?.evidenceId || !undoEntry?.item || !userId) {
      setUndoEntry(null);
      return;
    }

    if (undoEntry.timeoutId) {
      clearTimeout(undoEntry.timeoutId);
    }

    const result = await emergencyService.unhideGuardianEvidence(
      userId,
      undoEntry.evidenceId,
    );

    if (!result.success) {
      Alert.alert('Unable to Restore', result.message || 'Please try again.');
      setUndoEntry(null);
      return;
    }

    setEvidence(previous => {
      const alreadyExists = previous.some(
        evidenceItem =>
          (evidenceItem.id || '').toString() ===
          (undoEntry.item.id || '').toString(),
      );

      if (alreadyExists) {
        return previous;
      }

      const next = [undoEntry.item, ...previous];
      next.sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime(),
      );
      return next;
    });

    setUndoEntry(null);
  };

  const renderEvidenceItem = ({ item }) => {
    const evidenceId = (item?.id || '').toString();
    const isHiding = !!hidingEvidenceIds[evidenceId];
    const hasMedia = !!item.mediaUrl;
    const streamUrl = item.streamUrl || item.mediaUrl;
    const downloadUrl = item.downloadUrl || item.mediaUrl;
    const isImage = IMAGE_TYPES.has(item.type) && hasMedia;
    const createdAtText = item.createdAt
      ? new Date(item.createdAt).toLocaleString()
      : 'Just now';

    return (
      <View style={[globalStyles.card, styles.evidenceCard]}>
        <View style={styles.rowBetween}>
          <View style={styles.rowLeftGroup}>
            <Text style={styles.typePill}>{item.type || 'TEXT'}</Text>
            <Text style={styles.timeText}>{createdAtText}</Text>
          </View>
          <TouchableOpacity
            style={styles.removeEvidenceButton}
            onPress={() => handleHideEvidence(item)}
            disabled={isHiding}
          >
            {isHiding ? (
              <ActivityIndicator
                size="small"
                color={theme.colors.accentEmergency}
              />
            ) : (
              <Text style={styles.removeEvidenceIcon}>✕</Text>
            )}
          </TouchableOpacity>
        </View>

        {item.text ? (
          <Text style={styles.evidenceText}>{item.text}</Text>
        ) : null}

        {isImage ? (
          <TouchableOpacity
            onPress={() => openMedia(item)}
            activeOpacity={0.85}
            style={styles.imageWrap}
          >
            <Image
              source={{ uri: streamUrl }}
              style={styles.imagePreview}
              resizeMode="cover"
            />
            <Text style={styles.openLinkText}>
              Tap image to open full media
            </Text>
          </TouchableOpacity>
        ) : null}

        {hasMedia ? (
          <View style={styles.mediaActionRow}>
            <TouchableOpacity
              style={[
                globalStyles.buttonBase,
                globalStyles.buttonOutline,
                styles.openMediaButton,
                styles.mediaActionButton,
              ]}
              onPress={() => openMedia(item)}
            >
              <Text style={globalStyles.buttonTextOutline}>
                {item.type === 'AUDIO'
                  ? 'Play Audio'
                  : item.type === 'VIDEO'
                  ? 'Play Video'
                  : 'Open Media'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                globalStyles.buttonBase,
                globalStyles.buttonPrimary,
                styles.mediaActionButton,
              ]}
              onPress={() => downloadMedia(downloadUrl)}
            >
              <Text style={globalStyles.buttonTextPrimary}>Download</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={globalStyles.safeArea}>
        <View style={[globalStyles.container, styles.centered]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      <View style={globalStyles.container}>
        <View style={styles.headerRow}>
          <TouchableOpacity
            style={[
              globalStyles.buttonBase,
              globalStyles.buttonOutline,
              styles.backButton,
            ]}
            onPress={() => navigation.goBack()}
          >
            <Text style={globalStyles.buttonTextOutline}>Back</Text>
          </TouchableOpacity>
          <View style={styles.headerTextWrap}>
            <Text style={styles.eyebrow}>Guardian Monitoring</Text>
            <Text style={styles.headerTitle}>{screenTitle} Evidence Feed</Text>
          </View>
        </View>

        <View style={[globalStyles.card, styles.summaryCard]}>
          <Text style={styles.summaryTitle}>Live Evidence Stream</Text>
          <Text style={styles.summaryText}>
            {event
              ? `${evidence.length} evidence item${
                  evidence.length === 1 ? '' : 's'
                } in active emergency`
              : 'No active emergency evidence right now'}
          </Text>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <FlatList
          data={evidence}
          keyExtractor={(item, index) =>
            (item.id || `${item.createdAt || 'evidence'}-${index}`).toString()
          }
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
          renderItem={renderEvidenceItem}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No evidence items yet.</Text>
              <Text style={styles.emptySubText}>
                Pull down to refresh once user shares new evidence.
              </Text>
            </View>
          }
        />

        {undoEntry ? (
          <View style={styles.undoBar}>
            <Text style={styles.undoText}>Evidence removed from your feed</Text>
            <TouchableOpacity onPress={handleUndoHide}>
              <Text style={styles.undoAction}>UNDO</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
};

const createStyles = theme =>
  StyleSheet.create({
  centered: {
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 12,
  },
  headerTextWrap: {
    flex: 1,
  },
  eyebrow: {
    ...theme.typography.small,
    color: theme.colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  backButton: {
    paddingHorizontal: 16,
  },
  headerTitle: {
    ...theme.typography.headingMedium,
  },
  summaryCard: {
    marginBottom: 12,
    borderRadius: theme.radius.lg,
    backgroundColor: '#F6FAFF',
    borderWidth: 1,
    borderColor: theme.colors.primary + '25',
  },
  summaryTitle: {
    ...theme.typography.headingMedium,
    color: theme.colors.textPrimary,
  },
  summaryText: {
    ...theme.typography.small,
    marginTop: 6,
    color: theme.colors.textSecondary,
  },
  errorContainer: {
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.accentEmergency,
    backgroundColor: theme.colors.accentEmergency + '10',
    padding: 10,
    marginBottom: 12,
  },
  errorText: {
    ...theme.typography.small,
    color: theme.colors.accentEmergency,
  },
  listContent: {
    paddingBottom: 26,
    gap: 10,
  },
  evidenceCard: {
    marginBottom: 10,
    borderRadius: theme.radius.lg,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  rowLeftGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  typePill: {
    ...theme.typography.small,
    color: theme.colors.primary,
    fontWeight: '700',
    borderWidth: 1,
    borderColor: theme.colors.primary + '70',
    borderRadius: theme.radius.round,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: '#EEF4FF',
  },
  timeText: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
  },
  removeEvidenceButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: theme.colors.accentEmergency + '70',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
    backgroundColor: '#FFF7F7',
  },
  removeEvidenceIcon: {
    ...theme.typography.body,
    color: theme.colors.accentEmergency,
    fontWeight: '700',
    lineHeight: 18,
  },
  evidenceText: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    marginBottom: 10,
  },
  imageWrap: {
    marginBottom: 10,
  },
  imagePreview: {
    width: '100%',
    height: 220,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.border,
  },
  openLinkText: {
    ...theme.typography.small,
    marginTop: 6,
    color: theme.colors.textSecondary,
  },
  openMediaButton: {
    marginTop: 2,
  },
  mediaActionRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  mediaActionButton: {
    flex: 1,
  },
  emptyWrap: {
    alignItems: 'center',
    marginTop: 20,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
  },
  emptySubText: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    marginTop: 6,
    textAlign: 'center',
  },
  undoBar: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 14,
    borderRadius: theme.radius.md,
    backgroundColor: '#1f2937',
    borderWidth: 1,
    borderColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  undoText: {
    ...theme.typography.small,
    color: theme.colors.white,
    flex: 1,
    marginRight: 10,
  },
  undoAction: {
    ...theme.typography.small,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  });

export default GuardianEvidenceFeedScreen;
