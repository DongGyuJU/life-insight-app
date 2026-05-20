import React, {useState} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {saveEntry} from '../database/db';
import {analyzeText} from '../services/api';

export default function RecordScreen() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleSubmit = async () => {
    if (!text.trim()) {
      Alert.alert('입력 오류', '내용을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      // AI 분석 요청
      const analysis = await analyzeText(text);

      if (analysis) {
        setResult(analysis);
      } else {
        // 서버 연결 실패 시 분류 없이 저장
        await saveEntry({text});
        Alert.alert('저장 완료', '서버 연결 없이 저장됐어요.');
        setText('');
      }
    } catch (error) {
      Alert.alert('오류', '저장 중 문제가 발생했어요.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!result) return;
    await saveEntry({
      text,
      categories: JSON.stringify(result.categories),
      emotion: result.emotion,
      amount: result.amount,
      appointment_date: result.appointment_date,
      summary: result.summary,
    });
    Alert.alert('저장 완료', '기록이 저장됐어요!');
    setText('');
    setResult(null);
  };

  const handleReject = () => {
    setResult(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.inner}>
        <Text style={styles.title}>새 기록</Text>
        <Text style={styles.sub}>형식 없이 — AI가 알아서 분류해드려요</Text>

        <TextInput
          style={styles.input}
          placeholder="오늘 있었던 일, 지출, 약속, 느낀 것..."
          placeholderTextColor="#aaa"
          multiline
          value={text}
          onChangeText={setText}
        />

        {/* AI 분석 결과 스냅 리뷰 */}
        {result && (
          <View style={styles.resultBox}>
            <Text style={styles.resultTitle}>AI 분석 결과</Text>
            <Text style={styles.resultText}>
              카테고리: {result.categories?.join(', ')}
            </Text>
            {result.emotion && (
              <Text style={styles.resultText}>감정: {result.emotion}</Text>
            )}
            {result.amount && (
              <Text style={styles.resultText}>
                금액: ₩{result.amount.toLocaleString()}
              </Text>
            )}
            {result.appointment_date && (
              <Text style={styles.resultText}>
                약속: {result.appointment_date}
              </Text>
            )}
            {result.summary && (
              <Text style={styles.resultText}>요약: {result.summary}</Text>
            )}
            <View style={styles.snapRow}>
              <TouchableOpacity
                style={styles.confirmBtn}
                onPress={handleConfirm}>
                <Text style={styles.confirmText}>✓ 확인</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={handleReject}>
                <Text style={styles.rejectText}>✕ 수정</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 제출 버튼 */}
        {!result && (
          <TouchableOpacity
            style={styles.submitBtn}
            onPress={handleSubmit}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.submitText}>기록하고 분류 요청 →</Text>
            )}
          </TouchableOpacity>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  inner: {padding: 24, paddingTop: 60},
  title: {fontSize: 20, fontWeight: '600', color: '#1a1a1a', marginBottom: 4},
  sub: {fontSize: 13, color: '#999', marginBottom: 20},
  input: {
    borderWidth: 0.5,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#1a1a1a',
    minHeight: 140,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: '#BA7517',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  submitText: {color: '#fff', fontSize: 15, fontWeight: '500'},
  resultBox: {
    backgroundColor: '#FAEEDA',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  resultTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#854F0B',
    marginBottom: 8,
  },
  resultText: {fontSize: 13, color: '#412402', marginBottom: 4},
  snapRow: {flexDirection: 'row', gap: 8, marginTop: 12},
  confirmBtn: {
    flex: 1,
    backgroundColor: '#EAF3DE',
    borderRadius: 100,
    padding: 10,
    alignItems: 'center',
  },
  confirmText: {color: '#3B6D11', fontWeight: '500'},
  rejectBtn: {
    flex: 1,
    backgroundColor: '#FCEBEB',
    borderRadius: 100,
    padding: 10,
    alignItems: 'center',
  },
  rejectText: {color: '#A32D2D', fontWeight: '500'},
});