import React, {
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useEffect,
} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Modal,
  Alert,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { AuthContext } from '../context/AuthContext';
import { createGlobalStyles } from '../styles/globalStyles';
import { useAppTheme } from '../context/ThemeContext';
import emergencyService from '../services/emergencyService';
import guardianAlertService from '../services/guardianAlertService';

const GuardianDashboardScreen = () => {
  const navigation = useNavigation();
  const { user, logout } = useContext(AuthContext);
  const { theme: appTheme, mode, toggleTheme } = useAppTheme();
  const globalStyles = useMemo(() => createGlobalStyles(appTheme), [appTheme]);
  const styles = useMemo(() => createStyles(appTheme), [appTheme]);
  const [users, setUsers] = useState([]);
  const [alertsByUserId, setAlertsByUserId] = useState({});
  const [evidenceByUserId, setEvidenceByUserId] = useState({});
  const [metrics, setMetrics] = useState({
    activeSosCount: 0,
    linkedUsersCount: 0,
    evidenceFeedCount: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isAlertMuted, setIsAlertMuted] = useState(false);
  const [isSirenPlaying, setIsSirenPlaying] = useState(false);
  const [isSirenModalVisible, setIsSirenModalVisible] = useState(false);
  const [isSirenStoppedByGuardian, setIsSirenStoppedByGuardian] =
    useState(false);
  const [error, setError] = useState('');
  const latestAlertSignatureRef = useRef('');

  const emergencyCount = metrics.activeSosCount;
  const liveEvidenceFeedCount = metrics.evidenceFeedCount;
  const alertSummaries = useMemo(
    () => Object.values(alertsByUserId || {}),
    [alertsByUserId],
  );
  const activeAlerts = useMemo(
    () => alertSummaries.filter(alertItem => alertItem.status === 'ACTIVE'),
    [alertSummaries],
  );
  const activeUnacknowledgedAlerts = useMemo(() => activeAlerts, [activeAlerts]);

  const loadGuardianEvidenceSummaries = async linkedUsers => {
    const results = await Promise.allSettled(
      (linkedUsers || []).map(async linkedUser => {
        const linkedUserId = (linkedUser._id || linkedUser.id || '').toString();

        if (!linkedUserId) {
          return null;
        }

        const result = await emergencyService.getGuardianEvidenceFeed(linkedUserId);
        if (!result.success) {
          return [linkedUserId, { event: null, evidence: [], monitoredUser: null }];
        }

        return [linkedUserId, result];
      }),
    );

    const nextEvidenceByUserId = {};
    results.forEach(result => {
      if (result.status !== 'fulfilled' || !result.value) {
        return;
      }

      const [linkedUserId, feedResult] = result.value;
      nextEvidenceByUserId[linkedUserId] = {
        event: feedResult.event || null,
        evidence: feedResult.evidence || [],
        monitoredUser: feedResult.monitoredUser || null,
      };
    });

    setEvidenceByUserId(nextEvidenceByUserId);
  };

  useEffect(() => {
    loadGuardianLiveFeed();

    const pollInterval = setInterval(() => {
      loadGuardianLiveFeed({ refreshOnly: true });
    }, 15000);

    return () => {
      clearInterval(pollInterval);
      guardianAlertService.stopAlertSiren();
    };
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadGuardianLiveFeed({ refreshOnly: true });
    }, []),
  );

  useEffect(() => {
    const nextSignature = activeUnacknowledgedAlerts
      .map(alertItem => (alertItem.id || '').toString())
      .sort()
      .join('|');

    const hasIncomingAlert =
      activeUnacknowledgedAlerts.length > 0 &&
      nextSignature !== latestAlertSignatureRef.current;

    if (hasIncomingAlert) {
      setIsSirenStoppedByGuardian(false);
      setIsAlertMuted(false);
      setIsSirenModalVisible(true);
    }

    latestAlertSignatureRef.current = nextSignature;
  }, [activeUnacknowledgedAlerts]);

  useEffect(() => {
    if (activeUnacknowledgedAlerts.length === 0) {
      guardianAlertService.stopAlertSiren();
      setIsSirenPlaying(false);
      setIsSirenModalVisible(false);
      setIsSirenStoppedByGuardian(false);
      return;
    }

    if (isAlertMuted || isSirenStoppedByGuardian) {
      if (isSirenPlaying) {
        guardianAlertService.stopAlertSiren();
        setIsSirenPlaying(false);
      }
      return;
    }

    if (activeUnacknowledgedAlerts.length > 0 || isSirenPlaying) {
      const startResult = guardianAlertService.startAlertSiren();
      if (startResult.success || startResult.alreadyRunning) {
        setIsSirenPlaying(true);
        setIsSirenModalVisible(true);
      }
    }
  }, [
    activeUnacknowledgedAlerts.length,
    isAlertMuted,
    isSirenStoppedByGuardian,
    isSirenPlaying,
  ]);

  const loadGuardianLiveFeed = async ({ refreshOnly = false } = {}) => {
    if (!refreshOnly) {
      setIsLoading(true);
    }

    const result = await emergencyService.getGuardianLiveFeed();

    if (result.success) {
      const nextAlertsByUserId = {};

      (result.alerts || []).forEach(alertItem => {
        const alertUserId = alertItem.user?.id || alertItem.user?._id;
        if (alertUserId) {
          nextAlertsByUserId[alertUserId.toString()] = alertItem;
        }
      });

      setUsers(result.linkedUsers || []);
      setAlertsByUserId(nextAlertsByUserId);
      await loadGuardianEvidenceSummaries(result.linkedUsers || []);
      setMetrics(
        result.metrics || {
          activeSosCount: 0,
          linkedUsersCount: 0,
          evidenceFeedCount: 0,
        },
      );
      setError('');
    } else {
      setError(result.message);
      setUsers([]);
      setAlertsByUserId({});
      setEvidenceByUserId({});
      setMetrics({
        activeSosCount: 0,
        linkedUsersCount: 0,
        evidenceFeedCount: 0,
      });
    }

    if (!refreshOnly) {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadGuardianLiveFeed({ refreshOnly: true });
    setIsRefreshing(false);
  };

  const handleToggleMute = () => {
    setIsAlertMuted(previous => {
      const next = !previous;
      if (next) {
        setIsSirenStoppedByGuardian(true);
        setIsSirenModalVisible(false);
      }
      return next;
    });
  };

  const handleGuardianStopSiren = () => {
    guardianAlertService.stopAlertSiren();
    setIsSirenPlaying(false);
    setIsSirenStoppedByGuardian(true);
    setIsSirenModalVisible(false);
  };

  const handleSirenPreview = () => {
    const previewResult = guardianAlertService.playSirenPreview();
    if (!previewResult.success) {
      Alert.alert(
        'Siren Unavailable',
        previewResult.message || 'Unable to play siren preview right now.',
      );
      return;
    }

    Alert.alert('Siren Preview', 'Siren test played successfully.');
  };

  const openLiveEvidence = monitoredUser => {
    const userId = (monitoredUser._id || monitoredUser.id || '').toString();

    navigation.navigate('GuardianEvidenceFeed', {
      userId,
      userName: monitoredUser.name,
    });
  };

  const openLiveLocation = monitoredUser => {
    const userId = (monitoredUser._id || monitoredUser.id || '').toString();
    const activeAlert = alertsByUserId[userId];
    const hasLocationTrack =
      activeAlert?.status === 'ACTIVE' &&
      (!!activeAlert?.lastLocation || (activeAlert?.locationHistory || []).length > 0);

    if (!hasLocationTrack) {
      Alert.alert(
        'No Active SOS',
        `Live location is available only while ${monitoredUser.name} has an active SOS.`,
      );
      return;
    }

    navigation.navigate('GuardianLiveMap', {
      userId,
      userName: monitoredUser.name,
      alert: activeAlert,
    });
  };

  const handleLogout = async () => {
    guardianAlertService.stopAlertSiren();
    setIsSirenPlaying(false);
    await logout();
  };

  if (isLoading) {
    return (
      <SafeAreaView style={globalStyles.safeArea}>
        <View style={[globalStyles.container, { justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={appTheme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      <ScrollView
        style={globalStyles.container}
        contentContainerStyle={styles.pageContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={appTheme.colors.primary}
          />
        }
      >
        <View style={styles.backdrop}>
          <View style={styles.backdropGlowTop} />
          <View style={styles.backdropGlowBottom} />
        </View>

        <View style={globalStyles.section}>
          <View style={styles.headerRow}>
            <View>
              <View style={styles.brandPill}>
                <Text style={styles.brandPillText}>Guardian Console</Text>
              </View>
              <Text style={styles.pageTitle}>Control Center</Text>
              <Text style={styles.subtitle}>
                Welcome, {user?.name || 'Guardian'}
              </Text>
            </View>

            <View style={styles.headerActions}>
              <TouchableOpacity
                style={[
                  globalStyles.buttonBase,
                  globalStyles.buttonOutline,
                  styles.headerActionButton,
                ]}
                onPress={toggleTheme}
              >
                <Text style={styles.headerActionText}>
                  {mode === 'dark' ? 'Light Mode' : 'Dark Mode'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  globalStyles.buttonBase,
                  globalStyles.buttonOutline,
                  styles.headerActionButton,
                ]}
                onPress={() => navigation.navigate('Settings')}
              >
                <Text style={styles.headerActionText}>Settings</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[globalStyles.buttonBase, styles.logoutButton]}
                onPress={handleLogout}
              >
                <Text style={styles.logoutText}>Logout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View style={[globalStyles.card, styles.alertCard]}>
          <Text style={styles.alertTitle}>🚨 SOS Alert Console</Text>
          <Text style={styles.alertBody}>
            Track active SOS events, retained evidence, and live guardian
            monitoring in one place.
          </Text>

          <View style={styles.metricRow}>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{emergencyCount}</Text>
              <Text style={styles.metricLabel}>Active SOS</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{liveEvidenceFeedCount}</Text>
              <Text style={styles.metricLabel}>Evidence Items</Text>
            </View>
            <View style={styles.metricItem}>
              <Text style={styles.metricValue}>{metrics.linkedUsersCount}</Text>
              <Text style={styles.metricLabel}>Linked Users</Text>
            </View>
          </View>

          <Text style={styles.alertFooterText}>
            Evidence feeds: {liveEvidenceFeedCount}
          </Text>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.listHeaderWrap}>
          <Text style={appTheme.typography.headingMedium}>Live Monitoring</Text>
          <Text style={styles.listHeaderSubtext}>
            Users appear here only after they select your guardian email.
          </Text>
        </View>

        <View style={styles.userListContent}>
          <View style={styles.listHeaderWrap}>
            <Text style={appTheme.typography.headingMedium}>Connected Users</Text>
            <Text style={styles.listHeaderSubtext}>
              Each user has a separate evidence feed. Live location remains
              locked to active SOS only.
            </Text>
          </View>

          {users.length > 0 ? (
            users.map(item => {
              const userId = (item._id || item.id || '').toString();
              const activeAlert = alertsByUserId[userId];
              const isEmergency = activeAlert?.status === 'ACTIVE';
              const userEvidenceFeed = evidenceByUserId[userId];
              const evidenceItems = userEvidenceFeed?.evidence || [];
              const evidenceEvent = userEvidenceFeed?.event || activeAlert || null;
              const latestEvidence = evidenceItems.slice(0, 3);
              const hasLocationTrack =
                isEmergency &&
                (!!activeAlert?.lastLocation ||
                  (activeAlert?.locationHistory || []).length > 0);
              const locationPreview = activeAlert?.lastLocation
                ? `📍 ${activeAlert.lastLocation.latitude}, ${activeAlert.lastLocation.longitude}`
                : 'No live location yet';

              return (
                <View key={userId} style={[globalStyles.card, styles.userCard]}>
                  <View style={styles.userInfoRow}>
                    <View style={styles.userInfo}>
                      <Text style={appTheme.typography.headingMedium}>
                        {item.name}
                      </Text>
                      <Text style={styles.emailText}>{item.email}</Text>
                      {item.phone ? (
                        <Text style={styles.phoneText}>{item.phone}</Text>
                      ) : null}
                    </View>

                    <View
                      style={[
                        styles.statusBadge,
                        isEmergency
                          ? styles.statusBadgeEmergency
                          : activeAlert
                          ? styles.statusBadgeLinked
                          : styles.statusBadgePending,
                      ]}
                    >
                      <Text style={styles.statusText}>
                        {isEmergency ? '🚨 ACTIVE SOS' : activeAlert ? '🕘 RESOLVED' : '✅ NO ACTIVE SOS'}
                      </Text>
                    </View>
                  </View>

                  {activeAlert ? (
                    <View style={styles.emergencyMetaWrap}>
                      <Text style={styles.emergencyMetaText}>
                        {isEmergency
                          ? locationPreview
                          : 'SOS stopped. Location is locked until a new SOS starts.'}
                      </Text>
                      <Text style={styles.emergencyMetaText}>
                        Evidence retained: {evidenceItems.length}
                      </Text>
                    </View>
                  ) : (
                    <View style={styles.emergencyMetaWrap}>
                      <Text style={styles.emergencyMetaText}>
                        No active SOS for this user right now.
                      </Text>
                      <Text style={styles.emergencyMetaText}>
                        Retained evidence still shows below until deleted from the
                        backend.
                      </Text>
                    </View>
                  )}

                  <View style={styles.actionRow}>
                    <TouchableOpacity
                      style={[
                        globalStyles.buttonBase,
                        globalStyles.buttonPrimary,
                        styles.actionButton,
                      ]}
                      onPress={() => openLiveEvidence(item)}
                    >
                      <Text style={globalStyles.buttonTextPrimary}>
                        View Full Evidence
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        globalStyles.buttonBase,
                        hasLocationTrack
                          ? globalStyles.buttonDanger
                          : globalStyles.buttonOutline,
                        styles.actionButton,
                        !hasLocationTrack && styles.controlButtonDisabled,
                      ]}
                      onPress={() => openLiveLocation(item)}
                      disabled={!hasLocationTrack}
                    >
                      <Text
                        style={
                          hasLocationTrack
                            ? globalStyles.buttonTextPrimary
                            : globalStyles.buttonTextOutline
                        }
                      >
                        Live Location
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.userEvidenceSection}>
                    <Text style={styles.userEvidenceTitle}>
                      Evidence for {item.name}
                    </Text>

                    {latestEvidence.length > 0 ? (
                      latestEvidence.map(evidenceItem => (
                        <View
                          key={(evidenceItem.id || '').toString()}
                          style={styles.evidencePreviewItem}
                        >
                          <Text style={styles.evidencePreviewType}>
                            {evidenceItem.type || 'TEXT'}
                          </Text>
                          <Text style={styles.evidencePreviewText}>
                            {evidenceItem.text || evidenceItem.mediaName || 'Media evidence'}
                          </Text>
                          <Text style={styles.evidencePreviewMeta}>
                            {evidenceItem.createdAt
                              ? new Date(evidenceItem.createdAt).toLocaleString()
                              : 'Recently added'}
                          </Text>
                        </View>
                      ))
                    ) : (
                      <Text style={styles.evidenceEmptyText}>
                        No retained evidence yet for this user.
                      </Text>
                    )}

                    {evidenceEvent?.status === 'RESOLVED' ? (
                      <Text style={styles.evidenceResolvedText}>
                        Previous evidence stays here until it is removed from the
                        backend.
                      </Text>
                    ) : null}
                  </View>
                </View>
              );
            })
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                You are not linked to any users yet.
              </Text>
              <Text style={styles.emptyHint}>
                Ask a user to add your guardian email to begin monitoring.
              </Text>
            </View>
          )}
        </View>

        <Modal
          visible={isSirenModalVisible && activeUnacknowledgedAlerts.length > 0}
          transparent
          animationType="fade"
          onRequestClose={() => {}}
        >
          <View style={styles.sirenModalBackdrop}>
            <View style={styles.sirenModalCard}>
              <Text style={styles.sirenModalTitle}>Emergency Siren Active</Text>
              <Text style={styles.sirenModalText}>
                SOS alert is active. Siren will continue until guardian stops
                it.
              </Text>
              <TouchableOpacity
                style={[
                  globalStyles.buttonBase,
                  globalStyles.buttonDanger,
                  styles.sirenModalButton,
                ]}
                onPress={handleGuardianStopSiren}
              >
                <Text style={globalStyles.buttonTextPrimary}>
                  Stop Siren (Guardian)
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = theme =>
  StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 10,
  },
  pageContent: {
    paddingBottom: theme.spacing.xl,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  backdropGlowTop: {
    position: 'absolute',
    top: -55,
    right: -40,
    width: 190,
    height: 190,
    borderRadius: 95,
    backgroundColor: theme.colors.primary + '14',
  },
  backdropGlowBottom: {
    position: 'absolute',
    bottom: 20,
    left: -60,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: theme.colors.accentEmergency + '12',
  },
  brandPill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.border + '80',
    marginBottom: 8,
  },
  brandPillText: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  pageTitle: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    color: theme.colors.textPrimary,
    letterSpacing: -0.3,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: 6,
  },
  headerActions: {
    alignItems: 'flex-end',
    gap: 8,
  },
  headerActionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerActionText: {
    ...theme.typography.small,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: theme.radius.round,
    backgroundColor: theme.colors.accentEmergency + '16',
  },
  logoutText: {
    ...theme.typography.small,
    color: theme.colors.accentEmergency,
    fontWeight: '700',
  },
  alertCard: {
    backgroundColor: theme.colors.card,
    borderWidth: 1,
    borderColor: theme.colors.accentEmergency + '30',
    marginBottom: 14,
    borderRadius: theme.radius.lg,
  },
  alertTitle: {
    ...theme.typography.headingMedium,
    color: theme.colors.accentEmergency,
  },
  alertBody: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    marginTop: 6,
  },
  alertFooterText: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    marginTop: 8,
  },
  metricRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 8,
  },
  metricItem: {
    flex: 1,
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border + '70',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  metricValue: {
    ...theme.typography.headingMedium,
    color: theme.colors.textPrimary,
  },
  metricLabel: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  sirenCard: {
    marginBottom: 16,
    borderRadius: theme.radius.lg,
  },
  sirenHint: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    marginTop: 6,
    marginBottom: 10,
  },
  alertStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  alertStatusText: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    fontWeight: '600',
  },
  controlRow: {
    flexDirection: 'row',
    gap: 8,
  },
  controlButton: {
    flex: 1,
  },
  controlButtonDisabled: {
    opacity: 0.6,
  },
  controlButtonGhost: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: theme.radius.round,
    borderWidth: 1,
    borderColor: theme.colors.border + '70',
    backgroundColor: theme.colors.surfaceAlt,
    paddingVertical: 12,
  },
  controlButtonGhostText: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    fontWeight: '700',
  },
  previewButton: {
    marginTop: 10,
  },
  scrollArea: {
    flex: 1,
  },
  trackingCard: {
    marginBottom: 16,
    borderRadius: theme.radius.lg,
  },
  trackingSubText: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    marginTop: 6,
    marginBottom: 10,
  },
  trackingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border + '50',
  },
  trackingItemInfo: {
    flex: 1,
  },
  trackingUserName: {
    ...theme.typography.body,
    fontWeight: '700',
    color: theme.colors.textPrimary,
  },
  trackingMetaText: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  trackingActions: {
    gap: 8,
    alignItems: 'stretch',
  },
  trackingButton: {
    minWidth: 118,
  },
  trackingEmptyText: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    marginTop: 6,
  },
  pendingCard: {
    marginBottom: 16,
    borderRadius: theme.radius.lg,
  },
  pendingSubText: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    marginTop: 4,
    marginBottom: 10,
  },
  pendingItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border + '50',
  },
  pendingItemInfo: {
    flex: 1,
  },
  pendingUserName: {
    ...theme.typography.body,
    fontWeight: '600',
    color: theme.colors.textPrimary,
  },
  pendingMetaText: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  pendingAckButton: {
    minWidth: 124,
  },
  errorContainer: {
    backgroundColor: theme.colors.accentEmergency + '20',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    borderLeftWidth: 4,
    borderLeftColor: theme.colors.accentEmergency,
  },
  errorText: {
    color: theme.colors.accentEmergency,
    fontSize: 14,
  },
  listHeaderWrap: {
    marginBottom: 12,
  },
  listHeaderSubtext: {
    ...theme.typography.small,
    marginTop: 4,
    color: theme.colors.textSecondary,
  },
  userCard: {
    marginBottom: 14,
    borderRadius: theme.radius.lg,
    borderColor: theme.colors.border + '80',
  },
  userInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  userInfo: {
    flex: 1,
    marginRight: 12,
  },
  emailText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  phoneText: {
    fontSize: 13,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  statusBadge: {
    backgroundColor: theme.colors.success,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  statusBadgeEmergency: {
    backgroundColor: theme.colors.accentEmergency,
  },
  statusBadgePending: {
    backgroundColor: theme.colors.primary,
  },
  statusBadgeLinked: {
    backgroundColor: theme.colors.success,
  },
  statusText: {
    color: theme.colors.white,
    fontSize: 12,
    fontWeight: '600',
  },
  emergencyMetaWrap: {
    marginTop: 10,
    marginBottom: 2,
    gap: 2,
  },
  emergencyMetaText: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
  },
  actionRow: {
    flexDirection: 'row',
    marginTop: 14,
    gap: 8,
  },
  actionButton: {
    flex: 1,
  },
  userEvidenceSection: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border + '55',
  },
  userEvidenceHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  userEvidenceTitle: {
    ...theme.typography.body,
    fontWeight: '700',
    flex: 1,
    marginBottom: 10,
    flex: 1,
  },
  inlineAcknowledgeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  evidenceCard: {
    backgroundColor: theme.colors.surfaceAlt,
    borderRadius: theme.radius.sm,
    borderWidth: 1,
    borderColor: theme.colors.border + '70',
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  evidencePreviewType: {
    ...theme.typography.small,
    color: theme.colors.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  evidencePreviewText: {
    ...theme.typography.body,
    color: theme.colors.textPrimary,
    marginTop: 4,
  },
  evidencePreviewMeta: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    marginTop: 4,
  },
  evidenceEmptyText: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
  },
  evidenceResolvedText: {
    ...theme.typography.small,
    color: theme.colors.textSecondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  userListContent: {
    paddingBottom: 30,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  emptyHint: {
    ...theme.typography.small,
    marginTop: 6,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  sirenModalBackdrop: {
    flex: 1,
    backgroundColor: '#00000080',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  sirenModalCard: {
    width: '100%',
    borderRadius: 12,
    padding: 18,
    backgroundColor: theme.colors.white,
    borderWidth: 1,
    borderColor: theme.colors.accentEmergency + '60',
  },
  sirenModalTitle: {
    ...theme.typography.headingMedium,
    color: theme.colors.accentEmergency,
  },
  sirenModalText: {
    ...theme.typography.body,
    color: theme.colors.textSecondary,
    marginTop: 8,
  },
  sirenModalButton: {
    marginTop: 14,
  },
  });

export default GuardianDashboardScreen;
