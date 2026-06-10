// src/lib/domain_registry.js
// CQL Native AI — Domain Registry
//
// 새 도메인을 여기에 등록하면 전체 시스템이 자동으로 적응:
//   1. 분류 AI 프롬프트에 자동 주입 (카테고리 + 키워드)
//   2. Domain AI 엔드포인트 자동 매핑
//   3. Meta AI가 동적으로 도메인 목록 인식
//
// Category Theory 관점:
//   각 Domain = Category C_d
//   keywords  = C_d의 Object를 자연어로 기술한 것
//   schema    = C_d의 Morphism 구조
//   endpoint  = Functor F_d의 구현체 주소

const DOMAIN_REGISTRY = [

  // ── Core 도메인 (LifeInsight 기본 분류) ──────────────────────
  {
    id: 'diary',
    name: '일기',
    emoji: '📔',
    category_code: 'diary',           // 분류 AI가 사용하는 코드
    classifier_description: '일기/감정/기분/하루기록',
    keywords: ['기분', '감정', '오늘', '일기', '하루', '느낌', '생각'],
    sub_categories: ['기쁨😊', '설렘🥰', '평온😌', '피곤😪', '슬픔😢', '화남😠', '불안😰'],
    schema: {
      main_fields: ['emotion', 'summary'],
      date_field: 'created_at',
    },
    domain_ai_endpoint: null,         // Domain AI 없음 (Trend AI가 커버)
    meta_summary_template: '감정 및 일기 패턴',
    active: true,
    is_core: true,
  },

  {
    id: 'expense',
    name: '지출',
    emoji: '💸',
    category_code: 'expense',
    classifier_description: '지출/소비/영수증/가계부/결제',
    keywords: ['원', '결제', '샀다', '구매', '지출', '영수증', '카드', '현금', '냈다', '계산'],
    sub_categories: ['카페', '식사', '쇼핑', '교통', '의료', '구독', '기타'],
    schema: {
      main_fields: ['amount', 'sub_category', 'location'],
      date_field: 'created_at',
    },
    domain_ai_endpoint: '/domain/expense',
    meta_summary_template: '이번 달 지출 패턴과 카테고리별 분석',
    active: true,
    is_core: true,
  },

  {
    id: 'appointment',
    name: '약속',
    emoji: '📅',
    category_code: 'appointment',
    classifier_description: '순수 개인약속/데이트/친구모임/가족모임 (업무 제외)',
    keywords: ['약속', '만남', '데이트', '친구랑', '가족', '모임', '만나'],
    sub_categories: ['데이트', '친구', '가족', '기타'],
    schema: {
      main_fields: ['appointment_date', 'location', 'work_partner'],
      date_field: 'appointment_date',
    },
    domain_ai_endpoint: null,
    meta_summary_template: '약속 및 사회적 활동 패턴',
    active: true,
    is_core: true,
  },

  {
    id: 'work',
    name: '업무',
    emoji: '💼',
    category_code: 'work',
    classifier_description: '미팅/회의/마감/발표/보고/세미나/업무 (업무성이면 work)',
    keywords: ['미팅', '회의', '마감', '발표', '보고', '세미나', '컨퍼런스', '업무', '프로젝트', '면접'],
    sub_categories: ['미팅', '발표', '마감', 'D-day', '보고', '할일', '기타'],
    schema: {
      main_fields: ['due_date', 'work_partner', 'work_priority', 'work_status', 'is_todo'],
      date_field: 'due_date',
    },
    domain_ai_endpoint: null,
    meta_summary_template: '업무 마감 및 할일 현황',
    active: true,
    is_core: true,
  },

  {
    id: 'exercise',
    name: '운동',
    emoji: '🏃',
    category_code: 'exercise',
    classifier_description: '운동/헬스/달리기/수영/자전거/스포츠',
    keywords: ['운동', '헬스', '달리기', '수영', '자전거', '요가', '등산', '걷기', 'km', '분간'],
    sub_categories: ['달리기', '헬스', '수영', '자전거', '요가', '등산', '줄넘기', '기타'],
    schema: {
      main_fields: ['exercise_type', 'exercise_minutes', 'exercise_calories'],
      date_field: 'created_at',
    },
    domain_ai_endpoint: '/domain/activity',
    meta_summary_template: '운동 패턴 및 활동량 분석',
    active: true,
    is_core: true,
  },

  {
    id: 'health',
    name: '건강',
    emoji: '❤️',
    category_code: 'health',
    classifier_description: '건강/수면/식단/몸무게/병원/카페인/커피/음료 섭취',
    keywords: [
      '수면', '잠', '기상', '식단', '몸무게', '병원', '약',
      // 카페인 관련 (LiVars 연동)
      '커피', '아메리카노', '카페인', '라떼', '에스프레소', '카푸치노',
      '아이스', '따뜻한', '음료', '카페', '마셨다', '마심',
    ],
    sub_categories: ['수면', '식단', '몸무게', '병원', '카페인', '기타'],
    schema: {
      main_fields: ['sub_category', 'summary'],
      date_field: 'created_at',
    },
    domain_ai_endpoint: '/domain/caffeine',   // 카페인 sub_category면 CaffeineAI로
    meta_summary_template: '건강 상태 및 카페인/수면 패턴',
    active: true,
    is_core: true,
  },

  {
    id: 'study',
    name: '공부',
    emoji: '📚',
    category_code: 'study',
    classifier_description: '공부/독서/강의/학습/시험',
    keywords: ['공부', '독서', '강의', '학습', '시험', '책', '읽었다', '과제', '수업'],
    sub_categories: ['독서', '강의', '시험', '과제', '기타'],
    schema: {
      main_fields: ['summary', 'sub_category'],
      date_field: 'created_at',
    },
    domain_ai_endpoint: null,
    meta_summary_template: '학습 패턴 및 공부 현황',
    active: true,
    is_core: true,
  },

  {
    id: 'travel',
    name: '여행',
    emoji: '✈️',
    category_code: 'travel',
    classifier_description: '여행/방문/관광/출장',
    keywords: ['여행', '방문', '관광', '출장', '비행기', '기차', '호텔', '숙소'],
    sub_categories: ['국내', '해외', '당일치기', '기타'],
    schema: {
      main_fields: ['location', 'appointment_date', 'summary'],
      date_field: 'appointment_date',
    },
    domain_ai_endpoint: null,
    meta_summary_template: '여행 및 이동 패턴',
    active: true,
    is_core: true,
  },

  // ── LiVars 전용 도메인 (확장 도메인) ─────────────────────────
  {
    id: 'sleep_session',
    name: '수면 세션',
    emoji: '😴',
    category_code: 'health',          // 기존 health 카테고리 재사용
    classifier_description: '수면 기록 (취침/기상 시간 포함)',
    keywords: ['잠들었다', '취침', '기상', '수면', '잤다', '일어났다'],
    sub_categories: ['수면'],
    schema: {
      main_fields: ['sub_category', 'summary'],
      date_field: 'created_at',
    },
    domain_ai_endpoint: '/domain/sleep',
    meta_summary_template: '수면 품질 및 패턴 분석',
    active: true,
    is_core: false,
    parent_domain: 'health',
  },

  {
    id: 'meds',
    name: '약/영양제',
    emoji: '💊',
    category_code: 'health',
    classifier_description: '약 복용/영양제/건강기능식품',
    keywords: ['약', '영양제', '비타민', '오메가', '먹었다', '복용', '마그네슘'],
    sub_categories: ['수면'],
    schema: {
      main_fields: ['sub_category', 'summary'],
      date_field: 'created_at',
    },
    domain_ai_endpoint: '/domain/meds',
    meta_summary_template: '약/영양제 복용 현황',
    active: true,
    is_core: false,
    parent_domain: 'health',
  },

];

