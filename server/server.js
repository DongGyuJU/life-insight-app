process.env.CHCP = '65001';
// server.js
require('dotenv').config();
const Fastify = require('fastify');

const app = Fastify({ logger: true });

app.get('/health', async () => {
  return { status: 'LiIn server running ✓' };  // 여기만
});

// 기존 AI 라우트
app.register(require('./src/routes/ai'));

// 신규 생태계 라우트
app.register(require('./src/routes/user'));
app.register(require('./src/routes/sync'));
app.register(require('./src/routes/livars'));
app.register(require('./src/routes/domain')); // 도메인 관련 라우트 추가

app.listen({ port: 3000, host: '0.0.0.0' }, (err) => {
  if (err) {
    console.error(err);
    process.exit(1);
  }
  console.log('LiIn server running on port 3000');
});
