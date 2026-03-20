import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

let socket = null;

export const getSocket = () => {
  if (!socket) {
    const token = localStorage.getItem('token');
    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const joinOrderRoom = (orderId) => {
  const s = getSocket();
  s.emit('join-order', orderId);
};

export const onOrderUpdate = (callback) => {
  const s = getSocket();
  s.on('order-update', callback);
  return () => { s.off('order-update', callback); };
};

export const onNotification = (callback) => {
  const s = getSocket();
  s.on('notification', callback);
  return () => { s.off('notification', callback); };
};
