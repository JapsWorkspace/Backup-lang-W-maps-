const INVISIBLE_WHITESPACE_REGEX = /[\u200B-\u200D\uFEFF]/g;
const MULTI_WHITESPACE_REGEX = /\s+/g;

export const NAME_MAX_LENGTH = 50;
export const USERNAME_MAX_LENGTH = 24;
export const ADDRESS_MAX_LENGTH = 160;
export const SEARCH_MAX_LENGTH = 80;
export const INCIDENT_LOCATION_MAX_LENGTH = 120;
export const INCIDENT_DESCRIPTION_MAX_LENGTH = 500;
export const CONNECTION_CODE_MAX_LENGTH = 12;

function asString(value) {
  return typeof value === "string" ? value : value == null ? "" : String(value);
}

export function normalizeWhitespace(value) {
  return asString(value)
    .replace(INVISIBLE_WHITESPACE_REGEX, "")
    .replace(MULTI_WHITESPACE_REGEX, " ")
    .trim();
}

export function sanitizeTextInput(value, { maxLength, collapse = true } = {}) {
  const base = asString(value).replace(INVISIBLE_WHITESPACE_REGEX, "");
  const normalized = collapse ? base.replace(MULTI_WHITESPACE_REGEX, " ") : base;
  const trimmed = normalized.trim();

  if (typeof maxLength === "number" && maxLength >= 0) {
    return trimmed.slice(0, maxLength);
  }

  return trimmed;
}

export function sanitizeName(value) {
  return sanitizeTextInput(value, {
    maxLength: NAME_MAX_LENGTH,
  }).replace(/[^A-Za-z.\-'\s]/g, "");
}

export function sanitizeUsername(value) {
  return asString(value)
    .replace(INVISIBLE_WHITESPACE_REGEX, "")
    .replace(/\s+/g, "")
    .replace(/[^A-Za-z0-9_]/g, "")
    .slice(0, USERNAME_MAX_LENGTH);
}

export function sanitizeEmailInput(value) {
  return asString(value)
    .replace(INVISIBLE_WHITESPACE_REGEX, "")
    .trim();
}

export function sanitizePhoneLocal(value) {
  return asString(value).replace(/\D/g, "").slice(0, 10);
}

export function normalizeEmail(value) {
  return sanitizeEmailInput(value).toLowerCase();
}

export function sanitizeSearchText(value) {
  return sanitizeTextInput(value, {
    maxLength: SEARCH_MAX_LENGTH,
  });
}

export function sanitizeConnectionCode(value) {
  return asString(value)
    .replace(INVISIBLE_WHITESPACE_REGEX, "")
    .replace(/\s+/g, "")
    .replace(/[^A-Za-z0-9-]/g, "")
    .toUpperCase()
    .slice(0, CONNECTION_CODE_MAX_LENGTH);
}

export function isNonEmptyText(value) {
  return normalizeWhitespace(value).length > 0;
}

export function isValidEmail(value) {
  const email = normalizeEmail(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidGmail(value) {
  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/.test(normalizeEmail(value));
}

export function getUsernameError(value) {
  const username = sanitizeUsername(value);

  if (!username) return "Username is required.";
  if (username.length < 4) {
    return "Username must be at least 4 characters.";
  }
  if (!/^[A-Za-z0-9_]+$/.test(username)) {
    return "Username can only use letters, numbers, and underscores.";
  }

  return "";
}

export function getPhoneError(value) {
  const phone = sanitizePhoneLocal(value);

  if (!phone) return "Mobile number is required.";
  if (!/^9\d{9}$/.test(phone)) {
    return "Enter a valid 10-digit mobile number starting with 9.";
  }

  return "";
}

export function getPasswordError(value, { minLength = 8, maxLength = 64 } = {}) {
  const password = asString(value).replace(INVISIBLE_WHITESPACE_REGEX, "").trim();

  if (!password) return "Password is required.";
  if (password.length < minLength) {
    return `Password must be at least ${minLength} characters.`;
  }
  if (password.length > maxLength) {
    return `Password must not exceed ${maxLength} characters.`;
  }
  if (!/[A-Za-z]/.test(password)) {
    return "Password must include at least one letter.";
  }
  if (!/[0-9]/.test(password)) {
    return "Password must include at least one number.";
  }

  return "";
}

export function toNumber(value) {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

export function isValidCoordinate(lat, lng) {
  const parsedLat = toNumber(lat);
  const parsedLng = toNumber(lng);

  return (
    parsedLat != null &&
    parsedLng != null &&
    parsedLat >= -90 &&
    parsedLat <= 90 &&
    parsedLng >= -180 &&
    parsedLng <= 180
  );
}

export function normalizeCoordinate(value) {
  if (!value || typeof value !== "object") return null;

  const latitude = toNumber(
    value.latitude ??
      value.lat ??
      value.location?.latitude ??
      value.location?.lat
  );
  const longitude = toNumber(
    value.longitude ??
      value.lng ??
      value.lon ??
      value.location?.longitude ??
      value.location?.lng ??
      value.location?.lon
  );

  if (!isValidCoordinate(latitude, longitude)) {
    return null;
  }

  return { latitude, longitude };
}

export function sanitizeIncidentLocation(value) {
  return sanitizeTextInput(value, {
    maxLength: INCIDENT_LOCATION_MAX_LENGTH,
  });
}

export function sanitizeIncidentDescription(value) {
  return sanitizeTextInput(value, {
    maxLength: INCIDENT_DESCRIPTION_MAX_LENGTH,
  });
}

export function safeDisplayText(value, fallback = "Unknown") {
  const text = sanitizeTextInput(value);
  return text || fallback;
}

export function isSafeHttpUrl(value) {
  const url = sanitizeTextInput(value, { maxLength: 2048, collapse: false });
  return /^https?:\/\//i.test(url);
}
