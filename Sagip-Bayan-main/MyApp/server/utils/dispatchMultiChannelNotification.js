const NotificationDeliveryLog = require("../models/NotificationDeliveryLog");
const sendEmailNotification = require("./sendEmailNotification");
const {
  sendPhilSms,
  trimSmsMessage,
  normalizePhilippinePhoneNumber,
} = require("./sendPhilSms");

function sanitizeText(value, max = 500) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function normalizeType(value) {
  return String(value || "notification")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_:-]+/g, "_")
    .replace(/^_+|_+$/g, "") || "notification";
}

function getUserId(user) {
  return user?._id || user?.id || user?.userId || null;
}

function getUserPhone(user) {
  return user?.phone || user?.phoneNumber || user?.mobile || user?.contactNumber || "";
}

function getUserEmail(user) {
  return String(user?.email || "").trim().toLowerCase();
}

function buildDedupeKey(channel, { type, referenceId, notificationId, userId }) {
  const normalizedType = normalizeType(type);
  const reference = String(referenceId || notificationId || "general").trim();
  return `${channel}:${normalizedType}:${reference}:${String(userId || "").trim()}`;
}

function isUpdateType(type) {
  return ["announcement", "guideline"].includes(normalizeType(type));
}

function isEvacuationType(type) {
  return normalizeType(type).includes("evacuation");
}

function isIncidentApprovalType(type) {
  return normalizeType(type) === "incident_approved";
}

function buildSmsMessage({ type, title, message, barangay, incidentType }) {
  const normalizedType = normalizeType(type);
  const cleanBarangay = sanitizeText(barangay, 80);
  const cleanIncidentType = sanitizeText(incidentType || title, 40);

  if (isEvacuationType(normalizedType)) {
    return "SagipBayan: Evacuation advisory posted. Check the app.";
  }

  if (normalizedType === "announcement") {
    return "SagipBayan: Urgent MDRRMO announcement. Open the app.";
  }

  if (normalizedType === "guideline") {
    return "SagipBayan: Urgent MDRRMO guideline. Open the app.";
  }

  if (normalizedType.includes("incident") || cleanIncidentType) {
    const area = cleanBarangay ? ` in Brgy. ${cleanBarangay}` : "";
    const label = cleanIncidentType || "Danger";
    return `SagipBayan: ${label} reported${area}. Avoid the area.`;
  }

  return `SagipBayan: ${sanitizeText(message || title, 80)}`;
}

function buildEmailSubject({ type, title, urgent }) {
  const cleanTitle = sanitizeText(title, 120) || "SagipBayan Notification";
  if (isUpdateType(type) && !urgent) return `SagipBayan Update: ${cleanTitle}`;
  if (isUpdateType(type)) return `SagipBayan Update: ${cleanTitle}`;
  return `SagipBayan Alert: ${cleanTitle}`;
}

function buildEmailMessage({ type, message, title }) {
  const cleanMessage = String(message || title || "Please open the SagipBayan app for details.").trim();

  if (isUpdateType(type)) {
    return [
      "Dear Resident,",
      "",
      "The MDRRMO has posted a new update:",
      "",
      cleanMessage,
      "",
      "Please open the SagipBayan app for full details.",
      "",
      "This is an automated notification from SagipBayan.",
    ].join("\n");
  }

  if (isIncidentApprovalType(type)) {
    return [
      "Dear Resident,",
      "",
      cleanMessage,
      "",
      "Please open the SagipBayan app for full details.",
      "",
      "This is an automated notification from SagipBayan.",
    ].join("\n");
  }

  return [
    "Dear Resident,",
    "",
    cleanMessage,
    "",
    "Please stay alert and follow official MDRRMO instructions.",
    "",
    "This is an automated notification from SagipBayan.",
  ].join("\n");
}

