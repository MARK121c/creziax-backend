const { supabaseAdmin } = require('../supabaseClient');
const sharp = require('sharp');

// @desc    Upload an image (Avatar or Logo)
// @route   POST /api/upload/image
// @access  Private
const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded' });
    }

    // Double check size (multer limit should also catch this)
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ message: 'Image size exceeds 5MB limit' });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({ message: 'Storage not configured. SUPABASE_SERVICE_ROLE_KEY is missing.' });
    }

    let buffer;
    try {
      // Process image with sharp: resize and convert to webp
      buffer = await sharp(req.file.buffer)
        .resize({ width: 800, height: 800, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer();
    } catch (sharpErr) {
      // If sharp fails (e.g. in Docker), fallback to original buffer
      console.warn('Sharp processing failed, using original buffer:', sharpErr.message);
      buffer = req.file.buffer;
    }

    const ext = buffer === req.file.buffer ? (req.file.mimetype.split('/')[1] || 'jpg') : 'webp';
    const contentType = buffer === req.file.buffer ? req.file.mimetype : 'image/webp';
    const fileName = `images/${Date.now()}-${Math.round(Math.random() * 1e9)}.${ext}`;

    const { data, error } = await supabaseAdmin.storage
      .from('avatars')
      .upload(fileName, buffer, {
        contentType,
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error('Supabase Storage Error:', error.message, error);
      return res.status(500).json({ message: 'Failed to upload image to storage', error: error.message });
    }

    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('avatars')
      .getPublicUrl(data.path);

    res.status(201).json({
      url: publicUrl,
      name: fileName,
      size: buffer.length
    });
  } catch (err) {
    console.error('Upload Logic Error:', err);
    next(err);
  }
};

module.exports = { uploadImage };
