// src/routes/domain.js
// CQL Native AI — Domain AI 에이전트들
// 각 Domain AI = Functor F_d : C_d × History → DomainInsight
// Domain AI → Meta AI 통신 = Natural Transformation (DomainInsight 타입)

const { prisma } = require('../lib/prisma');

// ─── DomainInsight 타입 (Natural Transformation의 interface) ──
// {
//   domain:         string,
//   status:         'good' | 'warning' | 'info' | 'error',
//   headline:       string,   // 한 줄 요약
//   detail:         string,   // 상세 분석
//   recommendation: string,   // 실천 가능한 조언
//   confidence:     number,   // 0~1 (데이터가 많을수록 높음)
//   rawData:        object,   // Meta AI가 참고할 수치 데이터
// }

// ─── Groq 호출 공통 함수 ─────────────────────────────────────
async function callGroq(prompt, temperature = 0.3) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: [{
        role: 'user',
        content: prompt
      }],
      temperature,
    })
  });
  const data = await response.json();
  const raw = data.choices[0].message.content.trim();

  // JSON 파싱 시도
  try {
    return JSON.parse(raw.replace(/```json|```/g, '').trim());
  } catch {
    return null;
  }
}

// ─── 신뢰도 계산 헬퍼 ────────────────────────────────────────
function calcConfidence(dataPoints, minRequired = 3, maxOptimal = 20) {
  if (dataPoints === 0) return 0;
  if (dataPoints >= maxOptimal) return 1;
  return Math.min(dataPoints / maxOptimal, 1);
}

