// src/routes/ai.js
const { buildClassifierPrompt } = require('../lib/domain_registry');
 
module.exports = async function aiRoutes(app) {
 
  app.post('/analyze', async (req, reply) => {
    const { text } = req.body;
    const today = new Date().toISOString().slice(0, 10);
 
    const { keywordHints } = buildClassifierPrompt();
 
    const prompt = `You are a Korean life log classifier. Return ONLY a JSON object.
 
Today: ${today}
Input: "${text}"
 
Rules:
- categories: array of matching categories (can be multiple)
  - "diary": feelings, emotions, daily record
  - "expense": spending, payment, receipt, any amount in Korean won
  - "appointment": personal meeting with friends/family (NOT work)
  - "work": meeting, deadline, presentation, work task
  - "exercise": sports, workout, running, swimming
  - "health": sleep, diet, coffee/americano/latte/caffeine/drinks, hospital
  - "study": studying, reading, lecture, exam
  - "travel": trip, visit, travel
 
IMPORTANT RULES:
- "아메리카노", "커피", "라떼", "카페인", "마셨다", "마심" → categories: ["health"], sub_category: "카페인"
- "잠", "수면", "기상", "일어났다" → categories: ["health"], sub_category: "수면"
- Any Korean won amount → always include "expense"
- "미팅", "회의", "발표", "팀장님", "교수님" → categories: ["work"]
- "친구랑", "데이트", "가족" (without work context) → categories: ["appointment"]
${keywordHints}
 
Return this JSON (fill in real values, do NOT leave categories empty):
{
  "categories": ["the_actual_category"],
  "sub_category": null,
  "amount": null,
  "appointment_date": null,
  "exercise_type": null,
  "exercise_minutes": null,
  "work_partner": null,
  "work_priority": "보통",
  "is_todo": 0,
  "due_date": null,
  "summary": "10자이내요약"
}`;
 
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      })
    });
 
    const data = await response.json();
    const raw = data.choices[0].message.content;
    console.log('[Groq 원본]:', raw.slice(0, 200));
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  });
 
  app.post('/report', async (req, reply) => {
    const {
      totalEntries, totalExpense, positiveCount,
      insightHint, negativeCount, appointmentCount,
    } = req.body;
 
    let promptText = `다음 데이터로 한국어 2~3문장 생활 패턴 총평 작성. JSON 말고 순수 텍스트만.
- 총 기록: ${totalEntries}개
- 지출: ${totalExpense}원
- 긍정감정: ${positiveCount}회, 부정: ${negativeCount}회
- 약속: ${appointmentCount}개\n`;
 
    if (insightHint) promptText += `${insightHint}\n`;
    promptText += `따뜻하고 전문적인 비서의 톤으로 작성해.`;
 
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: promptText }],
        temperature: 0.7,
      })
    });
 
    const data = await response.json();
    return { summary: data.choices[0].message.content.trim() };
  });
 
  app.post('/analyze-image', async (req, reply) => {
    const { base64, today } = req.body;
 
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-4-scout-17b-16e-instruct',
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:image/jpeg;base64,${base64}` }
            },
            {
              type: 'text',
              text: `Today: ${today}. Analyze this image and extract all information. Return ONLY JSON:
{
  "extracted_text": "모든 텍스트 내용",
  "categories": ["expense","diary","work","appointment","exercise","health","study","travel"],
  "sub_category": null,
  "amount": null,
  "appointment_date": null,
  "work_partner": null,
  "summary": "10자이내"
}
Rules:
- Receipt/영수증 → categories: ["expense"], extract amount as number
- sub_category for expense: 카페/식사/쇼핑/교통/의료/구독/기타`
            }
          ]
        }],
        temperature: 0.1,
      })
    });
 
    const data = await response.json();
    const raw = data.choices[0].message.content;
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  });
 
  app.post('/expense-feedback', async (req, reply) => {
    try {
      const { expenseData } = req.body;
 
      if (!expenseData) {
        reply.status(400);
        return { error: '지출 데이터가 없습니다.' };
      }
 
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            {
              role: 'system',
              content: `너는 유저의 가계부를 진단하고 자산 관리를 조언해주는 냉철하고 위트 있는 금융 비서야.
유저가 이번 달 [총 지출 및 카테고리별 요약] 데이터를 주면, 그걸 기반으로 유저의 소비 패턴을 분석해.
 
[반드시 지켜야 할 철칙]
1. 친근하게 존댓말을 쓰되, 위트가 있는 조언을 해야 돼.
2. 절대로 다른 쓸데없는 말은 생략하고 진짜 본론만 '딱 두 줄(50자 내외)'로 출력해.
3. 제공받은 [유저의 실제 데이터]에 있는 카테고리 이름과 금액만 사용해.`,
            },
            {
              role: 'user',
              content: `내 이번 달 지출 데이터야: ${expenseData}`,
            },
          ],
          temperature: 0.7,
        })
      });
 
      const data = await response.json();
      return { feedback: data.choices[0].message.content.trim() };
 
    } catch (error) {
      console.error('지출 분석 에러:', error);
      reply.status(500);
      return { error: 'AI 분석 중 오류가 발생했습니다.' };
    }
  });
 
  app.get('/registry/domains', async (req, reply) => {
    const { getActiveDomains } = require('../lib/domain_registry');
    return {
      domains: getActiveDomains().map(d => ({
        id: d.id,
        name: d.name,
        emoji: d.emoji,
        category_code: d.category_code,
        sub_categories: d.sub_categories,
        has_domain_ai: !!d.domain_ai_endpoint,
      }))
    };
  });
};
 