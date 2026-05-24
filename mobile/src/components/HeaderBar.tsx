import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, TextInput } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import { useCurrentUserProfile } from '../hooks/useCurrentUserProfile';
import type { RootStackParamList } from '../App';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

// Colors now come from theme

type Props = {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
  left?: React.ReactNode;
  showProfileAvatar?: boolean;
  showSearch?: boolean;
  onSearchPress?: () => void;
  setProfileMenuVisible?: (visible: boolean) => void;
};

export default function HeaderBar({ 
  title, 
  subtitle, 
  left, 
  right, 
  showProfileAvatar = true,
  showSearch = false,
  onSearchPress,
  setProfileMenuVisible,
}: Props) {
  const { theme } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { data: currentUser } = useCurrentUserProfile();
  const canShowAvatar = showProfileAvatar && !right;
  const avatarUri = currentUser?.avatar_url;
  const initials = currentUser?.first_name?.[0] || currentUser?.username?.[0] || '?';

  const isHomeHeader = !title || title === 'Home' || title === 'Bugema Notify';
  if (isHomeHeader) {
    return (
      <View
        style={[
          styles.heroContainer,
          {
            backgroundColor: theme.colors.card,
            borderBottomColor: theme.colors.border,
          },
        ]}
      >
    <View style={styles.heroTopRow}>
      <View style={styles.logoSection}>
        {left || (
          <TouchableOpacity onPress={() => navigation.navigate('Home')} style={styles.logoButton}>
            <Image source={require('../../assets/bugema-official-logo.png')} style={styles.logoImage} />
            <View>
              <Text style={[styles.heroTitle, { color: theme.colors.text }]}>Bugema Notify</Text>
              <Text style={[styles.heroSubtitle, { color: theme.colors.muted }]}>Curated campus buzz</Text>
            </View>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.actionGroup}>
        <TouchableOpacity
          onPress={() => navigation.navigate('Notifications')}
          style={[styles.actionButton, { backgroundColor: theme.colors.surface }]}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="bell-ring-outline" size={20} color={theme.colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => navigation.navigate('Profile')}
          style={[
            styles.actionButton,
            { backgroundColor: theme.colors.surface, padding: 0, borderRadius: 18, width: 40, height: 40 },
          ]}
          activeOpacity={0.7}
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.heroAvatar} />
          ) : (
            <View style={[styles.heroAvatar, { backgroundColor: theme.colors.surface }]}>
              <Text style={[styles.profileInitials, { color: theme.colors.text }]}>
                {initials}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
        <TouchableOpacity
          onPress={onSearchPress || (() => navigation.navigate('SearchTab'))}
          style={[
            styles.heroSearch,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="magnify" size={20} color={theme.colors.muted} />
          <Text style={[styles.searchText, { color: theme.colors.muted }]}>Search notices, departments, users</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Standard header for other screens
  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.card,
          borderBottomColor: theme.colors.border,
        },
      ]}
    >
      <View style={styles.side}>{left}</View>
      <View style={styles.titleWrapper}>
        <Text
          style={[
            styles.title,
            {
              color: theme.colors.text,
            },
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {subtitle && (
          <Text
            style={[
              styles.subtitle,
              {
                color: theme.colors.muted,
              },
            ]}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        )}
      </View>
      <View style={[styles.side, styles.sideRight]}>
        {right ??
          (canShowAvatar ? (
            <TouchableOpacity
              onPress={() => navigation.navigate('Profile')}
              activeOpacity={0.85}
              style={styles.profileButton}
            >
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={styles.profileImage} />
              ) : (
                <View style={[styles.profileImage, { backgroundColor: theme.colors.surface }]}>
                  <Text style={[styles.profileInitials, { color: theme.colors.text }]}>{initials}</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : null)}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  heroContainer: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  logoSection: {
    minWidth: 120,
    flex: 1,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionButton: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
    elevation: 1,
  },
  heroSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    borderWidth: 1,
  },
  searchText: {
    fontSize: 14,
    flex: 1,
  },
  logoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  logoImage: {
    width: 36,
    height: 36,
    borderRadius: 10,
    overflow: 'hidden',
  },
  heroAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    overflow: 'hidden',
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 2,
  },
  titleWrapper: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  side: {
    minWidth: 72,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexShrink: 0,
  },
  sideRight: {
    justifyContent: 'flex-end',
  },
  profileButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  profileImage: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  profileInitials: {
    fontSize: 14,
    fontWeight: '700',
  },
});
