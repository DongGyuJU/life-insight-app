import {useSettings} from '../services/SettingsContext';
import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {getAllEntries} from '../database/db';
import {analyzeText, generateReport} from '../services/api';
import {Share} from 'react-native';
import {generatePDF} from '../services/pdf';

export default function ReportScreen() {
  const {colors, fontSize} = useSettings();
  const [period, setPeriod] = useState<'week' | 'month'>('week');
  const [entries, setEntries] = useState<any[]>([]);
  const [aiSummary, setAiSummary] = useState('');
  const [loadingSummary, setLoadingSummary] = useState(false);

  const loadData = async () => {
    const all = await getAllEntries();
    setEntries(all);
  };        

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  // 통계 계산
  const emotionEntries = entries.filter(e => {
    try {
      return JSON.parse(e.categories || '[]').includes('emotion');
    } catch {return false;}
  });

  const expenseEntries = entries.filter(e => {
    try {
      return JSON.parse(e.categories || '[]').includes('expense') && e.amount;
    } catch {return false;}
  });

  const appointmentEntries = entries.filter(e => {
    try {
      return JSON.parse(e.categories || '[]').includes('appointment');
    } catch {return false;}
  });

  const totalExpense = expenseEntries.reduce((sum, e) => {
    const amountValue = Number(e.amount);
    return sum + (Number.isFinite(amountValue) ? amountValue : 0);
  }, 0);

  const positiveCount = emotionEntries.filter(
    e => e.emotion === 'positive',
  ).length;

  const negativeCount = emotionEntries.filter(
    e => e.emotion === 'negative',
  ).length;

  const dominantEmotion =
    positiveCount > negativeCount
      ? '긍정적인 기간이었어요 😊'
      : negativeCount > positiveCount
      ? '다소 힘든 기간이었어요 😔'
      : '평온한 기간이었어요 😐';

  // AI 총평 생성
const generateSummary = async () => {
  setLoadingSummary(true);
  const result = await generateReport({
    totalEntries: entries.length,
    totalExpense,
    positiveCount,
    negativeCount,
    appointmentCount: appointmentEntries.length,
  });
  if (result?.summary) {
    setAiSummary(result.summary);
  }
  setLoadingSummary(false);
};
const handleExportPDF = async () => {
  const now = new Date();
  const month = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;

  const success = await generatePDF({
    month,
    totalEntries: entries.length,
    totalExpense,
    positiveCount,
    negativeCount,
    appointmentCount: appointmentEntries.length,
    aiSummary,
    entries,
  });

  if (!success) {
    Alert.alert('오류', 'PDF 생성에 실패했어요.');
  }
};

  const now = new Date();
  const monthStr = `${now.getFullYear()}년 ${now.getMonth() + 1}월`;

  return (
    <ScrollView style={[styles.container, {backgroundColor: colors.background}]}>
      {/* 주간/월간 전환 */}
      <View style={styles.periodRow}>
        <TouchableOpacity
          style={[styles.periodBtn, period === 'week' && styles.periodActive]}
          onPress={() => setPeriod('week')}>
          <Text
            style={[
              styles.periodText,
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
          {now.getMonth() + 1}월{'\n'}리포트
        </Text>
        <Text style={styles.coverSub}>
          {monthStr} · 기록 {entries.length}건
        </Text>
      </View>

      {/* 하이라이트 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>이달의 하이라이트</Text>

        <View style={styles.highlightCard}>
          <Text style={styles.highlightLabel}>에너지</Text>
          <Text style={[styles.highlightText, {color: colors.text, fontSize: fontSize(13)}]}>{dominantEmotion}</Text>
        </View>

        <View style={styles.highlightCard}>
          <Text style={styles.highlightLabel}>지출</Text>
          <Text style={styles.highlightText}>
            총 ₩{totalExpense.toLocaleString()} 지출.{' '}
            {expenseEntries.length}건의 지출 기록이 있어요.
          </Text>
        </View>

        <View style={styles.highlightCard}>
          <Text style={styles.highlightLabel}>약속</Text>
          <Text style={styles.highlightText}>
            이번 달 약속 {appointmentEntries.length}건.
          </Text>
        </View>
      </View>

      {/* AI 총평 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>AI 총평</Text>
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
            <Text style={styles.generateText}>✨ AI 총평 생성</Text>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.exportBtn}
          onPress={handleExportPDF}>
          <Text style={styles.exportText}>📄 PDF로 내보내기</Text>
        </TouchableOpacity>
      </View>

      {/* 통계 요약 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>통계 요약</Text>
        <View style={styles.statsGrid}>
          <View style={[styles.statItem, {backgroundColor: colors.card}]}>
            <Text style={[styles.statVal, {color: colors.text, fontSize: fontSize(20)}]}>{entries.length}</Text>
            <Text style={[styles.statLbl, {color: colors.subText, fontSize: fontSize(11)}]}>총 기록</Text>
          </View>
          <View style={[styles.statItem, {backgroundColor: colors.card}]}>
            <Text style={[styles.statVal, {color: colors.text, fontSize: fontSize(20)}]}>
              ₩{totalExpense.toLocaleString()}
            </Text>
            <Text style={[styles.statLbl, {color: colors.subText, fontSize: fontSize(11)}]}>총 지출</Text>
          </View>
          <View style={[styles.statItem, {backgroundColor: colors.card}]}>
            <Text style={[styles.statVal, {color: colors.text, fontSize: fontSize(20)}]}>{positiveCount}</Text>
            <Text style={[styles.statLbl, {color: colors.subText, fontSize: fontSize(11)}]}>긍정 감정</Text>
          </View>
          <View style={[styles.statItem, {backgroundColor: colors.card}]}>
            <Text style={[styles.statVal, {color: colors.text, fontSize: fontSize(20)}]}></Text>
            <Text style={[styles.statLbl, {color: colors.subText, fontSize: fontSize(11)}]}>약속</Text>
          </View>
        </View>
      </View>

      <View style={{height: 40}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  periodRow: {
    flexDirection: 'row',
    padding: 20,
    paddingTop: 60,
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