// src/screens/CoffeeScreen.tsx
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Platform,
} from 'react-native';
import { useSettings } from '../services/SettingsContext';
import { getCurrentUserId, updateUserProfile } from '../services/syncService';

// ─── 타입 ────────────────────────────────────────────────────
interface CaffeineWindow {
  avoid: { start: string; end: string; reason: string }[];
  optimal: { start: string; end: string; reason: string }[];
  lastCutoff: string;
  explanation: string;
}

interface WeeklyReport {
  totalEvents: number;
  avgFocus: number | null;
  bestPattern: { wakeOffset: number; drinkType: string; focus: number }[];
  insight: string;
}

const DRINK_TYPES = ['아메리카노', '라떼', '에스프레소', '카푸치노', '녹차', '홍차', '에너지드링크'];
const DRINK_MG: Record<string, number> = {
  '아메리카노': 150, '라떼': 150, '에스프레소': 63,
  '카푸치노': 150, '녹차': 30, '홍차': 50, '에너지드링크': 80,
};

// ─── 메인 컴포넌트 ────────────────────────────────────────────
export default function CoffeeScreen() {
  const { settings, updateSetting, colors, fontSize } = useSettings();

  const [optimalWindow, setOptimalWindow] = useState<CaffeineWindow | null>(null);
  const [weeklyReport, setWeeklyReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [logLoading, setLogLoading] = useState(false);

  // 로깅 상태
  const [selectedDrink, setSelectedDrink] = useState('아메리카노');
  const [wakeTimeInput, setWakeTimeInput] = useState(settings.wakeTime || '07:00');
  const [showWakeEdit, setShowWakeEdit] = useState(false);

  // 최적 시간 가져오기
  const fetchOptimalTime = useCallback(async () => {
    setLoading(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) { setLoading(false); return; }

      const SERVER_URL = 'http://100.x.x.x:3000'; // ← Tailscale IP
      const res = await fetch(`${SERVER_URL}/livars/coffee/optimal-time?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setOptimalWindow(data);
      }
    } catch (e) {
      console.log('[Coffee] 서버 연결 실패, 로컬 계산 사용');
      // 서버 없으면 로컬 계산
      setOptimalWindow(calculateLocalOptimal(settings.wakeTime || '07:00'));
    } finally {
      setLoading(false);
    }
  }, [settings.wakeTime]);

  // 주간 리포트 가져오기
  const fetchWeeklyReport = useCallback(async () => {
    try {
      const userId = await getCurrentUserId();
      if (!userId) return;

      const SERVER_URL = 'http://100.100.103.1:3000'; // ← Tailscale IP
      const res = await fetch(`${SERVER_URL}/livars/coffee/weekly-report?userId=${userId}`);
      if (res.ok) {
        const data = await res.json();
        setWeeklyReport(data);
      }
    } catch (e) {
      console.log('[Coffee] 주간 리포트 로드 실패');
    }
  }, []);

  useEffect(() => {
    fetchOptimalTime();
    fetchWeeklyReport();
  }, [fetchOptimalTime, fetchWeeklyReport]);

  // 기상 시간 저장
  const handleSaveWakeTime = async () => {
    if (!/^\d{2}:\d{2}$/.test(wakeTimeInput)) {
      Alert.alert('형식 오류', 'HH:MM 형식으로 입력해주세요. (예: 07:30)');
      return;
    }
    await updateSetting('wakeTime', wakeTimeInput);
    await updateUserProfile({ wakeTime: wakeTimeInput });
    setShowWakeEdit(false);
    fetchOptimalTime();
  };

  // 카페인 섭취 로깅
  const handleLogCaffeine = async () => {
    setLogLoading(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) {
        Alert.alert('오류', '유저 정보를 찾을 수 없어요.');
        return;
      }

      // 기상 후 몇 분인지 계산
      const [wakeH, wakeM] = (settings.wakeTime || '07:00').split(':').map(Number);
      const now = new Date();
      const wakeMinutes = wakeH * 60 + wakeM;
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const offset = nowMinutes - wakeMinutes;

      const SERVER_URL = 'http://100.x.x.x:3000'; // ← Tailscale IP
      const res = await fetch(`${SERVER_URL}/livars/coffee/log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          consumedAt: now.toISOString(),
          drinkType: selectedDrink,
          caffeineMg: DRINK_MG[selectedDrink] || 100,
          wakeOffsetMinutes: offset,
        }),
      });

      if (res.ok) {
        Alert.alert('✅ 기록 완료', `${selectedDrink} 섭취가 기록됐어요!`);
        fetchWeeklyReport();
      }
    } catch (e) {
      Alert.alert('오류', '서버 연결을 확인해주세요.');
    } finally {
      setLogLoading(false);
    }
  };

  const bg = colors.background;
  const card = colors.card;
  const text = colors.text;
  const sub = colors.subText;
  const border = colors.border;
  const primary = '#6F4E37'; // 커피 브라운

  return (
    <ScrollView style={[s.container, { backgroundColor: bg }]}
      contentContainerStyle={s.content}
      showsVerticalScrollIndicator={false}>

      {/* ── 헤더 ── */}
      <View style={s.header}>
        <Text style={[s.emoji]}>☕</Text>
        <Text style={[s.title, { color: text, fontSize: fontSize(22) }]}>LiVars · Coffee</Text>
        <Text style={[s.subtitle, { color: sub, fontSize: fontSize(13) }]}>
          코르티솔 리듬 기반 카페인 타이밍
        </Text>
      </View>

      {/* ── 기상 시간 설정 ── */}
      <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
        <View style={s.cardRow}>
          <Text style={[s.cardLabel, { color: sub, fontSize: fontSize(12) }]}>기상 시간</Text>
          <TouchableOpacity onPress={() => setShowWakeEdit(!showWakeEdit)}>
            <Text style={[s.editBtn, { color: primary }]}>
              {showWakeEdit ? '취소' : '수정'}
            </Text>
          </TouchableOpacity>
        </View>
        {showWakeEdit ? (
          <View style={s.wakeEditRow}>
            <TextInput
              style={[s.wakeInput, { color: text, borderColor: primary }]}
              value={wakeTimeInput}
              onChangeText={setWakeTimeInput}
              placeholder="07:00"
              placeholderTextColor={sub}
              keyboardType="numbers-and-punctuation"
              maxLength={5}
            />
            <TouchableOpacity
              style={[s.saveBtn, { backgroundColor: primary }]}
              onPress={handleSaveWakeTime}>
              <Text style={s.saveBtnText}>저장</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text style={[s.wakeTime, { color: text, fontSize: fontSize(32) }]}>
            {settings.wakeTime || '07:00'}
          </Text>
        )}
      </View>

      {/* ── 최적 섭취 시간 ── */}
      <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
        <Text style={[s.cardLabel, { color: sub, fontSize: fontSize(12) }]}>
          오늘 최적 카페인 시간
        </Text>
        {loading ? (
          <Text style={[s.loading, { color: sub }]}>계산 중...</Text>
        ) : optimalWindow ? (
          <>
            {/* 최적 구간 */}
            <View style={[s.optimalBadge, { backgroundColor: primary + '15' }]}>
              <Text style={[s.optimalIcon]}>✅</Text>
              <View style={s.optimalInfo}>
                <Text style={[s.optimalTime, { color: primary, fontSize: fontSize(20) }]}>
                  {optimalWindow.optimal[0]?.start} ~ {optimalWindow.optimal[0]?.end}
                </Text>
                <Text style={[s.optimalReason, { color: sub, fontSize: fontSize(11) }]}>
                  {optimalWindow.optimal[0]?.reason}
                </Text>
              </View>
            </View>

            {/* 피해야 할 구간 */}
            <Text style={[s.sectionLabel, { color: sub, fontSize: fontSize(11) }]}>
              ⚠️ 피해야 할 시간대
            </Text>
            {optimalWindow.avoid.map((w, i) => (
              <View key={i} style={[s.avoidRow, { borderColor: border }]}>
                <Text style={[s.avoidTime, { color: text, fontSize: fontSize(14) }]}>
                  {w.start} ~ {w.end}
                </Text>
                <Text style={[s.avoidReason, { color: sub, fontSize: fontSize(11) }]}>
                  {w.reason}
                </Text>
              </View>
            ))}

            {/* 마지막 섭취 */}
            <View style={[s.cutoffRow, { borderColor: border }]}>
              <Text style={[s.cutoffLabel, { color: sub, fontSize: fontSize(12) }]}>
                🌙 마지막 섭취 권장
              </Text>
              <Text style={[s.cutoffTime, { color: text, fontSize: fontSize(16) }]}>
                {optimalWindow.lastCutoff} 이전
              </Text>
            </View>
          </>
        ) : (
          <Text style={[s.loading, { color: sub }]}>서버 연결 중...</Text>
        )}
      </View>

      {/* ── 섭취 로깅 ── */}
      <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
        <Text style={[s.cardLabel, { color: sub, fontSize: fontSize(12) }]}>
          지금 마신 거 기록
        </Text>

        {/* 음료 선택 */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={s.drinkScroll}>
          {DRINK_TYPES.map(drink => (
            <TouchableOpacity
              key={drink}
              style={[
                s.drinkChip,
                {
                  backgroundColor: selectedDrink === drink ? primary : card,
                  borderColor: selectedDrink === drink ? primary : border,
                },
              ]}
              onPress={() => setSelectedDrink(drink)}>
              <Text style={[
                s.drinkChipText,
                {
                  color: selectedDrink === drink ? '#fff' : text,
                  fontSize: fontSize(13),
                },
              ]}>
                {drink}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* 카페인 양 표시 */}
        <Text style={[s.mgText, { color: sub, fontSize: fontSize(12) }]}>
          카페인 함량: {DRINK_MG[selectedDrink] || 100}mg
        </Text>

        {/* 기록 버튼 */}
        <TouchableOpacity
          style={[s.logBtn, { backgroundColor: primary, opacity: logLoading ? 0.6 : 1 }]}
          onPress={handleLogCaffeine}
          disabled={logLoading}>
          <Text style={[s.logBtnText, { fontSize: fontSize(15) }]}>
            {logLoading ? '기록 중...' : '☕ 지금 마셨어요'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── 주간 인사이트 ── */}
      {weeklyReport && (
        <View style={[s.card, { backgroundColor: card, borderColor: border }]}>
          <Text style={[s.cardLabel, { color: sub, fontSize: fontSize(12) }]}>
            📊 주간 패턴
          </Text>
          <Text style={[s.insightText, { color: text, fontSize: fontSize(14) }]}>
            {weeklyReport.insight}
          </Text>
          {weeklyReport.avgFocus !== null && (
            <View style={[s.focusRow, { borderColor: border }]}>
              <Text style={[s.focusLabel, { color: sub, fontSize: fontSize(12) }]}>
                평균 집중력
              </Text>
              <Text style={[s.focusValue, { color: primary, fontSize: fontSize(20) }]}>
                {weeklyReport.avgFocus.toFixed(1)}
                <Text style={[s.focusMax, { color: sub, fontSize: fontSize(12) }]}> / 5</Text>
              </Text>
            </View>
          )}
          <Text style={[s.totalText, { color: sub, fontSize: fontSize(12) }]}>
            이번 주 {weeklyReport.totalEvents}회 기록
          </Text>
        </View>
      )}

      {/* ── 논문 출처 ── */}
      <View style={[s.sourceCard, { borderColor: border }]}>
        <Text style={[s.sourceText, { color: sub, fontSize: fontSize(11) }]}>
          📖 Andrew Huberman (2021) · Adenosine/Cortisol 연구 기반
        </Text>
      </View>

    </ScrollView>
  );
}

// ─── 로컬 계산 (서버 없을 때 폴백) ──────────────────────────
function calculateLocalOptimal(wakeTime: string): CaffeineWindow {
  const [h, m] = wakeTime.split(':').map(Number);
  const wake = h * 60 + m;
  const fmt = (min: number) => {
    const hh = Math.floor((min % 1440) / 60);
    const mm = min % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };
  return {
    avoid: [
      { start: fmt(wake), end: fmt(wake + 30), reason: '기상 직후 코르티솔 1차 피크' },
      { start: fmt(wake + 90), end: fmt(wake + 120), reason: '코르티솔 2차 피크' },
    ],
    optimal: [{ start: fmt(wake + 120), end: fmt(wake + 420), reason: '카페인 효과 극대화 구간' }],
    lastCutoff: fmt(23 * 60 - 480),
    explanation: '',
  };
}

// ─── 스타일 ────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  header: { alignItems: 'center', paddingVertical: 20 },
  emoji: { fontSize: 40, marginBottom: 6 },
  title: { fontWeight: '700', letterSpacing: -0.5 },
  subtitle: { marginTop: 4 },
  card: {
    borderRadius: 16, borderWidth: 1,
    padding: 16, marginBottom: 12,
  },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardLabel: { fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' },
  editBtn: { fontWeight: '600', fontSize: 13 },
  wakeEditRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4 },
  wakeInput: {
    flex: 1, borderWidth: 1.5, borderRadius: 10,
    padding: 10, fontSize: 18, fontWeight: '600', textAlign: 'center',
  },
  saveBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  wakeTime: { fontWeight: '800', letterSpacing: -1, marginTop: 2 },
  loading: { textAlign: 'center', padding: 12 },
  optimalBadge: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 12, padding: 12, gap: 10, marginBottom: 12,
  },
  optimalIcon: { fontSize: 24 },
  optimalInfo: { flex: 1 },
  optimalTime: { fontWeight: '800', letterSpacing: -0.5 },
  optimalReason: { marginTop: 2 },
  sectionLabel: { marginBottom: 6, fontWeight: '600' },
  avoidRow: { borderTopWidth: 1, paddingVertical: 8 },
  avoidTime: { fontWeight: '600' },
  avoidReason: { marginTop: 2 },
  cutoffRow: {
    borderTopWidth: 1, marginTop: 8,
    paddingTop: 8, flexDirection: 'row',
    justifyContent: 'space-between', alignItems: 'center',
  },
  cutoffLabel: {},
  cutoffTime: { fontWeight: '700' },
  drinkScroll: { marginBottom: 10 },
  drinkChip: {
    borderWidth: 1.5, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 7,
    marginRight: 8,
  },
  drinkChipText: { fontWeight: '600' },
  mgText: { marginBottom: 12 },
  logBtn: {
    borderRadius: 14, paddingVertical: 14,
    alignItems: 'center',
  },
  logBtnText: { color: '#fff', fontWeight: '700' },
  insightText: { lineHeight: 22, marginBottom: 10 },
  focusRow: {
    borderTopWidth: 1, paddingTop: 10, marginTop: 4,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  focusLabel: {},
  focusValue: { fontWeight: '800' },
  focusMax: {},
  totalText: { marginTop: 6 },
  sourceCard: {
    borderWidth: 1, borderRadius: 10,
    padding: 10, alignItems: 'center', marginTop: 4,
  },
  sourceText: { textAlign: 'center', lineHeight: 16 },
});
