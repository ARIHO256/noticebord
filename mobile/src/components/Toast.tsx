import React, { useEffect, useRef, useCallback } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Dimensions,
  Platform,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { spacing } from '../theme';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface ToastData {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
  action?: {
    label: string;
    onPress: () => void;
  };
}

interface ToastProps {
  toast: ToastData;
  onHide: (id: string) => void;
}

const ToastComponent: React.FC<ToastProps> = ({ toast, onHide }) => {
  const { theme } = useTheme();
  const slideAnim = useRef(new Animated.Value(-100));
  const opacityAnim = useRef(new Animated.Value(0));

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(slideAnim.current, {
        toValue: -100,
        duration: 250,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim.current, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide(toast.id);
    });
  }, [toast.id, onHide]);

  useEffect(() => {
    // Slide in animation
    Animated.parallel([
      Animated.spring(slideAnim.current, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }),
      Animated.timing(opacityAnim.current, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    // Auto hide after duration
    const duration = toast.duration || 3000;
    const timer = setTimeout(() => {
      hideToast();
    }, duration);

    return () => {
      clearTimeout(timer);
      // Clean up animations
      slideAnim.current.stopAnimation();
      opacityAnim.current.stopAnimation();
    };
  }, [toast.id, toast.duration, hideToast]);

  const getToastConfig = () => {
    switch (toast.type) {
      case 'success':
        return {
          icon: 'check-circle',
          backgroundColor: '#10b981',
          iconColor: '#ffffff',
          borderColor: '#059669',
        };
      case 'error':
        return {
          icon: 'alert-circle',
          backgroundColor: '#ef4444',
          iconColor: '#ffffff',
          borderColor: '#dc2626',
        };
      case 'warning':
        return {
          icon: 'alert',
          backgroundColor: '#f59e0b',
          iconColor: '#ffffff',
          borderColor: '#d97706',
        };
      case 'info':
      default:
        return {
          icon: 'information',
          backgroundColor: theme.colors.primary,
          iconColor: '#ffffff',
          borderColor: theme.colors.primary,
        };
    }
  };

  const config = getToastConfig();

  return (
      <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim.current }],
          opacity: opacityAnim.current,
          backgroundColor: config.backgroundColor,
          borderColor: config.borderColor,
          shadowColor: config.backgroundColor,
        },
      ]}
    >
      <View style={styles.content}>
        <MaterialCommunityIcons name={config.icon as keyof typeof MaterialCommunityIcons.glyphMap} size={24} color={config.iconColor} />
        <View style={styles.textContainer}>
          <Text style={styles.message}>{toast.message}</Text>
        </View>
        {toast.action && (
          <TouchableOpacity
            onPress={() => {
              toast.action?.onPress();
              hideToast();
            }}
            style={styles.actionButton}
          >
            <Text style={styles.actionText}>{toast.action.label}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={hideToast} style={styles.closeButton}>
          <MaterialCommunityIcons name="close" size={20} color={config.iconColor} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

interface ToastContainerProps {
  toasts: ToastData[];
  onHide: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onHide }) => {
  if (toasts.length === 0) return null;

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      {toasts.map((toast) => (
        <ToastComponent key={toast.id} toast={toast} onHide={onHide} />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
    pointerEvents: 'box-none',
  },
  container: {
    width: SCREEN_WIDTH - spacing.lg * 2,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: spacing.sm,
    ...Platform.select({
      ios: {
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.md,
    gap: spacing.sm,
  },
  textContainer: {
    flex: 1,
  },
  message: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
  actionButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  actionText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  closeButton: {
    padding: spacing.xs,
    marginLeft: spacing.xs,
  },
});

