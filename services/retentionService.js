const fs = require('fs');
const path = require('path');
const prisma = require('../prismaClient');

/**
 * Retention Service
 * Handles archiving and deleting data older than a specified period (default 30 days)
 * And auto-deleting chat media files older than 48 hours to preserve server storage
 */

const ARCHIVE_AFTER_DAYS = 30;
const MEDIA_EXPIRE_HOURS = 48;

/**
 * Auto-delete chat media files older than 48 hours
 */
const cleanExpiredMedia = async (maxAgeHours = MEDIA_EXPIRE_HOURS) => {
  console.log(`[${new Date().toISOString()}] Running 48-Hour Media Cleanup Job...`);
  const cutoffTime = Date.now() - (maxAgeHours * 60 * 60 * 1000);
  const foldersToClean = [
    path.join(__dirname, '..', 'storage', 'files'),
    path.join(__dirname, '..', 'storage', 'images')
  ];

  let deletedCount = 0;
  let freedBytes = 0;

  for (const folder of foldersToClean) {
    if (!fs.existsSync(folder)) continue;

    try {
      const files = fs.readdirSync(folder);
      for (const file of files) {
        const filePath = path.join(folder, file);
        try {
          const stats = fs.statSync(filePath);
          if (stats.isFile() && stats.mtimeMs < cutoffTime) {
            freedBytes += stats.size;
            fs.unlinkSync(filePath);
            deletedCount++;
          }
        } catch (fileErr) {
          console.error(`[MediaCleanup] Error processing file ${file}:`, fileErr.message);
        }
      }
    } catch (dirErr) {
      console.error(`[MediaCleanup] Error reading folder ${folder}:`, dirErr.message);
    }
  }

  const freedMB = (freedBytes / (1024 * 1024)).toFixed(2);
  console.log(`[${new Date().toISOString()}] Media Cleanup Completed: Deleted ${deletedCount} files older than ${maxAgeHours}h (Freed ${freedMB} MB).`);
};

const runRetentionPolicy = async () => {
  console.log(`[${new Date().toISOString()}] Starting Data Retention Job...`);
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_AFTER_DAYS);
  
  try {
    // 1. Archive & Delete Notifications
    await archiveAndDelete('Notification', cutoffDate);
    
    // 2. Archive & Delete Broadcasts (Older than 30 days)
    await archiveAndDelete('Broadcast', cutoffDate);

    // 3. Clean Expired Media Files (48h)
    await cleanExpiredMedia(MEDIA_EXPIRE_HOURS);

    console.log(`[${new Date().toISOString()}] Data Retention Job Completed Successfully.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Data Retention Job Failed:`, error);
  }
};

const archiveAndDelete = async (modelName, cutoffDate) => {
  const model = prisma[modelName.charAt(0).toLowerCase() + modelName.slice(1)];
  if (!model) return;

  const records = await model.findMany({
    where: {
      createdAt: { lt: cutoffDate }
    }
  });
  
  if (records.length === 0) {
    return;
  }
  
  console.log(`Archiving ${records.length} records for ${modelName}...`);
  
  const archiveData = records.map(record => ({
    originalId: record.id,
    model: modelName,
    data: record,
    originalCreatedAt: record.createdAt
  }));
  
  await prisma.archivedLog.createMany({
    data: archiveData
  });
  
  const deleteResult = await model.deleteMany({
    where: {
      id: { in: records.map(r => r.id) }
    }
  });
  
  console.log(`Deleted ${deleteResult.count} ${modelName} records.`);
};

module.exports = { runRetentionPolicy, cleanExpiredMedia };
