# 🧠 LiIn (Life Insight)

> **A personalized app ecosystem that translates scientific research into daily optimization tools**
>
> The first reference implementation of **CQL Native AI** — a Category Theory-based Multi-Agent AI architecture

[![React Native](https://img.shields.io/badge/React_Native-0.85-61DAFB?logo=react)](https://reactnative.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-4.x-000000?logo=fastify)](https://fastify.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-336791?logo=postgresql)](https://www.postgresql.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🗺 System Architecture

### Text Classification Flow
```
User Input (App)
    ↓
On-device GGUF (Qwen2.5 1.5B)  →[fallback]→  Groq API (llama-3.1-8b)
    ↓
SQLite (local) + PostgreSQL (server)
```

### LIVARS Domain AI Flow
```
HealthKit + App log data
    ↓
Domain AIs (Functors) × 6
☕ Caffeine  😴 Sleep  🏃 Activity  💸 Expense  💊 Meds  📈 Trend
    ↓ DomainInsight (Natural Transformation)
Meta AI (Orchestrator)
    ↓
Unified Insight
```

### Category Theory Mapping

| CT Concept | LiIn Implementation |
|---|---|
| **Object** | Domain (C_caffeine, C_sleep, C_activity...) |
| **Functor** | Domain AI — F_d : C_d × History → DomainInsight |
| **Natural Transformation** | DomainInsight type (inter-agent communication interface) |
| **2-Category** | Meta AI — F_meta : ∫DomainInsights → UnifiedInsight |

---

## 📁 Project Structure

```
liin/
├── src/                        # React Native App
│   ├── components/
│   │   ├── LivarsSection.tsx   # LIVARS card slider + detail modals
│   │   └── GradientHeader.tsx
│   ├── screens/
│   │   ├── HomeScreen.tsx
│   │   ├── CategoryScreen.tsx
│   │   ├── CalendarScreen.tsx
│   │   ├── ReportScreen.tsx
│   │   └── SettingsScreen.tsx
│   ├── services/
│   │   ├── AIManager.ts        # On-device GGUF manager + server fallback
│   │   ├── healthService.ts    # HealthKit integration
│   │   ├── syncService.ts      # App ↔ server auto-sync
│   │   ├── api.ts              # Groq API client
│   │   └── SettingsContext.tsx
│   └── database/
│       └── db.ts               # SQLite schema + queries
│
├── server/                     # Fastify Server
│   ├── server.js
│   └── src/
│       ├── routes/
│       │   ├── ai.js           # /analyze, /report, /analyze-image
│       │   ├── domain.js       # 6 Domain AI endpoints
│       │   ├── livars.js       # LIVARS caffeine API
│       │   ├── sync.js         # Data sync
│       │   └── user.js         # User registration
│       └── lib/
│           ├── domain_registry.js    # CQL Registry (JS)
│           └── domain_registry.json  # Canonical source (JSON)
│
└── ml/                         # Fine-tuning Pipeline
    ├── train_llm.py            # Unsloth + QLoRA training script
    ├── generate_finetune.py    # Registry-based automatic data generation
    ├── domain_registry.json    # Domain definitions (canonical source)
    └── clean_finetune.jsonl    # Training data (426 examples)
```

---

## ⚙️ Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React Native 0.85 (iOS) |
| On-device AI | Qwen2.5 1.5B GGUF · llama.rn 0.12.4 |
| Cloud AI | Groq API (llama-3.1-8b-instant, Llama 4 Scout) |
| Local DB | SQLite (react-native-sqlite-storage) |
| Server | Fastify + PM2 + Tailscale |
| Server DB | PostgreSQL 15 + Prisma ORM |
| Sensors | HealthKit (steps / distance / calories / sleep) |
| Fine-tuning | Unsloth + QLoRA (RTX 3080 10GB) |

---

## 🚀 Getting Started

### App (React Native)

```bash
npm install
cd ios && pod install && cd ..
npx react-native run-ios
```

**Environment variables** (`.env`):
```
GROQ_API_KEY=your_key_here
SERVER_URL=http://your_server:3000
```

### Server (Fastify)

```bash
cd server
npm install
cp .env.example .env   # fill in GROQ_API_KEY and DATABASE_URL
npm start              # or: pm2 start server.js
```

### Fine-tuning

```bash
cd ml

# Generate training data from Domain Registry
python3 generate_finetune.py --count 500 --output my_finetune.jsonl

# Train model (~35s on RTX 3080)
python3 train_llm.py

# Output: model_gguf_gguf/Qwen2.5-1.5B-Instruct.Q4_K_M.gguf
```

> **GGUF model file** (941MB) is not included in the repo.
> Download from [Hugging Face](#) *(coming soon)*

---

## 🔬 CQL Native AI

### Core Idea

Existing multi-agent systems (LangGraph, CrewAI) communicate via natural language, with structure defined through prompt engineering. **CQL Native AI** is different:

```
Domain AI  =  Functor    F_d : C_d × History → DomainInsight
Communication  =  Natural Transformation  η : F_d1 → F_d2
Meta AI    =  Functor    F_meta : ∫DomainInsights → UnifiedInsight
```

A mathematically defined interface (`DomainInsight` type) guarantees inter-agent communication. Adding a new domain requires only **one entry in `domain_registry.json`** — the entire system adapts automatically.

### Domain Registry

```json
{
  "id": "caffeine",
  "trigger_words": ["coffee", "americano", "latte", "drank", "consumed"],
  "classification_rule": "beverage consumption verb + drink name → health/caffeine",
  "domain_ai_endpoint": "/domain/caffeine",
  "meta_summary_template": "Caffeine intake pattern and optimal timing analysis"
}
```

### Extensibility

LiIn (life logging) is just the first application. The same framework applies to:

```
LiIn              ← Life logging (current)
Company network   ← Department / process / personnel Category
Urban planning    ← Road segment / intersection / flow Category
Medical diagnosis ← Symptom / test / treatment Category
```

### Related Work

- Shiebler et al. (2021) *Category Theory in Machine Learning* — arXiv:2106.07032
- Gavranović et al. (2024) *Categorical Deep Learning is an Algebraic Theory of All Architectures* — ICML 2024
- Fong, Spivak, Tuyéras (2019) *Backprop as Functor* — LICS 2019
- Spivak (2010) *Functorial Data Migration*
- Mishra (2025) *Composing the Mind of a Machine: Agentic AI Through the Lens of Category Theory*

---

## ✅ Implemented Features

- [x] Text logging + on-device AI classification (8 categories)
- [x] Image / receipt OCR (Llama 4 Scout)
- [x] Monthly report + AI summary generation
- [x] App ↔ server auto-sync (UUID-based)
- [x] LIVARS 6 Domain AI cards + detailed chart modals
- [x] HealthKit integration (steps / distance / calories / sleep)
- [x] Meta AI orchestrator (Registry-based dynamic integration)
- [x] Domain Registry (JSON canonical source → full system auto-update)
- [x] QLoRA fine-tuning pipeline (automatic data generation included)
- [x] On-device GGUF + server fallback architecture

## 🔄 In Progress / Planned

- [ ] Real device HealthKit permission testing
- [ ] On-device model stability improvement (more training data)
- [ ] Phase 1 personalization (cumulative log-based prompt injection)
- [ ] TestFlight deployment → 10 beta users
- [ ] CQL Native AI paper draft (target: ACT 2026)

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details

---

*LiIn · CQL Native AI · 2026*
