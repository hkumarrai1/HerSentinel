import React, { useCallback, useMemo, useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { createGlobalStyles } from '../styles/globalStyles';
import { useAppTheme } from '../context/ThemeContext';
import emergencyService from '../services/emergencyService';

const SosTimelineScreen = ({ navigation }) => {
  const { theme } = useAppTheme();
  const globalStyles = useMemo(() => createGlobalStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);

  const [events, setEvents] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResolvingById, setIsResolvingById] = useState({});
  const [error, setError] = useState('');

  const loadTimeline = useCallback(async ({ refreshOnly = false } = {}) => {
    if (!refreshOnly) {
      setIsLoading(true);
    }

    const result = await emergencyService.getMyEmergencyTimeline();

    if (result.success) {
      setEvents(result.events || []);
      setError('');
    } else {
      setEvents([]);
      setError(result.message || 'Unable to load SOS timeline');
    }

    if (!refreshOnly) {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadTimeline();
    }, [loadTimeline]),
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadTimeline({ refreshOnly: true });
    setIsRefreshing(false);
  };

  const handleEndSos = async eventItem => {
    const eventId = eventItem?.id;
    if (!eventId) {
      return;
    }

    setIsResolvingById(previous => ({ ...previous, [eventId]: true }));

    const result = await emergencyService.resolveEmergency(
      eventId,
      'Ended manually from SOS timeline',
    );

    setIsResolvingById(previous => {
      const next = { ...previous };
      delete next[eventId];
      return next;
    });

    if (!result.success) {
      Alert.alert('Unable to End SOS', result.message || 'Please try again.');
      return;
    }

    Alert.alert('SOS Ended', 'The SOS event has been marked as expired.');
    await loadTimeline({ refreshOnly: true });
  };

  const renderTimelineItem = ({ item }) => {
    const isOngoing = item.status === 'ACTIVE';
    const isResolving = !!isResolvingById[item.id];

    return (
      <View style={[globalStyles.card, styles.eventCard]}>
        <View style={styles.headerRow}>
          <Text
            style={[
              styles.statusPill,
              isOngoing ? styles.statusPillOngoing : styles.statusPillExpired,
            ]}
          >
            {isOngoing ? 'ONGOING' : 'EXPIRED'}
          </Text>
          <Text style={styles.triggeredAtText}>
            {item.triggeredAt
              ? new Date(item.triggeredAt).toLocaleString()
              : 'Unknown trigger time'}
          </Text>
        </View>

        <Text style={styles.metaText}>
          Evidence captured: {item.evidenceCount || 0}
        </Text>

        <Text style={styles.metaText}>
          {item.resolvedAt
            ? `Resolved at: ${new Date(item.resolvedAt).toLocaleString()}`
            : 'Not resolved yet'}
        </Text>

        {isOngoing ? (
          <TouchableOpacity
            style={[
              globalStyles.buttonBase,
              globalStyles.buttonDanger,
              styles.endButton,
              isResolving && styles.buttonDisabled,
            ]}
            onPress={() => handleEndSos(item)}
            disabled={isResolving}
          >
            {isResolving ? (
              <ActivityIndicator color={theme.colors.white} size="small" />
            ) : (
              <Text style={globalStyles.buttonTextPrimary}>End This SOS</Text>
            )}
          </TouchableOpacity>
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
        <View style={styles.topRow}>
          <Text style={theme.typography.headingLarge}>SOS Timeline</Text>
          <TouchableOpacity
            style={[globalStyles.buttonBase, globalStyles.buttonOutline]}
            onPress={() => navigation.goBack()}
          >
            <Text style={globalStyles.buttonTextOutline}>Back</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.subtitle}>
          Review your SOS history and end only ongoing incidents.
        </Text>

        {error ? (
          <View style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <FlatList
          data={events}
          keyExtractor={item => (item.id || '').toString()}
          renderItem={renderTimelineItem}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={theme.colors.primary}
            />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.emptyText}>No SOS history yet.</Text>
              <Text style={styles.emptySubText}>
                Trigger SOS from Home to create your first timeline item.
              </Text>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
};

const createStyles = theme =>
  StyleSheet.create({
    centered: {
      justifyContent: 'center',
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 8,
    },
    subtitle: {
      ...theme.typography.body,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.md,
    },
    errorCard: {
      marginBottom: theme.spacing.md,
      backgroundColor: theme.colors.accentEmergency + '18',
      borderLeftWidth: 4,
      borderLeftColor: theme.colors.accentEmergency,
      borderRadius: theme.radius.sm,
      padding: theme.spacing.sm,
    },
    errorText: {
      ...theme.typography.small,
      color: theme.colors.accentEmergency,
    },
    listContent: {
      paddingBottom: theme.spacing.lg,
    },
    eventCard: {
      marginBottom: theme.spacing.sm,
      borderRadius: theme.radius.lg,
    },
    headerRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
    },
    statusPill: {
      ...theme.typography.small,
      fontWeight: '700',
      borderRadius: theme.radius.round,
      paddingHorizontal: 10,
      paddingVertical: 5,
      overflow: 'hidden',
      color: theme.colors.white,
    },
    statusPillOngoing: {
      backgroundColor: theme.colors.accentEmergency,
    },
    statusPillExpired: {
      backgroundColor: theme.colors.success,
    },
    triggeredAtText: {
      ...theme.typography.small,
      color: theme.colors.textSecondary,
      textAlign: 'right',
      flex: 1,
    },
    metaText: {
      ...theme.typography.small,
      color: theme.colors.textSecondary,
      marginBottom: 4,
    },
    endButton: {
      marginTop: 8,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    emptyWrap: {
      alignItems: 'center',
      marginTop: theme.spacing.xl,
      paddingHorizontal: theme.spacing.md,
    },
    emptyText: {
      ...theme.typography.body,
      fontWeight: '600',
      color: theme.colors.textPrimary,
    },
    emptySubText: {
      ...theme.typography.small,
      marginTop: 6,
      color: theme.colors.textSecondary,
      textAlign: 'center',
    },
  });

export default SosTimelineScreen;
