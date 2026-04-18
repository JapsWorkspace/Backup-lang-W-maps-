import { io } from "socket.io-client";

const SOCKET_URL = "http://192.168.1.8:8000"; // same as your backend

export const socket = io(SOCKET_URL, {
  transports: ["websocket"],
  autoConnect: false,
});