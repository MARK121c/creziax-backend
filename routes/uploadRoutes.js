const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadImage } = require('../controllers/uploadController');
const { protect } = require('../middleware/auth');

// Multer memory storage config for sharp processing
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (req, file, cb) => {
    // Only allow images
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed (jpg, png, webp, etc.)'), false);
    }
  }
});

router.use(protect);

router.post('/image', upload.single('image'), uploadImage);

module.exports = router;
