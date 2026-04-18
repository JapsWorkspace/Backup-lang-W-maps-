const nodemailer = require("nodemailer");
const PDFDocument = require("pdfkit");
const fs = require("fs");
const path = require("path");
const ReliefRequest = require("../models/ReliefRequest");

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  connectionTimeout: 30000,
  greetingTimeout: 30000,
  socketTimeout: 30000,
});

function ensureDirectoryExists(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function safeText(value) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function drawText(doc, text, x, y, options = {}) {
  doc.text(text, x, y, options);
}

function drawField(doc, label, value, x, y, width = 240) {
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#16331f")
    .text(label, x, y, { width: 95, continued: false });

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#111827")
    .text(value || "-", x + 95, y, { width });
}

function drawSectionTitle(doc, title, y) {
  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#14532d")
    .text(title, 40, y);

  doc
    .moveTo(40, y + 16)
    .lineTo(555, y + 16)
    .lineWidth(1)
    .strokeColor("#b7d1bb")
    .stroke();
}

function drawHeader(doc, request) {
  doc
    .rect(40, 36, 515, 64)
    .fillAndStroke("#f0f9f2", "#cfe0d1");

  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor("#14532d")
    .text("RELIEF REQUEST REPORT", 40, 52, {
      width: 515,
      align: "center",
    });

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#374151")
    .text("Municipal Disaster Risk Reduction and Management Office", 40, 76, {
      width: 515,
      align: "center",
    });

  let y = 122;

  drawField(doc, "Request No:", safeText(request.requestNo), 40, y);
  drawField(doc, "Status:", safeText(request.status), 320, y, 140);
  y += 20;

  drawField(doc, "Barangay:", safeText(request.barangayName), 40, y);
  drawField(doc, "Date:", request.requestDate ? new Date(request.requestDate).toLocaleString() : "-", 320, y, 180);
  y += 20;

  drawField(doc, "Disaster:", safeText(request.disaster), 40, y, 420);
  y += 26;

  drawField(doc, "Remarks:", safeText(request.remarks) || "-", 40, y, 420);
  y += 34;

  return y;
}

function drawTableHeader(doc, y) {
  const headers = [
    { label: "No.", x: 40, width: 28, align: "center" },
    { label: "Evacuation Center", x: 68, width: 150, align: "left" },
    { label: "Households", x: 218, width: 48, align: "center" },
    { label: "Families", x: 266, width: 45, align: "center" },
    { label: "Male", x: 311, width: 38, align: "center" },
    { label: "Female", x: 349, width: 42, align: "center" },
    { label: "LGBTQ", x: 391, width: 38, align: "center" },
    { label: "PWD", x: 429, width: 34, align: "center" },
    { label: "Preg.", x: 463, width: 40, align: "center" },
    { label: "Senior", x: 503, width: 38, align: "center" },
    { label: "Food Packs", x: 541, width: 40, align: "center" },
  ];

  doc
    .rect(40, y, 541, 24)
    .fillAndStroke("#14532d", "#14532d");

  doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff");

  headers.forEach((col) => {
    doc.text(col.label, col.x + 2, y + 8, {
      width: col.width - 4,
      align: col.align,
    });
  });

  return headers;
}

function drawTableRow(doc, row, index, y, headers) {
  const rowHeight = 24;

  doc
    .rect(40, y, 541, rowHeight)
    .fillAndStroke(index % 2 === 0 ? "#ffffff" : "#f8fbf8", "#dce9de");

  const values = [
    String(index + 1),
    safeText(row.evacuationCenterName),
    String(Number(row.households) || 0),
    String(Number(row.families) || 0),
    String(Number(row.male) || 0),
    String(Number(row.female) || 0),
    String(Number(row.lgbtq) || 0),
    String(Number(row.pwd) || 0),
    String(Number(row.pregnant) || 0),
    String(Number(row.senior) || 0),
    String(Number(row.requestedFoodPacks) || 0),
  ];

  doc.font("Helvetica").fontSize(8).fillColor("#111827");

  headers.forEach((col, i) => {
    doc.text(values[i], col.x + 2, y + 8, {
      width: col.width - 4,
      align: col.align,
    });
  });

  return rowHeight;
}

function drawTotalsCard(doc, request, y) {
  const totals = request.totals || {};

  doc
    .roundedRect(40, y, 515, 104, 12)
    .fillAndStroke("#f8fbf8", "#cfe0d1");

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#14532d")
    .text("Totals Summary", 56, y + 16);

  doc.font("Helvetica").fontSize(10).fillColor("#111827");

  doc.text(`Households: ${Number(totals.households) || 0}`, 56, y + 42);
  doc.text(`Families: ${Number(totals.families) || 0}`, 206, y + 42);
  doc.text(`Male: ${Number(totals.male) || 0}`, 356, y + 42);

  doc.text(`Female: ${Number(totals.female) || 0}`, 56, y + 64);
  doc.text(`LGBTQ: ${Number(totals.lgbtq) || 0}`, 206, y + 64);
  doc.text(`PWD: ${Number(totals.pwd) || 0}`, 356, y + 64);

  doc.text(`Pregnant: ${Number(totals.pregnant) || 0}`, 56, y + 86);
  doc.text(`Senior: ${Number(totals.senior) || 0}`, 206, y + 86);
  doc.text(
    `Requested Food Packs: ${Number(totals.requestedFoodPacks) || 0}`,
    356,
    y + 86
  );

  return y + 118;
}

function drawFooter(doc) {
  const footerY = 760;

  doc
    .moveTo(40, footerY - 12)
    .lineTo(555, footerY - 12)
    .lineWidth(1)
    .strokeColor("#dce9de")
    .stroke();

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#4b5563")
    .text("Prepared by: ____________________________", 40, footerY);

  doc
    .text("Received by: ____________________________", 320, footerY);

  doc
    .font("Helvetica-Oblique")
    .fontSize(8)
    .fillColor("#6b7280")
    .text("System Generated Document", 40, footerY + 22, {
      width: 515,
      align: "center",
    });
}

function generateReliefRequestPdf(request) {
  return new Promise((resolve, reject) => {
    try {
      const uploadDir = path.join(__dirname, "../uploads/relief-requests");
      ensureDirectoryExists(uploadDir);

      const fileName = `${request.requestNo}.pdf`;
      const absoluteFilePath = path.join(uploadDir, fileName);
      const relativeFilePath = `/uploads/relief-requests/${fileName}`;

      console.log("PDF DEBUG: uploadDir =", uploadDir);
      console.log("PDF DEBUG: absoluteFilePath =", absoluteFilePath);
      console.log("PDF DEBUG: relativeFilePath =", relativeFilePath);

      const doc = new PDFDocument({
        margin: 40,
        size: "A4",
      });

      const stream = fs.createWriteStream(absoluteFilePath);
      doc.pipe(stream);

      let y = drawHeader(doc, request);

      drawSectionTitle(doc, "Evacuation Details", y);
      y += 28;

      let headers = drawTableHeader(doc, y);
      y += 24;

      (request.rows || []).forEach((row, index) => {
        if (y > 690) {
          drawFooter(doc);
          doc.addPage();
          y = drawHeader(doc, request);
          drawSectionTitle(doc, "Evacuation Details (continued)", y);
          y += 28;
          headers = drawTableHeader(doc, y);
          y += 24;
        }

        y += drawTableRow(doc, row, index, y, headers);
      });

      y += 18;

      if (y > 620) {
        drawFooter(doc);
        doc.addPage();
        y = drawHeader(doc, request);
      }

      y = drawTotalsCard(doc, request, y);
      drawFooter(doc);

      doc.end();

      stream.on("finish", () => {
        console.log("PDF DEBUG: file created successfully");
        resolve({
          absoluteFilePath,
          relativeFilePath,
        });
      });

      stream.on("error", (err) => {
        console.error("PDF STREAM ERROR:", err);
        reject(err);
      });
    } catch (error) {
      console.error("PDF GENERATION ERROR:", error);
      reject(error);
    }
  });
}

const sendReliefRequestEmail = async (request) => {
  console.log("EMAIL DEBUG START");
  console.log("EMAIL DEBUG request id:", request?._id);
  console.log("EMAIL DEBUG requestNo:", request?.requestNo);
  console.log("EMAIL DEBUG EMAIL_USER exists:", !!process.env.EMAIL_USER);
  console.log("EMAIL DEBUG EMAIL_PASS exists:", !!process.env.EMAIL_PASS);
  console.log("EMAIL DEBUG DRRMO_EMAIL raw:", process.env.DRRMO_EMAIL || "");

  const recipients = String(process.env.DRRMO_EMAIL || "")
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);

  console.log("EMAIL DEBUG parsed recipients:", recipients);

  if (!recipients.length) {
    throw new Error("No DRRMO_EMAIL recipients found in environment variables.");
  }

  const pdfResult = await generateReliefRequestPdf(request);

  await ReliefRequest.findByIdAndUpdate(request._id, {
    pdfFile: pdfResult.relativeFilePath,
    pdfGeneratedAt: new Date(),
    emailSent: false,
  });

  const rowsHtml = (request.rows || [])
    .map(
      (row, index) => `
      <tr>
        <td>${index + 1}</td>
        <td>${safeText(row.evacuationCenterName)}</td>
        <td>${Number(row.households) || 0}</td>
        <td>${Number(row.families) || 0}</td>
        <td>${Number(row.male) || 0}</td>
        <td>${Number(row.female) || 0}</td>
        <td>${Number(row.lgbtq) || 0}</td>
        <td>${Number(row.pwd) || 0}</td>
        <td>${Number(row.pregnant) || 0}</td>
        <td>${Number(row.senior) || 0}</td>
        <td>${Number(row.requestedFoodPacks) || 0}</td>
      </tr>
    `
    )
    .join("");

  try {
    await transporter.verify();
    console.log("EMAIL DEBUG transporter verified successfully");

    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: recipients,
      subject: `New Relief Request - ${request.requestNo}`,
      html: `
        <h2>New Relief Request Submitted</h2>
        <p><strong>Request No:</strong> ${safeText(request.requestNo)}</p>
        <p><strong>Barangay:</strong> ${safeText(request.barangayName)}</p>
        <p><strong>Disaster:</strong> ${safeText(request.disaster)}</p>
        <p><strong>Date:</strong> ${
          request.requestDate
            ? new Date(request.requestDate).toLocaleDateString()
            : "-"
        }</p>
        <p><strong>Remarks:</strong> ${safeText(request.remarks) || "-"}</p>

        <h3>Evacuation Details</h3>
        <table border="1" cellpadding="6" cellspacing="0" style="border-collapse: collapse; width: 100%;">
          <thead>
            <tr>
              <th>No.</th>
              <th>Evacuation Center</th>
              <th>Households</th>
              <th>Families</th>
              <th>Male</th>
              <th>Female</th>
              <th>LGBTQ</th>
              <th>PWD</th>
              <th>Pregnant</th>
              <th>Senior</th>
              <th>Requested Food Packs</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>

        <h3>Totals</h3>
        <ul>
          <li>Households: ${Number(request.totals?.households) || 0}</li>
          <li>Families: ${Number(request.totals?.families) || 0}</li>
          <li>Male: ${Number(request.totals?.male) || 0}</li>
          <li>Female: ${Number(request.totals?.female) || 0}</li>
          <li>LGBTQ: ${Number(request.totals?.lgbtq) || 0}</li>
          <li>PWD: ${Number(request.totals?.pwd) || 0}</li>
          <li>Pregnant: ${Number(request.totals?.pregnant) || 0}</li>
          <li>Senior: ${Number(request.totals?.senior) || 0}</li>
          <li>Requested Food Packs: ${Number(request.totals?.requestedFoodPacks) || 0}</li>
        </ul>

        <p><strong>Attached:</strong> PDF copy of the relief request</p>
      `,
      attachments: [
        {
          filename: `${request.requestNo}.pdf`,
          path: pdfResult.absoluteFilePath,
          contentType: "application/pdf",
        },
      ],
    });

    console.log("EMAIL SENT SUCCESSFULLY");
    console.log("EMAIL SEND INFO:", info);

    await ReliefRequest.findByIdAndUpdate(request._id, {
      emailSent: true,
    });
  } catch (sendErr) {
    console.error("SENDMAIL FULL ERROR:", sendErr);
    console.error("SENDMAIL CODE:", sendErr?.code);
    console.error("SENDMAIL RESPONSE:", sendErr?.response);
    console.error("SENDMAIL COMMAND:", sendErr?.command);
    throw sendErr;
  }
};

module.exports = sendReliefRequestEmail;
