import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { VideoContentFit, VideoView, useVideoPlayer } from 'expo-video';

type AttachmentMediaPlayerProps = {
  uri?: string | null;
  style?: StyleProp<ViewStyle>;
  /**
   * Maps to the Expo Video `contentFit` prop.
   * Defaults to `contain` to avoid cropping.
   */
  contentFit?: VideoContentFit;
  /**
   * Whether the native controls should be visible.
   */
  showControls?: boolean;
  /**
   * When true playback starts automatically, otherwise the media stays paused.
   */
  shouldPlay?: boolean;
};

export default function AttachmentMediaPlayer({
  uri,
  style,
  contentFit = 'contain',
  showControls = true,
  shouldPlay = false,
}: AttachmentMediaPlayerProps) {
  const player = useVideoPlayer(
    uri ? { uri } : null,
    (instance) => {
      instance.loop = false;
      if (!shouldPlay) {
        instance.pause();
      }
    },
  );

  useEffect(() => {
    if (shouldPlay) {
      player.play();
    } else {
      player.pause();
    }
  }, [player, shouldPlay]);

  if (!uri) {
    return null;
  }

  return (
    <VideoView
      player={player}
      style={style}
      nativeControls={showControls}
      contentFit={contentFit}
    />
  );
}

