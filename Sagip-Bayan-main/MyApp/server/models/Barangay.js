const mongoose = require('mongoose');

const BARANGAY_OPTIONS = [
  "Bagong Sikat",
  "Bagong Silang",
  "Calabasa",
  "Don Mariano Marcos",
  "Dampulan",
  "Hilera",
  "Imelda Poblacion",
  "Ibunia",
  "Lambakin",
  "Langla",
  "Magsalisi",
  "Malabon Kaingin",
  "Marawa",
  "Niyugan",
  "Putlod",
  "San Jose",
  "San Pablo",
  "San Roque",
  "Santo Tomas Norte",
  "Santo Tomas Sur",
  "Sapang Putik",
  "Ulanin-Pitak"
];

const barangaySchema = new mongoose.Schema(
  {
    username: { type: String, required: true, trim: true },
    email: { type: String, unique: true, required: true, trim: true, lowercase: true },
    password: { type: String, required: true },

    barangayName: {
      type: String,
      required: true,
      trim: true,
      enum: BARANGAY_OPTIONS
    },

    verified: { type: Boolean, default: true },

    phoneNumber: { type: String, required: true, trim: true },
    hotline: { type: String, default: '', trim: true },
    address: { type: String, required: true, trim: true },

    archived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

barangaySchema.index(
  { barangayName: 1 },
  {
    unique: true,
    partialFilterExpression: { archived: false }
  }
);

module.exports = mongoose.model('Barangay', barangaySchema);
