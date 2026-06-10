// const SERVER_URL = 'http://100.100.103.1:3000';
const SERVER_URL = 'http://100.100.103.1:3000';


export const analyzeText = async (text: string) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    // 💡 [추가된 부분] 현재 날짜와 요일을 한국어로 명확하게 생성 (예: 2026년 5월 20일 수요일)
    const now = new Date();
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const todayString = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${dayNames[now.getDay()]}요일`;

    const response = await fetch(`${SERVER_URL}/analyze`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      // 💡 [수정된 부분] text뿐만 아니라 today 정보도 서버로 같이 보냅니다!
      body: JSON.stringify({ text, today: todayString }), 
      signal: controller.signal,
    });
    
    clearTimeout(timeout);
    const raw = await response.text(); 
    
    // JSON 파싱 시도
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    
    // 배열이면 첫 번째, 아니면 그대로
    const data = Array.isArray(parsed) ? parsed[0] : parsed;
    
    // 카테고리 정규화
    if (data && data.categories) {
      data.categories = normalizeCategories(data.categories);
    }

    // 필수 필드 검증
    if (!data || !data.categories) return null;
    
    return data;
  } catch (error) {
    console.error('분석 실패:', error);
    return null;
  }
};

const normalizeCategories = (categories: any): string[] => {
  if (!categories) return [];
  if (Array.isArray(categories)) return categories.map(String).filter(Boolean);
  if (typeof categories === 'string') {
    try {
      const parsed = JSON.parse(categories);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
      if (typeof parsed === 'string') return parsed.split(',').map(item => item.trim()).filter(Boolean);
    } catch {
      return categories.split(',').map(item => item.trim()).filter(Boolean);
    }
  }
  return [];
};

export const generateReport = async (data: {
  totalEntries: number;
  totalExpense: number;
  positiveCount: number;
  negativeCount: number;
  appointmentCount: number;
  insightHint?: string; // 👈 새로 추가된 랭킹 힌트 파라미터 (선택 사항)
}) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const response = await fetch(`${SERVER_URL}/report`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      // 👇 JSON.stringify(data) 덕분에 insightHint도 자동으로 서버로 전송됩니다!
      body: JSON.stringify(data), 
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return await response.json();
  } catch (error) {
    console.error('리포트 생성 실패:', error);
    return null;
  }
};

// 상대적 날짜 텍스트를 실제 날짜로 변환
export const parseRelativeDate = (text: string): string | null => {
  const today = new Date();
  const todayDay = today.getDay();

  const toLocalDate = (date: Date): string => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const dayMap: Record<string, number> = {
    '일요일': 0, '월요일': 1, '화요일': 2, '수요일': 3,
    '목요일': 4, '금요일': 5, '토요일': 6,
  };

  for (const [dayName, dayNum] of Object.entries(dayMap)) {
    if (text.includes(`다음주 ${dayName}`) || text.includes(`다음 주 ${dayName}`)) {
      const daysUntilThisWeek = (dayNum - todayDay + 7) % 7;
      const totalDays = daysUntilThisWeek === 0 ? 7 : daysUntilThisWeek + 7;
      const result = new Date(today);
      result.setDate(today.getDate() + totalDays);
      return toLocalDate(result);
    }

    if (text.includes(`이번주 ${dayName}`) || text.includes(`이번 주 ${dayName}`)) {
      const daysUntil = (dayNum - todayDay + 7) % 7;
      const result = new Date(today);
      result.setDate(today.getDate() + daysUntil);
      return toLocalDate(result);
    }
  }

  if (text.includes('내일')) {
    const result = new Date(today);
    result.setDate(today.getDate() + 1);
    return toLocalDate(result);
  }

  if (text.includes('모레')) {
    const result = new Date(today);
    result.setDate(today.getDate() + 2);
    return toLocalDate(result);
  }

  return null;
};

export const parseTimeText = (text: string): string | null => {
  // 한글 숫자 → 아라비아 숫자 변환
  const koreanNum: Array<[string, string]> = [
    ['열두', '12'],
    ['열한', '11'],
    ['열', '10'],
    ['아홉', '9'],
    ['여덟', '8'],
    ['일곱', '7'],
    ['여섯', '6'],
    ['다섯', '5'],
    ['네', '4'],
    ['세', '3'],
    ['두', '2'],
    ['한', '1'],
  ];

  let normalized = text.replace(/\u00A0/g, ' ').replace(/ +/g, ' ').trim();

  // 한글 숫자 교체 (숫자 뒤에 시가 올 때)
  for (const [kor, num] of koreanNum) {
    normalized = normalized.replace(new RegExp(`${kor}\\s*시`, 'g'), `${num}시`);
  }

  const meridiem = normalized.match(/(오전|오후)\s*([0-2]?\d)시(?:\s*([0-5]?\d)분)?/);
  if (meridiem) {
    let hour = Number(meridiem[2]);
    const minute = meridiem[3] ? Number(meridiem[3]) : 0;
    if (meridiem[1] === '오후' && hour < 12) hour += 12;
    if (meridiem[1] === '오전' && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  const halfMatch = normalized.match(/([0-2]?\d)시\s*반/);
  if (halfMatch) {
    const hour = Number(halfMatch[1]);
    return `${String(hour).padStart(2, '0')}:30`;
  }

  const plainTime = normalized.match(/([0-2]?\d)시(?:\s*([0-5]?\d)분)?/);
  if (plainTime) {
    const hour = Number(plainTime[1]);
    const minute = plainTime[2] ? Number(plainTime[2]) : 0;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  // 시가 없으면 한글 숫자를 이용해서 시간 추출
  const koreanKeys = koreanNum.map(([kor]) => kor).join('|');
  const noSiMatch = normalized.match(new RegExp(`(?:^|\\s)(${koreanKeys})(?:\\s*(?:에|부터|까지|까지|에))?(?:\\s*([0-5]?\\d)분)?(?:\\s|$)`));
  if (noSiMatch) {
    const hourStr = noSiMatch[1];
    const hour = Number(koreanNum.find(([kor]) => kor === hourStr)?.[1] || '0');
    const minute = noSiMatch[2] ? Number(noSiMatch[2]) : 0;
    if (hour > 0) {
      return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }
  }

  return null;
};

export const parseAppointmentLocation = (text: string): string | null => {
  const match = text.match(/([가-힣0-9\s]{2,30}?)(?=에서|에|으로|로)/);
  return match ? match[1].trim() : null;
};

export const parseAppointmentPartner = (text: string): string | null => {
  const normalized = text.replace(/\u00A0/g, ' ').trim();
  const partnerPatterns = [
    /([가-힣]{2,20})(?:님)?\s*(?:와|과|랑|이랑|에게|한테|와 함께|과 함께|랑 함께|이랑 함께)/,
    /(?:와|과|랑|이랑|에게|한테|와 함께|과 함께|랑 함께|이랑 함께)\s*([가-힣]{2,20})/,
  ];

  for (const pattern of partnerPatterns) {
    const match = normalized.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }

  return null;
};

export const formatDateTime = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value.replace('T', ' ').trim();
  const isoMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/);
  if (isoMatch) return `${isoMatch[1]} ${isoMatch[2]}`;
  const date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day} ${hour}:${minute}`;
  }
  return null;
};

