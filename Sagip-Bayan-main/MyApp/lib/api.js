import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const LAN_IP = '192.168.1.208';
const NGROK_URL = ''; // e.g. 'https://xxxx.ngrok.app'
const PORT = 8000;
const HEALTH_PATH = '/health';
const PROD_BASE = 'https://YOUR-PROD-API.com';
const FORCE_BASE = '';

const emulatorBase =
  Platform.OS === 'android'
    ? `http://10.0.2.2:${PORT}`
    : `http://localhost:${PORT}`;

const candidatesDev = [
  ...(NGROK_URL ? [NGROK_URL] : []),
  `http://${LAN_IP}:${PORT}`,
  emulatorBase,
];

let resolvedBase = null;

async function resolveDevBase() {
  if (resolvedBase) return resolvedBase;

  for (const base of candidatesDev) {
    try {
      await axios.get(`${base}${HEALTH_PATH}`, { timeout: 2500 });
      resolvedBase = base;
      console.log('[api] using base:', resolvedBase);
      return resolvedBase;
    } catch (_) {
      // Try the next candidate.
    }
  }

  resolvedBase = candidatesDev[0];
  console.log('[api] fallback base:', resolvedBase);
  return resolvedBase;
}

const api = axios.create({
  baseURL: __DEV__ ? undefined : PROD_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  if (__DEV__) {
    config.baseURL = FORCE_BASE || (await resolveDevBase());
  }

  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = (err?.config?.baseURL || '') + (err?.config?.url || '');

    console.log('[api] error:', {
      url,
      method: err?.config?.method,
      message: err?.message,
      status: err?.response?.status,
      data: err?.response?.data,
    });

    return Promise.reject(err);
  }
);

export default api;