async function createDeliveryLog({
  userId,
  notificationId,
  referenceId,
  channel,
  provider,
  status,
  phone = "",
  email = "",
  message = "",
  subject = "",
  dedupeKey,
  errorMessage = "",
  sentAt = null,
}) {
  try {
    await NotificationDeliveryLog.create({
      userId,
      notificationId,
      referenceId,
      channel,
      provider,
      status,
      phone,
      email,
      message,
      subject,
      dedupeKey,
      errorMessage: sanitizeText(errorMessage, 500),
      sentAt,
    });
  } catch (err) {
    if (err?.code === 11000) return;
    console.log("[notification delivery log failed]", {
      channel,
      dedupeKey,
      message: err?.message || String(err),
    });
  }
}

async function dispatchSms({ user, context, summary }) {
  const userId = getUserId(user);
  const phone = getUserPhone(user);
  const dedupeKey = buildDedupeKey("sms", { ...context, userId });

  if (await NotificationDeliveryLog.exists({ dedupeKey })) {
    console.log("[sms skipped duplicate]", { dedupeKey });
    summary.sms.skipped += 1;
    return;
  }

  const finalMessage = trimSmsMessage(buildSmsMessage(context), Number(process.env.SMS_MAX_LENGTH || 100));
  const result = await sendPhilSms({ to: phone, message: finalMessage });
  const status = result.ok ? "sent" : result.skipped ? "skipped" : "failed";

  await createDeliveryLog({
    userId,
    notificationId: context.notificationId,
    referenceId: context.referenceId,
    channel: "sms",
    provider: "philsms",
    status,
    phone: normalizePhilippinePhoneNumber(phone),
    message: finalMessage,
    dedupeKey,
    errorMessage: result.reason || result.errorMessage || "",
    sentAt: result.ok ? new Date() : null,
  });

  summary.sms[status] += 1;
}

async function dispatchEmail({ user, context, summary }) {
  const userId = getUserId(user);
  const email = getUserEmail(user);
  const dedupeKey = buildDedupeKey("email", { ...context, userId });

  if (await NotificationDeliveryLog.exists({ dedupeKey })) {
    console.log("[email skipped duplicate]", { dedupeKey });
    summary.email.skipped += 1;
    return;
  }

  const subject = buildEmailSubject(context);
  const emailMessage = buildEmailMessage(context);
  const result = await sendEmailNotification({
    to: email,
    subject,
    message: emailMessage,
  });
  const status = result.ok ? "sent" : result.skipped ? "skipped" : "failed";

  await createDeliveryLog({
    userId,
    notificationId: context.notificationId,
    referenceId: context.referenceId,
    channel: "email",
    provider: "smtp",
    status,
    email,
    message: emailMessage,
    subject,
    dedupeKey,
    errorMessage: result.reason || result.errorMessage || "",
    sentAt: result.ok ? new Date() : null,
  });

  summary.email[status] += 1;
}

async function dispatchMultiChannelNotification({
  users,
  title,
  message,
  type,
  referenceId,
  notificationId,
  urgent = false,
  sendSms = false,
  sendEmail = false,
  barangay = "",
  incidentType = "",
}) {
  const recipients = Array.isArray(users) ? users.filter(Boolean) : [];
  const summary = {
    users: recipients.length,
    sms: { sent: 0, failed: 0, skipped: 0 },
    email: { sent: 0, failed: 0, skipped: 0 },
  };

  if (!recipients.length || (!sendSms && !sendEmail)) return summary;

  const context = {
    title,
    message,
    type,
    referenceId,
    notificationId,
    urgent: Boolean(urgent),
    barangay,
    incidentType,
  };

  await Promise.all(
    recipients.map(async (user) => {
      try {
        if (sendSms && urgent) {
          await dispatchSms({ user, context, summary });
        }

        if (sendEmail) {
          await dispatchEmail({ user, context, summary });
        }
      } catch (err) {
        console.log("[notification dispatch failed]", {
          userId: String(getUserId(user) || ""),
          type: normalizeType(type),
          message: err?.message || String(err),
        });
      }
    })
  );

  console.log("[notification dispatch complete]", {
    type: normalizeType(type),
    referenceId: String(referenceId || ""),
    users: summary.users,
    sms: summary.sms,
    email: summary.email,
  });

  return summary;
}

module.exports = dispatchMultiChannelNotification;
