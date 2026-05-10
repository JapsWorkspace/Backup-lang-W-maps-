const express = require("express");
const { sendPhilSms } = require("../utils/sendPhilSms");
const sendEmailNotification = require("../utils/sendEmailNotification");

const router = express.Router();

router.post("/sms/test", async (req, res) => {
  try {
    const result = await sendPhilSms({
      to: req.body?.phone,
      message: req.body?.message || "SagipBayan: Test SMS alert.",
    });

    res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err?.message || "SMS test failed",
    });
  }
});

router.post("/email/test", async (req, res) => {
  try {
    const result = await sendEmailNotification({
      to: req.body?.email,
      subject: req.body?.subject || "SagipBayan Test Email",
      message: req.body?.message || "This is a test email from SagipBayan.",
    });

    res.status(result.ok ? 200 : 400).json(result);
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err?.message || "Email test failed",
    });
  }
});

module.exports = router;
