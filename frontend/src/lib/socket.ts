import { io, Socket } from "socket.io-client";
import { API_BASE } from "./api";

let socket: Socket | null = null;

export function connectSocket(accessToken: string): Socket {
  if (socket) socket.disconnect();
  socket = io(API_BASE, {
    auth: { token: accessToken },
    withCredentials: true,
  });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
