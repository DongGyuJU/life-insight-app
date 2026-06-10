// src/syncService.ts
// LiIn 생태계 서버 싱크 서비스

import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';
import { getPendingEntries, markAsSynced, markSyncFailed } from '../database/db';

// ─────────────────────────────────────────────────────────────
// 서버 URL 설정
// Tailscale IP로 어디서든 접근 가능
// ─────────────────────────────────────────────────────────────
const LIIN_SERVER = 'http://100.100.103.1:3000'; // ← Tailscale IP로 교체

const STORAGE_KEY_USER_ID = 'liin_user_id';
const STORAGE_KEY_DEVICE_ID = 'liin_device_id';

// ─────────────────────────────────────────────────────────────
// 디바이스 ID 생성 (앱 설치당 한 번)
// ─────────────────────────────────────────────────────────────
const getOrCreateDeviceId = async (): Promise<string> => {
  let deviceId = await AsyncStorage.getItem(STORAGE_KEY_DEVICE_ID);
  if (!deviceId) {
    // UUID 없이 간단하게 생성
    deviceId = `device_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    await AsyncStorage.setItem(STORAGE_KEY_DEVICE_ID, deviceId);
  }
  return deviceId;
};

// ─────────────────────────────────────────────────────────────
// 유저 등록 / 복구 (앱 첫 실행 시 한 번)
// ─────────────────────────────────────────────────────────────
export const initUser = async (): Promise<string | null> => {
  try {
    // 이미 등록된 userId가 있으면 바로 반환
    const cachedUserId = await AsyncStorage.getItem(STORAGE_KEY_USER_ID);
    if (cachedUserId) return cachedUserId;

    const deviceId = await getOrCreateDeviceId();

    const response = await fetch(`${LIIN_SERVER}/user/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId }),
    });

    if (!response.ok) throw new Error(`서버 응답 오류: ${response.status}`);

    const data = await response.json();
    const userId = data.userId;

    await AsyncStorage.setItem(STORAGE_KEY_USER_ID, userId);
    console.log('[LiIn Sync] 유저 등록 완료:', userId);
    return userId;

  } catch (error) {
    // 서버 연결 안 돼도 앱은 정상 작동
    console.log('[LiIn Sync] 유저 등록 실패 (오프라인 모드):', error);
    return null;
  }
};

// ─────────────────────────────────────────────────────────────
// 핵심: pending 항목들을 서버로 싱크
// ─────────────────────────────────────────────────────────────
export const syncPendingEntries = async (): Promise<void> => {
  try {
    const userId = await AsyncStorage.getItem(STORAGE_KEY_USER_ID);
    if (!userId) {
      // userId 없으면 먼저 등록 시도
      const newUserId = await initUser();
      if (!newUserId) return; // 서버 연결 안 되면 그냥 종료
    }

    const finalUserId = await AsyncStorage.getItem(STORAGE_KEY_USER_ID);
    if (!finalUserId) return;

    // pending 항목 가져오기 (최대 50개)
    const pendingEntries = await getPendingEntries();
    if (pendingEntries.length === 0) return;

    console.log(`[LiIn Sync] ${pendingEntries.length}개 항목 싱크 시작`);

    // categories JSON 파싱
    const processedEntries = pendingEntries.map(entry => ({
      ...entry,
      categories: (() => {
        try {
          return entry.categories ? JSON.parse(entry.categories) : [];
        } catch {
          return [];
        }
      })(),
    }));

    const response = await fetch(`${LIIN_SERVER}/sync/entries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: finalUserId,
        entries: processedEntries,
      }),
    });

    if (!response.ok) throw new Error(`싱크 서버 오류: ${response.status}`);

    const data = await response.json();
    const syncedUuids: string[] = data.synced || [];

    // 성공한 항목 synced로 업데이트
    await markAsSynced(syncedUuids);
    console.log(`[LiIn Sync] ${syncedUuids.length}개 싱크 완료`);

  } catch (error) {
    console.log('[LiIn Sync] 싱크 실패 (다음 기회에 재시도):', error);
    // 실패해도 앱 동작에는 영향 없음
  }
};

// ─────────────────────────────────────────────────────────────
// 앱 포그라운드 진입 시 자동 싱크 등록
// App.tsx에서 한 번만 호출하면 됨
// ─────────────────────────────────────────────────────────────
export const registerAutoSync = (): (() => void) => {
  // 앱이 포그라운드로 올 때마다 싱크 시도
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      syncPendingEntries(); // 백그라운드에서 조용히 실행
    }
  });

  // cleanup 함수 반환 (useEffect에서 사용)
  return () => subscription.remove();
};

// ─────────────────────────────────────────────────────────────
// 유저 프로파일 업데이트 (기상 시간, 카페인 민감도 등)
// LiVars 앱들이 사용
// ─────────────────────────────────────────────────────────────
export const updateUserProfile = async (profile: {
  wakeTime?: string;          // "07:30"
  chronotype?: string;        // "morning" | "neutral" | "evening"
  caffeineSensitivity?: string; // "low" | "medium" | "high"
}): Promise<boolean> => {
  try {
    const userId = await AsyncStorage.getItem(STORAGE_KEY_USER_ID);
    if (!userId) return false;

    const response = await fetch(`${LIIN_SERVER}/user/${userId}/profile`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });

    return response.ok;
  } catch (error) {
    console.log('[LiIn Sync] 프로파일 업데이트 실패:', error);
    return false;
  }
};

// ─────────────────────────────────────────────────────────────
// 헬퍼: 현재 userId 가져오기 (LiVars 앱들에서 사용)
// ─────────────────────────────────────────────────────────────
export const getCurrentUserId = async (): Promise<string | null> => {
  return AsyncStorage.getItem(STORAGE_KEY_USER_ID);
};