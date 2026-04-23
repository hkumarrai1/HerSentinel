import React, { useState, useEffect, useMemo } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  ActivityIndicator,
  FlatList,
  Alert,
} from 'react-native';
import { createGlobalStyles } from '../styles/globalStyles';
import { useAppTheme } from '../context/ThemeContext';
import guardianService from '../services/guardianService';

const GuardianManagementScreen = () => {
  const { theme } = useAppTheme();
  const globalStyles = useMemo(() => createGlobalStyles(theme), [theme]);
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [guardians, setGuardians] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [guardianEmail, setGuardianEmail] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    loadGuardians();
  }, []);

  const loadGuardians = async () => {
    setIsLoading(true);
    const result = await guardianService.getGuardians();
    if (result.success) {
      setGuardians(result.guardians);
    } else {
      setError(result.message);
    }
    setIsLoading(false);
  };

  const handleAddGuardian = async () => {
    if (!guardianEmail.trim()) {
      setError('Please enter a guardian email');
      return;
    }

    setIsAdding(true);
    const result = await guardianService.addGuardian(guardianEmail);
    setIsAdding(false);

    if (result.success) {
      setGuardians([...guardians, result.guardian]);
      setGuardianEmail('');
      setError('');
      Alert.alert('Success', 'Guardian added successfully! 👍');
    } else {
      setError(result.message);
    }
  };

  const handleRemoveGuardian = async guardianId => {
    Alert.alert(
      'Remove Guardian',
      'Are you sure you want to remove this guardian?',
      [
        { text: 'Cancel', onPress: () => {} },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            const result = await guardianService.removeGuardian(guardianId);
            if (result.success) {
              setGuardians(
                guardians.filter(
                  g => g._id.toString() !== guardianId.toString(),
                ),
              );
              setError('');
              Alert.alert('Success', 'Guardian removed successfully! 👍');
            } else {
              setError(result.message);
            }
          },
        },
      ],
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={globalStyles.safeArea}>
        <View style={[globalStyles.container, { justifyContent: 'center' }]}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={globalStyles.safeArea}>
      <View style={globalStyles.container}>
        <View style={globalStyles.section}>
          <Text style={theme.typography.headingLarge}>Your Guardians</Text>
          <Text style={[theme.typography.body, styles.subtitle]}>
            {guardians.length} guardian{guardians.length !== 1 ? 's' : ''}
          </Text>
          <Text style={styles.helperText}>
            Only users registered as Guardian accounts can be added.
          </Text>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={globalStyles.section}>
          <TextInput
            style={globalStyles.input}
            placeholder="Add guardian by email"
            placeholderTextColor={theme.colors.textSecondary}
            autoCapitalize="none"
            keyboardType="email-address"
            value={guardianEmail}
            onChangeText={setGuardianEmail}
            editable={!isAdding}
          />
          <TouchableOpacity
            style={[
              globalStyles.buttonBase,
              globalStyles.buttonPrimary,
              isAdding && styles.buttonDisabled,
            ]}
            onPress={handleAddGuardian}
            disabled={isAdding}
          >
            {isAdding ? (
              <ActivityIndicator color={theme.colors.white} size="small" />
            ) : (
              <Text style={globalStyles.buttonTextPrimary}>Add Guardian</Text>
            )}
          </TouchableOpacity>
        </View>

        <FlatList
          data={guardians}
          keyExtractor={item => item._id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={[globalStyles.card, styles.guardianCard]}>
              <View style={styles.guardianInfo}>
                <Text style={theme.typography.headingMedium}>{item.name}</Text>
                <Text style={styles.emailText}>{item.email}</Text>
                {item.phone ? (
                  <Text style={styles.phoneText}>{item.phone}</Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={[
                  globalStyles.buttonBase,
                  globalStyles.buttonDanger,
                  styles.removeButton,
                ]}
                onPress={() => handleRemoveGuardian(item._id)}
              >
                <Text style={globalStyles.buttonTextPrimary}>Remove</Text>
              </TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>
                No guardians added yet. Add one to get started! 👤
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
  subtitle: {
    marginTop: 8,
    color: theme.colors.textSecondary,
  },
  helperText: {
    ...theme.typography.small,
    marginTop: 4,
    color: theme.colors.textSecondary,
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
  guardianCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  guardianInfo: {
    flex: 1,
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
  removeButton: {
    marginLeft: 12,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
  });

export default GuardianManagementScreen;
