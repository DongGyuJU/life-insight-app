// src/routes/sync.js
const { prisma } = require('../lib/prisma');

module.exports = async function syncRoutes(app) {

  app.post('/sync/entries', async (req, reply) => {
    const { userId, entries } = req.body;

    // bulk insert - 중복 uuid는 조용히 스킵
    await prisma.lifeEvent.createMany({
      data: entries.map(e => ({
        id: e.uuid,
        userId,
        localId: e.id,
        categories: Array.isArray(e.categories)
          ? e.categories
          : JSON.parse(e.categories || '[]'),
        subCategory: e.sub_category || null,
        amount: e.amount || null,
        summary: e.summary || null,
        location: e.location || null,
        appointmentDate: e.appointment_date
          ? new Date(e.appointment_date)
          : null,
        exerciseType: e.exercise_type || null,
        exerciseMinutes: e.exercise_minutes || null,
        exerciseCalories: e.exercise_calories || null,
        rawText: e.text,
        createdAt: new Date(e.created_at),
      })),
      skipDuplicates: true,
    });

    return { synced: entries.map(e => e.uuid) };
  });

  // 월간 서버 집계 (앱 미설치 기기에서 웹 리포트용 - 향후 확장)
  app.get('/sync/monthly-summary', async (req, reply) => {
    const { userId, year, month } = req.query;

    const start = new Date(`${year}-${String(month).padStart(2, '0')}-01`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);

    const events = await prisma.lifeEvent.findMany({
      where: {
        userId,
        createdAt: { gte: start, lt: end },
      },
    });

    return {
      totalCount: events.length,
      totalExpense: events
        .filter(e => (e.categories).includes('expense'))
        .reduce((sum, e) => sum + (e.amount || 0), 0),
    };
  });
};