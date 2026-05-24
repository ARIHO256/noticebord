import React, { useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  Alert,
  Dimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';

interface AttachmentPickerProps {
  visible: boolean;
  onCamera: () => Promise<void>;
  onLibrary: () => Promise<void>;
  onClose: () => void;
}

export default function AttachmentPicker({
  visible,
  onCamera,
  onLibrary,
  onClose,
}: AttachmentPickerProps) {
  const { theme } = useTheme();
  const { height } = Dimensions.get('window');

  const handleCamera = useCallback(async () => {
    onClose();
    try {
      await onCamera();
    } catch (error) {
      Alert.alert('Error', 'Failed to access camera');
    }
  }, [onCamera, onClose]);

  const handleLibrary = useCallback(async () => {
    onClose();
    try {
      await onLibrary();
    } catch (error) {
      Alert.alert('Error', 'Failed to access library');
    }
  }, [onLibrary, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={[styles.overlay, { backgroundColor: 'rgba(0, 0, 0, 0.5)' }]}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[
            styles.bottomSheet,
            { backgroundColor: theme.colors.card, maxHeight: height * 0.5 },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              Share Media
            </Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <MaterialCommunityIcons name="close" size={24} color={theme.colors.muted} />
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />

          {/* Options */}
          <View style={styles.optionsContainer}>
            {/* Camera Option */}
            <TouchableOpacity
              style={styles.option}
              onPress={handleCamera}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: theme.colors.primary + '1A' },
                ]}
              >
                <MaterialCommunityIcons
                  name="camera"
                  size={28}
                  color={theme.colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, { color: theme.colors.text }]}>
                  Take Photo or Video
                </Text>
                <Text
                  style={[
                    styles.optionSubtitle,
                    { color: theme.colors.muted },
                  ]}
                >
                  Capture a new photo or video using your camera
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={theme.colors.muted}
              />
            </TouchableOpacity>

            {/* Divider between options */}
            <View style={[styles.optionDivider, { backgroundColor: theme.colors.border }]} />

            {/* Gallery Option */}
            <TouchableOpacity
              style={styles.option}
              onPress={handleLibrary}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.iconContainer,
                  { backgroundColor: theme.colors.accent + '1A' },
                ]}
              >
                <MaterialCommunityIcons
                  name="image-multiple"
                  size={28}
                  color={theme.colors.accent}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.optionTitle, { color: theme.colors.text }]}>
                  Choose from Gallery
                </Text>
                <Text
                  style={[
                    styles.optionSubtitle,
                    { color: theme.colors.muted },
                  ]}
                >
                  Select photos or videos from your library
                </Text>
              </View>
              <MaterialCommunityIcons
                name="chevron-right"
                size={24}
                color={theme.colors.muted}
              />
            </TouchableOpacity>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.cancelText,
                { color: theme.colors.primary },
              ]}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  bottomSheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    marginBottom: Platform.OS === 'android' ? spacing.md : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginBottom: spacing.md,
  },
  optionsContainer: {
    marginBottom: spacing.lg,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  optionSubtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  optionDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: spacing.xs,
  },
  cancelButton: {
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
