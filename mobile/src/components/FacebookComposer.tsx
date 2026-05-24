import React, { useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View, ActionSheetIOS, Platform, Alert } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { spacing } from '../theme';
import FeelingPicker from './FeelingPicker';

type Props = {
  avatarUrl?: string | null;
  placeholder?: string;
  onPress: () => void;
  onPhotoSelected?: (uri: string) => void;
  onVideoSelected?: (uri: string) => void;
  onFeelingSelected?: (feeling: string) => void;
};

export default function FacebookComposer({
  avatarUrl,
  placeholder = "What's on your mind?",
  onPress,
  onPhotoSelected,
  onVideoSelected,
  onFeelingSelected,
}: Props) {
  const { theme } = useTheme();
  const { showSuccess } = useToast();
  const fallbackAvatar = require('../../assets/bu-logo.png');
  const avatarSource = avatarUrl ? { uri: avatarUrl } : fallbackAvatar;
  const dynamicStyles = getStyles(theme);
  const [showFeelingPicker, setShowFeelingPicker] = useState(false);

  const requestMediaPermission = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow media access to attach photos or videos.');
      return false;
    }
    return true;
  };

  const requestCameraPermission = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow camera access to take photos or videos.');
      return false;
    }
    return true;
  };

  const handlePhotoPress = async () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take Photo', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 0) return;

          if (buttonIndex === 1) {
            if (!(await requestCameraPermission())) return;
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              quality: 0.9,
              allowsEditing: false,
            });
            if (!result.canceled && result.assets[0]?.uri && onPhotoSelected) {
              onPhotoSelected(result.assets[0].uri);
              showSuccess('Photo selected!');
            }
          } else if (buttonIndex === 2) {
            if (!(await requestMediaPermission())) return;
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.9,
              allowsEditing: false,
            });
            if (!result.canceled && result.assets[0]?.uri && onPhotoSelected) {
              onPhotoSelected(result.assets[0].uri);
              showSuccess('Photo selected!');
            }
          }
        }
      );
    } else {
      Alert.alert(
        'Select Photo',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Take Photo',
            onPress: async () => {
              if (!(await requestCameraPermission())) return;
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                quality: 0.9,
                allowsEditing: false,
              });
              if (!result.canceled && result.assets[0]?.uri && onPhotoSelected) {
                onPhotoSelected(result.assets[0].uri);
              }
            },
          },
          {
            text: 'Choose from Library',
            onPress: async () => {
              if (!(await requestMediaPermission())) return;
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.9,
                allowsEditing: false,
              });
              if (!result.canceled && result.assets[0]?.uri && onPhotoSelected) {
                onPhotoSelected(result.assets[0].uri);
              }
            },
          },
        ]
      );
    }
  };

  const handleVideoPress = async () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Record Video', 'Choose from Library'],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 0) return;

          if (buttonIndex === 1) {
            if (!(await requestCameraPermission())) return;
            const result = await ImagePicker.launchCameraAsync({
              mediaTypes: ['videos'],
              quality: 0.9,
              videoMaxDuration: 60,
            });
            if (!result.canceled && result.assets[0]?.uri && onVideoSelected) {
              onVideoSelected(result.assets[0].uri);
              showSuccess('Video selected!');
            }
          } else if (buttonIndex === 2) {
            if (!(await requestMediaPermission())) return;
            const result = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['videos'],
              quality: 0.9,
              videoMaxDuration: 60,
            });
            if (!result.canceled && result.assets[0]?.uri && onVideoSelected) {
              onVideoSelected(result.assets[0].uri);
              showSuccess('Video selected!');
            }
          }
        }
      );
    } else {
      Alert.alert(
        'Select Video',
        'Choose an option',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Record Video',
            onPress: async () => {
              if (!(await requestCameraPermission())) return;
              const result = await ImagePicker.launchCameraAsync({
                mediaTypes: ['videos'],
                quality: 0.9,
                videoMaxDuration: 60,
              });
              if (!result.canceled && result.assets[0]?.uri && onVideoSelected) {
                onVideoSelected(result.assets[0].uri);
              }
            },
          },
          {
            text: 'Choose from Library',
            onPress: async () => {
              if (!(await requestMediaPermission())) return;
              const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['videos'],
                quality: 0.9,
                videoMaxDuration: 60,
              });
              if (!result.canceled && result.assets[0]?.uri && onVideoSelected) {
                onVideoSelected(result.assets[0].uri);
              }
            },
          },
        ]
      );
    }
  };

  const handleFeelingPress = () => {
    setShowFeelingPicker(true);
  };

  const handleFeelingSelect = (feeling: { id: string; emoji: string; label: string }) => {
    if (onFeelingSelected) {
      onFeelingSelected(`${feeling.emoji} ${feeling.label}`);
      showSuccess(`Feeling: ${feeling.emoji} ${feeling.label}`);
    }
  };

  return (
    <View
      style={[
        dynamicStyles.wrapper,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.shadow,
        },
      ]}
    >
      <View style={dynamicStyles.row}>
        <Image source={avatarSource} style={dynamicStyles.avatar} />
        <TouchableOpacity
          onPress={onPress}
          style={[
            dynamicStyles.placeholderButton,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
          activeOpacity={0.7}
        >
          <Text style={[dynamicStyles.placeholder, { color: theme.colors.muted }]}>{placeholder}</Text>
        </TouchableOpacity>
        <View style={dynamicStyles.iconRow}>
          <TouchableOpacity
            onPress={handleVideoPress}
            style={[dynamicStyles.iconButton, { borderColor: theme.colors.surface }]}
          >
            <MaterialCommunityIcons name="video" size={20} color={theme.colors.accent} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handlePhotoPress}
            style={[dynamicStyles.iconButton, { borderColor: theme.colors.surface }]}
          >
            <MaterialCommunityIcons name="image-multiple" size={20} color={theme.colors.success} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleFeelingPress}
            style={[dynamicStyles.iconButton, { borderColor: theme.colors.surface }]}
          >
            <MaterialCommunityIcons name="emoticon-happy-outline" size={20} color={theme.colors.warning} />
          </TouchableOpacity>
        </View>
      </View>
      <FeelingPicker
        visible={showFeelingPicker}
        onClose={() => setShowFeelingPicker(false)}
        onSelect={handleFeelingSelect}
      />
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  wrapper: {
    marginTop: 0,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderRadius: 20,
    padding: spacing.sm,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 12,
    elevation: 3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: spacing.sm,
  },
  placeholderButton: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 42,
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  placeholder: {
    fontSize: 15,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.xs,
    borderWidth: 1,
  },
});
