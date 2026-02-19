import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { notificationService } from '../services/notificationService';
import { NotificationData } from '../types/notification';
import { useAuthStore } from '../store/authStore';

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';

export function useNotifications() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [_socket, setSocket] = useState<Socket | null>(null);
  const { user, token } = useAuthStore();

  // Função para buscar notificações
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const [notifs, count] = await Promise.all([
        notificationService.getNotifications(20),
        notificationService.getUnreadCount(),
      ]);
      setNotifications(notifs);
      setUnreadCount(count);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  // Conectar ao WebSocket
  useEffect(() => {
    if (!user || !token) return;

    const newSocket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    newSocket.on('connect', () => {
      console.log('🔔 Connected to notification service');
      // Entrar na sala do usuário
      newSocket.emit('join', `user:${user.id}`);
    });

    // Escutar novas notificações
    newSocket.on('notification', (notification: NotificationData) => {
      console.log('📬 New notification:', notification);
      setNotifications((prev) => [notification, ...prev]);
      setUnreadCount((prev) => prev + 1);

      // Mostrar notificação nativa do browser
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Nova notificação - VersatlyTask', {
          body: notification.content,
          icon: '/favicon.ico',
        });
      }
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 Disconnected from notification service');
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user, token]);

  // Buscar notificações iniciais
  useEffect(() => {
    if (user && token) {
      fetchNotifications();

      // Pedir permissão para notificações nativas
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }
  }, [user, token]);

  // Marcar como lida
  const markAsRead = async (notificationId: string) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications((prev) =>
        prev.map((notif) =>
          notif.id === notificationId ? { ...notif, isRead: true } : notif
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  // Marcar todas como lidas
  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) =>
        prev.map((notif) => ({ ...notif, isRead: true }))
      );
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read:', error);
    }
  };

  // Deletar notificação
  const deleteNotification = async (notificationId: string) => {
    try {
      await notificationService.deleteNotification(notificationId);
      setNotifications((prev) => prev.filter((notif) => notif.id !== notificationId));
      const deletedNotif = notifications.find((n) => n.id === notificationId);
      if (deletedNotif && !deletedNotif.isRead) {
        setUnreadCount((prev) => Math.max(0, prev - 1));
      }
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  return {
    notifications,
    unreadCount,
    loading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    refresh: fetchNotifications,
  };
}
