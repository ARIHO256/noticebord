import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Modal,
  ScrollView,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { useTheme } from '../context/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface MediaItem {
  id: string | number;
  url: string;
  file_type: 'image' | 'video' | 'audio' | 'document';
  original_name?: string;
}

interface MediaGalleryProps {
  items: MediaItem[];
  onMediaPress?: (index: number) => void;
  compact?: boolean; // Smaller display for feed cards
  maxCompactItems?: number; // Max items to show in compact mode
}

export default function MediaGallery({
  items,
  onMediaPress,
  compact = false,
  maxCompactItems = 4,
}: MediaGalleryProps) {
  const { theme } = useTheme();
  const [viewerVisible, setViewerVisible] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);

  const mediaItems = items.filter((item) => item && item.url);
  if (mediaItems.length === 0) return null;

  const handlePress = useCallback(
    (index: number) => {
      if (onMediaPress) {
        onMediaPress(index);
      } else {
        setViewerIndex(index);
        setViewerVisible(true);
      }
    },
    [onMediaPress]
  );

  // Single item
  if (mediaItems.length === 1) {
    const item = mediaItems[0];
    return (
      <>
        <SingleMedia item={item} compact={compact} onPress={() => handlePress(0)} />
        <MediaViewer
          visible={viewerVisible}
          onClose={() => setViewerVisible(false)}
          items={mediaItems}
          initialIndex={viewerIndex}
        />
      </>
    );
  }

  // Compact mode: grid layout for feed
  if (compact) {
    return (
      <>
        <CompactGrid
          items={mediaItems}
          maxItems={maxCompactItems}
          onPress={handlePress}
        />
        <MediaViewer
          visible={viewerVisible}
          onClose={() => setViewerVisible(false)}
          items={mediaItems}
          initialIndex={viewerIndex}
        />
      </>
    );
  }

  // Detail mode: horizontal scroll for detail view
  return (
    <>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.horizontalScroll}
      >
        {mediaItems.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => handlePress(index)}
            style={styles.detailItem}
          >
            <MediaThumbnail item={item} size={240} />
          </TouchableOpacity>
        ))}
      </ScrollView>
      <MediaViewer
        visible={viewerVisible}
        onClose={() => setViewerVisible(false)}
        items={mediaItems}
        initialIndex={viewerIndex}
      />
    </>
  );
}

// Single media display (image, video, audio, document)
function SingleMedia({
  item,
  compact,
  onPress,
}: {
  item: MediaItem;
  compact: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();

  if (item.file_type === 'document' || item.file_type === 'audio') {
    return (
      <TouchableOpacity
        onPress={onPress}
        style={[
          styles.documentRow,
          { backgroundColor: theme.colors.surface },
        ]}
      >
        <MaterialCommunityIcons
          name={item.file_type === 'audio' ? 'music-note' : 'file-document-outline'}
          size={28}
          color={theme.colors.primary}
        />
        <Text
          style={[styles.documentName, { color: theme.colors.text }]}
          numberOfLines={1}
        >
          {item.original_name || 'Attachment'}
        </Text>
        <MaterialCommunityIcons
          name="download"
          size={20}
          color={theme.colors.muted}
        />
      </TouchableOpacity>
    );
  }

  const height = compact ? Math.min(SCREEN_WIDTH * 0.6, 400) : Math.min(SCREEN_WIDTH * 0.75, 500);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.9}
      style={[styles.singleContainer, { height }]}
    >
      {item.file_type === 'video' ? (
        <VideoThumbnail url={item.url} />
      ) : (
        <Image
          source={{ uri: item.url }}
          style={styles.singleImage}
          resizeMode="cover"
        />
      )}
    </TouchableOpacity>
  );
}

