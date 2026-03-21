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

    // Enforce strict 5MB limit
    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(413).json({ 
        message: 'File size too large', 
        error: 'حجم الملف كبير جداً، الحد الأقصى هو 5 ميجا بايت' 
      });
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

    let publicUrl = '';
    const fileName = `images/${Date.now()}-${Math.round(Math.random() * 1e9)}.webp`;

    // Try Supabase Storage if configured
    if (supabase) {
      try {
        const { data, error } = await supabase.storage
          .from('avatars')
          .upload(fileName, buffer, {
            contentType: 'image/webp',
            cacheControl: '3600',
            upsert: false
          });

        if (!error) {
          const { data: { publicUrl: supaUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(data.path);
          publicUrl = supaUrl;
        } else {
          console.error("Supabase Storage Error:", error.message);
        }
      } catch (supaErr) {
        console.error("Supabase Upload Failed, falling back to local:", supaErr.message);
      }
    }

    // Fallback to local storage if publicUrl is still empty
    if (!publicUrl) {
      const fs = require('fs');
      const storagePath = path.join(__dirname, '..', 'storage', 'images');
      if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
      }
      const localFilePath = path.join(storagePath, path.basename(fileName));
      fs.writeFileSync(localFilePath, buffer);
      
      // Get the backend URL from env or fallback to relative
      const backendUrl = process.env.VITE_API_URL ? process.env.VITE_API_URL.replace('/api', '') : '';
      publicUrl = `${backendUrl}/storage/images/${path.basename(fileName)}`;
    }

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

// @desc    Upload any file (up to 100MB)
// @route   POST /api/upload/file
// @access  Private
const uploadAnyFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    if (req.file.size > 100 * 1024 * 1024) {
      return res.status(413).json({ 
        message: 'File size too large', 
        error: 'حجم الملف كبير جداً، الحد الأقصى هو 100 ميجا بايت' 
      });
    }

    let publicUrl = '';
    const ext = path.extname(req.file.originalname) || '';
    const fileName = `files/${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;

    if (supabase) {
      try {
        const { data, error } = await supabase.storage
          .from('avatars') // Using avatars bucket as universal public storage
          .upload(fileName, req.file.buffer, {
            contentType: req.file.mimetype,
            cacheControl: '3600',
            upsert: false
          });

        if (!error) {
          const { data: { publicUrl: supaUrl } } = supabase.storage
            .from('avatars')
            .getPublicUrl(data.path);
          publicUrl = supaUrl;
        } else {
          console.error("Supabase File Storage Error:", error.message);
        }
      } catch (e) {
        console.error("Supabase File Upload Failed:", e.message);
      }
    }

    if (!publicUrl) {
      const fs = require('fs');
      const storagePath = path.join(__dirname, '..', 'storage', 'files');
      if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
      }
      const localFilePath = path.join(storagePath, path.basename(fileName));
      fs.writeFileSync(localFilePath, req.file.buffer);
      
      const backendUrl = process.env.VITE_API_URL ? process.env.VITE_API_URL.replace('/api', '') : '';
      publicUrl = `${backendUrl}/storage/files/${path.basename(fileName)}`;
    }

    res.status(201).json({ 
      url: publicUrl,
      name: req.file.originalname,
      size: req.file.size,
      type: req.file.mimetype
    });
  } catch (err) {
    console.error("Upload File Logic Error:", err);
    next(err);
  }
};

module.exports = { uploadImage, uploadAnyFile };
