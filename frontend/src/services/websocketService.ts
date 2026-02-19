import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

const SOCKET_URL = import.meta.env.VITE_API_URL?.replace('/api', '') || (import.meta.env.PROD ? '' : 'http://localhost:5000');

export const websocketService = {
  connect(token: string) {
    if (socket?.connected) {
      return socket;
    }

    socket = io(SOCKET_URL, {
      auth: {
        token,
      },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('✅ WebSocket connected');
    });

    socket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });

    return socket;
  },

  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  },

  joinBoard(boardId: string) {
    if (socket) {
      socket.emit('join:board', boardId);
      console.log(`📋 Joined board: ${boardId}`);
    }
  },

  leaveBoard(boardId: string) {
    if (socket) {
      socket.emit('leave:board', boardId);
      console.log(`📋 Left board: ${boardId}`);
    }
  },

  // Listen to board events
  onBoardEvent(event: string, callback: (data: any) => void) {
    if (socket) {
      socket.on(event, callback);
    }
  },

  // Remove listener
  offBoardEvent(event: string, callback?: (data: any) => void) {
    if (socket) {
      if (callback) {
        socket.off(event, callback);
      } else {
        socket.off(event);
      }
    }
  },

  // Emit events
  emit(event: string, data: any) {
    if (socket?.connected) {
      socket.emit(event, data);
    }
  },

  getSocket() {
    return socket;
  },

  isConnected() {
    return socket?.connected || false;
  },
};