// Compact grid for feed cards (Facebook-style 2x2 or single row)
function CompactGrid({
  items,
  maxItems,
  onPress,
}: {
  items: MediaItem[];
  maxItems: number;
  onPress: (index: number) => void;
}) {
  const { theme } = useTheme();
  const visibleItems = items.slice(0, maxItems);
  const remaining = items.length - maxItems;

  // 2 items: side by side
  if (visibleItems.length === 2) {
    return (
      <View style={styles.row}>
        {visibleItems.map((item, index) => (
          <TouchableOpacity
            key={item.id}
            onPress={() => onPress(index)}
            style={styles.halfItem}
            activeOpacity={0.9}
          >
            <MediaThumbnail item={item} size={SCREEN_WIDTH / 2 - 12} />
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // 3+ items: 2x2 grid with overflow
  return (
    <View style={styles.grid}>
      {visibleItems.map((item, index) => {
        const isLast = index === maxItems - 1 && remaining > 0;
        return (
          <TouchableOpacity
            key={item.id}
            onPress={() => onPress(index)}
            style={styles.gridItem}
            activeOpacity={0.9}
          >
            <MediaThumbnail item={item} size={SCREEN_WIDTH / 2 - 12} />
            {isLast && (
              <View style={styles.overlay}>
                <Text style={styles.overlayText}>+{remaining}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// Thumbnail for any media type
function MediaThumbnail({ item, size }: { item: MediaItem; size: number }) {
  const { theme } = useTheme();

  if (item.file_type === 'document') {
    return (
      <View style={[styles.thumbFallback, { width: size, height: size }]}>
        <MaterialCommunityIcons name="file-document" size={32} color={theme.colors.primary} />
        <Text style={[styles.thumbLabel, { color: theme.colors.muted }]} numberOfLines={2}>
          {item.original_name || 'Document'}
        </Text>
      </View>
    );
  }

  if (item.file_type === 'audio') {
    return (
      <View style={[styles.thumbFallback, { width: size, height: size }]}>
        <MaterialCommunityIcons name="music-note" size={32} color={theme.colors.primary} />
        <Text style={[styles.thumbLabel, { color: theme.colors.muted }]} numberOfLines={2}>
          {item.original_name || 'Audio'}
        </Text>
      </View>
    );
  }

  if (item.file_type === 'video') {
    return (
      <View style={{ width: size, height: size }}>
        <Image
          source={{ uri: item.url }}
          style={[styles.thumbImage, { width: size, height: size }]}
          resizeMode="cover"
        />
        <View style={styles.playIcon}>
          <MaterialCommunityIcons name="play-circle" size={40} color="white" />
        </View>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: item.url }}
      style={[styles.thumbImage, { width: size, height: size }]}
      resizeMode="cover"
    />
  );
}

// Video thumbnail with play button
function VideoThumbnail({ url }: { url: string }) {
  return (
    <View style={styles.videoThumb}>
      <Image source={{ uri: url }} style={styles.singleImage} resizeMode="cover" />
      <View style={styles.playIconCenter}>
        <MaterialCommunityIcons name="play-circle-outline" size={56} color="white" />
      </View>
    </View>
  );
}

// Full-screen media viewer
function MediaViewer({
  visible,
  onClose,
  items,
  initialIndex,
}: {
  visible: boolean;
  onClose: () => void;
  items: MediaItem[];
  initialIndex: number;
}) {
  const { theme } = useTheme();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  if (!visible) return null;

  const currentItem = items[currentIndex];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.viewerContainer, { backgroundColor: 'rgba(0,0,0,0.95)' }]}>
        {/* Header */}
        <View style={styles.viewerHeader}>
          <Text style={styles.viewerCount}>
            {currentIndex + 1} / {items.length}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <MaterialCommunityIcons name="close" size={28} color="white" />
          </TouchableOpacity>
        </View>

        {/* Content */}
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: currentIndex * SCREEN_WIDTH, y: 0 }}
          onMomentumScrollEnd={(e) => {
            const index = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
            setCurrentIndex(index);
          }}
        >
          {items.map((item) => (
            <View key={item.id} style={[styles.viewerPage, { width: SCREEN_WIDTH }]}>
              {item.file_type === 'video' ? (
                <VideoPlayer url={item.url} />
              ) : item.file_type === 'audio' ? (
                <AudioPlayer url={item.url} name={item.original_name} />
              ) : item.file_type === 'document' ? (
                <DocumentViewer name={item.original_name} />
              ) : (
                <Image
                  source={{ uri: item.url }}
                  style={styles.viewerImage}
                  resizeMode="contain"
                />
              )}
            </View>
          ))}
        </ScrollView>

        {/* Bottom dots */}
        {items.length > 1 && (
          <View style={styles.dotsContainer}>
            {items.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.dot,
                  { backgroundColor: index === currentIndex ? 'white' : 'rgba(255,255,255,0.4)' },
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

function VideoPlayer({ url }: { url: string }) {
  const player = useVideoPlayer(url, (player) => {
    player.loop = false;
    player.play();
  });

  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });

  return (
    <View style={styles.playerContainer}>
      <VideoView
        style={styles.player}
        player={player}
        allowsFullscreen
        allowsPictureInPicture
        contentFit="contain"
      />
      <TouchableOpacity
        style={styles.playOverlay}
        onPress={() => (isPlaying ? player.pause() : player.play())}
      >
        {!isPlaying && (
          <MaterialCommunityIcons name="play" size={48} color="white" />
        )}
      </TouchableOpacity>
    </View>
  );
}

function AudioPlayer({ url, name }: { url: string; name?: string }) {
  const player = useVideoPlayer(url, (player) => {
    player.loop = false;
  });

  const { isPlaying } = useEvent(player, 'playingChange', {
    isPlaying: player.playing,
  });

  return (
    <View style={styles.audioPlayer}>
      <MaterialCommunityIcons name="music-circle" size={80} color="rgba(255,255,255,0.8)" />
      <Text style={styles.audioName} numberOfLines={2}>
        {name || 'Audio'}
      </Text>
      <TouchableOpacity
        style={styles.audioPlayButton}
        onPress={() => (isPlaying ? player.pause() : player.play())}
      >
        <MaterialCommunityIcons
          name={isPlaying ? 'pause' : 'play'}
          size={32}
          color="white"
        />
      </TouchableOpacity>
    </View>
  );
}

function DocumentViewer({ name }: { name?: string }) {
  return (
    <View style={styles.documentViewer}>
      <MaterialCommunityIcons name="file-document" size={80} color="rgba(255,255,255,0.8)" />
      <Text style={styles.documentViewerName} numberOfLines={2}>
        {name || 'Document'}
      </Text>
      <Text style={styles.documentViewerHint}>Download to view</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  singleContainer: {
    width: SCREEN_WIDTH,
    overflow: 'hidden',
  },
  singleImage: {
    width: '100%',
    height: '100%',
  },
  videoThumb: {
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  playIconCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  row: {
    flexDirection: 'row',
    gap: 2,
    marginTop: 8,
  },
  halfItem: {
    flex: 1,
    height: SCREEN_WIDTH / 2 - 12,
    borderRadius: 8,
    overflow: 'hidden',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 2,
    marginTop: 8,
  },
  gridItem: {
    width: SCREEN_WIDTH / 2 - 12,
    height: SCREEN_WIDTH / 2 - 12,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  thumbImage: {
    width: '100%',
    height: '100%',
    borderRadius: 8,
  },
  thumbFallback: {
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.05)',
    padding: 8,
  },
  thumbLabel: {
    fontSize: 11,
    marginTop: 4,
    textAlign: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
  },
  overlayText: {
    color: 'white',
    fontSize: 28,
    fontWeight: '700',
  },
  playIcon: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 4,
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    gap: 12,
  },
  documentName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  horizontalScroll: {
    paddingHorizontal: 12,
    gap: 8,
  },
  detailItem: {
    marginRight: 8,
    borderRadius: 8,
    overflow: 'hidden',
  },
  // Viewer
  viewerContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  viewerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: 48,
  },
  viewerCount: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  viewerPage: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  viewerImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  // Players
  playerContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.75,
    justifyContent: 'center',
    alignItems: 'center',
  },
  player: {
    width: '100%',
    height: '100%',
  },
  playOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  audioPlayer: {
    width: SCREEN_WIDTH,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  audioName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  audioPlayButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  documentViewer: {
    width: SCREEN_WIDTH,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  documentViewerName: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  documentViewerHint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
  },
});
