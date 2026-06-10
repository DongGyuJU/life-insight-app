import React, {useState, useCallback, useEffect} from 'react';
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
import {getAllEntries, saveEntry, deleteEntry} from '../database/db';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import {analyzeText, analyzeImage, parseRelativeDate, parseAppointmentLocation, parseAppointmentPartner, buildAppointmentDateTime, calcCalories, isWorkKeyword, isAppointmentKeyword, parseTimeText} from '../services/api';
import {loadSettings} from '../services/settings';
import {Swipeable} from 'react-native-gesture-handler';
import {useSettings} from '../services/SettingsContext';
import GradientHeader from '../components/GradientHeader';
import { loadAIEngine, analyzeLifeLog } from '../services/AIManager'; 
import ReactNativeHapticFeedback from "react-native-haptic-feedback";
import { syncPendingEntries } from '../services/syncService';
import { ScrollView as HScrollView } from 'react-native'; 
import { getCurrentUserId } from '../services/syncService';
import LivarsSection from '../components/LivarsSection';

const hapticOptions = { enableVibrateFallback: true, ignoreAndroidSystemSettings: false };

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
  
  const handleDeleteEntry = async (entry: any) => {
    await deleteEntry(entry.id);
    loadData(); // 삭제 후 목록 다시 불러오기
  };

  const renderSwipeActions = (entry: any) => {
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
  const [settings, setSettings] = useState<any>({ wakeTime: '07:00' });

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);
  const [optimalCoffeeTime, setOptimalCoffeeTime] = useState<string | null>(null);

  useEffect(() => {
    // 기상 시간 기반 최적 커피 시간 로컬 계산
    const calcCoffeeTime = async () => {
      const s = await loadSettings();
      const wakeTime = s.wakeTime || '07:00';
      const [h, m] = wakeTime.split(':').map(Number);
      const optimalMin = h * 60 + m + 120; // 기상 후 2시간
      const oh = Math.floor(optimalMin / 60) % 24;
      const om = optimalMin % 60;
      setOptimalCoffeeTime(
        `${String(oh).padStart(2, '0')}:${String(om).padStart(2, '0')}`
      );
    };
    calcCoffeeTime();
  }, []);
  useEffect(() => {
  loadAIEngine();
}, []);
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
      // ❌ 에러 발생 시 경고 진동 (드르륵!)
      ReactNativeHapticFeedback.trigger("notificationError", hapticOptions);
      Alert.alert('입력 오류', '내용을 입력해주세요.');
      return;
    }
    
    // 👇 1. 버튼 누른 직후 가벼운 진동 (톡!)
    ReactNativeHapticFeedback.trigger("impactLight", hapticOptions); 
    setLoading(true);
    
    try {
      const analysis = await analyzeLifeLog(text) ?? await analyzeText(text); 
      
      if (analysis) {
        // 👇 2. AI 분석 성공 시 기분 좋은 진동 (뾰로롱!)
        ReactNativeHapticFeedback.trigger("notificationSuccess", hapticOptions); 
        setResult(analysis);
      } else {
        await saveEntry({
          text,
          categories: JSON.stringify(['diary']), 
          reviewed: 0, 
        });
        Alert.alert('저장 완료', 'AI 분석에 실패하여 기본 일기로 저장됐어요.');
        setText('');
        loadData();
      }
    } catch (error) {
      ReactNativeHapticFeedback.trigger("notificationError", hapticOptions); // 에러 진동
      Alert.alert('오류', '저장 중 문제가 발생했어요.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  
  // AI 판단 결과에 맡김
  const handleConfirm = async () => {
    if (!result) return;
    ReactNativeHapticFeedback.trigger("impactMedium", hapticOptions);

    // 1. AI가 준 카테고리를 배열로 확실하게 파싱
    const resultCategories = normalizeCategories(result.categories);
    if (resultCategories.length === 0) {
      resultCategories.push('diary'); // 분류 실패 시 기본값
    }

    const isAppointment = resultCategories.includes('appointment');
    const isExercise = resultCategories.includes('exercise');

    // 2. 과거의 복잡한 정규식(parseRelativeDate 등)은 모두 삭제! AI의 결과를 그대로 믿습니다.
    const appointmentDate = isAppointment ? result.appointment_date : null;
    const location = result.location || '';
    const workPartner = result.work_partner || '';

    // 3. 일기인 경우에만 감정 이모지 추론
    const subCategory = isAppointment
      ? ''
      : result.sub_category || (resultCategories.includes('diary') ? inferDiarySubCategory(text) : '');

    let calories: number | undefined;
    if (isExercise && result.exercise_type && result.exercise_minutes) {
      const settings = await loadSettings();
      calories = calcCalories(
        result.exercise_type,
        result.exercise_minutes,
        settings.bodyWeight,
      );
    }

    try {
      // 4. SQLite DB에 저장 (saveEntry)
      await saveEntry({
        text: text,
        categories: JSON.stringify(resultCategories),
        sub_category: subCategory,
        amount: result.amount,
        appointment_date: appointmentDate || undefined,
        location: location,
        summary: result.summary,
        exercise_type: result.exercise_type,
        exercise_minutes: result.exercise_minutes,
        exercise_calories: calories,
        work_partner: workPartner || undefined,
        is_todo: result.is_todo || 0,
        reviewed: 1, // AI 분석 후 사용자가 '확인'을 눌렀으므로 리뷰 완료 처리
      });
      syncPendingEntries();
      ReactNativeHapticFeedback.trigger("notificationSuccess", hapticOptions);

      Alert.alert(
        '저장 완료', 
        calories ? `기록 저장! 소모 칼로리: ${calories}kcal 🔥` : '기록이 저장됐어요!'
      );
      
      // 5. UI 초기화 및 하단 '최근 기록' 리스트 갱신
      setText('');
      setResult(null);
      loadData(); 

    } catch (error) {
      console.error("DB 저장 에러:", error);
      Alert.alert('오류', '데이터베이스 저장 중 문제가 발생했습니다.');
    }
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
        <GradientHeader title={getGreeting().title} subtitle={getGreeting().sub} noGradient />

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
              backgroundColor: '#FFFFFF',
              fontSize: fontSize(14),
              borderWidth: 1,
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
                  <Text style={[styles.confirmText, {color: colors.primary}]}>✓ 확인</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rejectBtn}
                  onPress={handleReject}>
                  <Text style={styles.rejectText}>✕ 수정</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* 👇 개선된 로딩 버튼 */}
          {!result && (
            <TouchableOpacity
              style={[
                styles.submitBtn, 
                {backgroundColor: loading ? colors.subText : colors.primary} 
              ]}
              onPress={handleSubmit}
              disabled={loading}>
              {loading ? (
                <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                  <ActivityIndicator color="#fff" size="small" />
                  <Text style={[styles.submitText, {fontSize: fontSize(15)}]}>
                    AI 비서가 분석 중입니다... 🧠
                  </Text>
                </View>
              ) : (
                <Text style={[styles.submitText, {fontSize: fontSize(15)}]}>
                  기록하고 분류하기
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* 👇 실수로 지워졌던 최근 기록 리스트 복구 */}
        <View style={styles.section}>
            <Text style={[styles.sectionTitle, {color: colors.subText}]}>최근 기록</Text>
          {entries.length === 0 ? (
            <Text style={styles.emptyText}>
              아직 기록이 없어요. 위에서 시작해보세요!
            </Text>
          ) : (
            entries.map(entry => (
              <Swipeable
                key={entry.id}
                renderRightActions={() => renderSwipeActions(entry)}
                rightThreshold={100} 
                onSwipeableOpen={async () => {
                  await handleDeleteEntry(entry);
                }}>
                <View style={[styles.entryCard, {borderBottomColor: colors.border, backgroundColor: colors.card}]}>
                  <View style={[styles.entryLeft, {backgroundColor: 'rgba(255,255,255,0.9)'}]}>
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
        {/* ── LiVars 슬라이더 ── */}
        <LivarsSection
          entries={entries}
          colors={colors}
          fontSize={fontSize}
          wakeTime={settings.wakeTime || '07:00'}
          caffeineSensitivity={settings.caffeineSensitivity || 'medium'} 
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  inner: {paddingBottom: 40},
  header: {padding: 20, paddingTop: 24},
  month: {fontSize: 14, color: '#475569', marginBottom: 4},
  title: {fontSize: 22, fontWeight: '700', color: '#0f172a'},
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    gap: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  statBox: {
    flex: 1,
    borderRadius: 14,
    padding: 14,
    // frosted shadow
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  statVal: {fontSize: 22, fontWeight: '600', color: '#0f172a'},
  statLbl: {fontSize: 11, color: '#475569', marginTop: 4},
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
    borderWidth: 0,
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    color: '#0f172a',
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 10,
    // slight inner shadow look is achieved by background via inline
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
    borderRadius: 12,
    padding: 10,
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.85)'
  },
  attachText: {
    fontSize: 13,
    color: '#666',
  },
  submitBtn: {
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.12,
    shadowRadius: 18,
    elevation: 3,
  },
  submitText: {color: '#fff', fontSize: 14, fontWeight: '600'},
  resultBox: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    backgroundColor: 'rgba(255,255,255,0.9)',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 6},
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 2,
  },
  resultTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 8,
  },
  resultText: {fontSize: 13, color: '#0f172a', marginBottom: 4},
  snapRow: {flexDirection: 'row', gap: 8, marginTop: 10},
  confirmBtn: {
    flex: 1,
    borderRadius: 100,
    padding: 10,
    alignItems: 'center',
  },
  confirmText: {color: '#2563EB', fontWeight: '600'},
  rejectBtn: {
    flex: 1,
    borderRadius: 100,
    padding: 10,
    alignItems: 'center',
    backgroundColor: 'rgba(255,59,48,0.06)'
  },
  rejectText: {color: '#A32D2D', fontWeight: '600'},
  section: {paddingHorizontal: 24, marginBottom: 16},
  badge: {color: '#BA7517', fontSize: 11},
  reviewCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  reviewText: {flex: 1, fontSize: 13, color: '#0f172a'},
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
    gap: 10,
    borderRadius: 12,
    marginBottom: 8,
  },
  entryLeft: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.06,
    shadowRadius: 10,
  },
  entryEmoji: {fontSize: 18},
  entryRight: {flex: 1},
  entryText: {fontSize: 13, color: '#0f172a'},
  entryMeta: {fontSize: 11, color: '#475569', marginTop: 2},
  emptyText: {fontSize: 13, color: '#94a3b8', textAlign: 'center', marginTop: 20},
  greetingSub: {
    fontSize: 14,
    color: '#475569',
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
  livarsSection: {
  paddingHorizontal: 16,
  paddingTop: 20,
  paddingBottom: 8,
  },
  livarsSectionTitle: {
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  livarsScroll: {
    paddingBottom: 4,
    gap: 10,
  },
  livarsCard: {
    width: 120,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  livarsCardEmoji: {
    fontSize: 26,
    marginBottom: 2,
  },
  livarsCardTitle: {
    fontWeight: '700',
    textAlign: 'center',
  },
  livarsCardSub: {
    textAlign: 'center',
    lineHeight: 16,
  },
  livarsCardValue: {
    fontWeight: '800',
    textAlign: 'center',
  },
  livarsCardHint: {
    textAlign: 'center',
    opacity: 0.7,
  },
});