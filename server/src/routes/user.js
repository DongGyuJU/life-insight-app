// src/routes/user.js
const { prisma } = require('../lib/prisma');

module.exports = async function userRoutes(app) {

  // 앱 첫 실행 시 디바이스 등록
  app.post('/user/register', async (req, reply) => {
    const { deviceId } = req.body;

    const user = await prisma.user.upsert({
      where: { deviceId },
      update: {},
      create: { deviceId },
    });

    return { userId: user.id };
  });

  // 프로파일 업데이트 (기상시간, 크로노타입 등)
  app.patch('/user/:userId/profile', async (req, reply) => {
    const { userId } = req.params;
    const { wakeTime, chronotype, caffeineSensitivity } = req.body;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(wakeTime && { wakeTime }),
        ...(chronotype && { chronotype }),
        ...(caffeineSensitivity && { caffeineSensitivity }),
      },
    });

    return { ok: true, user: updated };
  });
};