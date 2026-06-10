# 🧠 LiIn (Life Insight)

> **과학 논문을 일상 최적화 도구로 번역해주는 개인화 앱 생태계**
>
> Category Theory 기반 Multi-Agent AI 아키텍처 **(CQL Native AI)** 의 첫 번째 레퍼런스 구현체

[![React Native](https://img.shields.io/badge/React_Native-0.85-61DAFB?logo=react)](https://reactnative.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-4.x-000000?logo=fastify)](https://fastify.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 📱 스크린샷

| 홈 화면 | LIVARS 카드 | 카페인 상세 | Meta AI 인사이트 |
|---|---|---|---|
| 로그 입력 + 분류 | 6개 도메인 카드 | 코르티솔 기반 최적 시간 | 종합 인사이트 생성 |

---

## 🗺 시스템 아키텍처

### 텍스트 분류 흐름
```
사용자 입력 (앱)
    ↓
온디바이스 GGUF (Qwen2.5 1.5B)  →[폴백]→  Groq API (llama-3.1-8b)
    ↓
SQLite (로컬) + PostgreSQL (서버)
```

### LIVARS Domain AI 흐름
```
HealthKit + 앱 기록 데이터
    ↓
Domain AIs (Functors) × 6
☕ 카페인  😴 수면  🏃 활동량  💸 지출  💊 약  📈 트렌드
    ↓ DomainInsight (Natural Transformation)
Meta AI (Orchestrator)
    ↓
종합 인사이트
```

### Category Theory 매핑
| CT 개념 | LiIn 구현 |
|---|---|
| **Object** | 도메인 (C_caffeine, C_sleep, ...) |
| **Functor** | Domain AI (F_d : C_d × History → DomainInsight) |
| **Natural Transformation** | DomainInsight 타입 (에이전트 간 통신 인터페이스) |
| **2-Category** | Meta AI (F_meta : ∫DomainInsights → UnifiedInsight) |

---

## 📁 프로젝트 구조

```
liin/
├── src/                        # React Native 앱
│   ├── components/
│   │   ├── LivarsSection.tsx   # LIVARS 카드 슬라이더 + 상세 모달
│   │   └── GradientHeader.tsx
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── CategoryScreen.tsx
│   │   ├── CalendarScreen.tsx
│   │   ├── ReportScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── services/
│   │   ├── AIManager.ts        # 온디바이스 GGUF 관리 + 서버 폴백
│   │   ├── healthService.ts    # HealthKit 연동
│   │   ├── syncService.ts      # 앱 ↔ 서버 자동 싱크
│   │   ├── api.ts              # Groq API 클라이언트
│   │   ├── settings.ts         # 앱 설정
│   │   └── SettingsContext.tsx
│   └── database/
│       └── db.ts               # SQLite 스키마 + 쿼리
│
├── server/                     # Fastify 서버
│   ├── server.js
│   └── src/
│       ├── routes/
│       │   ├── ai.js           # /analyze, /report, /analyze-image
│       │   ├── domain.js       # 6개 Domain AI 엔드포인트
│       │   ├── livars.js       # LIVARS 카페인 API
│       │   ├── sync.js         # 데이터 싱크
│       │   └── user.js         # 유저 등록
│       └── lib/
│           ├── domain_registry.js   # CQL Registry (JS)
│           └── domain_registry.json # 정규 소스 (JSON)
│
└── ml/                         # 파인튜닝 파이프라인
    ├── train_llm.py            # Unsloth + QLoRA 훈련 스크립트
    ├── generate_finetune.py    # Registry 기반 데이터 자동 생성
    ├── domain_registry.json    # 도메인 정의 (정규 소스)
    └── clean_finetune.jsonl    # 훈련 데이터 (426개)
```

---

## ⚙️ 기술 스택

| 레이어 | 기술 |
|---|---|
| Frontend | React Native 0.85 (iOS) |
| 온디바이스 AI | Qwen2.5 1.5B GGUF · llama.rn 0.12.4 |
| 클라우드 AI | Groq API (llama-3.1-8b-instant, Llama 4 Scout) |
| 로컬 DB | SQLite (react-native-sqlite-storage) |
| 서버 | Fastify + PM2 + Tailscale |
| 서버 DB | PostgreSQL 15 + Prisma ORM |
| 센서 연동 | HealthKit (걸음수/거리/칼로리/수면) |
| 파인튜닝 | Unsloth + QLoRA (RTX 3080 10GB) |

---

## 🚀 시작하기

### 앱 (React Native)

```bash
# 의존성 설치
npm install

# iOS 빌드
cd ios && pod install && cd ..
npx react-native run-ios
```

**환경 변수** (`.env`):
```
GROQ_API_KEY=your_key_here
SERVER_URL=http://your_server:3000
```

### 서버 (Fastify)

```bash
cd server
npm install
cp .env.example .env  # GROQ_API_KEY, DATABASE_URL 입력
npm start             # 또는 pm2 start server.js
```

### 모델 파인튜닝

```bash
cd ml

# 훈련 데이터 생성 (Domain Registry 기반 자동 생성)
python3 generate_finetune.py --count 500 --output my_finetune.jsonl

# 모델 훈련 (RTX 3080 기준 ~35초)
python3 train_llm.py

# 결과: model_gguf_gguf/Qwen2.5-1.5B-Instruct.Q4_K_M.gguf
```

**GGUF 모델 파일**: 크기(941MB)로 인해 레포에 포함되지 않습니다.
→ [Hugging Face에서 다운로드](#) *(준비 중)*

---

## 🔬 CQL Native AI

### 핵심 아이디어

기존 Multi-Agent 시스템(LangGraph, CrewAI)은 에이전트들이 자연어로 소통하고 구조는 프롬프트 엔지니어링으로 설계됩니다. **CQL Native AI**는 다릅니다:

```
Domain AI  =  Functor  F_d : C_d × History → DomainInsight
통신 규약  =  Natural Transformation η : F_d1 → F_d2
Meta AI    =  Functor  F_meta : ∫DomainInsights → UnifiedInsight
```

수학적으로 정의된 인터페이스(`DomainInsight` 타입)가 에이전트 간 통신을 보장합니다. 새 도메인 추가는 **`domain_registry.json`에 항목 하나를 추가**하는 것으로 전체 시스템에 자동 반영됩니다.

### Domain Registry

```json
{
  "id": "caffeine",
  "trigger_words": ["커피", "아메리카노", "마셨다", "마심", "라떼"],
  "classification_rule": "음료 섭취 동사 + 음료명 → health/카페인",
  "domain_ai_endpoint": "/domain/caffeine",
  "meta_summary_template": "카페인 섭취 패턴과 최적 시간 분석"
}
```

### 응용 가능 도메인

LiIn(라이프로그)은 첫 번째 응용일 뿐입니다:

```
LiIn            ← 라이프로그 (현재)
회사 네트워크    ← 부서/프로세스/인력 Category
도로 설계        ← 구간/교차로/흐름 Category
의료 진단        ← 증상/검사/치료 Category
```

### 관련 연구

- Shiebler et al. (2021) *Category Theory in Machine Learning* — arXiv:2106.07032
- Gavranović et al. (2024) *Categorical Deep Learning* — ICML 2024
- Fong, Spivak, Tuyéras (2019) *Backprop as Functor* — LICS 2019
- Spivak (2010) *Functorial Data Migration*

---

## ✅ 구현된 기능

- [x] 텍스트 로깅 + 온디바이스 AI 분류 (8개 카테고리)
- [x] 이미지/영수증 OCR (Llama 4 Scout)
- [x] 월간 리포트 + AI 총평
- [x] 앱 ↔ 서버 자동 싱크 (UUID 기반)
- [x] LIVARS 6개 Domain AI + 상세 모달 차트
- [x] HealthKit 연동 (걸음수/거리/칼로리/수면)
- [x] Meta AI 오케스트레이터 (Registry 기반 동적 통합)
- [x] Domain Registry (JSON 정규 소스 → 전체 시스템 자동 반영)
- [x] QLoRA 파인튜닝 파이프라인 (데이터 자동 생성 포함)

---

## 📄 라이선스

MIT License — 자세한 내용은 [LICENSE](LICENSE) 참고

---

*LiIn · CQL Native AI · 2026*
