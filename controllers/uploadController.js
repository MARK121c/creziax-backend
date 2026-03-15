const supabase = require('../supabaseClient');
const sharp = require('sharp');
const path = require('path');

// @desc    Upload an image (Avatar or Logo)
// @route   POST /api/upload/image
// @access  Private
const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded' });
    }

    // Double check size just in case (multer limit should catch this)
    if (req.file.size > 2 * 1024 * 1024) {
      return res.status(400).json({ message: 'Image size exceeds 2MB limit' });
    }

    // Process image with sharp
    // Resize to max 800px width/height while maintaining aspect ratio
    // Convert to webp with 80% quality for best compression/quality ratio
    const buffer = await sharp(req.file.buffer)
      .resize({
        width: 800,
        height: 800,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 80 })
      .toBuffer();

    const fileName = `images/${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;

    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(fileName, buffer, {
        contentType: 'image/webp',
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.error("Supabase Storage Error:", error.message);
      return res.status(500).json({ message: 'Failed to upload image to storage', error: error.message });
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(data.path);

    res.status(201).json({ 
      url: publicUrl,
      name: fileName,
      size: buffer.length
    });
  } catch (err) {
    console.error("Upload Logic Error:", err);
    next(err);
  }
};

module.exports = { uploadImage };
