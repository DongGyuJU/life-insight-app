// src/routes/livars.js
const { prisma } = require('../lib/prisma');
const { calculateOptimalCaffeineWindow } = require('../services/caffeineOptimizer');

module.exports = async function livarsRoutes(app) {

  // ?? Coffee ??????????????????????????????????????????

  // 移댄럹????랬 濡쒓퉭
  app.post('/livars/coffee/log', async (req, reply) => {
    const { userId, consumedAt, drinkType, caffeineMg, wakeOffsetMinutes } = req.body;

    const event = await prisma.caffeineEvent.create({
      data: {
        userId,
        consumedAt: new Date(consumedAt),
        drinkType,
        caffeineMg,
        wakeOffsetMinutes,
      },
    });

    return { ok: true, eventId: event.id };
  });

  // 吏묒쨷??湲곕텇 ?쇰뱶諛?(??랬 2~3?쒓컙 ???섏쭛)
  app.patch('/livars/coffee/:eventId/feedback', async (req, reply) => {
    const { eventId } = req.params;
    const { subjectiveFocus, subjectiveMood } = req.body;

    await prisma.caffeineEvent.update({
      where: { id: eventId },
      data: { subjectiveFocus, subjectiveMood },
    });

    return { ok: true };
  });

  // ?ㅻ뒛 理쒖쟻 移댄럹????랬 ?쒓컙
  app.get('/livars/coffee/optimal-time', async (req, reply) => {
    const { userId } = req.query;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { wakeTime: true, caffeineSensitivity: true },
    });

    const result = calculateOptimalCaffeineWindow(
      user?.wakeTime ?? '07:00',
      user?.caffeineSensitivity ?? 'medium'
    );

    return result;
  });

  // 二쇨컙 ?⑦꽩 由ы룷??
  app.get('/livars/coffee/weekly-report', async (req, reply) => {
    const { userId } = req.query;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const events = await prisma.caffeineEvent.findMany({
      where: {
        userId,
        consumedAt: { gte: sevenDaysAgo },
      },
      orderBy: { consumedAt: 'asc' },
    });

    const withFeedback = events.filter(e => e.subjectiveFocus !== null);
    const best = [...withFeedback]
      .sort((a, b) => (b.subjectiveFocus ?? 0) - (a.subjectiveFocus ?? 0))
      .slice(0, 3);

    return {
      totalEvents: events.length,
      avgFocus: withFeedback.length > 0
        ? withFeedback.reduce((s, e) => s + (e.subjectiveFocus ?? 0), 0) / withFeedback.length
        : null,
      bestPattern: best.map(e => ({
        wakeOffset: e.wakeOffsetMinutes,
        drinkType: e.drinkType,
        focus: e.subjectiveFocus,
      })),
      insight: best.length > 0
        ? `기상 후 ${best[0].wakeOffsetMinutes}분에 ${best[0].drinkType}를 마실 때 집중력이 가장 높았습니다.`
        : '데이터가 더 쌓이면 개인화된 인사이트를 제공합니다.',
    };
  });
};
