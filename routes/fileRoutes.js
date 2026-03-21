const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { getFiles, uploadFile, deleteFile } = require('../controllers/fileController');
const { protect, authorize } = require('../middleware/auth');

// Multer storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '..', 'storage'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB max
});

router.use(protect);

router.route('/')
  .get(getFiles)
  .post(upload.single('file'), uploadFile);

router.route('/:id')
  .delete(authorize('ADMIN'), deleteFile);

module.exports = router;
