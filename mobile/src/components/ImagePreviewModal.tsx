import React from 'react';
import { Modal, Pressable, StyleSheet, View, Image, Text } from 'react-native';

interface Props {
  visible: boolean;
  uri?: string | null;
  onClose: () => void;
  footer?: React.ReactNode;
}

export default function ImagePreviewModal({ visible, uri, onClose, footer }: Props) {
  if (!visible || !uri) return null;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={styles.content}>
          <Image source={{ uri }} style={styles.image} resizeMode="contain" />
          {footer ? <View style={styles.footer}>{footer}</View> : null}
          <Text style={styles.hint}>Tap anywhere to close</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  content: {
    width: '100%',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '80%',
  },
  hint: {
    marginTop: 12,
    color: '#f1f5f9',
    fontSize: 12,
  },
  footer: {
    marginTop: 16,
    width: '100%',
    alignItems: 'center',
  },
});
