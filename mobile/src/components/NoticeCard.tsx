import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  useWindowDimensions,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import MediaGallery, { type MediaItem } from './MediaGallery';

// Role badge config
const ROLE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  vice_chancellor: { label: 'VC', color: '#8B0000', icon: 'crown' },
  registrar: { label: 'Registrar', color: '#1E3A8A', icon: 'file-certificate' },
  business_office: { label: 'Business', color: '#065F46', icon: 'calculator' },
  security: { label: 'Security', color: '#92400E', icon: 'shield' },
  dean: { label: 'Dean', color: '#4C1D95', icon: 'school' },
  hod: { label: 'HOD', color: '#0369A1', icon: 'account-tie' },
  lecturer: { label: 'Lecturer', color: '#0F766E', icon: 'teach' },
  student: { label: 'Student', color: '#374151', icon: 'account' },
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: '#DC2626',
  important: '#D97706',
  normal: '#6B7280',
};

export interface NoticeCardProps {
  notice: {
    id: number;
    title?: string;
    description: string;
    created_by_username: string;
    created_by_full_name?: string | null;
    created_by_avatar?: string | null;
    created_by_designation?: string;
    department?: string;
    category?: string;
    priority?: string;
    is_pinned?: boolean;
    is_active?: boolean;
    created_at: string;
    views_count?: number;
    likes_count?: number;
    comments_count?: number;
    attachments?: MediaItem[];
    is_liked?: boolean;
    is_favorited?: boolean;
  };
  onLike?: (id: number) => void;
  onComment?: (id: number) => void;
  onShare?: (id: number) => void;
  compact?: boolean;
}

export default function NoticeCard({
  notice,
  onLike,
  onComment,
  onShare,
  compact = false,
}: NoticeCardProps) {
  const { theme } = useTheme();
  const navigation = useNavigation<any>();
  const { width } = useWindowDimensions();
  const [liked, setLiked] = useState(notice.is_liked ?? false);
  const [likeCount, setLikeCount] = useState(notice.likes_count ?? 0);

  const designation = (notice.created_by_designation || 'student').toLowerCase();
  const role = ROLE_CONFIG[designation] || ROLE_CONFIG.student;
  const priorityColor = PRIORITY_COLORS[notice.priority || 'normal'];

  const handleLike = useCallback(() => {
    setLiked((prev) => !prev);
    setLikeCount((prev) => (liked ? prev - 1 : prev + 1));
    onLike?.(notice.id);
  }, [liked, onLike, notice.id]);

  const handlePress = useCallback(() => {
    navigation.navigate('NoticeDetail', { id: notice.id });
  }, [navigation, notice.id]);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const displayName = notice.created_by_full_name || notice.created_by_username;
  const avatarUri = notice.created_by_avatar;

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.95}
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.card,
          borderLeftWidth: notice.is_pinned ? 4 : 0,
          borderLeftColor: notice.is_pinned ? theme.colors.primary : 'transparent',
        },
      ]}
    >
      {/* Header: Avatar + Name + Role + Time */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            navigation.navigate('UserProfile', {
              userId: notice.id, // This should be creator ID from parent
              name: displayName,
            });
          }}
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Text style={styles.avatarInitial}>
                {displayName?.[0]?.toUpperCase() || '?'}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        <View style={styles.headerText}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: theme.colors.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            {/* Role Badge */}
            <View style={[styles.roleBadge, { backgroundColor: role.color + '15' }]}>
              <MaterialCommunityIcons name={role.icon as any} size={10} color={role.color} />
              <Text style={[styles.roleText, { color: role.color }]}>{role.label}</Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <Text style={[styles.meta, { color: theme.colors.muted }]}>
              @{notice.created_by_username}
            </Text>
            <Text style={[styles.meta, { color: theme.colors.muted }]}> · </Text>
            <Text style={[styles.meta, { color: theme.colors.muted }]}>
              {formatTime(notice.created_at)}
            </Text>
            {notice.department && (
              <>
                <Text style={[styles.meta, { color: theme.colors.muted }]}> · </Text>
                <Text style={[styles.meta, { color: theme.colors.primary }]}>
                  {notice.department}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Priority + Pinned indicators */}
        <View style={styles.indicators}>
          {notice.priority && notice.priority !== 'normal' && (
            <View style={[styles.priorityBadge, { backgroundColor: priorityColor + '15' }]}>
              <MaterialCommunityIcons name="alert-circle" size={12} color={priorityColor} />
              <Text style={[styles.priorityText, { color: priorityColor }]}>
                {notice.priority.charAt(0).toUpperCase() + notice.priority.slice(1)}
              </Text>
            </View>
          )}
          {notice.is_pinned && (
            <MaterialCommunityIcons name="pin" size={16} color={theme.colors.primary} />
          )}
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>
        {notice.title && (
          <Text style={[styles.title, { color: theme.colors.text }]} numberOfLines={compact ? 2 : undefined}>
            {notice.title}
          </Text>
        )}
        <Text
          style={[styles.description, { color: theme.colors.text }]}
          numberOfLines={compact ? 4 : undefined}
        >
          {notice.description}
        </Text>
      </View>

      {/* Media */}
      {notice.attachments && notice.attachments.length > 0 && (
        <MediaGallery items={notice.attachments} compact={compact} />
      )}

      {/* Engagement Bar */}
      <View style={styles.engagement}>
        <TouchableOpacity
          style={styles.engagementButton}
          onPress={(e) => {
            e.stopPropagation();
            handleLike();
          }}
        >
          <MaterialCommunityIcons
            name={liked ? 'thumb-up' : 'thumb-up-outline'}
            size={18}
            color={liked ? theme.colors.primary : theme.colors.muted}
          />
          <Text style={[styles.engagementText, { color: liked ? theme.colors.primary : theme.colors.muted }]}>
            {likeCount || 'Like'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.engagementButton}
          onPress={(e) => {
            e.stopPropagation();
            onComment?.(notice.id);
          }}
        >
          <MaterialCommunityIcons name="comment-outline" size={18} color={theme.colors.muted} />
          <Text style={[styles.engagementText, { color: theme.colors.muted }]}>
            {notice.comments_count || 'Comment'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.engagementButton}
          onPress={(e) => {
            e.stopPropagation();
            onShare?.(notice.id);
          }}
        >
          <MaterialCommunityIcons name="share-outline" size={18} color={theme.colors.muted} />
          <Text style={[styles.engagementText, { color: theme.colors.muted }]}>Share</Text>
        </TouchableOpacity>

        <View style={styles.engagementButton}>
          <MaterialCommunityIcons name="eye-outline" size={18} color={theme.colors.muted} />
          <Text style={[styles.engagementText, { color: theme.colors.muted }]}>
            {notice.views_count || 0}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 8,
    marginVertical: 4,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#E5E7EB',
  },
  avatarFallback: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#6B7280',
  },
  headerText: {
    flex: 1,
    minWidth: 0,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roleText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    flexWrap: 'wrap',
  },
  meta: {
    fontSize: 12,
    fontWeight: '500',
  },
  indicators: {
    alignItems: 'flex-end',
    gap: 4,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  content: {
    marginBottom: 10,
    gap: 6,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  engagement: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
    marginTop: 4,
  },
  engagementButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  engagementText: {
    fontSize: 12,
    fontWeight: '600',
  },
});
