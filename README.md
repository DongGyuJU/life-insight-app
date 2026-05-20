# 🌟 Life Insight (라이프 인사이트)

사용자의 다양한 일상 데이터를 AI로 분석하여 스마트한 주기별 인사이트를 제공하는 모바일 애플리케이션입니다.

![앱 실행 화면 시연 GIF](여기에_나중에_움짤_링크_넣기)

## 📌 주요 기능
* **AI 기반 자동 분류 및 맥락 분석:** 일상 기록, 지출 내역, 일정, 운동 등 다양한 형태의 텍스트 입력을 AI가 파악하여 카테고리를 자동으로 분류하고 핵심 내용을 요약합니다.
* **주기별 맞춤형 리포트:** 단순히 데이터를 나열하는 것을 넘어, 사용자가 설정한 주기(주간/월간)에 맞춰 종합적인 분석 리포트를 생성합니다.
* **로컬 중심 데이터 보안:** 민감한 개인 정보와 일상 로그는 SQLite를 통해 기기 내부에 암호화 공간을 확보하여 안전하게 저장됩니다.

## 🛠 기술 스택 (Tech Stack)
* **Frontend:** React Native 0.85 (iOS), TypeScript
* **Backend:** Node.js (Fastify), Docker (Render 클라우드 서버 배포 완료)
* **Database:** SQLite (react-native-sqlite-storage), AsyncStorage
* **AI Engine:** Groq API (llama-3.1-8b-instant)

## 🏗 시스템 아키텍처 (Architecture)
1. **Client (React Native):** 사용자 데이터 입력 및 구조화된 SQLite 로컬 DB 저장
2. **Server (Fastify / Render Cloud):** 클라이언트의 요청을 받아 외부 AI 모델과의 통신 안전하게 중계
3. **AI Engine (Groq API):** 자연어 처리를 통해 복합 데이터를 분석하고 구조화된 JSON 형태로 반환

## 📂 프로젝트 구조 (Project Structure)
```text
src/
├── components/     # 재사용 가능한 UI 컴포넌트 (EditModal 등)
├── database/       # 로컬 DB 연결 및 스키마 정의 (db.ts)
├── screens/        # 메인 탭 화면 (Home, Category, Calendar, Report, Settings)
└── services/       # 비즈니스 로직 및 외부 API 통신 (api.ts, pdf.ts, settings.ts)
```


## 🗄 데이터베이스 설계 (Database Schema)
* 로컬 일상 로그 데이터를 체계적으로 관리하기 위해 SQLite 단일 테이블에 다각화된 컬럼 구조를 설계했습니다.

* 기본 정보: id, text, categories, sub_category, emotion, created_at

* 자산 및 일정: amount, appointment_date, summary, reviewed

* 운동 및 업무: exercise_type, exercise_minutes, exercise_calories, work_partner, work_priority, work_status

* 할 일 기능: is_todo, due_date

🚀 실행 방법 (How to run)

# 1. 패키지 설치
npm install

# 2. iOS 환경 세팅 (Mac 전용)
cd ios && pod install && cd ..

# 3. 앱 실행
npm run ios