// ─── Registry 접근 헬퍼 함수들 ────────────────────────────────

// 활성 도메인만 반환
const getActiveDomains = () =>
  DOMAIN_REGISTRY.filter(d => d.active);

// 코어 도메인만 반환 (분류 AI 프롬프트용)
const getCoreDomains = () =>
  DOMAIN_REGISTRY.filter(d => d.active && d.is_core);

// Domain AI 엔드포인트가 있는 도메인만 반환 (Meta AI용)
const getAIDomains = () =>
  DOMAIN_REGISTRY.filter(d => d.active && d.domain_ai_endpoint);

// 분류 AI 프롬프트 동적 생성
const buildClassifierPrompt = () => {
  const core = getCoreDomains();

  const categoriesSection = core
    .map(d => `  - ${d.category_code}: ${d.classifier_description}`)
    .join('\n');

  const subCategorySection = core
    .filter(d => d.sub_categories.length > 0)
    .map(d => `  - ${d.category_code} → one of: ${d.sub_categories.join(' ')}`)
    .join('\n');

  const keywordHints = [
    `"교수님 미팅", "팀장님 세미나", "발표 준비" → work`,
    `"친구랑 저녁", "데이트", "가족 모임" → appointment`,
    `"아메리카노", "커피", "카페인", "라떼", "마셨다" → health, sub_category: 카페인`,
    `"잠들었다", "기상", "수면 시간" → health, sub_category: 수면`,
  ].join('\n  ');

  return { categoriesSection, subCategorySection, keywordHints };
};

// Meta AI 프롬프트용 도메인 목록 생성
const buildMetaPromptContext = (availableDomains) => {
  return availableDomains
    .map(d => `${d.emoji} ${d.name}: ${d.meta_summary_template}`)
    .join('\n');
};

// ID로 도메인 찾기
const getDomainById = (id) =>
  DOMAIN_REGISTRY.find(d => d.id === id);

// category_code로 도메인들 찾기
const getDomainsByCode = (code) =>
  DOMAIN_REGISTRY.filter(d => d.category_code === code);

// 텍스트에서 관련 도메인 추론 (키워드 기반)
const inferDomains = (text) => {
  const lower = text.toLowerCase();
  return DOMAIN_REGISTRY.filter(d =>
    d.keywords.some(kw => lower.includes(kw.toLowerCase()))
  );
};

module.exports = {
  DOMAIN_REGISTRY,
  getActiveDomains,
  getCoreDomains,
  getAIDomains,
  buildClassifierPrompt,
  buildMetaPromptContext,
  getDomainById,
  getDomainsByCode,
  inferDomains,
};
