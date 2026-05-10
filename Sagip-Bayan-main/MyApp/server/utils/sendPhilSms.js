const fetch = require("node-fetch");

const PHILSMS_SEND_URL = "https://app.philsms.com/api/v3/sms/send";

function trimSmsMessage(message, maxLength = 100) {
  const clean = String(message || "")
    .replace(/\s+/g, " ")
    .trim();

  if (clean.length <= maxLength) return clean;

  return clean.slice(0, Math.max(0, maxLength - 3)).trimEnd() + "...";
}

function normalizePhilippinePhoneNumber(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (!digits) return "";

  if (digits.startsWith("09") && digits.length === 11) {
    return "+63" + digits.slice(1);
  }

  if (digits.startsWith("9") && digits.length === 10) {
    return "+63" + digits;
  }

  if (digits.startsWith("639") && digits.length === 12) {
    return "+" + digits;
  }

  if (digits.startsWith("63") && digits.length === 12) {
    return "+" + digits;
  }

  return "";
}

async function sendPhilSms({ to, message }) {
  const token = process.env.PHILSMS_API_TOKEN;
  const senderId = process.env.PHILSMS_SENDER_ID || "SagipBayan";
  const maxLength = Number(process.env.SMS_MAX_LENGTH || 100);

  if (!token) {
    console.log("[sms skipped] missing PHILSMS_API_TOKEN");
    return { ok: false, skipped: true, reason: "missing_token" };
  }

  const normalizedTo = normalizePhilippinePhoneNumber(to);
  if (!normalizedTo) {
    console.log("[sms skipped missing/invalid phone]", { to });
    return { ok: false, skipped: true, reason: "invalid_phone" };
  }

  const finalMessage = trimSmsMessage(message, maxLength);

  try {
    console.log("[sms sending]", {
      to: normalizedTo,
      senderId,
      length: finalMessage.length,
    });

    const response = await fetch(PHILSMS_SEND_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        recipient: normalizedTo,
        sender_id: senderId,
        type: "plain",
        message: finalMessage,
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errorMessage =
        data?.message || data?.error || `PhilSMS request failed (${response.status})`;
      console.log("[sms failed]", {
        to: normalizedTo,
        status: response.status,
        message: errorMessage,
      });
      return {
        ok: false,
        skipped: false,
        reason: "provider_error",
        status: response.status,
        errorMessage,
        data,
      };
    }

    console.log("[sms sent]", {
      to: normalizedTo,
      status: response.status,
    });

    return {
      ok: true,
      skipped: false,
      to: normalizedTo,
      message: finalMessage,
      data,
    };
  } catch (err) {
    console.log("[sms failed]", {
      to: normalizedTo,
      message: err?.message || String(err),
    });
    return {
      ok: false,
      skipped: false,
      reason: "send_failed",
      errorMessage: err?.message || String(err),
    };
  }
}

module.exports = {
  sendPhilSms,
  normalizePhilippinePhoneNumber,
  trimSmsMessage,
};
