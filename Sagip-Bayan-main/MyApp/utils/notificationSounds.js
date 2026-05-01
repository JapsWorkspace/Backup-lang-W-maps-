import AsyncStorage from "@react-native-async-storage/async-storage";

let normalSound = null;
let dangerSound = null;
let lastPlayedAt = 0;

const MIN_SOUND_GAP_MS = 1200;
const NOTIFICATION_SOUND_SETTINGS_KEY = "notificationSoundSettings";
const DEFAULT_NOTIFICATION_SOUND_SETTINGS = {
  normalNotificationSound: true,
  dangerNotificationSound: true,
};

export async function getNotificationSoundSettings() {
  try {
    const raw = await AsyncStorage.getItem(NOTIFICATION_SOUND_SETTINGS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};

    return {
      ...DEFAULT_NOTIFICATION_SOUND_SETTINGS,
      ...(parsed && typeof parsed === "object" ? parsed : {}),
    };
  } catch (err) {
    console.log("[notification sound] settings read failed:", err?.message);
    return DEFAULT_NOTIFICATION_SOUND_SETTINGS;
  }
}

export async function updateNotificationSoundSettings(nextSettings = {}) {
  const currentSettings = await getNotificationSoundSettings();
  const updatedSettings = {
    ...currentSettings,
    ...nextSettings,
  };

  await AsyncStorage.setItem(
    NOTIFICATION_SOUND_SETTINGS_KEY,
    JSON.stringify(updatedSettings)
  );

  return updatedSettings;
}

async function getAudio() {
  const module = await import("expo-av");
  return module.Audio;
}

async function configureAudioMode() {
  try {
    const Audio = await getAudio();
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true,
    });
  } catch (err) {
    console.log("[notification sound] audio mode failed:", err?.message);
  }
}

async function loadSound(kind) {
  const Audio = await getAudio();

  if (kind === "danger") {
    if (!dangerSound) {
      const loaded = await Audio.Sound.createAsync(
        require("../Notification/dangernotification.mp3")
      );
      dangerSound = loaded.sound;
    }
    return dangerSound;
  }

  if (!normalSound) {
    const loaded = await Audio.Sound.createAsync(
      require("../Notification/notification.mp3")
    );
    normalSound = loaded.sound;
  }
  return normalSound;
}

async function playSound(kind) {
  try {
    const settings = await getNotificationSoundSettings();
    const isDanger = kind === "danger";

    if (isDanger && !settings.dangerNotificationSound) {
      console.log("[notification sound] skipped danger sound: disabled");
      return;
    }

    if (!isDanger && !settings.normalNotificationSound) {
      console.log("[notification sound] skipped normal sound: disabled");
      return;
    }

    const now = Date.now();
    if (now - lastPlayedAt < MIN_SOUND_GAP_MS) return;
    lastPlayedAt = now;

    await configureAudioMode();
    const sound = await loadSound(kind);
    await sound.stopAsync().catch(() => {});
    await sound.setPositionAsync(0);
    await sound.playAsync();
  } catch (err) {
    console.log("[notification sound] play failed:", err?.message);
  }
}

export function playNormalNotificationSound() {
  return playSound("normal");
}

export function playDangerNotificationSound() {
  return playSound("danger");
}

export async function stopNotificationSound() {
  await Promise.all([
    normalSound?.stopAsync?.().catch(() => {}),
    dangerSound?.stopAsync?.().catch(() => {}),
  ]);
}

export async function unloadNotificationSounds() {
  await Promise.all([
    normalSound?.unloadAsync?.().catch(() => {}),
    dangerSound?.unloadAsync?.().catch(() => {}),
  ]);
  normalSound = null;
  dangerSound = null;
}

export async function setupNotificationChannels() {
  // Local in-app sounds use expo-av. Push notification channels require
  // expo-notifications plus a native/dev-client build with bundled sound files.
  // Keep this no-op so a missing/bundler-broken push module cannot block
  // in-app notification polling and guideline notifications.
  return false;
}
