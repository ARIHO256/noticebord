import React from 'react';
import { Image, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import AttachmentMediaPlayer from './AttachmentMediaPlayer';
import type { NoticeAttachment } from './TweetCard';

interface Props {
  visible: boolean;
  attachment?: NoticeAttachment | null;
  onClose: () => void;
}

export default function AttachmentPreviewModal({ visible, attachment, onClose }: Props) {
  if (!visible || !attachment?.url) return null;
  const type = attachment.file_type;
  const isImage = type === 'image' || !type;
  const isVideo = type === 'video';
  const isAudio = type === 'audio';

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.content}>
          {isImage ? (
            <Image source={{ uri: attachment.url }} style={styles.media} resizeMode="contain" />
          ) : isVideo || isAudio ? (
            <AttachmentMediaPlayer
              uri={attachment.url}
              style={styles.media}
              showControls
              contentFit="contain"
            />
          ) : (
            <Text style={styles.unsupported}>Preview unavailable</Text>
          )}
          <Text style={styles.hint}>Tap anywhere to close</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  content: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    width: '100%',
    height: '75%',
    borderRadius: 12,
  },
  unsupported: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
  hint: {
    marginTop: 20,
    color: '#f8fafc',
    fontSize: 12,
  },
});
