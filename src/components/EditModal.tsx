import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import {useSettings} from '../services/SettingsContext';
import {updateEntry, deleteEntry} from '../database/db';

interface EditModalProps {
  entry: any;
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
}

const EMOTION_OPTIONS = ['positive', 'neutral', 'negative'];
const EMOTION_LABELS: Record<string, string> = {
  positive: '😊 긍정',
  neutral: '😐 중립',
  negative: '😔 부정',
};

const SUB_CATEGORY_OPTIONS: Record<string, string[]> = {
  diary: ['기쁨😊', '설렘🥰', '평온😌', '피곤😪', '슬픔😢', '화남😠', '불안😰'],
  expense: ['카페', '식사', '쇼핑', '교통', '의료', '구독', '기타'],
  appointment: ['데이트', '친구', '가족', '업무', '기타'],
  work: ['미팅', '발표', '마감', 'D-day', '보고', '기타'],
  exercise: ['달리기', '헬스', '수영', '자전거', '요가', '등산', '줄넘기', '기타'],
  health: ['수면', '식단', '몸무게', '병원', '기타'],
  study: ['독서', '강의', '시험', '과제', '기타'],
  travel: ['국내', '해외', '당일치기', '기타'],
};

export default function EditModal({entry, visible, onClose, onSave}: EditModalProps) {
  const {colors} = useSettings();
  const [text, setText] = useState('');
  const [emotion, setEmotion] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [appointmentDate, setAppointmentDate] = useState('');
  const [location, setLocation] = useState('');
  const [workPartner, setWorkPartner] = useState('');
  const [summary, setSummary] = useState('');

  const normalizeDateInput = (value: string) => {
    if (!value) return '';
    const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/);
    if (isoMatch) return `${isoMatch[1]} ${isoMatch[2]}`;
    return value;
  };

  useEffect(() => {
    if (entry) {
      setText(entry.text || '');
      setEmotion(entry.emotion || '');
      setSubCategory(entry.sub_category || '');
      setAmount(entry.amount ? String(entry.amount) : '');
      setAppointmentDate(normalizeDateInput(entry.appointment_date || ''));
      setLocation(entry.location || '');
      setWorkPartner(entry.work_partner || '');
      setSummary(entry.summary || '');
    }
  }, [entry]);

  const getCategory = () => {
    try {
      const cats = JSON.parse(entry?.categories || '[]');
      return cats[0] || 'other';
    } catch { return 'other'; }
  };

  const handleSave = async () => {
    const rawAmount = amount ? amount.replace(/[^0-9.-]/g, '') : '';
    const parsedAmount = rawAmount ? parseFloat(rawAmount) : undefined;

    await updateEntry(entry.id, {
      text,
      emotion,
      sub_category: subCategory,
      amount: Number.isFinite(parsedAmount as number) ? parsedAmount : undefined,
      appointment_date: appointmentDate || undefined,
      location: location || undefined,
      work_partner: workPartner || undefined,
      summary,
    });
    onSave();
    onClose();
  };

  const handleDelete = () => {
    Alert.alert(
      '삭제 확인',
      '이 기록을 삭제할까요?',
      [
        {text: '취소', style: 'cancel'},
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            await deleteEntry(entry.id);
            onSave();
            onClose();
          },
        },
      ],
    );
  };

  const category = getCategory();
  const subOptions = SUB_CATEGORY_OPTIONS[category] || [];

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={[styles.container, {backgroundColor: colors.card}] }>
          {/* 헤더 */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancelText}>취소</Text>
            </TouchableOpacity>
            <Text style={styles.title}>기록 수정</Text>
            <TouchableOpacity onPress={handleSave}>
              <Text style={styles.saveText}>저장</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.body} showsVerticalScrollIndicator={false}>
            {/* 본문 */}
            <Text style={styles.label}>내용</Text>
            <TextInput
              style={styles.textInput}
              value={text}
              onChangeText={setText}
              multiline
              placeholder="내용을 입력하세요"
              placeholderTextColor="#aaa"
            />

            {/* 요약 */}
            <Text style={styles.label}>요약</Text>
            <TextInput
              style={styles.singleInput}
              value={summary}
              onChangeText={setSummary}
              placeholder="한 줄 요약"
              placeholderTextColor="#aaa"
            />

            {/* 감정
            {(category === 'diary' || category === 'expense') && (
              <>
                <Text style={styles.label}>감정</Text>
                <View style={styles.optionRow}>
                  {EMOTION_OPTIONS.map(e => (
                    <TouchableOpacity
                      key={e}
                      style={[
                        styles.optionBtn,
                        emotion === e && styles.optionBtnActive,
                      ]}
                      onPress={() => setEmotion(e)}>
                      <Text style={[
                        styles.optionText,
                        emotion === e && styles.optionTextActive,
                      ]}>
                        {EMOTION_LABELS[e]}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )} */}

            {/* 세부 카테고리 */}
            {subOptions.length > 0 && category !== 'appointment' && (
              <>
                <Text style={styles.label}>세부 분류</Text>
                <View style={styles.optionRow}>
                  {subOptions.map(opt => (
                    <TouchableOpacity
                      key={opt}
                      style={[
                        styles.optionBtn,
                        subCategory === opt && styles.optionBtnActive,
                      ]}
                      onPress={() => setSubCategory(opt)}>
                      <Text style={[
                        styles.optionText,
                        subCategory === opt && styles.optionTextActive,
                      ]}>
                        {opt}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            )}

            {/* 금액 */}
            {category === 'expense' && (
              <>
                <Text style={styles.label}>금액 (원)</Text>
                <TextInput
                  style={styles.singleInput}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor="#aaa"
                />
              </>
            )}

            {/* 약속 날짜 및 장소 */}
            {(category === 'appointment' || category === 'work') && (
              <>
                <Text style={styles.label}>누구와</Text>
                <TextInput
                  style={styles.singleInput}
                  value={workPartner}
                  onChangeText={setWorkPartner}
                  placeholder="예: 동식이"
                  placeholderTextColor="#aaa"
                />
                <Text style={styles.label}>날짜/시간 (YYYY-MM-DD HH:mm)</Text>
                <TextInput
                  style={styles.singleInput}
                  value={appointmentDate}
                  onChangeText={setAppointmentDate}
                  placeholder="2026-05-30 14:30"
                  placeholderTextColor="#aaa"
                />
                <Text style={styles.label}>장소 / 어디서</Text>
                <TextInput
                  style={styles.singleInput}
                  value={location}
                  onChangeText={setLocation}
                  placeholder="장소를 입력하세요"
                  placeholderTextColor="#aaa"
                />
              </>
            )}

            {/* 삭제 버튼 */}
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={handleDelete}>
              <Text style={styles.deleteBtnText}>🗑️ 이 기록 삭제</Text>
            </TouchableOpacity>

            <View style={{height: 40}} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  title: {fontSize: 16, fontWeight: '600', color: '#1a1a1a'},
  cancelText: {fontSize: 15, color: '#999'},
  saveText: {fontSize: 15, color: '#BA7517', fontWeight: '600'},
  body: {padding: 20},
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#999',
    marginBottom: 8,
    marginTop: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  textInput: {
    borderWidth: 0.5,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#1a1a1a',
    minHeight: 100,
    textAlignVertical: 'top',
    lineHeight: 22,
  },
  singleInput: {
    borderWidth: 0.5,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#1a1a1a',
  },
  optionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: '#f5f5f5',
    borderWidth: 0.5,
    borderColor: '#e0e0e0',
  },
  optionBtnActive: {
    backgroundColor: '#FAEEDA',
    borderColor: '#FAC775',
  },
  optionText: {fontSize: 13, color: '#666'},
  optionTextActive: {color: '#854F0B', fontWeight: '600'},
  deleteBtn: {
    marginTop: 24,
    padding: 14,
    borderRadius: 12,
    backgroundColor: '#FCEBEB',
    alignItems: 'center',
  },
  deleteBtnText: {fontSize: 14, color: '#A32D2D', fontWeight: '500'},
});