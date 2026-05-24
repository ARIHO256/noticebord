import React from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { useTheme } from '../context/ThemeContext';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
  animated?: boolean;
}

export default function SkeletonLoader({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
  animated = true,
}: SkeletonLoaderProps) {
  const { theme } = useTheme();
  const opacity = new Animated.Value(0.6);

  React.useEffect(() => {
    if (animated) {
      const animation = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.6,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      animation.start();
      return () => animation.stop();
    }
  }, [animated]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        {
          width,
          height,
          borderRadius,
          backgroundColor: theme.colors.surface,
          opacity: animated ? opacity : 0.6,
        },
        style,
      ]}
    />
  );
}

// Skeleton components for common layouts

export function NoticeSkeleton() {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: theme.colors.card },
      ]}
    >
      {/* Header */}
      <View style={styles.skeletonHeader}>
        <SkeletonLoader width={44} height={44} borderRadius={22} />
        <View style={{ flex: 1, gap: 8, marginLeft: 12 }}>
          <SkeletonLoader width="70%" height={14} />
          <SkeletonLoader width="50%" height={12} />
        </View>
      </View>

      {/* Content */}
      <View style={{ gap: 8, marginVertical: 12 }}>
        <SkeletonLoader width="100%" height={14} />
        <SkeletonLoader width="85%" height={14} />
      </View>

      {/* Image */}
      <SkeletonLoader width="100%" height={200} borderRadius={12} style={{ marginVertical: 12 }} />

      {/* Footer */}
      <View style={{ flexDirection: 'row', gap: 12, paddingTop: 8 }}>
        <SkeletonLoader width="30%" height={12} />
        <SkeletonLoader width="30%" height={12} />
      </View>
    </View>
  );
}

export function ConversationSkeleton() {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.conversationItem,
        { backgroundColor: theme.colors.card },
      ]}
    >
      <SkeletonLoader width={56} height={56} borderRadius={28} />
      <View style={{ flex: 1, marginLeft: 12, gap: 8 }}>
        <SkeletonLoader width="60%" height={14} />
        <SkeletonLoader width="80%" height={12} />
      </View>
      <SkeletonLoader width={40} height={12} />
    </View>
  );
}

export function ProfileSkeleton() {
  const { theme } = useTheme();
  return (
    <View style={{ backgroundColor: theme.colors.background, flex: 1 }}>
      {/* Cover */}
      <SkeletonLoader width="100%" height={150} borderRadius={0} />

      {/* Avatar */}
      <View style={{ alignItems: 'center', marginTop: -40, marginBottom: 16 }}>
        <SkeletonLoader width={88} height={88} borderRadius={44} />
      </View>

      {/* Info */}
      <View style={{ paddingHorizontal: 16, gap: 8 }}>
        <SkeletonLoader width="60%" height={18} style={{ alignSelf: 'center' }} />
        <SkeletonLoader width="80%" height={14} style={{ alignSelf: 'center' }} />
        
        {/* Stats */}
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
          <SkeletonLoader width="30%" height={60} borderRadius={12} />
          <SkeletonLoader width="30%" height={60} borderRadius={12} />
          <SkeletonLoader width="30%" height={60} borderRadius={12} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: '#E0E0E0',
  },
  card: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    elevation: 2,
  },
  skeletonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
});
