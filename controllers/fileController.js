const prisma = require('../prismaClient');
const path = require('path');
const fs = require('fs');
const { supabase } = require('../supabaseClient');

// @desc    Get files for a project
// @route   GET /api/files?projectId=xxx
// @access  Private
const getFiles = async (req, res, next) => {
  try {
    const { projectId } = req.query;
    const where = projectId ? { projectId } : {};
    const files = await prisma.file.findMany({ where, include: { project: true, uploadedBy: { select: { id: true, firstName: true, lastName: true } } } });
    res.json(files);
  } catch (err) {
    next(err);
  }
};

// @desc    Upload a file
// @route   POST /api/files
// @access  Private
const uploadFile = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const { projectId, fileType } = req.body;

    if (!projectId) {
      return res.status(400).json({ message: 'projectId is required' });
    }

    let fileUrl = `/storage/${req.file.filename}`;

    // Try Supabase Storage if configured
    if (process.env.SUPABASE_ANON_KEY) {
      try {
        const fileContent = fs.readFileSync(req.file.path);
        const { data, error } = await supabase.storage
          .from('creziax-assets')
          .upload(`uploads/${Date.now()}-${req.file.originalname}`, fileContent, {
            contentType: req.file.mimetype,
            cacheControl: '3600',
            upsert: false
          });

        if (error) {
          console.error("Supabase Storage Error:", error.message);
        } else {
          const { data: { publicUrl } } = supabase.storage
            .from('creziax-assets')
            .getPublicUrl(data.path);
          fileUrl = publicUrl;
          
          // Delete local file after successful upload to Supabase
          fs.unlinkSync(req.file.path);
        }
      } catch (supaErr) {
        console.error("Supabase Upload Failed, falling back to local:", supaErr.message);
      }
    }

    const file = await prisma.file.create({
      data: {
        name: req.file.filename,
        originalName: req.file.originalname,
        url: fileUrl,
        fileType: fileType || 'DOCUMENT',
        size: req.file.size,
        projectId,
        uploadedById: req.user.id,
      },
    });

    res.status(201).json(file);
  } catch (err) {
    next(err);
  }
};

// @desc    Delete a file
// @route   DELETE /api/files/:id
// @access  Private/Admin
const deleteFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const file = await prisma.file.findUnique({ where: { id } });
    if (!file) return res.status(404).json({ message: 'File not found' });

    // Delete physical file
    const filePath = path.join(__dirname, '..', file.url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await prisma.file.delete({ where: { id } });
    res.status(204).send();
  } catch (err) {
    next(err);
  }
};

module.exports = { getFiles, uploadFile, deleteFile };
