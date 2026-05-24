import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Modal,
  Dimensions,
  Image,
  TextInput,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';
import AttachmentMediaPlayer from './AttachmentMediaPlayer';

interface MediaPreviewEditorProps {
  visible: boolean;
  uri: string;
  type: 'image' | 'video';
  onConfirm: (caption: string) => void;
  onCancel: () => void;
}

const EMOJI_STICKERS = [
  // Smileys & Emotions
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
  '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
  '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜',
  '🤪', '😌', '😔', '😑', '😐', '😏', '😒', '🙁',
  '☹️', '🙍', '😬', '🤥', '😌', '😔', '😪', '🤤',
  '😷', '🤒', '🤕', '🤢', '🤮', '🤮', '🤯', '🥴',
  '😕', '😟', '🙁', '☹️', '😲', '😞', '😖', '😢',
  '😭', '😱', '😖', '😣', '😞', '😓', '😩', '😫',
  '🥱', '😤', '😡', '😠', '🤬', '😈', '👿', '💀',
  '☠️', '💩', '🤡', '👹', '👺', '👻', '👽', '👾',
  
  // Hand Gestures
  '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏',
  '✌️', '🤞', '🫰', '🤟', '🤘', '🤙', '👍', '👎',
  '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲',
  '🤝', '🤜', '🤛', '🙏', '💅', '💪', '👈', '👉',
  '👆', '👇', '☝️', '👏', '🤚', '👋',
  
  // Activities & Sports
  '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉',
  '🥏', '🎳', '🏓', '🏸', '🏒', '🏑', '🥍', '🏘️',
  '🎯', '🎱', '🎮', '🎲', '♟️', '🎰', '🎪', '🎨',
  '🎬', '🎤', '🎧', '🎼', '🎹', '🥁', '🎷', '🎺',
  '🎸', '🎻', '🎲',
  
  // Travel & Places
  '🏠', '🏡', '🏢', '🏣', '🏤', '🏥', '🏦', '🏧',
  '🏨', '🏩', '🏪', '🏫', '🏬', '🏭', '🏯', '🏰',
  '💒', '🗼', '🗽', '⛪', '🕌', '🕍', '🛕', '🕋',
  '⛩️', '🛤️', '🛣️', '🗿', '⛲', '⛺', '🌁', '🌋',
  '⛰️', '🏔️', '🗻', '🌅', '🌄', '🌠', '🎇', '🎆',
  
  // Nature & Animals
  '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
  '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈',
  '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🦆',
  '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝',
  '🐛', '🦋', '🐌', '🐞', '🐜', '🪰', '🦟', '🦗',
  '🕷️', '🦂', '🐢', '🐍', '🦎', '🦖', '🦕', '🐙',
  '🦑', '🦐', '🦞', '🦀', '🐡', '🐠', '🐟', '🐬',
  '🐳', '🐋', '🦈', '⭐', '🌟', '✨', '⚡', '☄️',
  
  // Food & Drink
  '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇',
  '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥',
  '🥑', '🍆', '🍅', '🌽', '🌶️', '🥒', '🥬', '🥦',
  '🧄', '🧅', '🍄', '🥜', '🌰', '🍞', '🥐', '🥖',
  '🥨', '🥯', '🍗', '🍖', '🌭', '🍔', '🍟', '🍕',
  '🥪', '🥙', '🧆', '🌮', '🌯', '🥗', '🥘', '🥫',
  '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪',
  '🍤', '🍚', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮',
  '🍢', '🍡', '🍧', '🍨', '🍦', '🍰', '🎂', '🧁',
  '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰',
  '🥐', '☕', '🍵', '🍶', '🍾', '🍷', '🍸', '🍹',
  '🍺', '🍻', '🥂', '🥃', '🥛',
  
  // Objects
  '⚽', '🎈', '🎁', '🎀', '🎉', '🎊', '🎂', '🎎',
  '🎏', '🎐', '🎋', '🎍', '💼', '👑', '💎', '📚',
  '📖', '📝', '✏️', '✒️', '🖊️', '🖋️', '🖌️', '🖍️',
  '📰', '📄', '📃', '📑', '🧾', '📊', '📈', '📉',
  '📋', '📁', '📂', '🗂️', '🗞️', '📰', '📓', '📔',
  '📒', '📕', '📗', '📘', '📙', '📚', '📓', '📔',
  '📕', '📖', '📐', '📏', '📌', '📍', '✂️', '🖇️',
  '📎', '📐', '📏', '📔', '🧷', '⌚', '💍', '📱',
  '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️',
  '🗜️', '💽', '💾', '💿', '🧮', '🎥', '🎬', '📺',
  '📷', '📸', '📹', '🎞️', '🎦', '📽️', '🎙️', '🎚️',
  '🎛️', '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳',
  
  // Symbols
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
  '🤎', '💔', '💕', '💞', '💓', '💗', '💖', '💘',
  '💝', '💟', '👋', '🔥', '💥', '⭐', '✨', '💫',
  '🌟', '💯', '💢', '💬', '👁️', '👀', '🎯', '🎪',
  '🎨', '🎭', '🎪', '🎡', '🎢', '🎠', '⛲', '⛱️',
  '🏖️', '🏝️', '🌊', '🌴', '🌵', '🌲', '🌳', '🌴',
];


