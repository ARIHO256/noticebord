import React, { useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';

type Feeling = {
  id: string;
  emoji: string;
  label: string;
  icon: string;
};

const FEELINGS: Feeling[] = [
  { id: 'happy', emoji: '😊', label: 'Happy', icon: 'emoticon-happy' },
  { id: 'loved', emoji: '🥰', label: 'Loved', icon: 'heart' },
  { id: 'blessed', emoji: '🙏', label: 'Blessed', icon: 'hands-pray' },
  { id: 'grateful', emoji: '🙌', label: 'Grateful', icon: 'hand-wave' },
  { id: 'excited', emoji: '🤩', label: 'Excited', icon: 'star' },
  { id: 'proud', emoji: '😎', label: 'Proud', icon: 'trophy' },
  { id: 'thankful', emoji: '💝', label: 'Thankful', icon: 'gift' },
  { id: 'hopeful', emoji: '✨', label: 'Hopeful', icon: 'sparkles' },
  { id: 'motivated', emoji: '💪', label: 'Motivated', icon: 'arm-flex' },
  { id: 'peaceful', emoji: '☮️', label: 'Peaceful', icon: 'peace' },
  { id: 'confident', emoji: '😌', label: 'Confident', icon: 'account-check' },
  { id: 'energetic', emoji: '⚡', label: 'Energetic', icon: 'lightning-bolt' },
];

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (feeling: Feeling) => void;
};

export default function FeelingPicker({ visible, onClose, onSelect }: Props) {
  const { theme } = useTheme();

  const handleSelect = (feeling: Feeling) => {
    onSelect(feeling);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.backdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[
            styles.container,
            {
              backgroundColor: theme.colors.card,
              borderColor: theme.colors.border,
            },
          ]}
          onStartShouldSetResponder={() => true}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.colors.text }]}>
              How are you feeling?
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons name="close" size={24} color={theme.colors.muted} />
            </TouchableOpacity>
          </View>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.grid}
            showsVerticalScrollIndicator={false}
          >
            {FEELINGS.map((feeling) => (
              <TouchableOpacity
                key={feeling.id}
                style={[
                  styles.feelingItem,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                  },
                ]}
                onPress={() => handleSelect(feeling)}
                activeOpacity={0.7}
              >
                <Text style={styles.emoji}>{feeling.emoji}</Text>
                <Text style={[styles.label, { color: theme.colors.text }]}>
                  {feeling.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  container: {
    width: '100%',
    maxWidth: 400,
    maxHeight: '80%',
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: spacing.xs,
  },
  scrollView: {
    flex: 1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.md,
    gap: spacing.sm,
  },
  feelingItem: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.sm,
    gap: spacing.xs,
  },
  emoji: {
    fontSize: 32,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});






