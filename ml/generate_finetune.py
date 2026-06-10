#!/usr/bin/env python3
"""
generate_finetune.py
Domain Registry에서 파인튜닝 데이터를 자동 생성합니다.

사용법:
  python3 generate_finetune.py                    # 전체 생성
  python3 generate_finetune.py --domain health    # 특정 도메인만
  python3 generate_finetune.py --count 100        # 개수 지정
"""

import json
import random
import argparse
from pathlib import Path
from datetime import datetime, timedelta

# ── 설정 ──────────────────────────────────────────────────────
TODAY = "2026-06-10"
SYSTEM_PROMPT = """당신은 일상 로그를 분석하는 비서입니다. 오늘 날짜는 {today}입니다.
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
오직 JSON으로만 응답하세요.""".format(today=TODAY)

# ── 템플릿 정의 ───────────────────────────────────────────────
TEMPLATES = {

    # ── health/카페인 ────────────────────────────────────────
    "health_caffeine": {
        "inputs": [
            "{drink} {action}",
            "{time}에 {drink} {action}",
            "{place}에서 {drink} {action}",
            "{drink} 한 잔 {action}",
            "{drink} 두 잔 {action}",
            "아이스 {drink} {action}",
            "따뜻한 {drink} {action}",
            "{drink} {price}원 {action}",
            "{activity} 하면서 {drink} {action}",
            "{drink} {action} 집중이 잘 됨",
            "{drink} {action} 기분이 좋다",
            "{time} {drink} {action}",
        ],
        "variables": {
            "drink": ["아메리카노", "커피", "라떼", "카페라떼", "에스프레소",
                     "카푸치노", "녹차", "홍차", "아이스티", "에너지드링크",
                     "더치커피", "콜드브루", "믹스커피"],
            "action": ["마셨다", "마심", "마셔", "마시고", "마셨어",
                      "마셨음", "먹었다", "한 잔 했다"],
            "time": ["오전 9시", "오전 10시", "오후 2시", "오후 3시",
                    "아침", "점심", "오후"],
            "place": ["카페", "스타벅스", "편의점", "회사", "도서관", "집"],
            "price": ["4500", "5000", "5500", "6000", "6100", "7000"],
            "activity": ["공부", "일", "회의", "독서", "운동"],
        },
        "output_template": {
            "categories": ["health"],
            "sub_category": "카페인",
            "amount": None,
            "appointment_date": None,
            "summary": "카페인 섭취"
        }
    },

    # ── health/카페인 + expense (카페 지출) ──────────────────
    "health_caffeine_expense": {
        "inputs": [
            "{place}에서 {drink} {price}원 {action}",
            "{drink} {price}원 {action}",
            "스타벅스 {drink} {price}원",
            "{place} 가서 {drink} 마셨다 {price}원 냈음",
            "{drink} 사서 마셨다 {price}원",
        ],
        "variables": {
            "drink": ["아메리카노", "라떼", "카페라떼", "에스프레소",
                     "카푸치노", "그린티라떼", "카라멜마키아토"],
            "place": ["스타벅스", "카페", "커피빈", "이디야", "투썸"],
            "price": ["4500", "5000", "5500", "6000", "6100", "6500", "7000"],
            "action": ["마셨다", "마심", "마셔", "마셨음"],
        },
        "output_template": {
            "categories": ["health", "expense"],
            "sub_category": "카페인",
            "amount": "PRICE",
            "appointment_date": None,
            "summary": "카페 음료"
        }
    },

    # ── health/수면 ──────────────────────────────────────────
    "health_sleep": {
        "inputs": [
            "{bedtime}에 잠들었다",
            "{bedtime} 취침 {waketime} 기상",
            "어젯밤 {bedtime}에 잠들었고 오늘 {waketime}에 일어났다",
            "{hours}시간 잠잤다",
            "{hours}시간 수면",
            "오늘 {hours}시간밖에 못잤다",
            "밤새 잠을 못잤다",
            "낮잠 {minutes}분 잤다",
            "{waketime}에 일어났다",
            "수면 시간 {hours}시간 기록",
            "불면증으로 한숨도 못잠",
        ],
        "variables": {
            "bedtime": ["밤 10시", "밤 11시", "자정", "새벽 1시", "새벽 2시"],
            "waketime": ["오전 6시", "오전 7시", "오전 7시 30분", "오전 8시"],
            "hours": ["5", "6", "7", "7.5", "8", "9"],
            "minutes": ["20", "30", "40"],
        },
        "output_template": {
            "categories": ["health"],
            "sub_category": "수면",
            "amount": None,
            "appointment_date": None,
            "summary": "수면 기록"
        }
    },

    # ── expense ──────────────────────────────────────────────
    "expense_general": {
        "inputs": [
            "{place}에서 {item} {price}원",
            "{item} 샀다 {price}원",
            "{item} {price}원 결제",
            "{place} {price}원 카드 결제",
            "오늘 {place}에서 {price}원 씀",
        ],
        "variables": {
            "place": ["마트", "편의점", "올리브영", "쿠팡", "백화점",
                     "약국", "서점", "이마트", "코스트코"],
            "item": ["생필품", "식료품", "옷", "화장품", "책", "약"],
            "price": ["5000", "10000", "15000", "20000", "30000",
                     "45000", "50000", "80000", "100000"],
        },
        "output_template": {
            "categories": ["expense"],
            "sub_category": "기타",
            "amount": "PRICE",
            "appointment_date": None,
            "summary": "지출"
        }
    },

    # ── exercise ─────────────────────────────────────────────
    "exercise_general": {
        "inputs": [
            "{sport} {duration}분 했다",
            "오늘 {sport} {duration}분",
            "{sport} {distance} 뛰었다",
            "헬스장에서 {duration}분 운동",
            "{sport} 완료 {duration}분",
        ],
        "variables": {
            "sport": ["달리기", "수영", "헬스", "요가", "자전거", "등산"],
            "duration": ["30", "45", "60", "90"],
            "distance": ["3km", "5km", "10km"],
        },
        "output_template": {
            "categories": ["exercise"],
            "sub_category": None,
            "amount": None,
            "appointment_date": None,
            "summary": "운동"
        }
    },

    # ── work ─────────────────────────────────────────────────
    "work_general": {
        "inputs": [
            "{partner}와 {meeting} 있음",
            "{time} {meeting} 예정",
            "{meeting} 완료",
            "{task} 마감 {date}",
            "{task} 발표 준비",
        ],
        "variables": {
            "partner": ["팀장님", "교수님", "클라이언트", "팀원들"],
            "meeting": ["미팅", "회의", "면담", "세미나", "발표"],
            "time": ["오전 10시", "오후 2시", "오후 3시"],
            "task": ["프로젝트", "보고서", "기획서", "발표"],
            "date": ["내일", "다음주", "이번주 금요일"],
        },
        "output_template": {
            "categories": ["work"],
            "sub_category": "미팅",
            "amount": None,
            "appointment_date": None,
            "summary": "업무"
        }
    },

    # ── appointment ──────────────────────────────────────────
    "appointment_general": {
        "inputs": [
            "{person}랑 {activity}",
            "{person}와 {place}에서 만나기로 함",
            "{date} {person}랑 약속",
            "{person}들이랑 {activity}",
        ],
        "variables": {
            "person": ["친구", "가족", "여자친구", "남자친구", "동기"],
            "place": ["홍대", "강남", "합정", "신촌", "이태원"],
            "activity": ["저녁 먹기로", "카페 가기로", "영화 보기로", "만나기로"],
            "date": ["내일", "이번 주말", "토요일"],
        },
        "output_template": {
            "categories": ["appointment"],
            "sub_category": "친구",
            "amount": None,
            "appointment_date": None,
            "summary": "약속"
        }
    },

    # ── 엣지 케이스: health+work (회의 중 커피) ──────────────
    "health_caffeine_work": {
        "inputs": [
            "회의 중에 {drink} {action}",
            "{meeting} 하면서 {drink} {action}",
            "{meeting} 전에 {drink} {action}",
        ],
        "variables": {
            "drink": ["커피", "아메리카노", "라떼"],
            "action": ["마셨다", "마심"],
            "meeting": ["회의", "미팅", "세미나"],
        },
        "output_template": {
            "categories": ["work", "health"],
            "sub_category": "카페인",
            "amount": None,
            "appointment_date": None,
            "summary": "회의 중 커피"
        }
    },

    # ── 엣지 케이스: health+study (공부 중 커피) ─────────────
    "health_caffeine_study": {
        "inputs": [
            "공부하면서 {drink} {action}",
            "{study} 하면서 {drink} {action}",
            "{drink} {action} {study} 집중",
        ],
        "variables": {
            "drink": ["커피", "아메리카노", "카페라떼"],
            "action": ["마셨다", "마심", "마셔"],
            "study": ["공부", "독서", "시험공부", "과제"],
        },
        "output_template": {
            "categories": ["study", "health"],
            "sub_category": "카페인",
            "amount": None,
            "appointment_date": None,
            "summary": "공부 중 커피"
        }
    },
}