export default function MediaPreviewEditor({
  visible,
  uri,
  type,
  onConfirm,
  onCancel,
}: MediaPreviewEditorProps) {
  const { theme } = useTheme();
  const { width, height } = Dimensions.get('window');
  const [caption, setCaption] = useState('');
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [stickers, setStickers] = useState<Array<{ id: string; emoji: string; x: number; y: number; size: number }>>([]);
  const [selectedStickerId, setSelectedStickerId] = useState<string | null>(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const scrollViewRef = useRef<ScrollView>(null);

  const handleConfirm = useCallback(() => {
    onConfirm(caption);
    setCaption('');
    setStickers([]);
    setBrightness(100);
    setContrast(100);
  }, [caption, onConfirm]);

  const handleCancel = useCallback(() => {
    setCaption('');
    onCancel();
    setStickers([]);
    setBrightness(100);
    setContrast(100);
  }, [onCancel]);

  const handleAddSticker = useCallback((emoji: string) => {
    const newSticker = {
      id: Date.now().toString(),
      emoji,
      x: width / 2 - 20,
      y: height * 0.25,
      size: 40,
    };
    setStickers([...stickers, newSticker]);
    setSelectedStickerId(newSticker.id);
    setShowStickerPicker(false);
  }, [stickers, width, height]);

  const handleRemoveSticker = useCallback((id: string) => {
    setStickers(stickers.filter(s => s.id !== id));
    if (selectedStickerId === id) {
      setSelectedStickerId(null);
    }
  }, [stickers, selectedStickerId]);

  const handleStickerScaleUp = useCallback(() => {
    if (!selectedStickerId) return;
    setStickers(stickers.map(s =>
      s.id === selectedStickerId ? { ...s, size: Math.min(s.size + 5, 100) } : s
    ));
  }, [stickers, selectedStickerId]);

  const handleStickerScaleDown = useCallback(() => {
    if (!selectedStickerId) return;
    setStickers(stickers.map(s =>
      s.id === selectedStickerId ? { ...s, size: Math.max(s.size - 5, 20) } : s
    ));
  }, [stickers, selectedStickerId]);

  const imageFilterStyle = {
    opacity: brightness / 100,
    backgroundColor: `rgba(0, 0, 0, ${(100 - contrast) / 500})`,
  };

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={handleCancel}
    >
      <SafeAreaView style={[styles.container, { backgroundColor: '#000000' }]}>
        {/* Header */}
        <View style={[styles.header, { backgroundColor: '#1a1a1a' }]}>
          <TouchableOpacity
            onPress={handleCancel}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {type === 'video' ? 'Send Video' : 'Send Photo'}
          </Text>
          <TouchableOpacity
            onPress={handleConfirm}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <MaterialCommunityIcons name="check" size={28} color="#25D366" />
          </TouchableOpacity>
        </View>

        {/* Media Preview with Stickers */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.mediaContainer}
          scrollEnabled={false}
        >
          <View
            style={[
              styles.mediaWrapper,
              {
                width: width,
                height: type === 'video' ? height * 0.5 : height * 0.55,
              },
            ]}
          >
            {type === 'video' ? (
              <View style={styles.videoContainer}>
                <AttachmentMediaPlayer
                  uri={uri}
                  style={styles.media}
                  contentFit="cover"
                  showControls={true}
                />
                <View style={styles.videoBadge}>
                  <MaterialCommunityIcons
                    name="play-circle-outline"
                    size={32}
                    color="#FFFFFF"
                  />
                </View>
              </View>
            ) : (
              <View style={[styles.mediaWrapper, imageFilterStyle]}>
                <Image
                  source={{ uri }}
                  style={styles.media}
                  resizeMode="cover"
                />
              </View>
            )}

            {/* Stickers Overlay */}
            {stickers.map(sticker => (
              <TouchableOpacity
                key={sticker.id}
                onPress={() => setSelectedStickerId(sticker.id)}
                style={[
                  styles.stickerOverlay,
                  {
                    left: sticker.x,
                    top: sticker.y,
                    width: sticker.size,
                    height: sticker.size,
                    borderWidth: selectedStickerId === sticker.id ? 2 : 0,
                    borderColor: selectedStickerId === sticker.id ? '#25D366' : 'transparent',
                  },
                ]}
              >
                <Text style={{ fontSize: sticker.size * 0.7 }}>
                  {sticker.emoji}
                </Text>
                {selectedStickerId === sticker.id && (
                  <TouchableOpacity
                    onPress={() => handleRemoveSticker(sticker.id)}
                    style={styles.removeStickerBtn}
                  >
                    <MaterialCommunityIcons name="close" size={14} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>

        {/* Edit Controls */}
        {type === 'image' && (
          <View style={[styles.editControlsContainer, { backgroundColor: '#1a1a1a' }]}>
            <View style={styles.editControl}>
              <Text style={styles.editLabel}>Brightness</Text>
              <View style={styles.sliderContainer}>
                <TouchableOpacity
                  onPress={() => setBrightness(Math.max(50, brightness - 10))}
                  style={styles.sliderButton}
                >
                  <MaterialCommunityIcons name="minus" size={16} color="#25D366" />
                </TouchableOpacity>
                <View
                  style={[
                    styles.sliderBar,
                    { width: `${Math.max(50, brightness)}%` },
                  ]}
                />
                <TouchableOpacity
                  onPress={() => setBrightness(Math.min(150, brightness + 10))}
                  style={styles.sliderButton}
                >
                  <MaterialCommunityIcons name="plus" size={16} color="#25D366" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.editControl}>
              <Text style={styles.editLabel}>Contrast</Text>
              <View style={styles.sliderContainer}>
                <TouchableOpacity
                  onPress={() => setContrast(Math.max(50, contrast - 10))}
                  style={styles.sliderButton}
                >
                  <MaterialCommunityIcons name="minus" size={16} color="#25D366" />
                </TouchableOpacity>
                <View
                  style={[
                    styles.sliderBar,
                    { width: `${Math.max(50, contrast)}%` },
                  ]}
                />
                <TouchableOpacity
                  onPress={() => setContrast(Math.min(150, contrast + 10))}
                  style={styles.sliderButton}
                >
                  <MaterialCommunityIcons name="plus" size={16} color="#25D366" />
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {/* Sticker Size Controls */}
        {selectedStickerId && (
          <View style={[styles.stickerControlsContainer, { backgroundColor: '#1a1a1a' }]}>
            <TouchableOpacity
              onPress={handleStickerScaleDown}
              style={[styles.stickerControl, { backgroundColor: '#E74C3C' }]}
            >
              <MaterialCommunityIcons name="minus" size={20} color="#FFFFFF" />
              <Text style={styles.stickerControlText}>Smaller</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleStickerScaleUp}
              style={[styles.stickerControl, { backgroundColor: '#27AE60' }]}
            >
              <MaterialCommunityIcons name="plus" size={20} color="#FFFFFF" />
              <Text style={styles.stickerControlText}>Larger</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Sticker Picker Modal */}
        {showStickerPicker && (
          <View style={[styles.stickerPickerContainer, { backgroundColor: '#1a1a1a' }]}>
            <View style={styles.stickerPickerHeader}>
              <Text style={styles.stickerPickerTitle}>Select Sticker</Text>
              <TouchableOpacity onPress={() => setShowStickerPicker(false)}>
                <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.stickerPickerGrid}
              contentContainerStyle={styles.stickerPickerContent}
            >
              {EMOJI_STICKERS.map((emoji, index) => (
                <TouchableOpacity
                  key={index}
                  onPress={() => handleAddSticker(emoji)}
                  style={styles.stickerPickerItem}
                >
                  <Text style={styles.stickerPickerEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Caption Input */}
        <View style={[styles.captionArea, { backgroundColor: '#1a1a1a' }]}>
          <View
            style={[
              styles.captionInputContainer,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}
          >
            <TextInput
              placeholder={
                type === 'video'
                  ? 'Add a caption to your video...'
                  : 'Add a caption to your photo...'
              }
              placeholderTextColor={theme.colors.muted}
              style={[styles.captionInput, { color: theme.colors.text }]}
              value={caption}
              onChangeText={setCaption}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text
              style={[
                styles.charCount,
                {
                  color:
                    caption.length > 450
                      ? theme.colors.danger
                      : theme.colors.muted,
                },
              ]}
            >
              {caption.length}/500
            </Text>
          </View>

          {/* Quick Actions */}
          <View style={styles.quickActionsContainer}>
            <TouchableOpacity
              style={[
                styles.quickAction,
                { backgroundColor: theme.colors.surface },
              ]}
              activeOpacity={0.7}
              onPress={() => Alert.alert('Edit', 'Image editing features coming soon')}
            >
              <MaterialCommunityIcons
                name="pencil"
                size={20}
                color={theme.colors.primary}
              />
              <Text
                style={[
                  styles.quickActionText,
                  { color: theme.colors.primary },
                ]}
              >
                Edit
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.quickAction,
                { backgroundColor: theme.colors.surface },
              ]}
              activeOpacity={0.7}
              onPress={() => setShowStickerPicker(true)}
            >
              <MaterialCommunityIcons
                name="sticker-emoji"
                size={20}
                color={theme.colors.accent}
              />
              <Text
                style={[
                  styles.quickActionText,
                  { color: theme.colors.accent },
                ]}
              >
                Sticker
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.quickAction,
                { backgroundColor: theme.colors.surface },
              ]}
              activeOpacity={0.7}
              onPress={() => Alert.alert('Text', 'Text overlay coming soon')}
            >
              <MaterialCommunityIcons
                name="text"
                size={20}
                color={theme.colors.success}
              />
              <Text
                style={[
                  styles.quickActionText,
                  { color: theme.colors.success },
                ]}
              >
                Text
              </Text>
            </TouchableOpacity>
          </View>

          {/* Confirm Button */}
          <TouchableOpacity
            style={[styles.confirmButton, { backgroundColor: '#25D366' }]}
            onPress={handleConfirm}
            activeOpacity={0.8}
          >
            <MaterialCommunityIcons name="send" size={24} color="#FFFFFF" />
            <Text style={styles.confirmButtonText}>Send</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
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
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  mediaContainer: {
    flex: 1,
  },
  mediaWrapper: {
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  media: {
    width: '100%',
    height: '100%',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  videoBadge: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: 24,
    padding: spacing.sm,
  },
  stickerOverlay: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: spacing.sm,
  },
  removeStickerBtn: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E74C3C',
    justifyContent: 'center',
    alignItems: 'center',
  },
  editControlsContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  editControl: {
    marginBottom: spacing.md,
  },
  editLabel: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: spacing.sm,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  sliderButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sliderBar: {
    flex: 1,
    height: 6,
    backgroundColor: '#25D366',
    borderRadius: 3,
  },
  stickerControlsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  stickerControl: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: 8,
    gap: spacing.sm,
  },
  stickerControlText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 12,
  },
  stickerPickerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(26, 26, 26, 0.95)',
    zIndex: 1000,
  },
  stickerPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  stickerPickerTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  stickerPickerGrid: {
    flex: 1,
  },
  stickerPickerContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  stickerPickerItem: {
    width: '25%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    paddingVertical: spacing.sm,
  },
  stickerPickerEmoji: {
    fontSize: 32,
  },
  captionArea: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    paddingBottom: Platform.OS === 'ios' ? spacing.lg : spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  captionInputContainer: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
    minHeight: 60,
    maxHeight: 100,
  },
  captionInput: {
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: spacing.sm,
  },
  charCount: {
    fontSize: 11,
    marginTop: spacing.xs,
    textAlign: 'right',
    fontWeight: '500',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: 10,
    gap: spacing.xs,
  },
  quickActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    borderRadius: 12,
    gap: spacing.sm,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
