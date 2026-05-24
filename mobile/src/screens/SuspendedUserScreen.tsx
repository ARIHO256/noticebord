import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { api } from '../api/client';
import { spacing } from '../theme';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext';
import Card from '../components/Card';
import PrimaryButton from '../components/PrimaryButton';

export default function SuspendedUserScreen() {
  const { theme } = useTheme();
  const { signOut } = useContext(AuthContext);
  const [appealText, setAppealText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitAppeal = async () => {
    if (!appealText.trim()) {
      Alert.alert('Error', 'Please provide a reason for your appeal.');
      return;
    }

    if (appealText.trim().length < 20) {
      Alert.alert('Error', 'Please provide a more detailed explanation (at least 20 characters).');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/users/appeal/', {
        message: appealText.trim(),
      });
      Alert.alert(
        'Appeal Submitted',
        'Your appeal has been submitted successfully. An administrator will review it and contact you if necessary.',
        [{ text: 'OK' }]
      );
      setAppealText('');
    } catch (error: any) {
      Alert.alert(
        'Error',
        error?.response?.data?.detail || 'Failed to submit appeal. Please try again later.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            await signOut();
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.iconContainer}>
          <View style={[styles.iconCircle, { backgroundColor: '#DC262620' }]}>
            <MaterialCommunityIcons name="account-cancel" size={64} color="#DC2626" />
          </View>
        </View>

        <Text style={[styles.title, { color: theme.colors.text }]}>
          Account Temporarily Suspended
        </Text>

        <Card style={styles.messageCard}>
          <Text style={[styles.messageText, { color: theme.colors.text }]}>
            Your account has been temporarily suspended due to a violation of community guidelines.
          </Text>
          <View style={styles.spacer} />
          <Text style={[styles.messageText, { color: theme.colors.text }]}>
            If you believe this was a mistake, please contact the administrator by submitting an appeal below.
          </Text>
        </Card>

        <Card style={styles.appealCard}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Submit an Appeal
          </Text>
          <Text style={[styles.sectionDescription, { color: theme.colors.muted }]}>
            Please provide a detailed explanation of why you believe your account suspension was a mistake.
          </Text>

          <View style={styles.textAreaContainer}>
            <TextInput
              style={[
                styles.textArea,
                {
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text,
                  borderColor: theme.colors.border,
                },
              ]}
              placeholder="Explain why you believe this suspension was a mistake..."
              placeholderTextColor={theme.colors.muted}
              multiline
              numberOfLines={8}
              value={appealText}
              onChangeText={setAppealText}
              textAlignVertical="top"
              editable={!submitting}
            />
            <Text style={[styles.charCount, { color: theme.colors.muted }]}>
              {appealText.length} characters (minimum 20)
            </Text>
          </View>

          <PrimaryButton
            title={submitting ? 'Submitting...' : 'Submit Appeal'}
            onPress={handleSubmitAppeal}
            disabled={submitting || appealText.trim().length < 20}
          />
        </Card>

        <TouchableOpacity
          style={[styles.signOutButton, { borderColor: theme.colors.border }]}
          onPress={handleSignOut}
        >
          <MaterialCommunityIcons name="logout" size={20} color={theme.colors.text} />
          <Text style={[styles.signOutText, { color: theme.colors.text }]}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.xl,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  messageCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  spacer: {
    height: spacing.md,
  },
  appealCard: {
    marginBottom: spacing.lg,
    padding: spacing.lg,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: spacing.sm,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: spacing.md,
    lineHeight: 20,
  },
  textAreaContainer: {
    marginBottom: spacing.md,
  },
  textArea: {
    minHeight: 150,
    borderRadius: 12,
    borderWidth: 1,
    padding: spacing.md,
    fontSize: 15,
    marginBottom: spacing.xs,
  },
  charCount: {
    fontSize: 12,
    textAlign: 'right',
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
    gap: spacing.sm,
    marginTop: spacing.md,
  },
  signOutText: {
    fontSize: 15,
    fontWeight: '600',
  },
});