# ── 생성 함수 ─────────────────────────────────────────────────

def fill_template(template: str, variables: dict) -> tuple[str, dict]:
    """템플릿에서 변수 치환. 가격 변수 추적."""
    chosen = {}
    result = template
    price_value = None

    for key, values in variables.items():
        if "{" + key + "}" in result:
            value = random.choice(values)
            chosen[key] = value
            result = result.replace("{" + key + "}", value)
            if key == "price":
                price_value = int(value)

    return result, price_value


def generate_output(template_def: dict, price_value: int | None) -> dict:
    """출력 JSON 생성."""
    output = template_def["output_template"].copy()

    # 가격 처리
    if output.get("amount") == "PRICE" and price_value:
        output["amount"] = price_value
    elif output.get("amount") == "PRICE":
        output["amount"] = None

    return output


def generate_examples(template_name: str, template_def: dict, count: int) -> list[dict]:
    """특정 템플릿에서 count개 예시 생성."""
    examples = []
    inputs = template_def["inputs"]
    variables = template_def["variables"]

    for _ in range(count):
        input_template = random.choice(inputs)
        user_input, price_value = fill_template(input_template, variables)
        output = generate_output(template_def, price_value)

        # 빈 변수 치환 안 된 것 스킵
        if "{" in user_input:
            continue

        examples.append({
            "messages": [
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": user_input},
                {"role": "assistant", "content": json.dumps(output, ensure_ascii=False)}
            ]
        })

    return examples


