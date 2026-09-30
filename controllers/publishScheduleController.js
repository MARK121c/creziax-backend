const prisma = require('../prismaClient');

const getPublishSchedules = async (req, res, next) => {
  try {
    const { projectId } = req.query;
    const where = projectId ? { projectId } : {};
    const schedules = await prisma.publishSchedule.findMany({
      where,
      orderBy: { publishTime: 'asc' }
    });
    res.json(schedules);
  } catch (err) { next(err); }
};

const createPublishSchedule = async (req, res, next) => {
  try {
    const { projectId, title, publishTime, frequency, notes } = req.body;
    if (!projectId || !title || !publishTime) {
      return res.status(400).json({ message: 'projectId, title, and publishTime are required' });
    }
    const schedule = await prisma.publishSchedule.create({
      data: { projectId, title, publishTime: new Date(publishTime), frequency, notes }
    });
    res.status(201).json(schedule);
  } catch (err) { next(err); }
};

const updatePublishSchedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, publishTime, frequency, notes } = req.body;
    const data = {};
    if (title) data.title = title;
    if (publishTime) data.publishTime = new Date(publishTime);
    if (frequency !== undefined) data.frequency = frequency;
    if (notes !== undefined) data.notes = notes;
    const schedule = await prisma.publishSchedule.update({ where: { id }, data });
    res.json(schedule);
  } catch (err) { next(err); }
};

const deletePublishSchedule = async (req, res, next) => {
  try {
    const { id } = req.params;
    await prisma.publishSchedule.delete({ where: { id } });
    res.status(204).send();
  } catch (err) { next(err); }
};

module.exports = { getPublishSchedules, createPublishSchedule, updatePublishSchedule, deletePublishSchedule };
