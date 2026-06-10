// src/components/LivarsSection.tsx
// LIVARS 슬라이더 + 상세 모달 컴포넌트

import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Modal, SafeAreaView, Dimensions, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTodayActivity, getLastNightSleep, TodayActivity, SleepData } from '../services/healthService';
import { getCurrentUserId } from '../services/syncService';
const { width: SCREEN_W } = Dimensions.get('window');

// ─── 타입 ────────────────────────────────────────────────────
type LivarType = 'caffeine' | 'sleep' | 'activity' | 'expense' | 'meds' | 'trend';

interface Props {
  entries: any[];
  colors: any;
  fontSize: (n: number) => number;
  wakeTime: string;
  caffeineSensitivity: string;  
}

// ─── 약 목록 기본값 ────────────────────────────────────────
const DEFAULT_MEDS = ['비타민D', '오메가3', '마그네슘'];
const MEDS_KEY = 'livars_meds_taken_';   // + YYYY-MM-DD
const MEDS_LIST_KEY = 'livars_meds_list';

// ─── 메인 컴포넌트 ─────────────────────────────────────────
export default function LivarsSection({ entries, colors, fontSize, wakeTime, caffeineSensitivity }: Props) {
  const [modalType, setModalType] = useState<LivarType | null>(null);
  const [medsTaken, setMedsTaken] = useState<Record<string, boolean>>({});
  const [medsList, setMedsList] = useState<string[]>(DEFAULT_MEDS);
  const [optimalTime, setOptimalTime] = useState('');
  const [metaInsight, setMetaInsight] = useState<string | null>(null);
  const [metaLoading, setMetaLoading] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const [todayActivity, setTodayActivity] = useState<TodayActivity>({
    steps: 0, distanceKm: 0, calories: 0, flights: 0
  });
  const [sleepData, setSleepData] = useState<SleepData | null>(null);

  useEffect(() => {
    // 최적 카페인 시간 계산
    const [h, m] = (wakeTime || '07:00').split(':').map(Number);
    const optMin = h * 60 + m + 120;
    const oh = Math.floor(optMin / 60) % 24;
    const om = optMin % 60;
    setOptimalTime(`${String(oh).padStart(2, '0')}:${String(om).padStart(2, '0')}`);

    // 약 복용 기록 로드
    loadMeds();
    // HealthKit 데이터 로드
    getTodayActivity().then(setTodayActivity);
    getLastNightSleep().then(setSleepData);
  }, [wakeTime, caffeineSensitivity]);

  const loadMeds = async () => {
    try {
      const list = await AsyncStorage.getItem(MEDS_LIST_KEY);
      if (list) setMedsList(JSON.parse(list));
      const taken = await AsyncStorage.getItem(MEDS_KEY + today);
      if (taken) setMedsTaken(JSON.parse(taken));
    } catch {}
  };
  const fetchMetaInsight = async () => {
    setMetaLoading(true);
    try {
      const userId = await getCurrentUserId();
      if (!userId) return;

      const SERVER_URL = 'http://100.100.103.1:3000';
      const activity = await getTodayActivity();
      const sleep = await getLastNightSleep();

      const now = new Date();
      const ym = now.toISOString().slice(0, 7);

      // 지출 집계
      const monthExpenses = entries.filter(e => {
        try { return JSON.parse(e.categories || '[]').includes('expense') && e.created_at?.slice(0, 7) === ym; }
        catch { return false; }
      });
      const byCategory = monthExpenses.reduce((acc: any, e: any) => {
        const key = e.sub_category || '기타';
        acc[key] = (acc[key] || 0) + (e.amount || 0);
        return acc;
      }, {});
      const monthTotal = monthExpenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);

      // 운동 기록
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekExercises = entries.filter((e: any) => {
        try { return JSON.parse(e.categories || '[]').includes('exercise') && new Date(e.created_at) >= weekAgo; }
        catch { return false; }
      });

      // 7일 트렌드
      const week7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        const dateStr = d.toISOString().slice(0, 10);
        return {
          date: dateStr,
          count: entries.filter((e: any) => e.created_at?.slice(0, 10) === dateStr).length
        };
      });

      // 카테고리 분포
      const categoryDist: any = {};
      entries.filter((e: any) => new Date(e.created_at) >= weekAgo).forEach((e: any) => {
        try {
          JSON.parse(e.categories || '[]').forEach((cat: string) => {
            categoryDist[cat] = (categoryDist[cat] || 0) + 1;
          });
        } catch {}
      });
      // 약 복용 데이터 수집
      const medsTakenRaw = await AsyncStorage.getItem(`livars_meds_taken_${new Date().toISOString().slice(0, 10)}`);
      const medsTaken = medsTakenRaw ? JSON.parse(medsTakenRaw) : {};
      const medsListRaw = await AsyncStorage.getItem('livars_meds_list');
      const medsList = medsListRaw ? JSON.parse(medsListRaw) : ['비타민D', '오메가3', '마그네슘'];
      const todayTaken = Object.values(medsTaken).filter(Boolean).length;

      // 각 Domain AI 병렬 호출
      const [caffeineRes, sleepRes, activityRes, expenseRes, trendRes, medsRes] = await Promise.all([
        fetch(`${SERVER_URL}/domain/caffeine`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            wakeTime: wakeTime || '07:00',
            caffeineSensitivity: caffeineSensitivity || 'medium',
          }),
        }).then(r => r.json()),

        fetch(`${SERVER_URL}/domain/sleep`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, lastNight: sleep }),
        }).then(r => r.json()),

        fetch(`${SERVER_URL}/domain/activity`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, today: activity, weekExercises }),
        }).then(r => r.json()),

        fetch(`${SERVER_URL}/domain/expense`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, monthTotal, byCategory: Object.entries(byCategory).map(([category, amount]) => ({ category, amount })) }),
        }).then(r => r.json()),

        fetch(`${SERVER_URL}/domain/trend`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId, week7, categoryDist }),
        }).then(r => r.json()),

        fetch(`${SERVER_URL}/domain/meds`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId,
            todayTaken,
            totalMeds: medsList.length,
            streak: 0,
            missedYesterday: false,
          }),
        }).then(r => r.json()),
      ]);

      // Meta AI v2 호출 — medsRes 포함
      const metaRes = await fetch(`${SERVER_URL}/meta/insight-v2`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          domainInsights: [caffeineRes, sleepRes, activityRes, expenseRes, trendRes, medsRes], // ← medsRes 추가
        }),
      });

      const metaData = await metaRes.json();
      setMetaInsight(metaData.insight);

    } catch (e) {
      console.log('[Meta AI v2] 호출 실패:', e);
    } finally {
      setMetaLoading(false);
    }
  };
  const toggleMed = async (med: string) => {
    const updated = { ...medsTaken, [med]: !medsTaken[med] };
    setMedsTaken(updated);
    await AsyncStorage.setItem(MEDS_KEY + today, JSON.stringify(updated));
  };

  // ── 데이터 계산 ─────────────────────────────────────────
  const getWeekEntries = () => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 6);
    return entries.filter(e => new Date(e.created_at) >= weekAgo);
  };

  const getExerciseThisWeek = () =>
    getWeekEntries().filter(e => {
      try { return JSON.parse(e.categories || '[]').includes('exercise'); }
      catch { return false; }
    });

  const getMonthExpense = () => {
    const ym = today.slice(0, 7);
    return entries
      .filter(e => {
        try {
          return JSON.parse(e.categories || '[]').includes('expense') &&
            e.created_at?.slice(0, 7) === ym;
        } catch { return false; }
      })
      .reduce((sum, e) => sum + (e.amount || 0), 0);
  };

  const getLastSleep = () =>
    entries.find(e => {
      try {
        return JSON.parse(e.categories || '[]').includes('health') &&
          e.sub_category === '수면';
      } catch { return false; }
    });

  const getMedsTakenCount = () =>
    medsList.filter(m => medsTaken[m]).length;

  // 7일치 일별 기록 수
  const get7DayTrend = () => {
    const days: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().slice(0, 10);
      const count = entries.filter(e => e.created_at?.slice(0, 10) === dateStr).length;
      days.push({ label: ['일', '월', '화', '수', '목', '금', '토'][d.getDay()], count });
    }
    return days;
  };

  const primary = colors.primary || '#BA7517';

  // ── 카드 데이터 ─────────────────────────────────────────
  const cards: {
    type: LivarType;
    emoji: string;
    title: string;
    value: string;
    sub: string;
    color: string;
  }[] = [
    {
      type: 'caffeine',
      emoji: '☕',
      title: '카페인',
      value: optimalTime ? `${optimalTime}~` : '--:--',
      sub: '최적 섭취 시간',
      color: '#6F4E37',
    },
    {
      type: 'sleep',
      emoji: '😴',
      title: '수면',
      value: sleepData
        ? `${Math.floor(sleepData.totalMinutes / 60)}h ${sleepData.totalMinutes % 60}m`
        : getLastSleep()?.summary || '기록 없음',
      sub: sleepData
        ? `${sleepData.bedtime} → ${sleepData.wakeTime}`
        : getLastSleep() ? getLastSleep().created_at?.slice(5, 10) : '수면을 기록해보세요',
      color: '#4A6FA5',
    },
    {
      type: 'activity',
      emoji: '🏃',
      title: '활동량',
      value: todayActivity.steps > 0
        ? `${todayActivity.steps.toLocaleString()}보`
        : `${getExerciseThisWeek().length}회`,
      sub: todayActivity.steps > 0
        ? `${todayActivity.distanceKm}km · ${todayActivity.calories}kcal`
        : '이번 주 운동',
      color: '#2D8A4E',
    },

    {
      type: 'expense',
      emoji: '💸',
      title: '지출',
      value: `₩${getMonthExpense().toLocaleString()}`,
      sub: `${new Date().getMonth() + 1}월 합계`,
      color: '#C0392B',
    },
    {
      type: 'meds',
      emoji: '💊',
      title: '약/영양제',
      value: `${getMedsTakenCount()}/${medsList.length}`,
      sub: '오늘 복용',
      color: '#8E44AD',
    },
    {
      type: 'trend',
      emoji: '📈',
      title: '트렌드',
      value: `${get7DayTrend().reduce((s, d) => s + d.count, 0)}건`,
      sub: '7일 기록',
      color: '#E67E22',
    },
  ];

  return (
    <View style={s.section}>
      {/* 섹션 타이틀 */}
      <Text style={[s.sectionTitle, { color: colors.subText, fontSize: fontSize(11) }]}>
        LIVARS
      </Text>
      {/* 카드 슬라이더 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.scroll}>
        {cards.map(card => (
          <TouchableOpacity
            key={card.type}
            style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
            onPress={() => setModalType(card.type)}
            activeOpacity={0.75}>
            <Text style={s.cardEmoji}>{card.emoji}</Text>
            <Text style={[s.cardTitle, { color: colors.text, fontSize: fontSize(12) }]}>
              {card.title}
            </Text>
            <Text style={[s.cardValue, { color: card.color, fontSize: fontSize(14) }]}
              numberOfLines={1}>
              {card.value}
            </Text>
            <Text style={[s.cardSub, { color: colors.subText, fontSize: fontSize(10) }]}
              numberOfLines={1}>
              {card.sub}
            </Text>
            <Text style={[s.cardTap, { color: colors.subText }]}></Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {/* Meta AI 인사이트 */}
      <TouchableOpacity
        style={[s.metaBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={fetchMetaInsight}
        disabled={metaLoading}
        activeOpacity={0.75}>
        <Text style={[s.metaBtnIcon]}>🧠</Text>
        <View style={{ flex: 1 }}>
          <Text style={[s.metaBtnTitle, { color: colors.text, fontSize: fontSize(14) }]}>
            {metaLoading ? '분석 중...' : '오늘의 인사이트'}
          </Text>
          {metaInsight ? (
            <Text style={[s.metaBtnSub, { color: colors.subText, fontSize: fontSize(12) }]}>
              {metaInsight}
            </Text>
          ) : (
            <Text style={[s.metaBtnSub, { color: colors.subText, fontSize: fontSize(12) }]}>
              {metaLoading ? 'AI가 데이터를 통합 분석 중이에요...' : '탭하면 AI가 오늘을 분석해드려요'}
            </Text>
          )}
        </View>
      </TouchableOpacity>
      {/* 상세 모달 */}
      <Modal
        visible={modalType !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setModalType(null)}>
        <SafeAreaView style={[s.modal, { backgroundColor: colors.background }]}>
          {/* 모달 헤더 */}
          <View style={[s.modalHeader, { borderBottomColor: colors.border }]}>
            <Text style={[s.modalTitle, { color: colors.text, fontSize: fontSize(17) }]}>
              {cards.find(c => c.type === modalType)?.emoji}{' '}
              {cards.find(c => c.type === modalType)?.title} 상세
            </Text>
            <TouchableOpacity onPress={() => setModalType(null)}>
              <Text style={[s.modalClose, { color: colors.subText, fontSize: fontSize(15) }]}>닫기</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={s.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
            {modalType === 'caffeine' && (
              <CaffeineDetail
                wakeTime={wakeTime} colors={colors} fontSize={fontSize}
                entries={entries}
              />
            )}
            {modalType === 'sleep' && (
              <SleepDetail entries={entries} colors={colors} fontSize={fontSize} />
            )}
            {modalType === 'activity' && (
              <ActivityDetail entries={entries} colors={colors} fontSize={fontSize} todayActivity={todayActivity} />
            )}
            {modalType === 'expense' && (
              <ExpenseDetail entries={entries} colors={colors} fontSize={fontSize} />
            )}
            {modalType === 'meds' && (
              <MedsDetail
                medsList={medsList} medsTaken={medsTaken}
                onToggle={toggleMed}
                onEditList={async (newList) => {
                  setMedsList(newList);
                  await AsyncStorage.setItem(MEDS_LIST_KEY, JSON.stringify(newList));
                }}
                colors={colors} fontSize={fontSize}
              />
            )}
            {modalType === 'trend' && (
              <TrendDetail entries={entries} colors={colors} fontSize={fontSize} />
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

// ─── 상세 컴포넌트들 ─────────────────────────────────────────

// ☕ 카페인 상세
function CaffeineDetail({ wakeTime, colors, fontSize, entries }: any) {
  const [h, m] = (wakeTime || '07:00').split(':').map(Number);
  const wake = h * 60 + m;
  const fmt = (min: number) => {
    const hh = Math.floor((min % 1440) / 60);
    const mm = min % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  };

  const windows = [
    { label: '🚫 코르티솔 1차 피크', time: `${fmt(wake)} ~ ${fmt(wake + 30)}`, color: '#E74C3C', desc: '기상 직후 — 카페인 효과 감소' },
    { label: '✅ 최적 섭취 구간', time: `${fmt(wake + 90)} ~ ${fmt(wake + 420)}`, color: '#27AE60', desc: '아데노신 축적 + 코르티솔 안정' },
    { label: '🚫 코르티솔 2차 피크', time: `${fmt(wake + 90)} ~ ${fmt(wake + 120)}`, color: '#E74C3C', desc: '2차 피크 — 내성 증가 위험' },
    { label: '🌙 마지막 권장 섭취', time: `${fmt(22 * 60 - 120)} 이전`, color: '#8E44AD', desc: '수면 방해 최소화' },
  ];

  // 최근 7일 카페인 관련 기록
  const caffeineEntries = entries.filter((e: any) => {
    try {
      const cats = JSON.parse(e.categories || '[]');
      return cats.includes('health') || (e.summary || '').includes('카페인') ||
        (e.summary || '').includes('커피') || (e.text || '').includes('커피');
    } catch { return false; }
  }).slice(0, 5);

  return (
    <View>
      <SectionLabel label="코르티솔 기반 최적 시간대" colors={colors} fontSize={fontSize} />
      {windows.map((w, i) => (
        <View key={i} style={[detail.timeRow, { borderColor: colors.border }]}>
          <View style={[detail.dot, { backgroundColor: w.color }]} />
          <View style={{ flex: 1 }}>
            <Text style={[detail.timeLabel, { color: colors.text, fontSize: fontSize(13) }]}>{w.label}</Text>
            <Text style={[detail.timeSub, { color: w.color, fontSize: fontSize(15) }]}>{w.time}</Text>
            <Text style={[detail.timeDesc, { color: colors.subText, fontSize: fontSize(11) }]}>{w.desc}</Text>
          </View>
        </View>
      ))}

      <SectionLabel label="최근 커피/카페인 기록" colors={colors} fontSize={fontSize} />
      {caffeineEntries.length > 0 ? caffeineEntries.map((e: any, i: number) => (
        <EntryRow key={i} entry={e} colors={colors} fontSize={fontSize} />
      )) : (
        <EmptyMsg msg="커피 관련 기록이 없어요" colors={colors} fontSize={fontSize} />
      )}

      <SourceNote text="Andrew Huberman (2021) · Adenosine/Cortisol 연구" colors={colors} fontSize={fontSize} />
    </View>
  );
}

// 😴 수면 상세
function SleepDetail({ entries, colors, fontSize }: any) {
  const sleepEntries = entries.filter((e: any) => {
    try {
      const cats = JSON.parse(e.categories || '[]');
      return cats.includes('health') && e.sub_category === '수면';
    } catch { return false; }
  }).slice(0, 7);

  // 7일 수면 바 차트 (기록 기준)
  const days = getLast7Days();

  return (
    <View>
      <SectionLabel label="최근 7일 수면 기록" colors={colors} fontSize={fontSize} />
      <BarChart
        data={days.map(d => ({
          label: d.label,
          value: entries.filter((e: any) => {
            try {
              return JSON.parse(e.categories || '[]').includes('health') &&
                e.sub_category === '수면' &&
                e.created_at?.slice(0, 10) === d.date;
            } catch { return false; }
          }).length,
        }))}
        color="#4A6FA5"
        colors={colors}
        fontSize={fontSize}
        unit="건"
      />

      <SectionLabel label="수면 기록 목록" colors={colors} fontSize={fontSize} />
      {sleepEntries.length > 0 ? sleepEntries.map((e: any, i: number) => (
        <EntryRow key={i} entry={e} colors={colors} fontSize={fontSize} />
      )) : (
        <EmptyMsg msg="수면 기록이 없어요.\n홈에서 '수면' 관련 내용을 기록해보세요." colors={colors} fontSize={fontSize} />
      )}

      <SourceNote text="Walker (2017) Why We Sleep · 수면 압력 연구" colors={colors} fontSize={fontSize} />
    </View>
  );
}

// 🏃 활동량 상세
function ActivityDetail({ entries, colors, fontSize, todayActivity }: any) {
  const days = getLast7Days();
  const chartData = days.map(d => ({
    label: d.label,
    value: entries.filter((e: any) => {
      try {
        return JSON.parse(e.categories || '[]').includes('exercise') &&
          e.created_at?.slice(0, 10) === d.date;
      } catch { return false; }
    }).length,
  }));

  const exerciseEntries = entries.filter((e: any) => {
    try { return JSON.parse(e.categories || '[]').includes('exercise'); }
    catch { return false; }
  }).slice(0, 7);

  const totalCalories = exerciseEntries.reduce((s: number, e: any) => s + (e.exercise_calories || 0), 0);
  const totalMinutes = exerciseEntries.reduce((s: number, e: any) => s + (e.exercise_minutes || 0), 0);

  return (
    <View>
      {/* 요약 스탯 */}
      {/* HealthKit 오늘 데이터 */}
      {todayActivity.steps > 0 && (
        <>
          <SectionLabel label="오늘 (HealthKit 자동 수집)" colors={colors} fontSize={fontSize} />
          <View style={detail.statRow}>
            <StatBox label="걸음 수" value={`${todayActivity.steps.toLocaleString()}`} color="#2D8A4E" colors={colors} fontSize={fontSize} />
            <StatBox label="이동 거리" value={`${todayActivity.distanceKm}km`} color="#3498DB" colors={colors} fontSize={fontSize} />
            <StatBox label="칼로리" value={`${todayActivity.calories}kcal`} color="#E67E22" colors={colors} fontSize={fontSize} />
          </View>
          {todayActivity.flights > 0 && (
            <Text style={[{ color: colors.subText, fontSize: fontSize(12), marginBottom: 8 }]}>
              🏢 오늘 오른 계단: {todayActivity.flights}층
            </Text>
          )}
        </>
      )}
      {/* 운동 기록 차트 */}
      <View style={detail.statRow}>
        <StatBox label="총 운동 시간" value={`${totalMinutes}분`} color="#2D8A4E" colors={colors} fontSize={fontSize} />
        <StatBox label="소모 칼로리" value={`${totalCalories}kcal`} color="#E67E22" colors={colors} fontSize={fontSize} />
        <StatBox label="이번 주" value={`${chartData.slice(-7).reduce((s, d) => s + d.value, 0)}회`} color="#3498DB" colors={colors} fontSize={fontSize} />
      </View>

      <SectionLabel label="최근 7일 운동 횟수" colors={colors} fontSize={fontSize} />
      <BarChart data={chartData} color="#2D8A4E" colors={colors} fontSize={fontSize} unit="회" />

      <SectionLabel label="운동 기록" colors={colors} fontSize={fontSize} />
      {exerciseEntries.length > 0 ? exerciseEntries.map((e: any, i: number) => (
        <EntryRow key={i} entry={e} colors={colors} fontSize={fontSize} />
      )) : (
        <EmptyMsg msg="운동 기록이 없어요" colors={colors} fontSize={fontSize} />
      )}
    </View>
  );
}

// 💸 지출 상세
function ExpenseDetail({ entries, colors, fontSize }: any) {
  const now = new Date();
  const ym = now.toISOString().slice(0, 7);

  const monthExpenses = entries.filter((e: any) => {
    try {
      return JSON.parse(e.categories || '[]').includes('expense') &&
        e.created_at?.slice(0, 7) === ym;
    } catch { return false; }
  });

  // 카테고리별 집계
  const bySubCat: Record<string, number> = {};
  monthExpenses.forEach((e: any) => {
    const key = e.sub_category || '기타';
    bySubCat[key] = (bySubCat[key] || 0) + (e.amount || 0);
  });
  const subCatData = Object.entries(bySubCat)
    .sort((a, b) => b[1] - a[1])
    .map(([label, value]) => ({ label, value }));

  const total = monthExpenses.reduce((s: number, e: any) => s + (e.amount || 0), 0);

  // 주차별 지출
  const days = getLast7Days();
  const weekData = days.map(d => ({
    label: d.label,
    value: entries.filter((e: any) => {
      try {
        return JSON.parse(e.categories || '[]').includes('expense') &&
          e.created_at?.slice(0, 10) === d.date;
      } catch { return false; }
    }).reduce((s: number, e: any) => s + (e.amount || 0), 0) / 10000, // 만원 단위
  }));

  return (
    <View>
      <View style={[detail.totalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[detail.totalLabel, { color: colors.subText, fontSize: fontSize(12) }]}>
          {now.getMonth() + 1}월 총 지출
        </Text>
        <Text style={[detail.totalValue, { color: '#C0392B', fontSize: fontSize(28) }]}>
          ₩{total.toLocaleString()}
        </Text>
      </View>

      <SectionLabel label="최근 7일 지출 추이 (만원)" colors={colors} fontSize={fontSize} />
      <BarChart data={weekData} color="#C0392B" colors={colors} fontSize={fontSize} unit="만" />

      <SectionLabel label="카테고리별 지출" colors={colors} fontSize={fontSize} />
      {subCatData.length > 0 ? subCatData.map((item, i) => (
        <View key={i} style={[detail.catRow, { borderColor: colors.border }]}>
          <Text style={[{ color: colors.text, fontSize: fontSize(14), flex: 1 }]}>{item.label}</Text>
          <Text style={[{ color: '#C0392B', fontSize: fontSize(14), fontWeight: '700' }]}>
            ₩{item.value.toLocaleString()}
          </Text>
        </View>
      )) : (
        <EmptyMsg msg="이번 달 지출 기록이 없어요" colors={colors} fontSize={fontSize} />
      )}
    </View>
  );
}

// 💊 약/영양제 상세
function MedsDetail({ medsList, medsTaken, onToggle, onEditList, colors, fontSize }: any) {
  const takenCount = medsList.filter((m: string) => medsTaken[m]).length;

  return (
    <View>
      {/* 오늘 복용 현황 */}
      <View style={[detail.totalBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[detail.totalLabel, { color: colors.subText, fontSize: fontSize(12) }]}>
          오늘 복용 현황
        </Text>
        <Text style={[detail.totalValue, { color: '#8E44AD', fontSize: fontSize(28) }]}>
          {takenCount} / {medsList.length}
        </Text>
        <Text style={[{ color: colors.subText, fontSize: fontSize(12), marginTop: 4 }]}>
          {takenCount === medsList.length ? '✅ 오늘 모두 복용 완료!' : `${medsList.length - takenCount}개 남았어요`}
        </Text>
      </View>

      <SectionLabel label="복용 체크" colors={colors} fontSize={fontSize} />
      {medsList.map((med: string, i: number) => (
        <TouchableOpacity
          key={i}
          style={[detail.medRow, { borderColor: colors.border, backgroundColor: colors.card }]}
          onPress={() => onToggle(med)}>
          <View style={[detail.medCheck, {
            backgroundColor: medsTaken[med] ? '#8E44AD' : 'transparent',
            borderColor: medsTaken[med] ? '#8E44AD' : colors.border,
          }]}>
            {medsTaken[med] && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
          </View>
          <Text style={[detail.medName, {
            color: medsTaken[med] ? colors.subText : colors.text,
            fontSize: fontSize(15),
            textDecorationLine: medsTaken[med] ? 'line-through' : 'none',
          }]}>
            {med}
          </Text>
        </TouchableOpacity>
      ))}

      <TouchableOpacity
        style={[detail.addMedBtn, { borderColor: '#8E44AD' }]}
        onPress={() => {
          Alert.prompt('약/영양제 추가', '이름을 입력하세요', (name) => {
            if (name?.trim()) onEditList([...medsList, name.trim()]);
          });
        }}>
        <Text style={[{ color: '#8E44AD', fontSize: fontSize(14), fontWeight: '600' }]}>
          + 추가하기
        </Text>
      </TouchableOpacity>

      <SourceNote text="복용 기록은 기기에만 저장됩니다" colors={colors} fontSize={fontSize} />
    </View>
  );
}

// 📈 트렌드 상세
function TrendDetail({ entries, colors, fontSize }: any) {
  const days = getLast7Days();

  const chartData = days.map(d => ({
    label: d.label,
    value: entries.filter((e: any) => e.created_at?.slice(0, 10) === d.date).length,
  }));

  // 카테고리별 7일 분포
  const catColors: Record<string, string> = {
    diary: '#F39C12', expense: '#C0392B', appointment: '#2980B9',
    work: '#8E44AD', exercise: '#27AE60', health: '#1ABC9C',
    study: '#E67E22', travel: '#16A085',
  };

  const catCounts: Record<string, number> = {};
  entries.filter((e: any) => {
    const d = new Date(e.created_at);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    return d >= weekAgo;
  }).forEach((e: any) => {
    try {
      JSON.parse(e.categories || '[]').forEach((cat: string) => {
        catCounts[cat] = (catCounts[cat] || 0) + 1;
      });
    } catch {}
  });

  const catData = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, count]) => ({ cat, count, color: catColors[cat] || '#95A5A6' }));

  const total7 = chartData.reduce((s, d) => s + d.value, 0);
  const avg = (total7 / 7).toFixed(1);
  const maxDay = chartData.reduce((a, b) => a.value > b.value ? a : b);

  return (
    <View>
      {/* 요약 */}
      <View style={detail.statRow}>
        <StatBox label="7일 총 기록" value={`${total7}건`} color="#E67E22" colors={colors} fontSize={fontSize} />
        <StatBox label="일 평균" value={`${avg}건`} color="#3498DB" colors={colors} fontSize={fontSize} />
        <StatBox label="최다 기록일" value={maxDay.label} color="#27AE60" colors={colors} fontSize={fontSize} />
      </View>

      <SectionLabel label="최근 7일 기록 횟수" colors={colors} fontSize={fontSize} />
      <BarChart data={chartData} color="#E67E22" colors={colors} fontSize={fontSize} unit="건" />

      <SectionLabel label="카테고리 분포 (7일)" colors={colors} fontSize={fontSize} />
      {catData.length > 0 ? catData.map(({ cat, count, color }, i) => (
        <View key={i} style={[detail.catRow, { borderColor: colors.border }]}>
          <View style={[detail.catDot, { backgroundColor: color }]} />
          <Text style={[{ color: colors.text, fontSize: fontSize(13), flex: 1 }]}>
            {getCatLabel(cat)}
          </Text>
          <View style={[detail.catBar, { backgroundColor: colors.border, flex: 2, marginHorizontal: 8 }]}>
            <View style={[detail.catBarFill, {
              backgroundColor: color,
              width: `${Math.min((count / (catData[0]?.count || 1)) * 100, 100)}%`,
            }]} />
          </View>
          <Text style={[{ color: colors.subText, fontSize: fontSize(12), width: 24, textAlign: 'right' }]}>
            {count}
          </Text>
        </View>
      )) : (
        <EmptyMsg msg="7일 내 기록이 없어요" colors={colors} fontSize={fontSize} />
      )}
    </View>
  );
}

// ─── 공통 서브 컴포넌트들 ────────────────────────────────────

function BarChart({ data, color, colors, fontSize, unit }: any) {
  const max = Math.max(...data.map((d: any) => d.value), 1);
  return (
    <View style={chart.container}>
      {data.map((d: any, i: number) => (
        <View key={i} style={chart.col}>
          <Text style={[chart.val, { color: colors.subText, fontSize: fontSize(10) }]}>
            {d.value > 0 ? `${Math.round(d.value)}${unit}` : ''}
          </Text>
          <View style={[chart.barBg, { backgroundColor: colors.border }]}>
            <View style={[chart.bar, {
              backgroundColor: color,
              height: `${Math.max((d.value / max) * 100, d.value > 0 ? 8 : 0)}%`,
              opacity: d.value > 0 ? 1 : 0.2,
            }]} />
          </View>
          <Text style={[chart.label, { color: colors.subText, fontSize: fontSize(10) }]}>
            {d.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

function SectionLabel({ label, colors, fontSize }: any) {
  return (
    <Text style={[detail.sectionLabel, { color: colors.subText, fontSize: fontSize(11) }]}>
      {label}
    </Text>
  );
}

function StatBox({ label, value, color, colors, fontSize }: any) {
  return (
    <View style={[detail.statBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[{ color, fontWeight: '800', fontSize: fontSize(16) }]}>{value}</Text>
      <Text style={[{ color: colors.subText, fontSize: fontSize(10), marginTop: 2 }]}>{label}</Text>
    </View>
  );
}

function EntryRow({ entry, colors, fontSize }: any) {
  return (
    <View style={[detail.entryRow, { borderColor: colors.border }]}>
      <Text style={[{ color: colors.text, fontSize: fontSize(13), flex: 1 }]}
        numberOfLines={1}>
        {entry.summary || entry.text}
      </Text>
      <Text style={[{ color: colors.subText, fontSize: fontSize(11) }]}>
        {entry.created_at?.slice(5, 10)}
      </Text>
    </View>
  );
}

function EmptyMsg({ msg, colors, fontSize }: any) {
  return (
    <Text style={[detail.emptyMsg, { color: colors.subText, fontSize: fontSize(13) }]}>
      {msg}
    </Text>
  );
}

function SourceNote({ text, colors, fontSize }: any) {
  return (
    <Text style={[detail.sourceNote, { color: colors.subText, fontSize: fontSize(11) }]}>
      📖 {text}
    </Text>
  );
}

// ─── 헬퍼 ────────────────────────────────────────────────────
function getLast7Days() {
  const result = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    result.push({
      date: d.toISOString().slice(0, 10),
      label: ['일', '월', '화', '수', '목', '금', '토'][d.getDay()],
    });
  }
  return result;
}

function getCatLabel(cat: string) {
  const map: Record<string, string> = {
    diary: '일기', expense: '지출', appointment: '약속',
    work: '업무', exercise: '운동', health: '건강',
    study: '공부', travel: '여행', other: '기타',
  };
  return map[cat] || cat;
}

// ─── 스타일 ────────────────────────────────────────────────
const s = StyleSheet.create({
  section: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16 },
  sectionTitle: { fontWeight: '700', letterSpacing: 1.5, marginBottom: 10 },
  scroll: { gap: 10, paddingBottom: 4 },
  card: {
    width: 110, borderRadius: 16, borderWidth: 1,
    padding: 12, alignItems: 'center', gap: 3,
  },
  cardEmoji: { fontSize: 26, marginBottom: 2 },
  cardTitle: { fontWeight: '700', textAlign: 'center' },
  cardValue: { fontWeight: '800', textAlign: 'center' },
  cardSub: { textAlign: 'center', opacity: 0.8 },
  cardTap: { fontSize: 12, marginTop: 4, opacity: 0.4 },
  modal: { flex: 1 },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16, borderBottomWidth: 0.5,
  },
  modalTitle: { fontWeight: '700' },
  modalClose: { padding: 4 },
  modalBody: { flex: 1, padding: 16 },
});

const detail = StyleSheet.create({
  sectionLabel: {
    fontWeight: '700', letterSpacing: 0.5,
    marginTop: 20, marginBottom: 10, textTransform: 'uppercase',
  },
  timeRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    gap: 12, paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  timeLabel: { fontWeight: '600' },
  timeSub: { fontWeight: '800', marginTop: 2 },
  timeDesc: { marginTop: 2, lineHeight: 16 },
  totalBox: {
    borderRadius: 16, borderWidth: 1,
    padding: 20, alignItems: 'center', marginBottom: 8,
  },
  totalLabel: { fontWeight: '600' },
  totalValue: { fontWeight: '900', marginTop: 4 },
  entryRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 0.5, gap: 8,
  },
  catRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 0.5, gap: 8,
  },
  catDot: { width: 8, height: 8, borderRadius: 4 },
  catBar: { height: 6, borderRadius: 3, overflow: 'hidden' },
  catBarFill: { height: '100%', borderRadius: 3 },
  emptyMsg: { textAlign: 'center', padding: 20, lineHeight: 22 },
  sourceNote: {
    textAlign: 'center', marginTop: 24,
    paddingTop: 12, opacity: 0.6,
  },
  statRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statBox: {
    flex: 1, borderRadius: 12, borderWidth: 1,
    padding: 12, alignItems: 'center',
  },
  medRow: {
    flexDirection: 'row', alignItems: 'center',
    gap: 12, padding: 14, borderRadius: 12,
    borderWidth: 1, marginBottom: 8,
  },
  medCheck: {
    width: 24, height: 24, borderRadius: 6,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  medName: { fontWeight: '500' },
  addMedBtn: {
    borderWidth: 1.5, borderRadius: 12, borderStyle: 'dashed',
    padding: 14, alignItems: 'center', marginTop: 4,
  },
});

const chart = StyleSheet.create({
  container: {
    flexDirection: 'row', height: 120,
    alignItems: 'flex-end', gap: 6,
    paddingHorizontal: 4, marginBottom: 8,
  },
  col: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  val: { marginBottom: 2, textAlign: 'center' },
  barBg: {
    width: '80%', height: '75%',
    borderRadius: 4, overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  bar: { width: '100%', borderRadius: 4 },
  label: { marginTop: 4 },
  metaBtn: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    marginTop: 10,
  },
  metaBtnIcon: { fontSize: 24, marginTop: 2 },
  metaBtnTitle: { fontWeight: '700', marginBottom: 4 },
  metaBtnSub: { lineHeight: 18 },
});