// ─── 라우트 등록 ─────────────────────────────────────────────
module.exports = async function domainRoutes(app) {

  // ══════════════════════════════════════════════════════════
  // ☕ CAFFEINE AI
  // F_caffeine : C_caffeine × UserProfile → CaffeineInsight
  // 논문 근거: Huberman (2021), Adenosine/Cortisol 연구
  // ══════════════════════════════════════════════════════════
  app.post('/domain/caffeine', async (req, reply) => {
    const { userId, wakeTime, caffeineSensitivity, recentEvents } = req.body;
    // recentEvents: [{ consumedAt, wakeOffsetMinutes, drinkType, subjectiveFocus }]

    const sensitivity = caffeineSensitivity || 'medium';
    const wake = wakeTime || '07:00';
    const [wh, wm] = wake.split(':').map(Number);
    const wakeMin = wh * 60 + wm;

    const addMin = (base, offset) => {
      const total = (base + offset + 1440) % 1440;
      return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    };

    // 코르티솔 window 계산 (논문 기반 규칙 엔진)
    const optimalStart = addMin(wakeMin, 90);
    const optimalEnd = addMin(wakeMin, 420);
    const cutoffMap = { low: 420, medium: 480, high: 540 };
    const lastCutoff = addMin(23 * 60, -(cutoffMap[sensitivity]));

    // 개인화 데이터가 있으면 AI 분석 추가
    const hasHistory = recentEvents && recentEvents.length >= 3;
    const confidence = calcConfidence(recentEvents?.length || 0, 3, 14);

    let insight = null;

    if (hasHistory) {
      const bestEvents = recentEvents
        .filter(e => e.subjectiveFocus)
        .sort((a, b) => b.subjectiveFocus - a.subjectiveFocus)
        .slice(0, 3);

      const avgOffset = bestEvents.length > 0
        ? Math.round(bestEvents.reduce((s, e) => s + e.wakeOffsetMinutes, 0) / bestEvents.length)
        : 120;

      const prompt = `당신은 카페인 최적화 전문 AI입니다. 아래 사용자 데이터를 분석하세요.

기상 시간: ${wake}
카페인 민감도: ${sensitivity}
최근 ${recentEvents.length}회 섭취 기록:
${recentEvents.slice(0, 7).map(e =>
  `- 기상 후 ${e.wakeOffsetMinutes}분, ${e.drinkType}, 집중력: ${e.subjectiveFocus || '미기록'}/5`
).join('\n')}

논문 기반 최적 구간: ${optimalStart}~${optimalEnd}
이 사람의 실제 최고 집중력 패턴: 기상 후 평균 ${avgOffset}분

다음 JSON만 반환하세요:
{
  "status": "good" | "warning" | "info",
  "headline": "15자 이내 핵심 요약",
  "detail": "2문장 이내 분석",
  "recommendation": "1문장 실천 조언"
}`;

      insight = await callGroq(prompt);
    }

    return {
      domain: 'caffeine',
      status: insight?.status || 'info',
      headline: insight?.headline || `최적 섭취: ${optimalStart}~`,
      detail: insight?.detail || `기상(${wake}) 후 90분~7시간이 코르티솔 안정기입니다. ${lastCutoff} 이후 카페인은 수면을 방해할 수 있어요.`,
      recommendation: insight?.recommendation || `${optimalStart}에 첫 커피를 마셔보세요.`,
      confidence,
      rawData: {
        optimalStart,
        optimalEnd,
        lastCutoff,
        wakeTime: wake,
        sensitivity,
        eventCount: recentEvents?.length || 0,
      }
    };
  });

  // ══════════════════════════════════════════════════════════
  // 😴 SLEEP AI
  // F_sleep : C_sleep × History → SleepInsight
  // 논문 근거: Walker "Why We Sleep" (2017), 수면 압력/일주기 리듬
  // ══════════════════════════════════════════════════════════
  app.post('/domain/sleep', async (req, reply) => {
    const { userId, lastNight, recentSessions } = req.body;
    // lastNight: { totalMinutes, bedtime, wakeTime }
    // recentSessions: [{ totalMinutes, quality }]

    if (!lastNight) {
      return {
        domain: 'sleep',
        status: 'info',
        headline: '수면 데이터 없음',
        detail: 'HealthKit 수면 추적이 필요합니다.',
        recommendation: 'Apple Watch 또는 아이폰을 침대 옆에 두고 수면 추적을 활성화하세요.',
        confidence: 0,
        rawData: { hasData: false }
      };
    }

    const hours = lastNight.totalMinutes / 60;
    const confidence = calcConfidence(recentSessions?.length || 1, 3, 14);

    // 수면 품질 평가 (Walker 연구 기반)
    // 성인 권장: 7-9시간, 취침 10-12시 권장, 규칙성 중요
    const isGoodDuration = hours >= 7 && hours <= 9;
    const bedHour = parseInt(lastNight.bedtime?.split(':')[0] || '0');
    const isGoodTiming = bedHour >= 21 && bedHour <= 24;

    const avgQuality = recentSessions?.length > 0
      ? recentSessions.reduce((s, r) => s + (r.quality || 3), 0) / recentSessions.length
      : null;

    const prompt = `당신은 수면 과학 전문 AI입니다. Walker의 수면 연구를 기반으로 분석하세요.

어젯밤 수면:
- 총 수면: ${hours.toFixed(1)}시간 (${lastNight.totalMinutes}분)
- 취침: ${lastNight.bedtime}
- 기상: ${lastNight.wakeTime}
${recentSessions?.length > 0 ? `최근 ${recentSessions.length}일 평균: ${(recentSessions.reduce((s, r) => s + r.totalMinutes, 0) / recentSessions.length / 60).toFixed(1)}시간` : ''}

평가 기준 (Walker 2017):
- 권장 수면: 7-9시간
- 수면 부채 위험: 6시간 이하
- 최적 취침: 오후 10시~자정

다음 JSON만 반환하세요:
{
  "status": "good" | "warning" | "info",
  "headline": "15자 이내 핵심 요약",
  "detail": "2문장 이내 분석",
  "recommendation": "1문장 실천 조언"
}`;

    const insight = await callGroq(prompt);

    const autoStatus = !isGoodDuration ? 'warning' : isGoodTiming ? 'good' : 'info';

    return {
      domain: 'sleep',
      status: insight?.status || autoStatus,
      headline: insight?.headline || `${hours.toFixed(1)}시간 수면`,
      detail: insight?.detail || `어젯밤 ${lastNight.bedtime}에 취침해 ${hours.toFixed(1)}시간 수면했습니다. ${isGoodDuration ? '권장 수면량을 충족했어요.' : '권장(7-9시간)보다 ' + (hours < 7 ? '부족' : '많음') + '해요.'}`,
      recommendation: insight?.recommendation || (hours < 7 ? '오늘은 30분 일찍 취침해보세요.' : '수면 리듬이 좋아요. 유지하세요.'),
      confidence,
      rawData: {
        totalMinutes: lastNight.totalMinutes,
        hours,
        bedtime: lastNight.bedtime,
        wakeTime: lastNight.wakeTime,
        isGoodDuration,
        avgQuality,
      }
    };
  });

  // ══════════════════════════════════════════════════════════
  // 🏃 ACTIVITY AI
  // F_activity : C_activity × History → ActivityInsight
  // 논문 근거: WHO 신체활동 가이드라인 (2020), ACSM 운동 처방
  // ══════════════════════════════════════════════════════════
  app.post('/domain/activity', async (req, reply) => {
    const { userId, today, weekExercises } = req.body;
    // today: { steps, distanceKm, calories, flights }
    // weekExercises: [{ exercise_type, exercise_minutes, exercise_calories }]

    if (!today || today.steps === 0) {
      return {
        domain: 'activity',
        status: 'info',
        headline: '활동 데이터 없음',
        detail: 'HealthKit 연동이 필요합니다.',
        recommendation: '건강 앱에서 걸음 수 추적을 활성화하세요.',
        confidence: 0,
        rawData: { hasData: false }
      };
    }

    const stepGoal = 10000;
    const stepProgress = Math.round((today.steps / stepGoal) * 100);
    const weekExerciseCount = weekExercises?.length || 0;
    const weekExerciseMinutes = weekExercises?.reduce((s, e) => s + (e.exercise_minutes || 0), 0) || 0;
    const confidence = calcConfidence(weekExerciseCount, 0, 7);

    // WHO 기준: 주 150분 중강도 운동 권장
    const whoWeeklyGoal = 150;
    const weeklyProgress = Math.round((weekExerciseMinutes / whoWeeklyGoal) * 100);

    const prompt = `당신은 운동 과학 전문 AI입니다. WHO/ACSM 가이드라인을 기반으로 분석하세요.

오늘 활동:
- 걸음 수: ${today.steps.toLocaleString()}보 (목표 10,000보의 ${stepProgress}%)
- 이동 거리: ${today.distanceKm}km
- 활성 칼로리: ${today.calories}kcal
- 오른 계단: ${today.flights}층

이번 주 운동 기록:
- 운동 횟수: ${weekExerciseCount}회
- 총 운동 시간: ${weekExerciseMinutes}분 (WHO 권장 150분의 ${weeklyProgress}%)
${weekExercises?.slice(0, 3).map(e => `- ${e.exercise_type || '운동'} ${e.exercise_minutes || 0}분`).join('\n') || ''}

다음 JSON만 반환하세요:
{
  "status": "good" | "warning" | "info",
  "headline": "15자 이내 핵심 요약",
  "detail": "2문장 이내 분석",
  "recommendation": "1문장 실천 조언"
}`;

    const insight = await callGroq(prompt);
    const autoStatus = stepProgress >= 80 ? 'good' : stepProgress >= 50 ? 'info' : 'warning';

    return {
      domain: 'activity',
      status: insight?.status || autoStatus,
      headline: insight?.headline || `${today.steps.toLocaleString()}보 (${stepProgress}%)`,
      detail: insight?.detail || `오늘 ${today.steps.toLocaleString()}보를 걸었어요. 이번 주 ${weekExerciseCount}회 운동으로 WHO 권장량의 ${weeklyProgress}%를 달성했어요.`,
      recommendation: insight?.recommendation || (stepProgress < 50 ? '퇴근 후 20분 산책으로 목표를 채워보세요.' : '좋은 활동량이에요! 유지하세요.'),
      confidence,
      rawData: {
        steps: today.steps,
        stepProgress,
        distanceKm: today.distanceKm,
        calories: today.calories,
        weekExerciseCount,
        weekExerciseMinutes,
        weeklyProgress,
      }
    };
  });

  // ══════════════════════════════════════════════════════════
  // 💸 EXPENSE AI
  // F_expense : C_expense × History → ExpenseInsight
  // 논문 근거: Thaler & Sunstein 넛지 이론, 행동경제학
  // ══════════════════════════════════════════════════════════
  app.post('/domain/expense', async (req, reply) => {
    const { userId, monthTotal, byCategory, dailyAvg } = req.body;
    // byCategory: [{ category, amount }]

    if (!monthTotal || monthTotal === 0) {
      return {
        domain: 'expense',
        status: 'info',
        headline: '이번 달 지출 없음',
        detail: '지출 기록을 시작해보세요.',
        recommendation: '영수증 사진을 찍거나 지출 내용을 입력하면 자동 분석돼요.',
        confidence: 0,
        rawData: { hasData: false }
      };
    }

    const topCat = byCategory?.sort((a, b) => b.amount - a.amount)[0];
    const confidence = calcConfidence(byCategory?.length || 0, 1, 5);
    const topRatio = topCat ? Math.round((topCat.amount / monthTotal) * 100) : 0;

    const prompt = `당신은 개인 재정 분석 AI입니다. 행동경제학 관점에서 분석하세요.

이번 달 지출:
- 총액: ₩${monthTotal.toLocaleString()}
- 일 평균: ₩${Math.round(dailyAvg || monthTotal / 30).toLocaleString()}
- 카테고리별:
${byCategory?.slice(0, 5).map(c => `  ${c.category}: ₩${c.amount.toLocaleString()} (${Math.round(c.amount / monthTotal * 100)}%)`).join('\n') || '  (분류 없음)'}

가장 많이 쓴 카테고리: ${topCat?.category || '없음'} (${topRatio}%)

다음 JSON만 반환하세요:
{
  "status": "good" | "warning" | "info",
  "headline": "15자 이내 핵심 요약",
  "detail": "2문장 이내 분석",
  "recommendation": "1문장 실천 조언"
}`;

    const insight = await callGroq(prompt, 0.4);
    const autoStatus = topRatio > 60 ? 'warning' : topRatio > 40 ? 'info' : 'good';

    return {
      domain: 'expense',
      status: insight?.status || autoStatus,
      headline: insight?.headline || `₩${monthTotal.toLocaleString()} 지출`,
      detail: insight?.detail || `이번 달 총 ₩${monthTotal.toLocaleString()}을 지출했어요. ${topCat ? `${topCat.category}가 ${topRatio}%로 가장 많아요.` : ''}`,
      recommendation: insight?.recommendation || (topRatio > 50 ? `${topCat?.category} 지출을 10% 줄여보세요.` : '균형 잡힌 지출 패턴이에요.'),
      confidence,
      rawData: {
        monthTotal,
        dailyAvg: dailyAvg || Math.round(monthTotal / 30),
        topCategory: topCat?.category,
        topAmount: topCat?.amount,
        topRatio,
        categoryCount: byCategory?.length || 0,
      }
    };
  });

  // ══════════════════════════════════════════════════════════
  // 💊 MEDS AI
  // F_meds : C_meds × History → MedsInsight
  // 논문 근거: WHO 약물 복용 순응도 연구 (2003)
  // ══════════════════════════════════════════════════════════
  app.post('/domain/meds', async (req, reply) => {
    const { userId, todayTaken, totalMeds, streak, missedYesterday } = req.body;
    // streak: 연속 완전 복용 일수

    const takenRatio = totalMeds > 0 ? todayTaken / totalMeds : 0;
    const confidence = calcConfidence(streak || 0, 0, 30);

    const allTaken = todayTaken === totalMeds && totalMeds > 0;
    const noneTaken = todayTaken === 0 && totalMeds > 0;

    const prompt = `당신은 약물 복용 관리 AI입니다. WHO 복용 순응도 연구를 기반으로 분석하세요.

오늘 복용 현황:
- 복용 완료: ${todayTaken}/${totalMeds}개 (${Math.round(takenRatio * 100)}%)
- 연속 완전 복용: ${streak || 0}일
- 어제 미복용: ${missedYesterday ? '있음' : '없음'}

WHO 기준: 80% 이상 복용 시 치료 효과 유지

다음 JSON만 반환하세요:
{
  "status": "good" | "warning" | "info",
  "headline": "15자 이내 핵심 요약",
  "detail": "1문장 분석",
  "recommendation": "1문장 실천 조언"
}`;

    const insight = totalMeds > 0 ? await callGroq(prompt) : null;

    const autoStatus = allTaken ? 'good' : noneTaken ? 'warning' : 'info';

    return {
      domain: 'meds',
      status: insight?.status || autoStatus,
      headline: insight?.headline || (allTaken ? `${totalMeds}개 모두 복용` : `${todayTaken}/${totalMeds}개 복용`),
      detail: insight?.detail || (allTaken
        ? `오늘 모든 약/영양제를 복용했어요. ${streak > 0 ? `${streak}일 연속 완전 복용 중!` : ''}`
        : `${totalMeds - todayTaken}개가 남았어요. 지금 바로 복용해보세요.`),
      recommendation: insight?.recommendation || (allTaken ? '이 습관을 유지하세요!' : '취침 전 알림을 설정해 빠뜨리지 마세요.'),
      confidence,
      rawData: {
        todayTaken,
        totalMeds,
        takenRatio,
        streak: streak || 0,
        allTaken,
      }
    };
  });

  // ══════════════════════════════════════════════════════════
  // 📈 TREND AI
  // F_trend : C_trend × History → TrendInsight
  // 논문 근거: Lally et al. (2010) 습관 형성 연구, 66일 법칙
  // ══════════════════════════════════════════════════════════
  app.post('/domain/trend', async (req, reply) => {
    const { userId, week7, categoryDist, streak } = req.body;
    // week7: [{ date, count }] 최근 7일 일별 기록 수
    // categoryDist: { diary: n, expense: n, ... }
    // streak: 연속 기록 일수

    const total7 = week7?.reduce((s, d) => s + d.count, 0) || 0;
    const avg7 = total7 / 7;
    const activeDays = week7?.filter(d => d.count > 0).length || 0;
    const confidence = calcConfidence(total7, 3, 30);

    const topCategory = categoryDist
      ? Object.entries(categoryDist).sort((a, b) => b[1] - a[1])[0]
      : null;

    const prompt = `당신은 생활 패턴 분석 AI입니다. Lally(2010) 습관 형성 연구를 기반으로 분석하세요.

최근 7일 기록 통계:
- 총 기록: ${total7}건 (일 평균 ${avg7.toFixed(1)}건)
- 기록한 날: ${activeDays}/7일
- 연속 기록: ${streak || 0}일
- 가장 많은 카테고리: ${topCategory ? `${topCategory[0]} (${topCategory[1]}건)` : '없음'}
- 카테고리 분포: ${categoryDist ? Object.entries(categoryDist).map(([k, v]) => `${k}: ${v}`).join(', ') : '없음'}

Lally 연구: 습관 형성에 평균 66일 필요. 21일 이상 연속 기록 시 자동화 시작.

다음 JSON만 반환하세요:
{
  "status": "good" | "warning" | "info",
  "headline": "15자 이내 핵심 요약",
  "detail": "2문장 이내 분석",
  "recommendation": "1문장 실천 조언"
}`;

    const insight = await callGroq(prompt, 0.4);
    const autoStatus = activeDays >= 5 ? 'good' : activeDays >= 3 ? 'info' : 'warning';

    return {
      domain: 'trend',
      status: insight?.status || autoStatus,
      headline: insight?.headline || `7일 ${total7}건 기록`,
      detail: insight?.detail || `최근 7일 중 ${activeDays}일 기록했어요. ${streak > 7 ? `${streak}일 연속 기록 중!` : '매일 기록하는 습관을 만들어보세요.'}`,
      recommendation: insight?.recommendation || (activeDays < 5 ? '매일 짧게 하나씩 기록해보세요.' : '좋은 기록 습관이에요!'),
      confidence,
      rawData: {
        total7,
        avg7,
        activeDays,
        streak: streak || 0,
        topCategory: topCategory?.[0],
        topCount: topCategory?.[1],
      }
    };
  });

  // ══════════════════════════════════════════════════════════
  // 🧠 META AI v2 — Domain AI 오케스트레이터
  // F_meta : ∫(F_caffeine, F_sleep, F_activity, F_expense, F_meds, F_trend) → Insight
  // Natural Transformation: DomainInsight[] → UnifiedInsight
  // ══════════════════════════════════════════════════════════
  app.post('/meta/insight-v2', async (req, reply) => {
    const { domainInsights } = req.body;
    // domainInsights: DomainInsight[] — 각 Domain AI의 결과

    if (!domainInsights || domainInsights.length === 0) {
      return { insight: '데이터가 부족해요. 각 영역에 기록을 쌓아보세요.' };
    }

    // warning 상태인 도메인 우선 식별
    const warnings = domainInsights.filter(d => d.status === 'warning');
    const goods = domainInsights.filter(d => d.status === 'good');

    const prompt = `당신은 사용자의 생활 데이터를 종합 분석하는 Meta AI입니다.
아래 각 도메인 AI의 분석 결과를 통합해 오늘의 핵심 인사이트를 생성하세요.

${domainInsights.map(d =>
  `[${d.domain.toUpperCase()} — ${d.status}]
  요약: ${d.headline}
  분석: ${d.detail}
  조언: ${d.recommendation}`
).join('\n\n')}

통합 분석 규칙:
1. ${warnings.length > 0 ? `주의 도메인(${warnings.map(d => d.domain).join(', ')})을 중심으로 분석하세요.` : '전반적으로 좋은 상태예요.'}
2. 도메인 간 연관성을 찾아 언급하세요 (예: 수면 부족 → 카페인 과다 패턴)
3. 오늘 당장 실천할 수 있는 조언 1가지를 구체적으로 제시하세요
4. 따뜻하고 개인적인 톤으로 2~3문장

JSON 없이 자연스러운 한국어로만 응답하세요.`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.6,
      })
    });

    const data = await response.json();
    return {
      insight: data.choices[0].message.content.trim(),
      warningDomains: warnings.map(d => d.domain),
      goodDomains: goods.map(d => d.domain),
    };
  });
  // domain.js 맨 아래 meta/insight-v2 엔드포인트를 이걸로 교체
  // Registry 기반 동적 Meta AI
  
    // ══════════════════════════════════════════════════════════
    // 🧠 META AI v3 — Registry 기반 동적 오케스트레이터
    // 하드코딩 없이 Registry에서 도메인 목록을 읽어서 통합
    // ══════════════════════════════════════════════════════════
    app.post('/meta/insight-v3', async (req, reply) => {
      const { domainInsights } = req.body;
      // domainInsights: DomainInsight[] — 각 Domain AI의 결과
  
      if (!domainInsights || domainInsights.length === 0) {
        return { insight: '데이터가 부족해요. 각 영역에 기록을 쌓아보세요.' };
      }
  
      const { getAIDomains, buildMetaPromptContext } = require('../lib/domain_registry');
  
      // Registry에서 활성 도메인 목록 가져오기
      const activeDomains = getAIDomains();
      const domainContext = buildMetaPromptContext(activeDomains);
  
      // warning 상태 도메인 우선 식별
      const warnings = domainInsights.filter(d => d.status === 'warning');
      const goods = domainInsights.filter(d => d.status === 'good');
  
      const prompt = `당신은 사용자의 생활 데이터를 종합 분석하는 Meta AI입니다.
  
  현재 분석 가능한 도메인:
  ${domainContext}
  
  각 Domain AI의 분석 결과:
  ${domainInsights.map(d =>
    `[${d.domain?.toUpperCase() || 'UNKNOWN'} — ${d.status}]
    요약: ${d.headline}
    분석: ${d.detail}
    조언: ${d.recommendation}
    신뢰도: ${Math.round((d.confidence || 0) * 100)}%`
  ).join('\n\n')}
  
  통합 분석 규칙:
  1. ${warnings.length > 0
    ? `주의 필요 도메인(${warnings.map(d => d.domain).join(', ')})을 중심으로 분석하세요.`
    : '전반적으로 좋은 상태예요. 긍정적으로 피드백하세요.'}
  2. 도메인 간 연관성을 찾아 언급하세요
    (예: 수면 부족 → 카페인 과다, 운동 부족 → 기분 저하)
  3. 신뢰도가 낮은 도메인은 "데이터가 쌓이면 더 정확해져요"라고 언급
  4. 오늘 당장 실천할 수 있는 조언 1가지를 구체적으로 제시
  5. 따뜻하고 개인적인 톤, 2~3문장
  
  JSON 없이 자연스러운 한국어로만 응답하세요.`;
  
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.6,
        })
      });
  
      const data = await response.json();
      return {
        insight: data.choices[0].message.content.trim(),
        warningDomains: warnings.map(d => d.domain),
        goodDomains: goods.map(d => d.domain),
        activeDomainCount: activeDomains.length,
      };
    });
};
