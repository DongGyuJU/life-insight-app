# 🌟 Life Insight (라이프 인사이트)

사용자의 다양한 일상 데이터를 AI로 분석하여 스마트한 주기별 인사이트를 제공하는 모바일 애플리케이션입니다.

![앱 실행 화면 시연 GIF](여기에_나중에_움짤_링크_넣기)

## 📌 주요 기능

* **AI 기반 자동 분류:** 텍스트/이미지 입력을 Groq AI가 분석하여 일기·지출·약속·업무·운동 등으로 자동 분류
* **이미지 분석:** 영수증·메모 사진을 촬영하거나 갤러리에서 선택하면 Groq Vision이 내용을 자동 추출
* **카테고리별 뷰:** 일기(감정), 지출(세부분류 필터), 약속(날짜 정렬), 업무(D-day·할일), 운동(칼로리 계산)
* **월간 리포트:** AI 총평 + PDF 내보내기
* **다크모드 / 글자 크기:** 설정에서 전체 앱에 즉시 반영
* **로컬 데이터 저장:** SQLite로 기기 내부에 안전하게 저장

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