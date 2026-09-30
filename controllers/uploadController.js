const supabase = require('../supabaseClient');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// @desc    Upload an image (Avatar or Logo - max 5MB)
// @route   POST /api/upload/image
// @access  Private
const uploadImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded' });
    }

    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(413).json({ 
        message: 'File size too large', 
        error: 'حجم الملف كبير جداً، الحد الأقصى هو 5 ميجا بايت' 
      });
    }

    // Process image with sharp
    const buffer = await sharp(req.file.buffer)
      .resize({
        width: 800,
        height: 800,
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: 80 })
      .toBuffer();

    let publicUrl = '';
    const fileName = `images/${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;

    if (supabase) {
      try {
        console.log(`[STORAGE] Attempting Supabase upload for ${fileName}...`);
        const { data, error } = await supabase.storage
          .from('creziax-assets')
          .upload(fileName, buffer, {
            contentType: 'image/webp',
            cacheControl: '3600',
            upsert: false
          });

        if (!error && data) {
          const { data: { publicUrl: supaUrl } } = supabase.storage
            .from('creziax-assets')
            .getPublicUrl(data.path);
          publicUrl = supaUrl;
          console.log(`[STORAGE] Supabase upload success: ${publicUrl}`);
        } else {
          console.error("❌ [STORAGE] Supabase Error:", error?.message);
        }
      } catch (supaErr) {
        console.error("❌ [STORAGE] Exception during Supabase upload:", supaErr.message);
      }
    }

    if (!publicUrl) {
      const storagePath = path.join(__dirname, '..', 'storage', 'images');
      if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
      }
      const localFilePath = path.join(storagePath, path.basename(fileName));
      fs.writeFileSync(localFilePath, buffer);
      publicUrl = `/storage/images/${path.basename(fileName)}`;
    }

    res.status(201).json({ 
      url: publicUrl,
      name: fileName,
      size: buffer.length
    });
  } catch (err) {
    console.error("Upload Image Error:", err);
    next(err);
  }
};

// @desc    Upload any file / media (Images, Videos, Docs - up to 1GB)
// @route   POST /api/upload/file
// @access  Private
const uploadAnyFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // 1GB limit check
    if (req.file.size > 1024 * 1024 * 1024) {
      // If saved to disk, remove temporary file
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(413).json({ 
        message: 'File size too large', 
        error: 'حجم الملف كبير جداً، الحد الأقصى هو 1 جيجابايت' 
      });
    }

    let publicUrl = '';
    const filename = req.file.filename || `${Date.now()}-${Math.round(Math.random() * 1e9)}${path.extname(req.file.originalname) || ''}`;

    // If file was streamed to disk directly by multer.diskStorage:
    if (req.file.path) {
      publicUrl = `/storage/files/${filename}`;
    } else if (req.file.buffer) {
      // Memory buffer fallback
      const storagePath = path.join(__dirname, '..', 'storage', 'files');
      if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
      }
      const localFilePath = path.join(storagePath, filename);
      fs.writeFileSync(localFilePath, req.file.buffer);
      publicUrl = `/storage/files/${filename}`;
    }

    res.status(201).json({ 
      url: publicUrl,
      fileUrl: publicUrl,
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype
    });
  } catch (err) {
    console.error("Upload File Error:", err);
    next(err);
  }
};

module.exports = { uploadImage, uploadAnyFile };
