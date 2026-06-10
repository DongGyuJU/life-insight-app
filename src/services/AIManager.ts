// AIManager.ts
import { initLlama, LlamaContext } from 'llama.rn';
import RNFS from 'react-native-fs';
import { Alert } from 'react-native';

let llamaContext: LlamaContext | null = null;

export const loadAIEngine = async () => {
  if (llamaContext) return llamaContext;
  
  const absolutePath = `${RNFS.MainBundlePath}/lifelog_qwen_1.5b.gguf`;

  try {
    console.log("🔄 온디바이스 AI 로딩 중...");
    console.log("📂 모델 경로 확인:", absolutePath);

    llamaContext = await initLlama({
      model: absolutePath,
      use_mlock: true,
      n_gpu_layers: 99,
      n_ctx: 2048,
    });
    
    console.log("✅ AI 로딩 완료! GPU 스탠바이.");
    return llamaContext;
  } catch (error: any) {
    console.error("AI 엔진 점화 실패:", error?.message || String(error));
    console.error("시도한 경로:", absolutePath);
  }
};

export const analyzeLifeLog = async (userInput: string) => {
  if (!llamaContext) {
    console.warn("온디바이스 AI 없음 → 서버 분석 사용");
    return null; 
  }

  // 💡 오늘 날짜를 구해서 모델에게 알려줍니다 (예: 2026-06-02)
  const today = new Date();
  const dateString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // 💡 프롬프트 진화: 출력할 JSON의 정확한 "키(Key)"와 형태를 강제합니다.
  // const prompt = `<|im_start|>system
  // 당신은 일상 로그를 분석하는 비서입니다. 오늘 날짜는 ${dateString}입니다.
  // [🚨중요 규칙]
  // 1. 사용자의 입력 텍스트에 없는 정보는 절대 지어내지 마세요.
  // 2. 알 수 없는 정보는 반드시 null로 비워두세요.
  // 3. 오직 아래의 JSON 형식으로만 대답하세요.

  // {
  //   "categories": ["diary", "expense", "appointment", "work", "exercise", "health", "study", "travel"],
  //   "sub_category": null,
  //   "appointment_date": "YYYY-MM-DD HH:mm",
  //   "location": "",
  //   "work_partner": "",
  //   "amount": null,
  //   "exercise_type": null,
  //   "exercise_minutes": null,
  //   "summary": "입력 내용의 10자 이내 한 줄 요약"
  // }

  // [카테고리 분류 규칙]
  // - diary: 일기, 감정, 기분, 하루 기록
  // - expense: 지출, 소비, 영수증, 금액이 나오면 무조건
  // - appointment: 친구/가족/연인과의 약속, 모임 (업무 제외)
  // - work: 미팅, 회의, 마감, 발표, 업무 관련
  // - exercise: 운동, 헬스, 달리기, 수영, 자전거
  // - health: 수면, 식단, 병원, 커피/아메리카노/카페인/음료 섭취
  // - study: 공부, 독서, 강의, 시험
  // - travel: 여행, 방문, 출장

  // [sub_category 규칙]
  // - health 이면서 커피/아메리카노/라떼/카페인/음료 → sub_category: "카페인"
  // - health 이면서 잠/수면/기상 → sub_category: "수면"
  // - diary → sub_category: 기쁨😊 설렘🥰 평온😌 피곤😪 슬픔😢 화남😠 불안😰 중 하나
  // - expense → sub_category: 카페 식사 쇼핑 교통 의료 구독 기타 중 하나

  // [중요 예시]
  // - "아메리카노 마심" → categories: ["health"], sub_category: "카페인"
  // - "커피 한 잔" → categories: ["health"], sub_category: "카페인"
  // - "5000원 냈다" → categories: ["expense"], amount: 5000
  // - "친구랑 저녁" → categories: ["appointment"]
  // - "팀장님 미팅" → categories: ["work"]
  // <|im_end|>
  // <|im_start|>user
  // ${userInput}<|im_end|>
  // <|im_start|>assistant
  // `;
  const prompt = `<|im_start|>system
  당신은 일상 로그를 분석하는 비서입니다. 오늘 날짜는 ${dateString}입니다.
  [카테고리]
  - diary: 일기/감정/기분
  - expense: 지출/소비/영수증
  - appointment: 친구/가족 약속
  - work: 미팅/업무/마감
  - exercise: 운동
  - health: 수면/식단/커피/카페인/음료
  - study: 공부/독서
  - travel: 여행
  [sub_category]
  - health+커피/카페인 → 카페인
  - health+수면 → 수면
  오직 JSON으로만 응답하세요.<|im_end|>
  <|im_start|>user
  ${userInput}<|im_end|>
  <|im_start|>assistant
  `;
  try {
    const response = await llamaContext.completion({
      prompt: prompt,
      n_predict: 256,  // 512 → 256으로 줄여보기
      temperature: 0.1,
      stop: ["<|im_end|>", "<|endoftext|>"],  // stop token 추가
    });

    const rawText = response.content || response.text || '';
    console.log("🤖 tokens_predicted:", response.tokens_predicted);
    console.log("🤖 rawText 길이:", rawText.length);
    console.log("🤖 rawText 전체:", JSON.stringify(rawText));
    console.log("🤖 rawText JSON:", JSON.stringify(rawText));
    if (!rawText || rawText.length < 50) {
      console.warn("⚠️ 온디바이스 출력 없음 → 서버 폴백");
      return null;
    }
    const jsonMatch = rawText.match(/\[[\s\S]*\]|\{[\s\S]*\}/);
    console.log("stopped_eos:", response.stopped_eos);
    console.log("context_full:", response.context_full);
    console.log("interrupted:", response.interrupted);
    console.log("tokens_predicted:", response.tokens_predicted);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        const raw = Array.isArray(parsed) ? parsed[0] : parsed;

        // 포맷 정규화: 두 가지 출력 포맷 모두 처리
        const normalized: any = {
          categories: raw.categories || 
                      (raw.category ? [raw.category] : 
                      (raw.sub_category === '카페인' ? ['health'] :
                      raw.sub_category === '수면' ? ['health'] : ['diary'])),
          sub_category: raw.sub_category || null,
          amount: raw.amount || null,
          appointment_date: raw.appointment_date || raw.date || null,
          exercise_type: raw.exercise_type || null,
          exercise_minutes: raw.exercise_minutes || null,
          work_partner: raw.work_partner || null,
          work_priority: raw.work_priority || '보통',
          is_todo: raw.is_todo || 0,
          due_date: raw.due_date || null,
          summary: raw.summary || null,
        };

        console.log("🎉 [분석 성공]:", normalized);
        return normalized;
      } catch (e) {
        console.error("JSON 파싱 실패, 원본:", jsonMatch[0].slice(0, 100));
        return null;
      }
    }
  } catch (error) {
    console.error("추론 중 에러 발생:", error);
    return null;
  }
};