def generate_registry_based_examples(registry_path: str, count_per_domain: int = 20) -> list[dict]:
    """Registry의 trigger_words에서 직접 예시 생성."""
    with open(registry_path) as f:
        registry = json.load(f)

    examples = []
    domains = registry["domains"]

    for domain in domains:
        trigger_words = domain.get("trigger_words", [])
        sub_rules = domain.get("sub_category_rules", {})
        category_code = domain["category_code"]

        for _ in range(count_per_domain):
            # 랜덤 trigger word 2~3개 조합
            chosen_words = random.sample(trigger_words, min(2, len(trigger_words)))
            user_input = " ".join(chosen_words)

            # sub_category 결정
            sub_category = None
            for sub, words in sub_rules.items():
                if any(w in user_input for w in words):
                    sub_category = sub
                    break

            output = {
                "categories": [category_code],
                "sub_category": sub_category,
                "amount": None,
                "appointment_date": None,
                "summary": domain["name"] + " 기록"
            }

            examples.append({
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_input},
                    {"role": "assistant", "content": json.dumps(output, ensure_ascii=False)}
                ]
            })

    return examples


def main():
    parser = argparse.ArgumentParser(description="Domain Registry 기반 파인튜닝 데이터 생성")
    parser.add_argument("--domain", type=str, default="all", help="특정 도메인만 생성")
    parser.add_argument("--count", type=int, default=200, help="총 생성 개수")
    parser.add_argument("--output", type=str, default="generated_finetune.jsonl", help="출력 파일")
    parser.add_argument("--registry", type=str, default="domain_registry.json", help="Registry JSON 경로")
    args = parser.parse_args()

    all_examples = []

    # 1. 템플릿 기반 생성
    count_per_template = args.count // len(TEMPLATES)
    for template_name, template_def in TEMPLATES.items():
        if args.domain != "all" and args.domain not in template_name:
            continue
        examples = generate_examples(template_name, template_def, count_per_template)
        all_examples.extend(examples)
        print(f"  {template_name}: {len(examples)}개 생성")

    # 2. Registry trigger_words 기반 생성
    registry_path = Path(args.registry)
    if registry_path.exists():
        registry_examples = generate_registry_based_examples(str(registry_path), count_per_domain=10)
        all_examples.extend(registry_examples)
        print(f"  registry_based: {len(registry_examples)}개 생성")
    else:
        print(f"  ⚠️  Registry 파일 없음: {registry_path}")

    # 셔플
    random.shuffle(all_examples)

    # 출력
    output_path = Path(args.output)
    with open(output_path, "w", encoding="utf-8") as f:
        for example in all_examples:
            f.write(json.dumps(example, ensure_ascii=False) + "\n")

    print(f"\n✅ 총 {len(all_examples)}개 생성 → {output_path}")

    # 카테고리 분포 출력
    from collections import Counter
    cats = Counter()
    for ex in all_examples:
        try:
            content = json.loads(ex["messages"][2]["content"])
            for c in content.get("categories", []):
                cats[c] += 1
        except:
            pass
    print("\n카테고리 분포:")
    for cat, count in cats.most_common():
        print(f"  {cat}: {count}")


if __name__ == "__main__":
    main()
