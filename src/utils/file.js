const fs = require('fs');
const path = require('path');
const multer = require('multer');
let sharp;
try { sharp = require('sharp'); } catch (e) { sharp = null; }
const { randomUUID } = require('crypto');

const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(uploadsDir, 'products');
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${randomUUID()}${ext || '.jpg'}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowed.includes(ext)) return cb(new Error('Invalid image type'));
    cb(null, true);
  }
});

async function processImage(filePath) {
  if (!sharp) return filePath;
  const dir = path.dirname(filePath);
  const base = path.basename(filePath, path.extname(filePath));
  const out = path.join(dir, `${base}-md.jpg`);
  await sharp(filePath).rotate().resize(800).jpeg({ quality: 80 }).toFile(out);
  return out;
}

module.exports = { upload, processImage };