export const formatMonthDayTime = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const normalized = value.replace('T', ' ').trim();
  const isoMatch = normalized.match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/);
  if (isoMatch) {
    const month = isoMatch[1].slice(5, 7);
    const day = isoMatch[1].slice(8, 10);
    return isoMatch[2] ? `${month}/${day} ${isoMatch[2]}` : `${month}/${day}`;
  }
  const date = new Date(normalized);
  if (!Number.isNaN(date.getTime())) {
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hour = String(date.getHours()).padStart(2, '0');
    const minute = String(date.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hour}:${minute}`;
  }
  return null;
};

// export const buildAppointmentDateTime = (text: string, candidate?: string | null): string | null => {
//   const timeText = parseTimeText(text);
//   const candidateDateTime = formatDateTime(candidate || null);
//   if (candidateDateTime) {
//     if (timeText && candidateDateTime.length === 10) {
//       return `${candidateDateTime} ${timeText}`;
//     }
//     return candidateDateTime;
//   }
//   const relativeDate = parseRelativeDate(text);
//   if (relativeDate && timeText) {
//     return `${relativeDate} ${timeText}`;
//   }
//   return relativeDate;
// };
export const buildAppointmentDateTime = (text: string, candidate?: string | null): string | null => {
  const timeText = parseTimeText(text);
  
  // parseRelativeDate 우선 적용
  const relativeDate = parseRelativeDate(text);
  
  if (relativeDate) {
    return timeText ? `${relativeDate} ${timeText}` : relativeDate;
  }
  
  // 상대날짜 없으면 AI 날짜 사용
  const candidateDateTime = formatDateTime(candidate || null);
  if (candidateDateTime) {
    if (timeText && candidateDateTime.length === 10) {
      return `${candidateDateTime} ${timeText}`;
    }
    return candidateDateTime;
  }

  return null;
};

export const analyzeImage = async (base64: string) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 90000);
    const today = new Date().toISOString().slice(0, 10);

    const response = await fetch(`${SERVER_URL}/analyze-image`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({base64, today}),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    let data: any = await response.json();
    data = Array.isArray(data) ? data[0] : data;
    if (data && data.categories) {
      data.categories = normalizeCategories(data.categories);
    }
    return data;
  } catch (error) {
    console.error('이미지 분석 실패:', error);
    return null;
  }
};

const MET_VALUES: Record<string, number> = {
  '달리기': 9.8,
  '걷기': 3.5,
  '자전거': 6.0,
  '수영': 7.0,
  '헬스': 5.0,
  '요가': 2.5,
  '등산': 6.5,
  '줄넘기': 10.0,
  '기타': 5.0,
};

export const calcCalories = (
  exerciseType: string,
  minutes: number,
  weightKg: number,
): number => {
  const met = MET_VALUES[exerciseType] || 5.0;
  return Math.round(met * weightKg * (minutes / 60));
};

// 업무 관련 키워드 판별
export const isWorkKeyword = (text: string): boolean => {
  const normalized = text.toLowerCase();
  return /미팅|회의|마감|보고|발표|뮤팅|세미나|컨퍼런스|워크샵|강의|수업|면접|프레젠테이션/.test(normalized);
};

// 약속 관련 키워드 판별 (업무 제외)
export const isAppointmentKeyword = (text: string): boolean => {
  const normalized = text.toLowerCase();
  // 약속 관련 키워드: 약속, 만남 (단, 미팅/회의/마감 등은 제외)
  if (/미팅|회의|마감|보고|발표/.test(normalized)) return false;
  return /약속|만남/.test(normalized);
};

// 💡 [추가] 이번 달 지출 내역을 기반으로 AI 피드백 가져오기
export const getAiExpenseFeedback = async (expenseSummaryText: string) => {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    // 💡 주소를 /expense-feedback 으로 전용선 변경!
    const response = await fetch(`${SERVER_URL}/expense-feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expenseData: expenseSummaryText }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    
    // 백엔드에서 { "feedback": "..." } 형태로 이쁘게 줄 예정입니다.
    const data = await response.json();
    return data?.feedback || "이번 달 소비를 분석 중입니다.";
  } catch (error) {
    console.error('AI 지출 피드백 실패:', error);
    return "소비 데이터를 읽는 데 실패했어요.";
  }
};