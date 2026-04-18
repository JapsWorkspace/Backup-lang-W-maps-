const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendVerificationEmail = async (
  email,
  verificationLink,
  firstName = "there"
) => {
  const templatePath = path.join(
    __dirname,
    "../emails/verifyEmail.html"
  );

  let html = fs.readFileSync(templatePath, "utf8");

  html = html
    .replace(/{{VERIFY_LINK}}/g, verificationLink)
    .replace(/{{FIRST_NAME}}/g, firstName)
    .replace(
      /{{LOGO_URL}}/g,
      "https://YOUR_PUBLIC_DOMAIN/uploads/logo/sagipbayanlogo.png"
    );

  console.log("✅ Verification email HTML loaded:", html.length);

  return transporter.sendMail({
    from: `"SagipBayan" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Verify Your Email",
    html,
  });
};

module.exports = sendVerificationEmail;
