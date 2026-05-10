const nodemailer = require("nodemailer");

function toBoolean(value) {
  if (typeof value === "boolean") return value;
  return ["true", "1", "yes", "y"].includes(String(value || "").trim().toLowerCase());
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtml(message) {
  const paragraphs = String(message || "")
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${escapeHtml(part).replace(/\n/g, "<br>")}</p>`)
    .join("");

  return [
    '<div style="font-family:Arial,sans-serif;color:#111827;line-height:1.55">',
    paragraphs || "<p>SagipBayan notification</p>",
    "</div>",
  ].join("");
}

async function sendEmailNotification({ to, subject, message, html }) {
  if (!to) {
    console.log("[email skipped missing recipient]");
    return { ok: false, skipped: true, reason: "missing_email" };
  }

  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.EMAIL_FROM || user;

  if (!host || !port || !from) {
    console.log("[email skipped missing smtp config]");
    return { ok: false, skipped: true, reason: "missing_smtp_config" };
  }

  try {
    console.log("[email sending]", { to, subject });

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: toBoolean(process.env.SMTP_SECURE),
      auth: user && pass ? { user, pass } : undefined,
    });

    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text: message,
      html: html || buildHtml(message),
    });

    console.log("[email sent]", {
      to,
      messageId: info?.messageId || "",
    });

    return { ok: true, skipped: false, messageId: info?.messageId || "" };
  } catch (err) {
    console.log("[email failed]", {
      to,
      subject,
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

module.exports = sendEmailNotification;
