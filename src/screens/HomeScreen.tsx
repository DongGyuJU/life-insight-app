import React, {useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {getAllEntries, markAsReviewed, saveEntry, deleteEntry} from '../database/db';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {analyzeText, analyzeImage, parseRelativeDate, parseAppointmentLocation, parseAppointmentPartner, buildAppointmentDateTime, calcCalories, isWorkKeyword, isAppointmentKeyword} from '../services/api';
import {loadSettings} from '../services/settings';
import {Swipeable} from 'react-native-gesture-handler';
import {useSettings} from '../services/SettingsContext';

export default function HomeScreen() {
  const {colors, fontSize} = useSettings();
  const [entries, setEntries] = useState<any[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [completedCount, setCompletedCount] = useState(0);
  const [appointmentCount, setAppointmentCount] = useState(0);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  
  const handleDeleteEntry = async (entry) => {
    await deleteEntry(entry.id);
    loadData(); // 삭제 후 목록 다시 불러오기
  };

  const renderSwipeActions = (entry) => {
    return (
      // 터치(TouchableOpacity)가 아니라 그냥 View로 바꿉니다. (밀면 바로 삭제되니까요!)
      <View style={styles.deleteAction}>
        <Text style={styles.deleteActionText}>🗑️</Text>
        <Text style={styles.deleteActionLabel}>삭제</Text>
      </View>
    );
  };

  const loadData = async () => {
    const all = await getAllEntries();
    setEntries(all.slice(0, 5));
    setTotalCount(all.length);
    setCompletedCount(all.filter(e => e.reviewed === 1 || e.reviewed === '1').length);
    setAppointmentCount(all.filter(e => {
      try { return JSON.parse(e.categories || '[]').includes('appointment'); }
      catch { return false; }
    }).length);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );
  const getGreeting = () => {
    const hour = new Date().getHours();
    const hasAppointment = entries.some(e => {
      try { return JSON.parse(e.categories || '[]').includes('appointment'); }
      catch { return false; }
    });
    const hasWork = entries.some(e => {
      try { return JSON.parse(e.categories || '[]').includes('work'); }
      catch { return false; }
    });

    if (hour >= 0 && hour < 6) {
      return {
        title: '늦게까지 깨어 계시네요 🌙',
        sub: '오늘 하루는 어떠셨나요?',
      };
    } else if (hour >= 6 && hour < 9) {
      return {
        title: '좋은 아침이에요 ☀️',
        sub: hasWork ? '오늘 업무 일정이 있으신가요?' : '오늘 하루를 기록해보세요',
      };
    } else if (hour >= 9 && hour < 12) {
      return {
        title: '오전도 활기차게! 💪',
        sub: hasWork ? '오늘 업무 계획이 있으신가요?' : '오늘 있었던 일을 기록해보세요',
      };
    } else if (hour >= 12 && hour < 14) {
      return {
        title: '점심 드셨나요? 🍱',
        sub: hasAppointment ? '오늘 점심 약속이 있으시네요!' : '점심 약속이 있으신가요?',
      };
    } else if (hour >= 14 && hour < 18) {
      return {
        title: '오후도 잘 보내고 계신가요? ☕',
        sub: '오늘 지출이 있으셨나요?',
      };
    } else if (hour >= 18 && hour < 21) {
      return {
        title: '오늘 하루 수고하셨어요 🌆',
        sub: hasAppointment ? '저녁 약속이 있으시네요!' : '오늘 하루를 기록해보세요',
      };
    } else {
      return {
        title: '오늘 하루 어떠셨나요? 🌙',
        sub: '하루를 마무리하며 기록해보세요',
      };
    }
  };
  const handleCamera = () => {
    launchCamera(
      {mediaType: 'photo', includeBase64: true, quality: 0.8},
      async response => {
        if (response.assets?.[0]) {
          const asset = response.assets[0];
          setImageUri(asset.uri || null);
          if (asset.base64) {
            setLoading(true);
            const analysis = await analyzeImage(asset.base64);
            if (analysis) {
              setText(analysis.extracted_text || '');
              setResult(analysis);
            }
            setLoading(false);
          }
        }
      },
    );
  };

  const handleGallery = () => {
    launchImageLibrary(
      {mediaType: 'photo', includeBase64: true, quality: 0.8},
      async response => {
        if (response.assets?.[0]) {
          const asset = response.assets[0];
          setImageUri(asset.uri || null);
          if (asset.base64) {
            setLoading(true);
            const analysis = await analyzeImage(asset.base64);
            if (analysis) {
              setText(analysis.extracted_text || '');
              setResult(analysis);
            }
            setLoading(false);
          }
        }
      },
    );
  };
  const handleSubmit = async () => {
    if (!text.trim()) {
      Alert.alert('입력 오류', '내용을 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      const analysis = await analyzeText(text);
      if (analysis) {
        setResult(analysis);
      } else {
        await saveEntry({text});
        Alert.alert('저장 완료', '서버 연결 없이 저장됐어요.');
        setText('');
        loadData();
      }
    } catch (error) {
      Alert.alert('오류', '저장 중 문제가 발생했어요.');
    } finally {
      setLoading(false);
    }
  };
  
  // AI 판단 + 규칙 기반 보정
  // const handleConfirm = async () => {
  //   if (!result) return;

  //   const resultCategories = normalizeCategories(result.categories);
  //   const isDiary = resultCategories.includes('diary');
  //   const isWork = resultCategories.includes('work');
  //   const isAppointment = resultCategories.includes('appointment');
  //   const isExercise = resultCategories.includes('exercise');

  //   const appointmentDate = isAppointment
  //     ? buildAppointmentDateTime(text, result.appointment_date)
  //     : null;

  //   // const dueDate = isWork
  //   //   ? (result.is_todo === 1 ? null : (parseRelativeDate(text) || result.due_date || null))
  //   //   : null;
  //   const dueDate = (isWork || isWorkKeyword(text))
  //     ? (result.is_todo === 1 ? null : (parseRelativeDate(text) || result.due_date || null))
  //     : null;

  //   const location = (isAppointment || isWork)
  //     ? (result.location || parseAppointmentLocation(text) || '')
  //     : result.location;

  //   const workPartner = (isAppointment || isWork || isWorkKeyword(text))
  //     ? (result.work_partner || parseAppointmentPartner(text) || null)
  //     : result.work_partner;

  //   let categories = [...resultCategories];

  //   // 미팅/회의 키워드면 work로 강제 교정
  //   if (isWorkKeyword(text) && !categories.includes('work')) {
  //     categories = categories.filter(c => c !== 'appointment');
  //     categories.push('work');
  //   }
  //   if (categories.length === 0) {
  //     if (result.amount) {
  //       categories.push('expense');
  //     } else if (isWorkKeyword(text)) {
  //     // 업무 키워드 우선: 미팅, 회의, 마감, 보고, 발표 등
  //     categories.push('work');
  //     } else if (isAppointmentKeyword(text)) {
  //     // 약속 키워드: 약속, 만남
  //     categories.push('appointment');
  //     } else if (result.exercise_type) {
  //       categories.push('exercise');
  //     } else if (appointmentDate && (result.location || result.work_partner)) {
  //       // 날짜 + 위치/사람 = 약속
  //       categories.push('appointment');
  //     } else if (dueDate && (result.is_todo === 1 || result.work_partner)) {
  //       // 마감일 + (할일 또는 담당자) = 업무
  //       categories.push('work');
  //     } else if (result.is_todo === 1) {
  //       categories.push('work');
  //     } else if (dueDate) {
  //       categories.push('work');
  //     } else {
  //       categories.push('diary');
  //     }
  //   }
  //   const subCategory = isAppointment
  //     ? ''
  //     : result.sub_category || (categories.includes('diary') ? inferDiarySubCategory(text) : '');

  //   let calories: number | undefined;
  //   if (isExercise && result.exercise_type && result.exercise_minutes) {
  //     const settings = await loadSettings();
  //     calories = calcCalories(
  //       result.exercise_type,
  //       result.exercise_minutes,
  //       settings.bodyWeight,
  //     );
  //   }

  //   await saveEntry({
  //     text,
  //     categories: JSON.stringify(categories),
  //     sub_category: subCategory,
  //     amount: result.amount,
  //     appointment_date: appointmentDate || undefined,
  //     location,
  //     summary: result.summary,
  //     exercise_type: result.exercise_type,
  //     exercise_minutes: result.exercise_minutes,
  //     exercise_calories: calories,
  //     work_partner: workPartner || undefined,
  //     work_priority: result.work_priority || '보통',
  //     work_status: '예정',
  //     is_todo: result.is_todo || 0,
  //     due_date: dueDate,
  //     reviewed: 1,
  //   });

  //   Alert.alert('저장 완료', calories
  //     ? `기록 저장! 소모 칼로리: ${calories}kcal 🔥`
  //     : '기록이 저장됐어요!');
  //   setText('');
  //   setResult(null);
  //   loadData();
  // };

  // AI 판단 결과에 맡김
  const handleConfirm = async () => {
    if (!result) return;

    const resultCategories = normalizeCategories(result.categories);
    const isWork = resultCategories.includes('work');
    const isAppointment = resultCategories.includes('appointment');
    const isExercise = resultCategories.includes('exercise');

    const appointmentDate = isAppointment
      ? buildAppointmentDateTime(text, result.appointment_date)
      : null;

    const dueDate = isWork
      ? (result.is_todo === 1 ? null : (parseRelativeDate(text) || result.due_date || null))
      : null;

    const location = (isAppointment || isWork)
      ? (result.location || parseAppointmentLocation(text) || '')
      : result.location;

    const workPartner = (isAppointment || isWork)
      ? (result.work_partner || parseAppointmentPartner(text) || null)
      : result.work_partner;

    // AI 판단 그대로 사용
    let categories = [...resultCategories];
    if (categories.length === 0) {
      categories.push('diary');
    }

    const subCategory = isAppointment
      ? ''
      : result.sub_category || (categories.includes('diary') ? inferDiarySubCategory(text) : '');

    let calories: number | undefined;
    if (isExercise && result.exercise_type && result.exercise_minutes) {
      const settings = await loadSettings();
      calories = calcCalories(
        result.exercise_type,
        result.exercise_minutes,
        settings.bodyWeight,
      );
    }

    await saveEntry({
      text,
      categories: JSON.stringify(categories),
      sub_category: subCategory,
      amount: result.amount,
      appointment_date: appointmentDate || undefined,
      location,
      summary: result.summary,
      exercise_type: result.exercise_type,
      exercise_minutes: result.exercise_minutes,
      exercise_calories: calories,
      work_partner: workPartner || undefined,
      work_priority: result.work_priority || '보통',
      work_status: '예정',
      is_todo: result.is_todo || 0,
      due_date: dueDate,
      reviewed: 1,
    });

    Alert.alert('저장 완료', calories
      ? `기록 저장! 소모 칼로리: ${calories}kcal 🔥`
      : '기록이 저장됐어요!');
    setText('');
    setResult(null);
    loadData();
  };


  const handleReject = () => setResult(null);

  const getDiaryEmoji = (sub_category: string) => {
      const map: Record<string, string> = {
        '기쁨😊': '😊',
        '설렘🥰': '🥰',
        '평온😌': '😌',
        '피곤😪': '😪',
        '슬픔😢': '😢',
        '화남😠': '😠',
        '불안😰': '😰',
      };
      return map[sub_category] || '📔';
    };

  const inferDiarySubCategory = (text: string) => {
    const normalized = text.replace(/\s+/g, '');
    if (/기쁘|행복|즐거|뿌듯/.test(normalized)) return '기쁨😊';
    if (/설렘|기대|두근|떨림/.test(normalized)) return '설렘🥰';
    if (/평온|편안|차분|안정/.test(normalized)) return '평온😌';
    if (/피곤|힘들|졸림|지침/.test(normalized)) return '피곤😪';
    if (/슬퍼|우울|눈물|서운/.test(normalized)) return '슬픔😢';
    if (/화나|짜증|열받|분노/.test(normalized)) return '화남😠';
    if (/불안|걱정|초조|긴장/.test(normalized)) return '불안😰';
    return '';
  };

  const getCategoryLabel = (categories: string) => {
    try {
      return JSON.parse(categories).join(', ');
    } catch {
      return categories;
    }
  };

  const normalizeCategories = (categories: any): string[] => {
    if (!categories) return [];
    if (Array.isArray(categories)) return categories.map(String).filter(Boolean);
    if (typeof categories === 'string') {
      try {
        const parsed = JSON.parse(categories);
        if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
        if (typeof parsed === 'string') return parsed.split(',').map(item => item.trim()).filter(Boolean);
      } catch {
        return categories.split(',').map(item => item.trim()).filter(Boolean);
      }
    }
    return [];
  };

  const parseCategoryList = (categories: string) => {
    try {
      return JSON.parse(categories || '[]');
    } catch {
      return [categories].filter(Boolean);
    }
  };

  const getEntryIcon = (entry: any) => {
    const categoryList = parseCategoryList(entry.categories);
    if (categoryList.includes('appointment')) return '📅';
    if (categoryList.includes('expense')) return '💰';
    if (categoryList.includes('work')) return '💼';
    if (categoryList.includes('exercise')) return '🏃';
    if (categoryList.includes('health')) return '❤️';
    if (categoryList.includes('study')) return '📚';
    if (categoryList.includes('travel')) return '✈️';
    if (categoryList.includes('diary')) {
      return entry.sub_category ? getDiaryEmoji(entry.sub_category) : '📔';
    }
    return '📝';
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, {backgroundColor: colors.background}]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.inner}>

        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={[styles.month, {color: colors.subText, fontSize: fontSize(14)}]}>
            {new Date().getFullYear()}년 {new Date().getMonth() + 1}월
          </Text>
          <Text style={[styles.title, {color: colors.text, fontSize: fontSize(22)}]}>
            {getGreeting().title}
          </Text>
          <Text style={[styles.greetingSub, {color: colors.subText, fontSize: fontSize(14)}]}>
            {getGreeting().sub}
          </Text>
        </View>

        {/* 통계 */}
        <View style={styles.statsRow}>
          <View style={[styles.statBox, {backgroundColor: colors.card}]}>
            <Text style={[styles.statVal, {color: colors.text, fontSize: fontSize(22)}]}>
              {totalCount}
            </Text>
            <Text style={[styles.statLbl, {color: colors.subText, fontSize: fontSize(11)}]}>
              전체 기록
            </Text>
          </View>
          <View style={[styles.statBox, {backgroundColor: colors.card}]}> 
            <Text style={[styles.statVal, {color: colors.text, fontSize: fontSize(22)}]}>
              {completedCount}
            </Text>
            <Text style={[styles.statLbl, {color: colors.subText, fontSize: fontSize(11)}]}>
              분류 완료
            </Text>
          </View>
          <View style={[styles.statBox, {backgroundColor: colors.card}]}> 
            <Text style={[styles.statVal, {color: colors.text, fontSize: fontSize(22)}]}>
              {appointmentCount}
            </Text>
            <Text style={[styles.statLbl, {color: colors.subText, fontSize: fontSize(11)}]}>
              약속 개수
            </Text>
          </View>
        </View>

        {/* 기록 입력창 */}
        <View style={styles.inputSection}>
          <Text style={styles.sectionTitle}>오늘의 기록</Text>
          <TextInput
            style={[styles.input, {
              borderColor: colors.border,
              color: colors.text,
              backgroundColor: colors.background,
              fontSize: fontSize(14),
            }]}
            placeholder="지출, 약속, 감정... 무엇이든 기록하세요"
            placeholderTextColor={colors.subText}
            multiline
            value={text}
            onChangeText={setText}
          />
          {/* 첨부 버튼 */}
          <View style={styles.attachRow}>
            <TouchableOpacity style={styles.attachBtn} onPress={handleCamera}>
              <Text style={styles.attachText}>📷 카메라</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.attachBtn} onPress={handleGallery}>
              <Text style={styles.attachText}>🖼️ 갤러리</Text>
            </TouchableOpacity>
          </View>
          {/* AI 분석 결과 */}
          {result && (
            <View style={styles.resultBox}>
              <Text style={styles.resultTitle}>AI 분석 결과</Text>
              <Text style={styles.resultText}>
                카테고리: {result.categories?.join(', ')}
              </Text>
              {/* {result.emotion && (
                <Text style={styles.resultText}>감정: {result.emotion}</Text>
              )} */}
              {result.amount && (
                <Text style={styles.resultText}>
                  금액: ₩{result.amount.toLocaleString()}
                </Text>
              )}
              {(result.categories?.includes('appointment') || result.categories?.includes('work')) && (
                <>
                  {(result.work_partner || parseAppointmentPartner(text)) && (
                    <Text style={styles.resultText}>
                      누구와: {result.work_partner || parseAppointmentPartner(text)}
                    </Text>
                  )}
                  {(result.location || parseAppointmentLocation(text)) && (
                    <Text style={styles.resultText}>
                      장소: {result.location || parseAppointmentLocation(text)}
                    </Text>
                  )}
                  {buildAppointmentDateTime(text, result.appointment_date) && (
                    <Text style={styles.resultText}>
                      시간: {buildAppointmentDateTime(text, result.appointment_date)}
                    </Text>
                  )}
                </>
              )}
              {result.exercise_type && (
                <Text style={styles.resultText}>
                  운동: {result.exercise_type} {result.exercise_minutes}분
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

          {!result && (
            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleSubmit}
              disabled={loading}>
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.submitText, {fontSize: fontSize(15)}]}>
                  기록하고 분류하기
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>


        {/* 최근 기록 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>최근 기록</Text>
          {entries.length === 0 ? (
            <Text style={styles.emptyText}>
              아직 기록이 없어요. 위에서 시작해보세요!
            </Text>
          ) : (
            entries.map(entry => (
              <Swipeable
                key={entry.id}
                renderRightActions={() => renderSwipeActions(entry)}
                rightThreshold={100} // 화면을 100만큼 밀면 오픈 판정!
                onSwipeableOpen={async () => {
                  // 밀림 판정이 나는 순간 자동으로 삭제 실행
                  await handleDeleteEntry(entry);
                }}>
                <View style={[styles.entryCard, {borderBottomColor: colors.border}]}>
                  <View style={styles.entryLeft}>
                    <Text style={styles.entryEmoji}>
                      {getEntryIcon(entry)}
                    </Text>
                  </View>
                  <View style={styles.entryRight}>
                    <Text style={[styles.entryText, {color: colors.text, fontSize: fontSize(13)}]}
                      numberOfLines={1}>
                      {entry.summary || entry.text}
                    </Text>
                    <Text style={[styles.entryMeta, {color: colors.subText, fontSize: fontSize(11)}]}>
                      {entry.created_at?.slice(0, 10)}
                      {entry.categories ? `  ·  ${getCategoryLabel(entry.categories)}` : ''}
                      {entry.amount ? `  ·  ₩${entry.amount.toLocaleString()}` : ''}
                    </Text>
                  </View>
                </View>
              </Swipeable>
            ))
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  inner: {paddingBottom: 40},
  header: {padding: 24, paddingTop: 60},
  month: {fontSize: 14, color: '#999', marginBottom: 4},
  title: {fontSize: 22, fontWeight: '600', color: '#1a1a1a'},
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 10,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    padding: 12,
  },
  statVal: {fontSize: 22, fontWeight: '500', color: '#1a1a1a'},
  statLbl: {fontSize: 11, color: '#999', marginTop: 2},
  inputSection: {paddingHorizontal: 24, marginBottom: 16},
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  input: {
    borderWidth: 0.5,
    borderColor: '#ddd',
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    color: '#1a1a1a',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  attachRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  attachBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  attachText: {
    fontSize: 13,
    color: '#666',
  },
  submitBtn: {
    backgroundColor: '#BA7517',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  submitText: {color: '#fff', fontSize: 14, fontWeight: '500'},
  resultBox: {
    backgroundColor: '#FAEEDA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#854F0B',
    marginBottom: 8,
  },
  resultText: {fontSize: 13, color: '#412402', marginBottom: 4},
  snapRow: {flexDirection: 'row', gap: 8, marginTop: 10},
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
  section: {paddingHorizontal: 24, marginBottom: 16},
  badge: {color: '#BA7517', fontSize: 11},
  reviewCard: {
    backgroundColor: '#FAEEDA',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewText: {flex: 1, fontSize: 13, color: '#412402'},
  reviewBtns: {flexDirection: 'row', gap: 6},
  reviewConfirm: {
    backgroundColor: '#EAF3DE',
    borderRadius: 100,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewReject: {
    backgroundColor: '#FCEBEB',
    borderRadius: 100,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
    gap: 10,
  },
  entryLeft: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  entryEmoji: {fontSize: 18},
  entryRight: {flex: 1},
  entryText: {fontSize: 13, color: '#1a1a1a'},
  entryMeta: {fontSize: 11, color: '#aaa', marginTop: 2},
  emptyText: {fontSize: 13, color: '#aaa', textAlign: 'center', marginTop: 20},
  greetingSub: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  deleteAction: {
    backgroundColor: '#FCEBEB',
    justifyContent: 'center',
    alignItems: 'center',
    width: 70,
    borderRadius: 10,
    marginVertical: 2,
  },
  deleteActionText: {fontSize: 20},
  deleteActionLabel: {fontSize: 11, color: '#A32D2D', marginTop: 2},
});