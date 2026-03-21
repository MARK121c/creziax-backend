const prisma = require('../prismaClient');

/**
 * Retention Service
 * Handles archiving and deleting data older than a specified period (default 30 days)
 */

const ARCHIVE_AFTER_DAYS = 30;

const runRetentionPolicy = async () => {
  console.log(`[${new Date().toISOString()}] Starting Data Retention Job...`);
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_AFTER_DAYS);
  
  try {
    // 1. Archive & Delete Notifications
    await archiveAndDelete('Notification', cutoffDate);
    
    // 2. Archive & Delete Messages (Threads) - Optional, but user mentioned "بيانات (Logs)"
    // We'll archive messages that are part of closed tickets only to be safe,
    // or just generic notifications/logs for now.
    
    // 3. Archive & Delete Broadcasts (Older than 30 days)
    await archiveAndDelete('Broadcast', cutoffDate);

    console.log(`[${new Date().toISOString()}] Data Retention Job Completed Successfully.`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Data Retention Job Failed:`, error);
  }
};

const archiveAndDelete = async (modelName, cutoffDate) => {
  const model = prisma[modelName.charAt(0).toLowerCase() + modelName.slice(1)];
  
  // Find records to archive
  const records = await model.findMany({
    where: {
      createdAt: { lt: cutoffDate }
    }
  });
  
  if (records.length === 0) {
    console.log(`No records to archive for ${modelName}.`);
    return;
  }
  
  console.log(`Archiving ${records.length} records for ${modelName}...`);
  
  // Create archive entries
  const archiveData = records.map(record => ({
    originalId: record.id,
    model: modelName,
    data: record,
    originalCreatedAt: record.createdAt
  }));
  
  await prisma.archivedLog.createMany({
    data: archiveData
  });
  
  // Delete original records
  const deleteResult = await model.deleteMany({
    where: {
      id: { in: records.map(r => r.id) }
    }
  });
  
  console.log(`Deleted ${deleteResult.count} ${modelName} records.`);
};

module.exports = { runRetentionPolicy };
