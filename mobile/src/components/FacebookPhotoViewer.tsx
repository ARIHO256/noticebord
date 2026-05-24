import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Text,
  Dimensions,
  StatusBar,
  Platform,
  ScrollView,
  PanResponder,
  Animated,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import AttachmentMediaPlayer from './AttachmentMediaPlayer';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export type PhotoViewerAttachment = {
  id: number;
  url: string;
  file_type?: string;
  original_name?: string | null;
};

export type FacebookPhotoViewerProps = {
  visible: boolean;
  attachments: PhotoViewerAttachment[];
  initialIndex?: number;
  authorName?: string;
  authorAvatar?: string | null;
  postTime?: string;
  noticeId?: number; // For likes and comments
  likesCount?: number;
  commentsCount?: number;
  isLiked?: boolean;
  onClose: () => void;
  onLikeToggle?: () => Promise<void> | void;
  onCommentPress?: () => void;
};

type Comment = {
  id: number;
  user: {
    id: number;
    username: string;
    first_name?: string;
    last_name?: string;
    avatar_url?: string | null;
  };
  content: string;
  created_at: string;
};

export default function FacebookPhotoViewer({
  visible,
  attachments,
  initialIndex = 0,
  authorName,
  authorAvatar,
  postTime,
  noticeId,
  likesCount = 0,
  commentsCount = 0,
  isLiked = false,
  onClose,
  onLikeToggle,
  onCommentPress,
}: FacebookPhotoViewerProps) {
  const { theme } = useTheme();
  const { showSuccess, showError } = useToast();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const scrollViewRef = useRef<ScrollView>(null);
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const [isZoomed, setIsZoomed] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [currentLikesCount, setCurrentLikesCount] = useState(likesCount);
  const [currentIsLiked, setCurrentIsLiked] = useState(isLiked);
  const [savingPhoto, setSavingPhoto] = useState(false);
  const [imageSize, setImageSize] = useState({ width: SCREEN_WIDTH, height: SCREEN_HEIGHT });
  const lastScale = useRef(1);
  const lastTranslateX = useRef(0);
  const lastTranslateY = useRef(0);
  const lastTap = useRef<number | null>(null);
  const tapLocation = useRef({ x: 0, y: 0 });

  const images = (attachments || []).filter((att) => att && (att.file_type === 'image' || !att.file_type));
  const videos = (attachments || []).filter((att) => att && att.file_type === 'video');
  const allMedia = [...images, ...videos];

  useEffect(() => {
    if (visible && allMedia.length > 0) {
      const safeInitialIndex = Math.max(0, Math.min(initialIndex, allMedia.length - 1));
      setCurrentIndex(safeInitialIndex);
      scaleAnim.setValue(1);
      translateX.setValue(0);
      translateY.setValue(0);
      setIsZoomed(false);
      setShowComments(false);
      lastScale.current = 1;
      lastTranslateX.current = 0;
      lastTranslateY.current = 0;
    }
  }, [visible, initialIndex, allMedia.length, scaleAnim, translateX, translateY]);

  useEffect(() => {
    setCurrentLikesCount(likesCount);
    setCurrentIsLiked(isLiked);
  }, [likesCount, isLiked]);

  useEffect(() => {
    if (showComments && noticeId) {
      loadComments();
    }
  }, [showComments, noticeId]);

  const loadComments = async () => {
    if (!noticeId) return;
    setLoadingComments(true);
    try {
      const response = await api.get<Comment[]>(`/notices/${noticeId}/comments/`);
      setComments(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      showError('Failed to load comments');
    } finally {
      setLoadingComments(false);
    }
  };

  const handleScroll = useCallback((event: any) => {
    if (!event?.nativeEvent?.contentOffset) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index !== currentIndex && index >= 0 && index < allMedia.length && allMedia[index]) {
      setCurrentIndex(index);
      scaleAnim.setValue(1);
      translateX.setValue(0);
      translateY.setValue(0);
      setIsZoomed(false);
      lastScale.current = 1;
      lastTranslateX.current = 0;
      lastTranslateY.current = 0;
    }
  }, [currentIndex, allMedia, scaleAnim, translateX, translateY]);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isZoomed,
      onMoveShouldSetPanResponder: () => isZoomed,
      onPanResponderGrant: () => {
        scaleAnim.setOffset(lastScale.current);
        translateX.setOffset(lastTranslateX.current);
        translateY.setOffset(lastTranslateY.current);
      },
      onPanResponderMove: (evt, gestureState) => {
        if (isZoomed) {
          translateX.setValue(gestureState.dx);
          translateY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        scaleAnim.flattenOffset();
        translateX.flattenOffset();
        translateY.flattenOffset();
        lastTranslateX.current += gestureState.dx;
        lastTranslateY.current += gestureState.dy;
      },
    }),
  ).current;

  const handleTap = useCallback((event: any) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    // Get tap location for centered zoom
    if (event?.nativeEvent) {
      tapLocation.current = {
        x: event.nativeEvent.locationX || SCREEN_WIDTH / 2,
        y: event.nativeEvent.locationY || SCREEN_HEIGHT / 2,
      };
    }

    if (lastTap.current && now - lastTap.current < DOUBLE_TAP_DELAY) {
      // Double tap detected
      if (isZoomed) {
        // Zoom out to center
        Animated.parallel([
          Animated.spring(scaleAnim, {
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
          }),
        ]).start();
        setIsZoomed(false);
        lastScale.current = 1;
        lastTranslateX.current = 0;
        lastTranslateY.current = 0;
      } else {
        // Zoom in from center (Facebook style)
        // Reset pan so zoom grows evenly from center
        translateX.setValue(0);
        translateY.setValue(0);
        translateX.setOffset(0);
        translateY.setOffset(0);
        lastTranslateX.current = 0;
        lastTranslateY.current = 0;
        Animated.spring(scaleAnim, {
          toValue: 2,
          useNativeDriver: true,
        }).start();
        setIsZoomed(true);
        lastScale.current = 2;
      }
      lastTap.current = null;
    } else {
      lastTap.current = now;
    }
  }, [isZoomed, scaleAnim, translateX, translateY]);

  const handleSavePhoto = async () => {
    const currentMedia = allMedia[Math.max(0, Math.min(currentIndex, allMedia.length - 1))];
    if (!currentMedia || currentMedia.file_type === 'video') {
      showError('Can only save images');
      return;
    }

    setSavingPhoto(true);
    try {
      // Request permissions
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to save photos to your gallery.');
        setSavingPhoto(false);
        return;
      }

      // Download image
      const fileUri = FileSystem.documentDirectory + `photo-${Date.now()}.jpg`;
      const downloadResult = await FileSystem.downloadAsync(currentMedia.url, fileUri);
      
      // Save to gallery
      await MediaLibrary.createAssetAsync(downloadResult.uri);
      showSuccess('Photo saved to gallery!');
    } catch (error: any) {
      showError('Failed to save photo');
    } finally {
      setSavingPhoto(false);
    }
  };

  const handleLikeToggle = async () => {
    if (onLikeToggle) {
      try {
        await onLikeToggle();
        setCurrentIsLiked(!currentIsLiked);
        setCurrentLikesCount((prev) => prev + (currentIsLiked ? -1 : 1));
      } catch (error) {
        showError('Failed to update like');
      }
    }
  };

  const formatTime = (dateString?: string) => {
    if (!dateString) return '';
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

  if (!visible || allMedia.length === 0) return null;

  const safeIndex = Math.max(0, Math.min(currentIndex, allMedia.length - 1));
  const currentMedia = allMedia[safeIndex];
  if (!currentMedia) return null;
  
  const isImage = currentMedia.file_type === 'image' || !currentMedia.file_type;
  const isVideo = currentMedia.file_type === 'video';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <View style={styles.container}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          {authorName && (
            <View style={styles.authorInfo}>
              {authorAvatar ? (
                <Image source={{ uri: authorAvatar }} style={styles.authorAvatar} />
              ) : (
                <View style={[styles.authorAvatar, { backgroundColor: theme.colors.surface }]}>
                  <Text style={[styles.authorInitials, { color: theme.colors.text }]}>
                    {(authorName || 'U').slice(0, 1).toUpperCase()}
                  </Text>
                </View>
              )}
              <View style={styles.authorText}>
                <Text style={styles.authorName}>{authorName}</Text>
                {postTime && <Text style={styles.postTime}>{formatTime(postTime)}</Text>}
              </View>
            </View>
          )}
          <View style={styles.headerRight}>
            {isImage && (
              <TouchableOpacity
                onPress={handleSavePhoto}
                style={styles.headerButton}
                disabled={savingPhoto}
              >
                {savingPhoto ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <MaterialCommunityIcons name="download" size={24} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            )}
            {allMedia.length > 1 && (
              <Text style={styles.photoCounter}>
                {safeIndex + 1} / {allMedia.length}
              </Text>
            )}
          </View>
        </View>

        {/* Photo/Video Viewer */}
        <ScrollView
          ref={scrollViewRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentOffset={{ x: safeIndex * SCREEN_WIDTH, y: 0 }}
          style={styles.scrollView}
          scrollEnabled={!isZoomed}
        >
          {allMedia.map((media, index) => {
            if (!media || !media.url) return null;
            const isCurrentImage = (media.file_type === 'image' || !media.file_type) && index === safeIndex;

            if (media.file_type === 'image' || !media.file_type) {
              return (
                <View key={media.id} style={styles.mediaContainer}>
                  <TouchableOpacity
                    activeOpacity={1}
                    onPress={handleTap}
                    style={styles.tapArea}
                  >
                  <Animated.View
                    style={[
                      styles.imageWrapper,
                      {
                        transform: isCurrentImage
                          ? [
                              // Center the pivot for scaling, then apply any pan offsets
                              { translateX: -imageSize.width / 2 },
                              { translateY: -imageSize.height / 2 },
                              { scale: scaleAnim },
                              { translateX: imageSize.width / 2 },
                              { translateY: imageSize.height / 2 },
                              { translateX: translateX },
                              { translateY: translateY },
                            ]
                          : [],
                      },
                    ]}
                      {...(isCurrentImage ? panResponder.panHandlers : {})}
                    >
                      <Image
                        source={{ uri: media.url }}
                        style={styles.mediaImage}
                        resizeMode={isZoomed ? 'none' : 'contain'}
                        onLayout={(e) => {
                          const { width, height } = e.nativeEvent.layout;
                          if (width > 0 && height > 0) {
                            setImageSize({ width, height });
                          }
                        }}
                      />
                    </Animated.View>
                  </TouchableOpacity>
                </View>
              );
            }

            if (media.file_type === 'video') {
              return (
                <View key={media.id} style={styles.mediaContainer}>
                  <AttachmentMediaPlayer
                    uri={media.url}
                    style={styles.mediaVideo}
                    showControls
                    contentFit="contain"
                  />
                </View>
              );
            }

            return null;
          })}
        </ScrollView>

        {/* Facebook-style Bottom Bar with Likes and Comments */}
        {isImage && noticeId && (
          <View style={[styles.bottomBar, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
            <View style={styles.engagementRow}>
              <View style={styles.engagementLeft}>
                {(currentLikesCount ?? 0) > 0 && (
                  <View style={styles.likesContainer}>
                    <View style={[styles.likeIcon, { backgroundColor: '#1877F2' }]}>
                      <MaterialCommunityIcons name="thumb-up" size={14} color="#FFFFFF" />
                    </View>
                    <Text style={styles.engagementText}>{currentLikesCount}</Text>
                  </View>
                )}
                {(commentsCount ?? 0) > 0 && (
                  <TouchableOpacity
                    onPress={() => setShowComments(!showComments)}
                    style={styles.commentsLink}
                  >
                    <Text style={styles.engagementText}>
                      {commentsCount} {commentsCount === 1 ? 'comment' : 'comments'}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleLikeToggle}
              >
                <MaterialCommunityIcons
                  name={currentIsLiked ? 'thumb-up' : 'thumb-up-outline'}
                  size={24}
                  color={currentIsLiked ? '#1877F2' : '#FFFFFF'}
                />
                <Text style={[styles.actionText, { color: currentIsLiked ? '#1877F2' : '#FFFFFF' }]}>
                  Like
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => {
                  if (onCommentPress) {
                    onCommentPress();
                    onClose();
                  } else {
                    setShowComments(!showComments);
                  }
                }}
              >
                <MaterialCommunityIcons name="comment-outline" size={24} color="#FFFFFF" />
                <Text style={styles.actionText}>Comment</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.actionButton}
                onPress={handleSavePhoto}
                disabled={savingPhoto}
              >
                {savingPhoto ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <MaterialCommunityIcons name="download" size={24} color="#FFFFFF" />
                )}
                <Text style={styles.actionText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Comments Bottom Sheet (Facebook style) */}
        {showComments && (
          <Animated.View style={[styles.commentsSheet, { backgroundColor: theme.colors.card }]}>
            <View style={[styles.commentsHeader, { borderBottomColor: theme.colors.border }]}>
              <Text style={[styles.commentsTitle, { color: theme.colors.text }]}>Comments</Text>
              <TouchableOpacity onPress={() => setShowComments(false)}>
                <MaterialCommunityIcons name="close" size={24} color={theme.colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.commentsList}>
              {loadingComments ? (
                <ActivityIndicator style={{ marginTop: spacing.lg }} />
              ) : comments.length === 0 ? (
                <Text style={[styles.noComments, { color: theme.colors.muted }]}>No comments yet</Text>
              ) : (
                comments.map((comment) => (
                  <View key={comment.id} style={styles.commentItem}>
                    {comment.user.avatar_url ? (
                      <Image source={{ uri: comment.user.avatar_url }} style={styles.commentAvatar} />
                    ) : (
                      <View style={[styles.commentAvatar, { backgroundColor: theme.colors.surface }]}>
                        <Text style={[styles.commentInitials, { color: theme.colors.text }]}>
                          {(comment.user.first_name || comment.user.username || 'U').slice(0, 1).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <View style={styles.commentContent}>
                      <View style={[styles.commentBubble, { backgroundColor: theme.colors.surface }]}>
                        <Text style={[styles.commentName, { color: theme.colors.text }]}>
                          {comment.user.first_name || comment.user.username}
                        </Text>
                        <Text style={[styles.commentText, { color: theme.colors.text }]}>
                          {comment.content}
                        </Text>
                      </View>
                      <Text style={[styles.commentTime, { color: theme.colors.muted }]}>
                        {formatTime(comment.created_at)}
                      </Text>
                    </View>
                  </View>
                ))
              )}
            </ScrollView>
          </Animated.View>
        )}

        {/* Footer with dots indicator */}
        {allMedia.length > 1 && !showComments && (
          <View style={styles.footer}>
            <View style={styles.dotsContainer}>
              {allMedia.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.dot,
                    {
                      backgroundColor: index === safeIndex ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
                      width: index === safeIndex ? 8 : 6,
                      height: index === safeIndex ? 8 : 6,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingBottom: spacing.md,
    paddingHorizontal: spacing.md,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.sm,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginLeft: spacing.md,
  },
  authorAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: spacing.sm,
  },
  authorInitials: {
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 36,
  },
  authorText: {
    flex: 1,
  },
  authorName: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  postTime: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  photoCounter: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  mediaContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tapArea: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mediaImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  mediaVideo: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
  },
  engagementRow: {
    marginBottom: spacing.sm,
  },
  engagementLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  likesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  likeIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  engagementText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  commentsLink: {
    paddingVertical: 2,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  actionText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  footer: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 100 : 80,
    left: 0,
    right: 0,
    paddingBottom: spacing.md,
    paddingTop: spacing.md,
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dot: {
    borderRadius: 4,
  },
  commentsSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: SCREEN_HEIGHT * 0.6,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  commentsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  commentsTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  commentsList: {
    maxHeight: SCREEN_HEIGHT * 0.5,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  noComments: {
    textAlign: 'center',
    paddingVertical: spacing.xl,
    fontSize: 14,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: spacing.md,
    gap: spacing.sm,
  },
  commentAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentInitials: {
    fontSize: 12,
    fontWeight: '700',
  },
  commentContent: {
    flex: 1,
  },
  commentBubble: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 18,
    marginBottom: spacing.xs,
  },
  commentName: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 2,
  },
  commentText: {
    fontSize: 14,
    lineHeight: 18,
  },
  commentTime: {
    fontSize: 11,
    marginLeft: spacing.md,
  },
});
