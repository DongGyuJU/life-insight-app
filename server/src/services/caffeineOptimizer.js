// src/services/caffeineOptimizer.js
// 논문 기반: Huberman / Adenosine / Cortisol 연구

function calculateOptimalCaffeineWindow(wakeTime, sensitivity = 'medium') {
  const [wakeHour, wakeMin] = wakeTime.split(':').map(Number);
  const wakeMinutes = wakeHour * 60 + wakeMin;

  const addMin = (base, offset) => {
    const total = base + offset;
    const h = Math.floor(total / 60) % 24;
    const m = total % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  // 코르티솔 피크 구간 → 카페인 효과 감소 + 내성 증가
  const avoid = [
    {
      start: addMin(wakeMinutes, 0),
      end: addMin(wakeMinutes, 30),
      reason: '기상 직후 코르티솔 1차 피크',
    },
    {
      start: addMin(wakeMinutes, 90),
      end: addMin(wakeMinutes, 120),
      reason: '코르티솔 2차 피크',
    },
  ];

  // 최적 구간: 코르티솔 안정기
  const optimal = [{
    start: addMin(wakeMinutes, 120),
    end: addMin(wakeMinutes, 420),
    reason: '아데노신 축적 + 코르티솔 안정 → 카페인 효과 극대화',
  }];

  // 민감도별 마지막 섭취 권장 시간 (수면 영향 최소화)
  const cutoffMap = { high: 540, medium: 480, low: 420 };
  const sleepMinutes = 23 * 60;
  const lastCutoff = addMin(sleepMinutes, -(cutoffMap[sensitivity] ?? 480));

  return {
    avoid,
    optimal,
    lastCutoff,
    explanation: `기상(${wakeTime}) 후 ${addMin(wakeMinutes, 120)}~${addMin(wakeMinutes, 420)}이 최적입니다. ${lastCutoff} 이후 카페인은 수면을 방해할 수 있습니다.`,
  };
}

module.exports = { calculateOptimalCaffeineWindow };