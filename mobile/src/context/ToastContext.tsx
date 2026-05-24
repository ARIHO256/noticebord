import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastContainer, ToastData, ToastType } from '../components/Toast';

interface ToastContextType {
  showToast: (message: string, type?: ToastType, options?: Partial<ToastData>) => void;
  showSuccess: (message: string, options?: Partial<ToastData>) => void;
  showError: (message: string, options?: Partial<ToastData>) => void;
  showInfo: (message: string, options?: Partial<ToastData>) => void;
  showWarning: (message: string, options?: Partial<ToastData>) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const generateId = () => `toast-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  const showToast = useCallback(
    (message: string, type: ToastType = 'info', options?: Partial<ToastData>) => {
      const toast: ToastData = {
        id: generateId(),
        message,
        type,
        duration: 3000,
        ...options,
      };
      setToasts((prev) => [...prev, toast]);
    },
    []
  );

  const showSuccess = useCallback(
    (message: string, options?: Partial<ToastData>) => {
      showToast(message, 'success', options);
    },
    [showToast]
  );

  const showError = useCallback(
    (message: string, options?: Partial<ToastData>) => {
      showToast(message, 'error', { duration: 4000, ...options });
    },
    [showToast]
  );

  const showInfo = useCallback(
    (message: string, options?: Partial<ToastData>) => {
      showToast(message, 'info', options);
    },
    [showToast]
  );

  const showWarning = useCallback(
    (message: string, options?: Partial<ToastData>) => {
      showToast(message, 'warning', { duration: 3500, ...options });
    },
    [showToast]
  );

  const hideToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast, showSuccess, showError, showInfo, showWarning }}>
      {children}
      <ToastContainer toasts={toasts} onHide={hideToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
};






