import {useSettings} from '../services/SettingsContext';
import React, {useState, useCallback} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {getMonthlyReport, getCategoryRanking} from '../database/db'; // 👈 우리가 만든 새 DB 함수 임포트!
import {generateReport} from '../services/api';
import {generatePDF} from '../services/pdf';

export default function ReportScreen() {
  const {colors, fontSize} = useSettings();
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  
  // 💡 수많은 변수들을 하나의 reportData 객체로 깔끔하게 묶어줍니다.
  const [reportData, setReportData] = useState({
    totalEntries: 0,
    totalExpense: 0,
    appointmentCount: 0,
    diaryCount: 0,
    totalCalories: 0,
  });

  const [aiSummary, setAiSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);

  // 날짜 계산 (현재 달 기준)
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const monthStr = `${currentYear}년 ${currentMonth}월`;

  // 💡 DB에서 통계 데이터를 싹 가져오는 함수
  const loadData = async () => {
    try {
      // 위에서 만든 getMonthlyReport 함수를 호출합니다!
      const stats = await getMonthlyReport(currentYear, currentMonth);
      setReportData({
        totalEntries: stats.diaryCount + stats.appointmentCount, // 임시로 전체 기록 수 계산
        totalExpense: stats.totalExpense,
        appointmentCount: stats.appointmentCount,
        diaryCount: stats.diaryCount,
        totalCalories: stats.totalCalories,
      });
    } catch (error) {
      console.error("리포트 로드 에러:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  // 감정 추론 로직 (임시: diaryCount를 활용하거나 나중에 DB에 긍정/부정 카운트 추가 가능)
  // 현재는 기록이 많으면 긍정적으로 표현하도록 임시 설정했습니다.
  const dominantEmotion = reportData.diaryCount > 5 
    ? '기록이 활발한 에너지가 넘치는 달이에요! 😊'
    : '차분하게 일상을 돌아보는 달이에요 😌';

  // AI 총평 생성
  const generateSummary = async () => {
    setLoadingSummary(true);

    try {
      // 1. 방금 만든 랭킹 엔진을 돌려서 상위 2개의 핫한 카테고리를 뽑아옵니다.
      const topRankings = await getCategoryRanking(currentYear, currentMonth);
      
      // 2. AI가 알아듣기 쉽게 문장으로 가공합니다. (예: "지출(₩150,000 지출), 업무(마감 임박 1건...)")
      const topContext = topRankings.length > 0 
        ? topRankings.map(r => `${r.category}(${r.detail})`).join(', ')
        : "특별히 눈에 띄는 이벤트는 없음";

      // 3. 기존 통계 데이터에 핵심 맥락(topContext)을 얹어서 API에 보냅니다!
      const result = await generateReport({
        totalEntries: reportData.totalEntries,
        totalExpense: reportData.totalExpense,
        positiveCount: reportData.diaryCount,
        negativeCount: 0,
        appointmentCount: reportData.appointmentCount,
        // 👇 이 부분이 API(services/api.ts) 로 넘어가도록 추가 파라미터 전달!
        insightHint: `[중요] 이번 달 유저의 삶에서 가장 큰 비중을 차지한 핵심 카테고리는 '${topContext}' 입니다. 이 사실을 반드시 반영하여 총평을 작성하세요.`
      });

      if (result?.summary) {
        setAiSummary(result.summary);
      }
    } catch (error) {
      console.error("AI 총평 생성 중 에러:", error);
    } finally {
      setLoadingSummary(false);
    }
  };

  // PDF 내보내기 (기존 로직 유지)
  const handleExportPDF = async () => {
    const success = await generatePDF({
      month: monthStr,
      totalEntries: reportData.totalEntries,
      totalExpense: reportData.totalExpense,
      positiveCount: reportData.diaryCount,
      negativeCount: 0,
      appointmentCount: reportData.appointmentCount,
      aiSummary,
      entries: [], // 필요 시 getAllEntries()로 불러와서 전달
    });

    if (!success) {
      Alert.alert('오류', 'PDF 생성에 실패했어요.');
    }
  };

  return (
    <SafeAreaView style={[styles.safeArea, {backgroundColor: colors.background}]}> 
      <ScrollView style={[styles.container, {backgroundColor: colors.background}]}>
      {/* 주간/월간 전환 */}
      <View style={styles.periodRow}>
        <TouchableOpacity
          style={[styles.periodBtn, period === 'week' && styles.periodActive]}
          onPress={() => setPeriod('week')}>
          <Text
            style={[
              styles.periodText,
              {fontSize: fontSize(13)},
              period === 'week' && styles.periodTextActive,
            ]}>
            주간
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.periodBtn, period === 'month' && styles.periodActive]}
          onPress={() => setPeriod('month')}>
          <Text
            style={[
              styles.periodText,
              {fontSize: fontSize(13)},
              period === 'month' && styles.periodTextActive,
            ]}>
            월간
          </Text>
        </TouchableOpacity>
      </View>

      {/* 리포트 커버 */}
      <View style={styles.cover}>
        <View style={styles.coverDeco} />
        <Text style={styles.coverLabel}>Monthly Insight</Text>
        <Text style={[styles.coverMonth, {fontSize: fontSize(32)}]}>
          {currentMonth}월{'\n'}리포트
        </Text>
        <Text style={styles.coverSub}>
          {monthStr} · 기록 {reportData.totalEntries}건
        </Text>
      </View>

      {/* 하이라이트 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, {fontSize: fontSize(12), color: colors.subText}]}>이달의 하이라이트</Text>

        <View style={styles.highlightCard}>
          <Text style={[styles.highlightLabel, {fontSize: fontSize(10), color: colors.primary}]}>에너지</Text>
          <Text style={[styles.highlightText, {color: colors.text, fontSize: fontSize(13)}]}>{dominantEmotion}</Text>
        </View>

        <View style={styles.highlightCard}>
          <Text style={[styles.highlightLabel, {fontSize: fontSize(10), color: colors.primary}]}>지출</Text>
          <Text style={[styles.highlightText, {color: colors.text, fontSize: fontSize(13)}]}>
            총 ₩{reportData.totalExpense.toLocaleString()} 지출.
          </Text>
        </View>

        <View style={styles.highlightCard}>
          <Text style={[styles.highlightLabel, {fontSize: fontSize(10), color: colors.primary}]}>약속</Text>
          <Text style={[styles.highlightText, {color: colors.text, fontSize: fontSize(13)}]}>
            이번 달 약속 {reportData.appointmentCount}건.
          </Text>
        </View>
      </View>

      {/* AI 총평 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, {fontSize: fontSize(12), color: colors.subText}]}>AI 총평</Text>
        <View style={[styles.aiBox, {backgroundColor: colors.card}]}>
          {aiSummary ? (
            <Text style={[styles.aiText, {color: colors.text, fontSize: fontSize(13)}]}>{aiSummary}</Text>
          ) : (
            <Text style={styles.aiPlaceholder}>
              아래 버튼을 눌러 AI 총평을 생성해보세요.
            </Text>
          )}
        </View>
        <TouchableOpacity
          style={styles.generateBtn}
          onPress={generateSummary}
          disabled={loadingSummary}>
          {loadingSummary ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.generateText, {fontSize: fontSize(14)}]}>✨ AI 총평 생성</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={handleExportPDF}>
          <Text style={[styles.exportText, {fontSize: fontSize(14)}]}>📄 PDF로 내보내기</Text>
        </TouchableOpacity>
      </View>

      {/* 통계 요약 */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, {fontSize: fontSize(12), color: colors.subText}]}>통계 요약</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statItem, {backgroundColor: colors.card}]}>
            <Text style={[styles.statVal, {color: colors.text, fontSize: fontSize(20)}]}>{reportData.diaryCount}</Text>
            <Text style={[styles.statLbl, {color: colors.subText, fontSize: fontSize(11)}]}>일기 기록</Text>
          </View>
          <View style={[styles.statItem, {backgroundColor: colors.card}]}>
            <Text style={[styles.statVal, {color: colors.text, fontSize: fontSize(20)}]}>
              ₩{reportData.totalExpense.toLocaleString()}
            </Text>
            <Text style={[styles.statLbl, {color: colors.subText, fontSize: fontSize(11)}]}>총 지출</Text>
          </View>
          <View style={[styles.statItem, {backgroundColor: colors.card}]}>
            <Text style={[styles.statVal, {color: colors.text, fontSize: fontSize(20)}]}>{reportData.totalCalories}</Text>
            <Text style={[styles.statLbl, {color: colors.subText, fontSize: fontSize(11)}]}>소모 칼로리</Text>
          </View>
          <View style={[styles.statItem, {backgroundColor: colors.card}]}>
            <Text style={[styles.statVal, {color: colors.text, fontSize: fontSize(20)}]}>{reportData.appointmentCount}</Text>
            <Text style={[styles.statLbl, {color: colors.subText, fontSize: fontSize(11)}]}>약속 건수</Text>
          </View>
        </View>
      </View>

      <View style={{height: 40}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1},
  container: {flex: 1, backgroundColor: '#fff'},

  periodRow: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 24,
    gap: 8,
  },
  periodBtn: {
    flex: 1,
    padding: 10,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: '#e0e0e0',
  },
  periodActive: {backgroundColor: '#FAEEDA', borderColor: '#FAC775'},
  periodText: {fontSize: 13, color: '#999'},
  periodTextActive: {color: '#854F0B', fontWeight: '600'},
  cover: {
    margin: 20,
    backgroundColor: '#FAEEDA',
    borderRadius: 20,
    padding: 24,
    overflow: 'hidden',
    position: 'relative',
  },
  coverDeco: {
    position: 'absolute',
    right: -20,
    top: -20,
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FAC775',
    opacity: 0.4,
  },
  coverLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#854F0B',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  coverMonth: {
    fontSize: 32,
    fontWeight: '600',
    color: '#412402',
    lineHeight: 38,
  },
  coverSub: {fontSize: 12, color: '#854F0B', marginTop: 8},
  section: {paddingHorizontal: 20, marginBottom: 16},
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  highlightCard: {
    borderLeftWidth: 3,
    borderLeftColor: '#BA7517',
    paddingLeft: 12,
    paddingVertical: 8,
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
    marginBottom: 8,
  },
  highlightLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#BA7517',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  highlightText: {fontSize: 13, color: '#1a1a1a', lineHeight: 18},
  aiBox: {
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    minHeight: 80,
    justifyContent: 'center',
  },
  aiText: {fontSize: 13, color: '#1a1a1a', lineHeight: 20},
  aiPlaceholder: {fontSize: 13, color: '#aaa', textAlign: 'center'},
  generateBtn: {
    backgroundColor: '#BA7517',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  generateText: {color: '#fff', fontSize: 14, fontWeight: '500'},
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  exportBtn: {
    width: '100%',
    padding: 14,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: '#BA7517',
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  exportText: {
    color: '#BA7517',
    fontSize: 14,
    fontWeight: '500',
  },
  statItem: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 16,
  },
  statVal: {fontSize: 20, fontWeight: '600', color: '#1a1a1a'},
  statLbl: {fontSize: 11, color: '#999', marginTop: 4},
});