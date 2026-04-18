// myapp/lib/api.js
// One Axios client that works for emulator, real devices, ngrok, and production.
// Expo-friendly: no native changes required.

import axios from 'axios';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

/* -------------------------------------------------------------------------- */
/*                               CONFIGURE THESE                               */
/* -------------------------------------------------------------------------- */

// 1) Your laptop's LAN IP (for real phone via Expo Go)

const LAN_IP = '192.168.1.8';

// 2) Optional HTTPS tunnel for dev (ngrok, cloudflared, etc.)
const NGROK_URL = ''; // e.g. 'https://xxxx.ngrok.app'

// 3) Backend port
// 3) Backend port
const PORT = 8000;

// 4) Health probe path
const HEALTH_PATH = '/health';
// 5) Production base
const PROD_BASE = 'https://YOUR-PROD-API.com';

// 6) Optional override
// 6) Optional override
const FORCE_BASE = '';

/* -------------------------------------------------------------------------- */
/*                              RUNTIME CANDIDATES                             */
/* -------------------------------------------------------------------------- */

const candidatesDev = [
  ...(NGROK_URL ? [NGROK_URL] : []),
  `http://${LAN_IP}:${PORT}`,
  Platform.OS === 'android'
    ? `http://10.0.2.2:${PORT}`
    : `http://localhost:${PORT}`,
  Platform.OS === 'android'
    ? `http://10.0.2.2:${PORT}`
    : `http://localhost:${PORT}`,
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
      // try next
      // try next
    }
  }

  resolvedBase = candidatesDev[0];
  console.log('[api] fallback base:', resolvedBase);
  return resolvedBase;
}

/* -------------------------------------------------------------------------- */
/*                               AXIOS INSTANCE                                */
/* -------------------------------------------------------------------------- */

const api = axios.create({
  baseURL: __DEV__ ? undefined : PROD_BASE,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

/* -------------------------------------------------------------------------- */
/*                      REQUEST INTERCEPTOR (FIXED ✅)                         */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*                      REQUEST INTERCEPTOR (FIXED ✅)                         */
/* -------------------------------------------------------------------------- */

api.interceptors.request.use(async (config) => {
  // ✅ Resolve base URL dynamically in development
  // ✅ Resolve base URL dynamically in development
  if (__DEV__) {
    if (FORCE_BASE) {
      config.baseURL = FORCE_BASE;
    } else {
      const base = await resolveDevBase();
      config.baseURL = base;
    }
  }

  // ✅ ATTACH AUTH TOKEN (THIS FIXES 401)
  const token = await AsyncStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/* -------------------------------------------------------------------------- */
/*                       RESPONSE INTERCEPTOR (LOGGING)                        */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/*                       RESPONSE INTERCEPTOR (LOGGING)                        */
/* -------------------------------------------------------------------------- */

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url =
      (err?.config?.baseURL || '') + (err?.config?.url || '');

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