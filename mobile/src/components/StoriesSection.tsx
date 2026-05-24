import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';

type Story = {
  id: string;
  imageUri?: string;
  name: string;
  badge?: number;
  isAddStory?: boolean;
};

type Props = {
  stories?: Story[];
};

const DEFAULT_STORIES: Story[] = [
  {
    id: 'add',
    name: '4 recent photos',
    isAddStory: true,
  },
  {
    id: '1',
    name: 'Charlotte Uwase',
    badge: 2,
  },
  {
    id: '2',
    name: 'Prudence Nuwahereza',
    badge: 1,
  },
  {
    id: '3',
    name: 'Anthe Nats Frien',
  },
];

export default function StoriesSection({ stories = DEFAULT_STORIES }: Props) {
  const { theme } = useTheme();

  const renderStory = (story: Story, index: number) => {
    const isAddStory = story.isAddStory;
    
    return (
      <TouchableOpacity
        key={story.id}
        style={[
          styles.storyCard,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
        activeOpacity={0.8}
      >
        {isAddStory ? (
          <>
            <View style={styles.storyImageContainer}>
              <View style={[styles.storyImagePlaceholder, { backgroundColor: theme.colors.border }]} />
              <View style={[styles.addStoryButton, { backgroundColor: theme.colors.primary }]}>
                <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
              </View>
            </View>
            <Text style={[styles.storyName, { color: theme.colors.text }]} numberOfLines={1}>
              {story.name}
            </Text>
          </>
        ) : (
          <>
            <View style={styles.storyImageContainer}>
              {story.imageUri ? (
                <Image source={{ uri: story.imageUri }} style={styles.storyImage} />
              ) : (
                <View style={[styles.storyImagePlaceholder, { backgroundColor: theme.colors.border }]} />
              )}
              {story.badge && story.badge > 0 && (
                <View style={[styles.badge, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.badgeText}>{story.badge}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.storyName, { color: theme.colors.text }]} numberOfLines={1}>
              {story.name}
            </Text>
          </>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.card, borderBottomColor: theme.colors.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {stories.map((story, index) => renderStory(story, index))}
      </ScrollView>
    </View>
  );
}

const HAIRLINE_WIDTH = StyleSheet.hairlineWidth;

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.md,
    borderBottomWidth: HAIRLINE_WIDTH,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  storyCard: {
    width: 100,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  storyImageContainer: {
    width: '100%',
    height: 160,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  storyImagePlaceholder: {
    width: '100%',
    height: '100%',
  },
  addStoryButton: {
    position: 'absolute',
    bottom: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  badge: {
    position: 'absolute',
    top: 8,
    left: 8,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  storyName: {
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.xs,
    textAlign: 'center',
  },
});

