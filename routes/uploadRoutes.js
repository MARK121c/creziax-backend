const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadImage, uploadAnyFile } = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');

// Multer memory storage config for avatar/logo image processing with sharp
const memoryStorage = multer.memoryStorage();

// Ensure storage/files directory exists for direct disk streaming of attachments
const filesStoragePath = path.join(__dirname, '..', 'storage', 'files');
if (!fs.existsSync(filesStoragePath)) {
  fs.mkdirSync(filesStoragePath, { recursive: true });
}

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, filesStoragePath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    const safeName = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, safeName);
  }
});

// Config for avatars/logos (restricted to 5MB images)
const uploadImageConfig = multer({
  storage: memoryStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed (jpg, png, webp, etc.)'), false);
    }
  }
});

// Config for chat attachments & media (up to 1GB = 1024 * 1024 * 1024 bytes)
const uploadFileConfig = multer({
  storage: diskStorage,
  limits: { fileSize: 1024 * 1024 * 1024 } // 1GB max
});

router.use(protect);

router.post('/image', uploadImageConfig.single('image'), uploadImage);
router.post('/file', uploadFileConfig.single('file'), uploadAnyFile);

module.exports = router;
