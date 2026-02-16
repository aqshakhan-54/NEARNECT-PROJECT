const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Store in different folders based on file type
    let folder = 'general';
    if (file.fieldname === 'avatar' || file.fieldname === 'profile') {
      folder = 'profiles';
    } else if (file.fieldname === 'document') {
      folder = 'documents';
    } else if (file.fieldname === 'gallery') {
      folder = 'gallery';
    }
    
    const dest = path.join(uploadsDir, folder);
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }
    cb(null, dest);
  },
  filename: (req, file, cb) => {
    // Generate unique filename: timestamp_userId_originalname
    const userId = req.userId || 'anonymous';
    const timestamp = Date.now();
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext).replace(/[^a-zA-Z0-9]/g, '_');
    cb(null, `${timestamp}_${userId}_${name}${ext}`);
  }
});

// File filter - only allow images and PDFs
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only image files (jpeg, jpg, png, gif, webp) and PDFs are allowed!'));
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

// All routes require authentication
router.use(authenticate);

// POST /upload/avatar - Upload profile picture
router.post('/avatar', upload.single('avatar'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Return file URL (relative path)
    const fileUrl = `/uploads/profiles/${req.file.filename}`;
    
    res.json({
      success: true,
      message: 'File uploaded successfully',
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: fileUrl,
        path: req.file.path
      }
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// POST /upload/gallery - Upload multiple images (for worker gallery)
router.post('/gallery', upload.array('gallery', 10), (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }

    const files = req.files.map(file => ({
      filename: file.filename,
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      url: `/uploads/gallery/${file.filename}`,
      path: file.path
    }));

    res.json({
      success: true,
      message: `${files.length} file(s) uploaded successfully`,
      files: files
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload files' });
  }
});

// POST /upload/document - Upload document (PDF, etc.)
router.post('/document', upload.single('document'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const fileUrl = `/uploads/documents/${req.file.filename}`;
    
    res.json({
      success: true,
      message: 'Document uploaded successfully',
      file: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        url: fileUrl,
        path: req.file.path
      }
    });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// DELETE /upload/:filename - Delete uploaded file
router.delete('/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    const userId = req.userId.toString();

    // Security: Check if filename contains userId to prevent unauthorized deletion
    if (!filename.includes(userId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Try to find and delete file in all upload folders
    const folders = ['profiles', 'gallery', 'documents', 'general'];
    let deleted = false;

    for (const folder of folders) {
      const filePath = path.join(uploadsDir, folder, filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        deleted = true;
        break;
      }
    }

    if (deleted) {
      res.json({ success: true, message: 'File deleted successfully' });
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (err) {
    console.error('Delete error:', err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

module.exports = router;

