// src/services/healthService.ts
// HealthKit 연동 서비스 — 걸음 수, 이동 거리, 활성 칼로리 자동 수집

import { Platform } from 'react-native';
import { HealthKitPermissions, HealthValue } from 'react-native-health';

const { HealthKit: AppleHealthKit } = require('react-native-health');

// ─── 요청할 권한 ──────────────────────────────────────────────
const getPermissions = (): HealthKitPermissions => ({
  permissions: {
    read: [
      AppleHealthKit.Constants.Permissions.StepCount,
      AppleHealthKit.Constants.Permissions.DistanceWalkingRunning,
      AppleHealthKit.Constants.Permissions.ActiveEnergyBurned,
      AppleHealthKit.Constants.Permissions.FlightsClimbed,
      AppleHealthKit.Constants.Permissions.SleepAnalysis,
    ],
    write: [],
  },
});

// ─── 타입 ────────────────────────────────────────────────────
export interface TodayActivity {
  steps: number;           // 걸음 수
  distanceKm: number;      // 이동 거리 (km)
  calories: number;        // 활성 칼로리
  flights: number;         // 오른 계단 수
}

export interface SleepData {
  totalMinutes: number;    // 총 수면 시간 (분)
  bedtime: string;         // 취침 시간 HH:MM
  wakeTime: string;        // 기상 시간 HH:MM
}

let isInitialized = false;

// ─── 초기화 (권한 요청) ───────────────────────────────────────
export const initHealthKit = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (Platform.OS !== 'ios') { resolve(false); return; }
    // ← 이 줄 추가: 시뮬레이터에서 네이티브 모듈 없으면 그냥 false
    if (!AppleHealthKit || !AppleHealthKit.initHealthKit) {
      console.log('[HealthKit] 네이티브 모듈 없음 (시뮬레이터)');
      resolve(false);
      return;
    }
    //. 
    if (isInitialized) { resolve(true); return; }

    AppleHealthKit.initHealthKit(getPermissions(), (error: string) => {  // ← 여기
      if (error) {
        console.log('[HealthKit] 초기화 실패:', error);
        resolve(false);
        return;
      }
      isInitialized = true;
      console.log('[HealthKit] 초기화 성공 ✅');
      resolve(true);
    });
  });
};

// ─── 오늘 걸음 수 ─────────────────────────────────────────────
export const getTodaySteps = (): Promise<number> => {
  return new Promise((resolve) => {
    if (!isInitialized) { resolve(0); return; }

    const options = {
      date: new Date().toISOString(),
      includeManuallyAdded: true,
    };

    AppleHealthKit.getStepCount(options, (err: string, result: HealthValue) => {
      if (err) { resolve(0); return; }
      resolve(Math.round(result.value || 0));
    });
  });
};

// ─── 오늘 이동 거리 ───────────────────────────────────────────
export const getTodayDistance = (): Promise<number> => {
  return new Promise((resolve) => {
    if (!isInitialized) { resolve(0); return; }

    const options = {
      date: new Date().toISOString(),
      includeManuallyAdded: true,
    };

    AppleHealthKit.getDistanceWalkingRunning(
      options,
      (err: string, result: HealthValue) => {
        if (err) { resolve(0); return; }
        // 미터 → km 변환, 소수점 1자리
        resolve(Math.round((result.value || 0) / 100) / 10);
      }
    );
  });
};

// ─── 오늘 활성 칼로리 ─────────────────────────────────────────
export const getTodayCalories = (): Promise<number> => {
  return new Promise((resolve) => {
    if (!isInitialized) { resolve(0); return; }

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const options = {
      startDate: start.toISOString(),
      endDate: new Date().toISOString(),
    };

    AppleHealthKit.getActiveEnergyBurned(
      options,
      (err: string, results: HealthValue[]) => {
        if (err || !results) { resolve(0); return; }
        const total = results.reduce((sum, r) => sum + (r.value || 0), 0);
        resolve(Math.round(total));
      }
    );
  });
};

// ─── 오늘 계단 ───────────────────────────────────────────────
export const getTodayFlights = (): Promise<number> => {
  return new Promise((resolve) => {
    if (!isInitialized) { resolve(0); return; }

    const options = { date: new Date().toISOString() };

    AppleHealthKit.getFlightsClimbed(
      options,
      (err: string, result: HealthValue) => {
        if (err) { resolve(0); return; }
        resolve(Math.round(result.value || 0));
      }
    );
  });
};

// ─── 오늘 전체 활동 데이터 한 번에 ───────────────────────────
export const getTodayActivity = async (): Promise<TodayActivity> => {
  const initialized = await initHealthKit();
  if (!initialized) {
    return { steps: 0, distanceKm: 0, calories: 0, flights: 0 };
  }

  const [steps, distanceKm, calories, flights] = await Promise.all([
    getTodaySteps(),
    getTodayDistance(),
    getTodayCalories(),
    getTodayFlights(),
  ]);

  return { steps, distanceKm, calories, flights };
};

// ─── 어젯밤 수면 ─────────────────────────────────────────────
export const getLastNightSleep = (): Promise<SleepData | null> => {
  return new Promise((resolve) => {
    if (!isInitialized) { resolve(null); return; }

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 1);
    start.setHours(18, 0, 0, 0); // 어제 오후 6시부터

    const options = {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    };

    AppleHealthKit.getSleepSamples(
      options,
      (err: string, results: any[]) => {
        if (err || !results || results.length === 0) {
          resolve(null);
          return;
        }

        // asleep 상태만 필터
        const sleepSamples = results.filter(
          r => r.value === 'ASLEEP' || r.value === 'CORE' ||
               r.value === 'DEEP' || r.value === 'REM'
        );

        if (sleepSamples.length === 0) { resolve(null); return; }

        const earliest = sleepSamples.reduce((a, b) =>
          new Date(a.startDate) < new Date(b.startDate) ? a : b
        );
        const latest = sleepSamples.reduce((a, b) =>
          new Date(a.endDate) > new Date(b.endDate) ? a : b
        );

        const totalMs = sleepSamples.reduce((sum, s) =>
          sum + (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()), 0
        );

        const fmt = (dateStr: string) => {
          const d = new Date(dateStr);
          return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        };

        resolve({
          totalMinutes: Math.round(totalMs / 60000),
          bedtime: fmt(earliest.startDate),
          wakeTime: fmt(latest.endDate),
        });
      }
    );
  });
};

// ─── 걸음 수 목표 달성률 ──────────────────────────────────────
export const getStepGoalProgress = async (goal = 10000): Promise<number> => {
  const steps = await getTodaySteps();
  return Math.min(Math.round((steps / goal) * 100), 100);
};
