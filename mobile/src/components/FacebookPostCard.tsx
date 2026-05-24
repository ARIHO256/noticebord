import React, { useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import { getNoticeCategoryLabel, getNoticePriorityLabel, getNoticePriorityColor } from '../constants/notices';
import AttachmentMediaPlayer from './AttachmentMediaPlayer';
import FacebookPhotoViewer from './FacebookPhotoViewer';

export type NoticeAttachment = {
  id: number;
  url: string;
  file_type?: string;
  original_name?: string | null;
};

export type FacebookPostCardProps = {
  id: number;
  title: string;
  description: string;
  created_by_username: string;
  created_by_full_name?: string;
  created_by_avatar?: string | null;
  created_at: string;
  department?: string;
  views_count?: number;
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
  is_favorited?: boolean;
  is_pinned?: boolean;
  priority?: string | null;
  expires_at?: string | null;
  attachments?: NoticeAttachment[];
  category?: string | null;
  onPress: () => void;
  onLikeToggle: () => Promise<void> | void;
  onFavoriteToggle: () => Promise<void> | void;
  onCommentPress: () => void;
  onAuthorPress?: () => void;
};

// Colors now come from theme

export default function FacebookPostCard({
  id,
  title,
  description,
  created_by_full_name,
  created_by_username,
  created_by_avatar,
  created_at,
  department,
  views_count,
  likes_count,
  comments_count,
  is_liked,
  is_favorited,
  is_pinned,
  priority,
  expires_at,
  attachments,
  category,
  onPress,
  onLikeToggle,
  onFavoriteToggle,
  onCommentPress,
  onAuthorPress,
}: FacebookPostCardProps) {
  const { theme } = useTheme();
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [showFullText, setShowFullText] = useState(false);

  const displayName = created_by_full_name || created_by_username;
  const media = attachments?.[0];
  const imageAttachments = attachments?.filter((att) => att.file_type === 'image' || !att.file_type) || [];
  const hasMultipleImages = imageAttachments.length > 1;
  const categoryLabel = getNoticeCategoryLabel(category);
  const priorityLabel = getNoticePriorityLabel(priority);
  const priorityColor = getNoticePriorityColor(priority);
  const isExpired = expires_at ? new Date(expires_at) < new Date() : false;
  const daysUntilExpiry = expires_at ? Math.ceil((new Date(expires_at).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null;
  const [isLiking, setIsLiking] = useState(false);
  const [isFavoriting, setIsFavoriting] = useState(false);

  const handleAttachmentPress = (url?: string) => {
    if (url) {
      Linking.openURL(url);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    if (diffDays < 30) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const handleLikePress = async () => {
    setIsLiking(true);
    try {
      await onLikeToggle();
    } finally {
      setIsLiking(false);
    }
  };

  const handleFavoritePress = async () => {
    setIsFavoriting(true);
    try {
      await onFavoriteToggle();
    } finally {
      setIsFavoriting(false);
    }
  };

  // Determine if text should be truncated
  const fullText = title ? `${title}\n\n${description}` : description;
  const shouldTruncate = fullText.length > 200;
  const displayText = shouldTruncate && !showFullText 
    ? fullText.substring(0, 200) + '...' 
    : fullText;

  const styles = getStyles(theme);

  const renderMedia = () => {
    if (!media) return null;

    if (media.file_type === 'image' || !media.file_type) {
      // Show grid for multiple images (Facebook style)
      if (hasMultipleImages) {
        return (
          <View style={[styles.mediaContainer, { aspectRatio: 1, height: 400, position: 'relative' }]}>
            {imageAttachments.slice(0, 4).map((att, index) => {
              const isLast = index === 3 && imageAttachments.length > 4;
              const remainingCount = imageAttachments.length - 4;
              
              return (
                <TouchableOpacity
                  key={att.id}
                  activeOpacity={0.95}
                  onPress={() => {
                    const foundIndex = imageAttachments.findIndex((a) => a.id === att.id);
                    setPreviewIndex(foundIndex >= 0 ? foundIndex : 0);
                    setPreviewVisible(true);
                  }}
                  style={[
                    styles.gridImageContainer,
                    index === 0 && styles.gridImageFirst,
                    index === 1 && styles.gridImageSecond,
                    index === 2 && styles.gridImageThird,
                    index === 3 && styles.gridImageFourth,
                  ]}
                >
                  <Image 
                    source={{ uri: att.url }} 
                    style={styles.gridImage}
                    resizeMode="cover"
                  />
                  {isLast && (
                    <View style={styles.remainingOverlay}>
                      <Text style={styles.remainingText}>+{remainingCount}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        );
      }
      
      // Single image - Full width, no rounded corners (Facebook style)
      return (
        <TouchableOpacity
          onPress={() => {
            setPreviewIndex(0);
            setPreviewVisible(true);
          }}
          style={styles.mediaContainer}
          activeOpacity={1}
        >
          <Image 
            source={{ uri: media.url }} 
            style={styles.mediaImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
      );
    }

    if (media.file_type === 'video' || media.file_type === 'audio') {
      return (
        <View style={[styles.mediaContainer, { backgroundColor: theme.colors.surface }]}>
          <AttachmentMediaPlayer
            uri={media.url}
            style={styles.mediaVideo}
            showControls
            contentFit="contain"
          />
        </View>
      );
    }

    return (
      <TouchableOpacity
        onPress={() => handleAttachmentPress(media.url)}
        style={[
          styles.document,
          {
            backgroundColor: theme.colors.surface,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <MaterialCommunityIcons
          name="file-document-outline"
          size={20}
          color={theme.colors.primary}
        />
        <Text
          style={{
            color: theme.colors.primary,
            fontWeight: '600',
            marginLeft: spacing.sm,
          }}
        >
          {media.original_name || 'View attachment'}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.container,
          {
            backgroundColor: theme.colors.card,
            elevation: pressed ? 8 : 4,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
          pressed && { opacity: 0.95 },
        ]}
      >
        {/* Enhanced Header with Department Badge */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <TouchableOpacity
              onPress={onAuthorPress}
              activeOpacity={0.7}
              style={styles.avatarContainer}
            >
              {created_by_avatar ? (
                <Image source={{ uri: created_by_avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, { backgroundColor: theme.colors.surface }]}>
                  <Text style={[styles.avatarInitials, { color: theme.colors.text }]}>
                    {(displayName || 'U').slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.headerText}>
              <TouchableOpacity onPress={onAuthorPress} activeOpacity={0.7}>
                <Text style={[styles.name, { color: theme.colors.text }]}>
                  {displayName}
                </Text>
              </TouchableOpacity>
              <View style={styles.metaRow}>
                <Text style={[styles.meta, { color: theme.colors.muted }]}>
                  {formatTime(created_at)}
                </Text>
                {department && (
                  <>
                    <Text style={[styles.metaDot, { color: theme.colors.muted }]}> · </Text>
                    <View style={[styles.departmentBadge, { backgroundColor: `${theme.colors.primary}20` }]}>
                      <MaterialCommunityIcons name="briefcase" size={10} color={theme.colors.primary} />
                      <Text style={[styles.departmentText, { color: theme.colors.primary }]} numberOfLines={1}>
                        {department}
                      </Text>
                    </View>
                  </>
                )}
              </View>
            </View>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity 
              onPress={handleFavoritePress}
              disabled={isFavoriting}
              style={styles.favoriteButton}
            >
              <MaterialCommunityIcons 
                name={is_favorited ? 'bookmark' : 'bookmark-outline'} 
                size={20} 
                color={is_favorited ? '#FFB800' : theme.colors.muted} 
              />
            </TouchableOpacity>
            <TouchableOpacity style={styles.moreButton}>
              <MaterialCommunityIcons name="dots-horizontal" size={20} color={theme.colors.muted} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Category & Priority Badges */}
        {(categoryLabel || priority || expires_at || is_pinned) && (
          <View style={styles.badgesContainer}>
            {is_pinned && (
              <View style={[styles.badge, { backgroundColor: theme.colors.primary + '15' }]}>
                <MaterialCommunityIcons name="pin" size={12} color={theme.colors.primary} />
                <Text style={[styles.badgeText, { color: theme.colors.primary }]}>Pinned</Text>
              </View>
            )}
            {categoryLabel && (
              <View style={[styles.badge, { backgroundColor: `${theme.colors.primary}15` }]}>
                <MaterialCommunityIcons name="tag" size={12} color={theme.colors.primary} />
                <Text style={[styles.badgeText, { color: theme.colors.primary }]}>
                  {categoryLabel}
                </Text>
              </View>
            )}
            {priority && priority !== 'normal' && (
              <View style={[styles.badge, { backgroundColor: priorityColor + '15' }]}>
                <MaterialCommunityIcons name={priority === 'urgent' ? 'alert-circle' : 'information'} size={12} color={priorityColor} />
                <Text style={[styles.badgeText, { color: priorityColor }]}>{priorityLabel}</Text>
              </View>
            )}
            {expires_at && daysUntilExpiry !== null && (
              <View style={[styles.badge, { backgroundColor: daysUntilExpiry <= 3 ? theme.colors.danger + '15' : theme.colors.border }]}>
                <MaterialCommunityIcons name="clock-outline" size={12} color={daysUntilExpiry <= 3 ? theme.colors.danger : theme.colors.muted} />
                <Text style={[styles.badgeText, { color: daysUntilExpiry <= 3 ? theme.colors.danger : theme.colors.muted }]}>
                  {isExpired ? 'Expired' : daysUntilExpiry <= 0 ? 'Today' : `${daysUntilExpiry}d`}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Content - Title and Description */}
        <View style={styles.content}>
          <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={2}>
            {title}
          </Text>
          <Text style={[styles.description, { color: theme.colors.text }]} numberOfLines={3}>
            {description}
          </Text>
        </View>

        {/* Media */}
        {renderMedia()}

        {/* Enhanced Engagement Stats */}
        {((likes_count ?? 0) > 0 || (comments_count ?? 0) > 0 || (views_count ?? 0) > 0) && (
          <View style={[styles.engagementBar, { borderTopColor: theme.colors.border }]}>
            <View style={styles.engagementLeft}>
              {(likes_count ?? 0) > 0 && (
                <View style={styles.reactionsContainer}>
                  <View style={styles.reactionIcons}>
                    <View style={[styles.reactionIcon, { backgroundColor: '#1877F2' }]}>
                      <MaterialCommunityIcons name="thumb-up" size={14} color="#fff" />
                    </View>
                  </View>
                  <Text style={[styles.engagementText, { color: theme.colors.muted }]}>
                    {likes_count ?? 0}
                  </Text>
                </View>
              )}
            </View>
            <View style={styles.engagementRight}>
              {(comments_count ?? 0) > 0 && (
                <TouchableOpacity onPress={onCommentPress}>
                  <Text style={[styles.engagementText, { color: theme.colors.muted }]}>
                    {comments_count ?? 0} {(comments_count ?? 0) === 1 ? 'comment' : 'comments'}
                  </Text>
                </TouchableOpacity>
              )}
              {(views_count ?? 0) > 0 && (
                <>
                  {(comments_count ?? 0) > 0 && (
                    <Text style={[styles.engagementText, { color: theme.colors.muted, marginHorizontal: 8 }]}>·</Text>
                  )}
                  <Text style={[styles.engagementText, { color: theme.colors.muted }]}>
                    {views_count ?? 0} {(views_count ?? 0) === 1 ? 'view' : 'views'}
                  </Text>
                </>
              )}
            </View>
          </View>
        )}

        {/* Advanced Action Buttons with More Options */}
        <View style={[styles.actions, { borderTopColor: theme.colors.border }]}>
          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              pressed && { backgroundColor: `${theme.colors.primary}10` },
            ]}
            onPress={handleLikePress}
            disabled={isLiking}
          >
            <MaterialCommunityIcons
              name={is_liked ? 'thumb-up' : 'thumb-up-outline'}
              size={20}
              color={is_liked ? '#1877F2' : theme.colors.muted}
            />
            <Text
              style={[
                styles.actionLabel,
                {
                  color: is_liked ? '#1877F2' : theme.colors.muted,
                  fontWeight: is_liked ? '700' : '500',
                },
              ]}
            >
              Like
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              pressed && { backgroundColor: `${theme.colors.primary}10` },
            ]}
            onPress={onCommentPress}
          >
            <MaterialCommunityIcons
              name="comment-outline"
              size={20}
              color={theme.colors.muted}
            />
            <Text style={[styles.actionLabel, { color: theme.colors.muted }]}>
              Comment
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.actionButton,
              pressed && { backgroundColor: `${theme.colors.primary}10` },
            ]}
            onPress={() => onPress()}
          >
            <MaterialCommunityIcons
              name="share-variant-outline"
              size={20}
              color={theme.colors.muted}
            />
            <Text style={[styles.actionLabel, { color: theme.colors.muted }]}>
              Share
            </Text>
          </Pressable>
        </View>
      </Pressable>

      <FacebookPhotoViewer
        visible={previewVisible}
        attachments={attachments || []}
        initialIndex={previewIndex}
        authorName={displayName}
        authorAvatar={created_by_avatar}
        postTime={created_at}
        noticeId={id}
        likesCount={likes_count}
        commentsCount={comments_count}
        isLiked={is_liked}
        onClose={() => setPreviewVisible(false)}
        onLikeToggle={onLikeToggle}
        onCommentPress={onCommentPress}
      />
    </>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: {
    marginVertical: 0,
    marginHorizontal: 0,
    borderWidth: 0,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: theme.colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarContainer: {
    marginRight: spacing.sm,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarInitials: {
    fontSize: 16,
    fontWeight: '700',
  },
  headerText: {
    flex: 1,
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
    color: theme.colors.text,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  meta: {
    fontSize: 13,
    color: theme.colors.muted,
  },
  metaDot: {
    fontSize: 13,
    color: theme.colors.muted,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  favoriteButton: {
    padding: spacing.xs,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  moreButton: {
    padding: spacing.xs,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
  },
  departmentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    gap: 3,
  },
  departmentText: {
    fontSize: 11,
    fontWeight: '600',
    maxWidth: 80,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    marginBottom: spacing.xs,
    lineHeight: 20,
  },
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  content: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.text,
  },
  seeMoreButton: {
    marginTop: spacing.xs,
  },
  seeMoreText: {
    fontSize: 15,
    fontWeight: '400',
    color: theme.colors.muted,
  },
  mediaContainer: {
    marginTop: 0,
    marginBottom: 0,
    width: '100%',
  },
  mediaImage: {
    width: '100%',
    aspectRatio: 1,
    maxHeight: 600,
    minHeight: 300,
    backgroundColor: theme.colors.surface,
  },
  gridImageContainer: {
    position: 'absolute',
    overflow: 'hidden',
  },
  gridImageFirst: {
    top: 0,
    left: 0,
    width: '50%',
    height: '50%',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  gridImageSecond: {
    top: 0,
    right: 0,
    width: '50%',
    height: '50%',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  gridImageThird: {
    bottom: 0,
    left: 0,
    width: '50%',
    height: '50%',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  gridImageFourth: {
    bottom: 0,
    right: 0,
    width: '50%',
    height: '50%',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  remainingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  remainingText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  mediaVideo: {
    width: '100%',
    aspectRatio: 16 / 9,
    maxHeight: 500,
    minHeight: 200,
  },
  document: {
    marginTop: spacing.sm,
    marginHorizontal: spacing.md,
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
  },
  engagementBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 40,
  },
  engagementLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  reactionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reactionIcons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  reactionIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: theme.colors.card,
  },
  engagementRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  engagementText: {
    fontSize: 15,
    color: theme.colors.muted,
  },
  commentsCountBar: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  commentsCountText: {
    fontSize: 15,
    fontWeight: '400',
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 42,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    borderRadius: 8,
    gap: spacing.xs,
  },
  actionLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
});
