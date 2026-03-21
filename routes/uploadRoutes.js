const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadImage, uploadAnyFile } = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');

// Multer memory storage config
const storage = multer.memoryStorage();

// Config for avatars/logos (restricted to 5MB images)
const uploadImageConfig = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed (jpg, png, webp, etc.)'), false);
    }
  }
});

// Config for chat attachments (up to 100MB, any file type)
const uploadFileConfig = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 } // 100MB max
});

router.use(protect);

router.post('/image', uploadImageConfig.single('image'), uploadImage);
router.post('/file', uploadFileConfig.single('file'), uploadAnyFile);

module.exports = router;
