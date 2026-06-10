import {useSettings} from '../services/SettingsContext';
import React, {useState, useCallback, useEffect, useMemo} from 'react';
import {loadSettings, saveSettings, AppSettings} from '../services/settings';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import {formatMonthDayTime, analyzeText, analyzeImage, getAiExpenseFeedback} from '../services/api';
import {useFocusEffect} from '@react-navigation/native';
import EditModal from '../components/EditModal';
import GradientHeader from '../components/GradientHeader';
import {updateEntry, deleteEntry} from '../database/db';
import {getAllEntries, markAsReviewed, toggleTodo} from '../database/db';
import {Swipeable} from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
import { LineChart } from 'react-native-chart-kit';
import { Dimensions } from 'react-native';
type TabType = 'diary' | 'expense' | 'appointment' | 'work' | 'exercise' | 'health' | 'study' | 'travel';

const DEFAULT_TABS: {key: TabType; label: string}[] = [
  {key: 'diary', label: '📔 일기'},
  {key: 'expense', label: '💰 지출'},
  {key: 'appointment', label: '📅 약속'},
  {key: 'work', label: '💼 업무'},
  {key: 'exercise', label: '🏃 운동'},
  {key: 'health', label: '❤️ 건강'},
  {key: 'study', label: '📚 학습'},
  {key: 'travel', label: '✈️ 여행'},
];

export default function CategoryScreen() {
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

  const getDiaryColor = (sub_category: string) => {
    const map: Record<string, string> = {
      '기쁨😊': '#EAF3DE',   // 연초록
      '설렘🥰': '#FAEEDA',   // 연주황
      '평온😌': '#E6F1FB',   // 연파랑
      '피곤😪': '#F5F5F5',   // 연회색
      '슬픔😢': '#EAE6FB',   // 연보라
      '화남😠': '#FCEBEB',   // 연빨강
      '불안😰': '#FBF6E6',   // 연노랑
    };
    return map[sub_category] || '#f9f9f9';
  };
  const calcDday = (dateStr: string) => {
    if (!dateStr) return null;
    try {
      const today = new Date();
      today.setHours(0,0,0,0);
      const due = new Date(dateStr);
      due.setHours(0,0,0,0);
      const diff = Math.round((due.getTime() - today.getTime()) / (1000*60*60*24));
      if (diff === 0) return 'D-day';
      if (diff > 0) return `D-${diff}`;
      return `D+${Math.abs(diff)}`;
    } catch {
      return null;
    }
  };
  const [expenseFilter, setExpenseFilter] = useState('날짜순');
  const [selectedExpense, setSelectedExpense] = useState<any>(null);
  const {colors, fontSize} = useSettings();
  const [activeTab, setActiveTab] = useState<TabType>('diary');
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [tabOrder, setTabOrder] = useState(DEFAULT_TABS);
  const [entries, setEntries] = useState<any[]>([]);
  const [selectedDiary, setSelectedDiary] = useState<any>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<any>(null);
  const [editEntry, setEditEntry] = useState<any>(null);
  const [editVisible, setEditVisible] = useState(false);
  const [selectedWork, setSelectedWork] = useState<any>(null);
  const [expenseSubTab, setExpenseSubTab] = useState<'list' | 'analysis'>('list'); // 세부 탭 토글
  // const [analysisPeriod, setAnalysisPeriod] = useState<'month' | 'all'>('month'); // 분석 기간 토글
  const [aiFeedback, setAiFeedback] = useState<string>('이번 달 소비 데이터를 분석하고 있어요...');
  const [isAiLoading, setIsAiLoading] = useState<boolean>(false);

  // 지출 데이터
  const expenseEntries = useMemo(() => entries.filter(e => {
    try {
      const cats = JSON.parse(e.categories || '[]');
      return cats.includes('expense') && e.amount;
    } catch {
      return false;
    }
  }), [entries]);

  useEffect(() => {
    // 소비 분석 탭이 켜졌을 때만 AI 요청 작동
    if (expenseSubTab !== 'analysis') return;

    const fetchExpenseFeedback = async () => {
      setIsAiLoading(true);
      
      // 💡 이번 달 데이터만 가져오도록 깔끔하게 고정!
      const currentMonthStr = new Date().toISOString().slice(0, 7);
      const filteredData = expenseEntries.filter(e => e.created_at?.startsWith(currentMonthStr));

      if (filteredData.length === 0) {
        setAiFeedback('이번 달에는 지출 내역이 없어 AI 분석이 불가능해요.');
        setIsAiLoading(false);
        return;
      }

      const total = filteredData.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      
      const categoryMap: Record<string, number> = {};
      filteredData.forEach(e => {
        const cat = e.sub_category || '기타';
        categoryMap[cat] = (categoryMap[cat] || 0) + (Number(e.amount) || 0);
      });

      const summaryString = Object.entries(categoryMap)
        .map(([cat, amt]) => `${cat} ₩${amt.toLocaleString()}`)
        .join(', ');

      const finalPayload = `총 ${total.toLocaleString()}원 사용 (${summaryString})`;

      const result = await getAiExpenseFeedback(finalPayload);
      setAiFeedback(result);
      setIsAiLoading(false);
    };

    fetchExpenseFeedback();
  }, [expenseSubTab, expenseEntries]); // 
  const buildTabOrder = (settings: AppSettings) => {
    const order = settings.categoryOrder || DEFAULT_TABS.map(tab => tab.key);
    const ordered = order
      .map(key => DEFAULT_TABS.find(tab => tab.key === key))
      .filter((tab): tab is {key: TabType; label: string} => !!tab);
    const enabled = ordered.filter(tab => settings.categories[tab.key]);
    const missing = DEFAULT_TABS.filter(tab => settings.categories[tab.key] && !order.includes(tab.key));
    return [...enabled, ...missing];
  };

  const updateCategoryOrder = async (data: {key: TabType; label: string}[]) => {
    setTabOrder(data);
    if (settings) {
      const next = {...settings, categoryOrder: data.map(tab => tab.key)};
      setSettings(next);
      await saveSettings(next);
    }
  };

  const loadData = async () => {
    const all = await getAllEntries();
    const s = await loadSettings();
    setEntries(all);
    setSettings(s);
    setTabOrder(buildTabOrder(s));
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  // 감정 데이터
  const emotionEntries = entries.filter(e => {
    try {
      const cats = JSON.parse(e.categories || '[]');
      return cats.includes('emotion');
    } catch {
      return false;
    }
  });

  const appointmentEntries = entries.filter(e => {
    try {
      const cats = JSON.parse(e.categories || '[]');
      return cats.includes('appointment');
    } catch {
      return false;
    }
  });

  const totalExpense = expenseEntries.reduce((sum, e) => {
    const amountValue = Number(e.amount);
    return sum + (Number.isFinite(amountValue) ? amountValue : 0);
  }, 0);

  const getEmotionEmoji = (emotion: string) => {
    if (emotion === 'positive') return '😊';
    if (emotion === 'negative') return '😔';
    return '😐';
  };

  const getEmotionLabel = (emotion: string) => {
    if (emotion === 'positive') return '긍정';
    if (emotion === 'negative') return '부정';
    return '중립';
  };

  const handleDeleteEntry = async (entry: any) => {
    await deleteEntry(entry.id);
    loadData();
  };

  const renderSwipeActions = (entry: any) => (
    <View style={styles.swipeActions}>
      <TouchableOpacity
        style={[styles.swipeAction, styles.deleteSwipeAction]}
        onPress={() => handleDeleteEntry(entry)}>
        <Text style={styles.swipeActionText}>🗑️ 삭제</Text>
      </TouchableOpacity>
    </View>
  );

  const getAppointmentLabel = (entry: any) => {
    const labels: string[] = [];
    if (entry.work_partner) labels.push(`👤 ${entry.work_partner}`);
    if (entry.location) labels.push(`📍 ${entry.location}`);
    if (entry.appointment_date) {
      const formatted = formatMonthDayTime(entry.appointment_date);
      labels.push(`🕒 ${formatted || entry.appointment_date}`);
    }
    return labels;
  };

  const getEmotionColor = (emotion: string) => {
    if (emotion === 'positive') return '#EAF3DE';
    if (emotion === 'negative') return '#FCEBEB';
    return '#f5f5f5';
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.background}]}>
      <GradientHeader title={activeTab.toUpperCase()} subtitle={"탭을 선택해보세요"} noGradient />
      {/* 탭 */}
      {settings && (
        <DraggableFlatList
          horizontal
          data={tabOrder.filter(tab => settings.categories[tab.key])}
          keyExtractor={item => item.key}
          onDragEnd={({data}) => updateCategoryOrder(data)}
          activationDistance={20}
          style={[styles.tabScroll, {backgroundColor: colors.background}]}
          contentContainerStyle={styles.tabRow}
          renderItem={({item, drag, isActive}) => (
            <ScaleDecorator>
              <TouchableOpacity
                style={[
                  styles.tab,
                  activeTab === item.key && styles.tabActive,
                  isActive && styles.tabActiveDragging,
                ]}
                onPress={() => {
                  setActiveTab(item.key);
                  setSelectedDiary(null);
                }}
                onLongPress={drag}>
                <Text style={[styles.tabText, {fontSize: fontSize(12)}, activeTab === item.key && styles.tabTextActive]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            </ScaleDecorator>
          )}
        />
      )}

      <ScrollView style={[styles.content, {backgroundColor: colors.background}]}>
        {/* 일기 탭 */}
        {activeTab === 'diary' && (
          <View>
            <Text style={[styles.sectionTitle, {color: colors.subText, fontSize: fontSize(13)}]}>일기 기록</Text>
            {entries.filter(e => {
              try { return JSON.parse(e.categories || '[]').includes('diary'); }
              catch { return false; }
            }).length === 0 ? (
              <Text style={[styles.emptyText, {color: colors.subText, fontSize: fontSize(13)}]}>일기 기록이 없어요.</Text>
            ) : (
              entries.filter(e => {
                try { return JSON.parse(e.categories || '[]').includes('diary'); }
                catch { return false; }
              }).map(entry => (
                <TouchableOpacity
                  key={entry.id}
                  style={[styles.diaryCard, {backgroundColor: getDiaryColor(entry.sub_category)}]}
                  onPress={() => setSelectedDiary(entry)}>
                  <View style={styles.diaryHeader}>
                    <Text style={styles.diaryEmoji}>{getDiaryEmoji(entry.sub_category)}</Text>
                    <View style={styles.diaryHeaderRight}>
                      <Text style={styles.diaryDate}>{entry.created_at?.slice(0, 10)}</Text>
                      {entry.sub_category && (
                        <View style={styles.diaryTag}>
                          <Text style={styles.diaryTagText}>{entry.sub_category}</Text>
                        </View>
                      )}
                    </View>
                  </View>
                  <Text style={styles.diaryText} numberOfLines={2}>
                    {entry.text}
                  </Text>
                  {entry.summary && (
                    <Text style={styles.diarySummary}>📌 {entry.summary}</Text>
                  )}
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* 일기 상세 보기 */}
        <Modal
          visible={!!selectedDiary}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedDiary(null)}>
          <View style={styles.modal}>
            <View style={[styles.modalContent, {backgroundColor: colors.card}] }>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>일기</Text>
                <View style={{flexDirection: 'row', gap: 8}}>
                  <TouchableOpacity
                    style={[styles.modalClose, {backgroundColor: '#FAEEDA'}]}
                    onPress={() => {
                      setSelectedDiary(null);
                      setEditEntry(selectedDiary);
                      setEditVisible(true);
                    }}>
                    <Text style={{fontSize: 14, color: '#854F0B'}}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalClose}
                    onPress={() => setSelectedDiary(null)}>
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.modalMeta}>
                <Text style={styles.modalEmoji}>
                  {getDiaryEmoji(selectedDiary?.sub_category)}
                </Text>
                <View>
                  <Text style={styles.modalDate}>
                    {selectedDiary?.created_at?.slice(0, 10)}
                  </Text>
                  {selectedDiary?.sub_category && (
                    <View style={styles.diaryTag}>
                      <Text style={styles.diaryTagText}>
                        {selectedDiary.sub_category}
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              <ScrollView
                style={styles.modalBody}
                showsVerticalScrollIndicator={false}>
                <Text style={styles.modalText}>{selectedDiary?.text}</Text>
                {selectedDiary?.summary && (
                  <View style={styles.modalSummaryBox}>
                    <Text style={styles.modalSummaryLabel}>✨ AI 요약</Text>
                    <Text style={styles.modalSummary}>{selectedDiary.summary}</Text>
                  </View>
                )}
                <Text style={styles.modalEmotion}>
                  감정: {getEmotionLabel(selectedDiary?.emotion)}
                </Text>
                <View style={{height: 20}} />
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* 약속 상세 보기 */}
        <Modal
          visible={!!selectedAppointment}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedAppointment(null)}>
          <View style={styles.modal}>
            <View style={[styles.modalContent, {backgroundColor: colors.card}] }>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>약속</Text>
                <View style={{flexDirection: 'row', gap: 8}}>
                  <TouchableOpacity
                    style={[styles.modalClose, {backgroundColor: '#FAEEDA'}]}
                    onPress={() => {
                      setSelectedAppointment(null);
                      setEditEntry(selectedAppointment);
                      setEditVisible(true);
                    }}>
                    <Text style={{fontSize: 14, color: '#854F0B'}}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalClose}
                    onPress={() => setSelectedAppointment(null)}>
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.modalMeta}>
                <Text style={styles.modalEmoji}>📅</Text>
                <View>
                  <Text style={styles.modalDate}>
                    {formatMonthDayTime(selectedAppointment?.appointment_date) || selectedAppointment?.created_at?.slice(0,10)}
                  </Text>
                  {selectedAppointment?.location && (
                    <Text style={styles.appointmentMetaText}>{selectedAppointment.location}</Text>
                  )}
                </View>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                <Text style={styles.modalText}>{selectedAppointment?.summary || selectedAppointment?.text}</Text>
                <View style={styles.modalSummaryBox}>
                  {selectedAppointment?.work_partner && (
                    <Text style={styles.modalSummary}>👤 {selectedAppointment.work_partner}</Text>
                  )}
                  {selectedAppointment?.location && (
                    <Text style={[styles.modalSummary, {marginTop:8}]}>📍 {selectedAppointment.location}</Text>
                  )}
                </View>
                <View style={{height: 20}} />
              </ScrollView>
            </View>
          </View>
        </Modal>
        <EditModal
          entry={editEntry}
          visible={editVisible}
          onClose={() => setEditVisible(false)}
          onSave={loadData}
        />

        {/* 업무 상세 보기 */}
        <Modal
          visible={!!selectedWork}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedWork(null)}>
          <View style={styles.modal}>
            <View style={[styles.modalContent, {backgroundColor: colors.card}] }>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>업무 상세</Text>
                <View style={{flexDirection: 'row', gap: 8}}>
                  <TouchableOpacity
                    style={[styles.modalClose, {backgroundColor: '#FAEEDA'}]}
                    onPress={() => {
                      setSelectedWork(null);
                      setEditEntry(selectedWork);
                      setEditVisible(true);
                    }}>
                    <Text style={{fontSize: 14, color: '#854F0B'}}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalClose}
                    onPress={() => setSelectedWork(null)}>
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* D-day */}
                {selectedWork?.due_date && (
                  <View style={styles.workDdayBanner}>
                    <Text style={styles.workDdayBannerText}>
                      {(() => {
                        const today = new Date();
                        today.setHours(0,0,0,0);
                        const due = new Date(selectedWork.due_date);
                        due.setHours(0,0,0,0);
                        const diff = Math.round((due.getTime() - today.getTime()) / (1000*60*60*24));
                        if (diff === 0) return 'D-day 🔥';
                        if (diff > 0) return `D-${diff}`;
                        return `D+${Math.abs(diff)} (지남)`;
                      })()}
                    </Text>
                  </View>
                )}

                {/* 제목 */}
                <Text style={styles.workDetailTitle}>
                  {selectedWork?.summary || selectedWork?.text}
                </Text>

                {/* 상세 정보 */}
                <View style={styles.workDetailRows}>
                  {selectedWork?.sub_category && (
                    <View style={styles.workDetailRow}>
                      <Text style={styles.workDetailLabel}>종류</Text>
                      <Text style={styles.workDetailValue}>{selectedWork.sub_category}</Text>
                    </View>
                  )}
                  {selectedWork?.work_partner && (
                    <View style={styles.workDetailRow}>
                      <Text style={styles.workDetailLabel}>@ 함께</Text>
                      <Text style={styles.workDetailValue}>{selectedWork.work_partner}</Text>
                    </View>
                  )}
                  {selectedWork?.due_date && (
                    <View style={styles.workDetailRow}>
                      <Text style={styles.workDetailLabel}>날짜</Text>
                      <Text style={styles.workDetailValue}>{formatMonthDayTime(selectedWork.due_date) || selectedWork.due_date}</Text>
                    </View>
                  )}
                  {selectedWork?.work_priority && (
                    <View style={styles.workDetailRow}>
                      <Text style={styles.workDetailLabel}>우선순위</Text>
                      <Text style={styles.workDetailValue}>
                        {selectedWork.work_priority === '높음' ? '🔴' :
                        selectedWork.work_priority === '낮음' ? '🟢' : '🟡'} {selectedWork.work_priority}
                      </Text>
                    </View>
                  )}
                  {selectedWork?.work_status && (
                    <View style={styles.workDetailRow}>
                      <Text style={styles.workDetailLabel}>상태</Text>
                      <Text style={styles.workDetailValue}>{selectedWork.work_status}</Text>
                    </View>
                  )}
                </View>

                {/* 원문 */}
                {selectedWork?.text !== selectedWork?.summary && (
                  <View style={styles.workDetailMemo}>
                    <Text style={styles.workDetailMemoLabel}>메모</Text>
                    <Text style={styles.workDetailMemoText}>{selectedWork?.text}</Text>
                  </View>
                )}

                {/* 완료 버튼 */}
                <TouchableOpacity
                  style={[
                    styles.workCompleteBtn,
                    selectedWork?.work_status === '완료' && {backgroundColor: '#f5f5f5'},
                  ]}
                  onPress={async () => {
                    await toggleTodo(selectedWork.id, selectedWork.work_status);
                    setSelectedWork(null);
                    loadData();
                  }}>
                  <Text style={[
                    styles.workCompleteBtnText,
                    selectedWork?.work_status === '완료' && {color: '#999'},
                  ]}>
                    {selectedWork?.work_status === '완료' ? '↩️ 완료 취소' : '✓ 완료 처리'}
                  </Text>
                </TouchableOpacity>

                <View style={{height: 20}} />
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* 지출 탭 */}
        {activeTab === 'expense' && (
          <View style={{ flex: 1 }}>
            {/* 🌟 [추가] 내역 / 분석 세부 탭 버튼 */}
            <View style={[styles.subTabRow, {backgroundColor: colors.inputBg}]}> 
              <TouchableOpacity
                style={[
                  styles.subTabBtn,
                  {backgroundColor: expenseSubTab === 'list' ? colors.card : 'transparent'},
                  expenseSubTab === 'list' && styles.subTabBtnActive,
                ]}
                onPress={() => setExpenseSubTab('list')}>
                <Text style={[
                  styles.subTabKey,
                  {color: expenseSubTab === 'list' ? colors.text : colors.subText},
                  expenseSubTab === 'list' && styles.subTabKeyActive,
                ]}>내역</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.subTabBtn,
                  {backgroundColor: expenseSubTab === 'analysis' ? colors.card : 'transparent'},
                  expenseSubTab === 'analysis' && styles.subTabBtnActive,
                ]}
                onPress={() => setExpenseSubTab('analysis')}>
                <Text style={[
                  styles.subTabKey,
                  {color: expenseSubTab === 'analysis' ? colors.text : colors.subText},
                  expenseSubTab === 'analysis' && styles.subTabKeyActive,
                ]}>분석</Text>
              </TouchableOpacity>
            </View>

            {/* ----------------------------------------------------------------- */}
            {/* 📝 [내역 탭 선택 시]: 기존 필터와 목록 화면 */}
            {/* ----------------------------------------------------------------- */}
            {expenseSubTab === 'list' && (
              <View>
                {/* 총 지출 */}
                <View style={[styles.totalBox, {backgroundColor: colors.card, borderColor: colors.border}]}>
                  <Text style={[styles.totalLabel, {color: colors.subText, fontSize: fontSize(13)}]}>이번 달 총 지출</Text>
                  <Text style={[styles.totalAmount, {color: colors.text, fontSize: fontSize(26)}]}>
                    ₩{totalExpense.toLocaleString()}
                  </Text>
                </View>

                {/* 정렬 필터 */}
                <View style={styles.expenseFilterRow}>
                  {['날짜순', '카페', '식사', '쇼핑', '교통', '의료', '구독', '기타'].map(filter => (
                    <TouchableOpacity
                      key={filter}
                      style={[
                        styles.expenseFilterBtn,
                        {backgroundColor: expenseFilter === filter ? colors.primary : colors.inputBg},
                      ]}
                      onPress={() => setExpenseFilter(filter)}>
                      <Text style={[
                        styles.expenseFilterText,
                        {color: expenseFilter === filter ? '#fff' : colors.subText, fontSize: fontSize(12)},
                        expenseFilter === filter && styles.expenseFilterTextActive,
                      ]}>
                        {filter}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={[styles.sectionTitle, {color: colors.subText, fontSize: fontSize(13)}]}>지출 내역</Text>
                {expenseEntries.length === 0 ? (
                  <Text style={[styles.emptyText, {color: colors.subText, fontSize: fontSize(13)}]}>지출 기록이 없어요.</Text>
                ) : (
                  expenseEntries
                    .filter(e => expenseFilter === '날짜순' || e.sub_category === expenseFilter)
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
                    .map(entry => (
                      <Swipeable
                        key={entry.id}
                        renderRightActions={() => renderSwipeActions(entry)}
                        rightThreshold={100}
                        onSwipeableOpen={async () => {
                          await handleDeleteEntry(entry);
                        }}>
                        <TouchableOpacity
                          style={[styles.expenseCard, {backgroundColor: colors.card, borderColor: colors.border}]}
                          onPress={() => setSelectedExpense(entry)}>
                          <View style={styles.expenseLeft}>
                            <Text style={[styles.expenseAmount, {color: colors.primary, fontSize: fontSize(15)}]}>
                              ₩{entry.amount?.toLocaleString()}
                            </Text>
                            <Text style={[styles.expenseDate, {color: colors.subText, fontSize: fontSize(11)}]}>
                              {entry.created_at?.slice(0, 10)}
                            </Text>
                          </View>
                          <View style={{flex: 1}}>
                            <Text style={[styles.expenseText, {color: colors.text, fontSize: fontSize(14)}]} numberOfLines={1}>
                              {entry.summary || entry.text}
                            </Text>
                            {entry.sub_category && (
                              <View style={styles.diaryTag}>
                                <Text style={styles.diaryTagText}>{entry.sub_category}</Text>
                              </View>
                            )}
                          </View>
                        </TouchableOpacity>
                      </Swipeable>
                    ))
                )}
              </View>
            )}

            {/* ----------------------------------------------------------------- */}
            {/* 📊 [분석 탭 선택 시]: 새로운 대시보드 화면 */}
            {/* ----------------------------------------------------------------- */}
            {expenseSubTab === 'analysis' && (() => {
              // 💡 실시간 데이터 분석 엔진
              const currentMonthStr = new Date().toISOString().slice(0, 7); // 예: "2026-05"
              const filteredData = expenseEntries.filter(e => e.created_at?.startsWith(currentMonthStr));

              const analysisTotal = filteredData.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
              const { colors, fontSize } = useSettings();

              // 카테고리별 그룹화 계산
              const categoryMap: Record<string, number> = {};
              filteredData.forEach(e => {
                const cat = e.sub_category || '기타';
                categoryMap[cat] = (categoryMap[cat] || 0) + (Number(e.amount) || 0);
              });

              const categoryList = Object.entries(categoryMap)
                .map(([category, amount]) => ({
                  category,
                  amount,
                  percentage: analysisTotal > 0 ? Math.round((amount / analysisTotal) * 100) : 0,
                }))
                .sort((a, b) => b.amount - a.amount);

              // 📊 [추가] 최근 7일간의 일별 지출 데이터 가공 엔진
              const getChartData = () => {
                const labels: string[] = [];
                const data: number[] = [];

                for (let i = 6; i >= 0; i--) {
                  const d = new Date();
                  d.setDate(d.getDate() - i);
                  
                  const dateStr = d.toISOString().slice(5, 10); // "05-21" 형태로 라벨링
                  const fullDateStr = d.toISOString().slice(0, 10); // "2026-05-21" 검색용

                  // 해당 날짜의 지출 항목만 필터링해서 합산
                  const dayTotal = expenseEntries
                    .filter(e => e.created_at?.startsWith(fullDateStr))
                    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

                  labels.push(dateStr);
                  data.push(dayTotal);
                }

                // 만약 7일간 지출이 전부 0원이라면 차트 오류 방지를 위해 기본값 세팅
                      const isAllZero = data.every(val => val === 0);

                      return {
                        labels,
                        datasets: [{
                          data: isAllZero ? [0, 0, 0, 0, 0, 0, 0] : data
                        }]
                      };
                    };

                    const chartData = getChartData();

                    const formatAmountLabel = (value: number) => {
                      if (value >= 10000) return `${(value / 10000).toFixed(value % 10000 === 0 ? 0 : 1)}만`;
                      if (value >= 1000) return `${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}천`;
                      return `${value}`;
                    };

                    const maxValue = Math.max(...chartData.datasets[0].data, 0);
                    // 주간 최고치에 따라 만원 단위로 스케일링 (주식 차트처럼)
                    const divisions = 4; // y축 분할 수(위에서 아래로)
                    // 최소 단위는 1만원
                    const roundupToMan = (v: number) => Math.max(10000, Math.ceil(v / 10000) * 10000);
                    let top = roundupToMan(maxValue);
                    // 계산된 step(만원 단위로 올림) — 상단 레이블을 divisions*step 형태로 맞춤
                    let step = Math.max(10000, Math.ceil(top / divisions / 10000) * 10000);
                    // 보장: top은 step * divisions 이상이 되어야 하므로 필요시 증가
                    while (step * divisions < top) {
                      step += 10000;
                    }
                    top = step * divisions;

                    const yAxisLabels: string[] = [];
                    for (let i = divisions; i >= 0; i--) {
                      const value = step * i;
                      yAxisLabels.push(value === 0 ? '0' : `${value / 10000}만`);
                    }

              // 카테고리별 이모지 매핑 서비스
              const emojiMap: Record<string, string> = {
                '식사': '🍕', '카페': '☕', '쇼핑': '🛒', '교통': '🚌', 
                '의료': '🏥', '구독': '📅', '기타': '💰'
              };

              return (
                <View style={{ flex: 1, marginTop: 8 }}>
                  
                  {/* 1. 토글 스위치 삭제됨 (이번 달 전용 화면으로 고정) */}

                  {/* 2. 이번 달 총 지출 카드 및 ✨ AI 한마디 */}
                  <View style={[styles.analysisTotalCard, {backgroundColor: colors.card, borderColor: colors.border}]}> 
                    <Text style={[styles.analysisTotalLabel, {color: colors.subText, fontSize: fontSize(13)}]}> 
                      이번 달 총 지출
                    </Text>
                    <Text style={[styles.analysisTotalAmount, {color: colors.text, fontSize: fontSize(28)}]}>
                      ₩{analysisTotal.toLocaleString()}
                    </Text>
                    
                    <View style={[styles.aiBriefBox, {backgroundColor: colors.inputBg, borderColor: colors.border}]}> 
                      <Text style={[styles.aiBriefText, {color: colors.text, fontSize: fontSize(13)}]}> 
                        {isAiLoading ? '🤖 소비 패턴을 분석중이에요...' : `✨ ${aiFeedback}`}
                      </Text>
                    </View>
                  </View>

                  {/* 3. 📈 일별 지출 추이 (선 그래프) */}
                  <View style={[styles.chartContainer, {backgroundColor: colors.card, borderColor: colors.border}]}> 
                    <Text style={[styles.chartTitle, {color: colors.text, fontSize: fontSize(15)}]}>📉 일별 지출 추이 (최근 7일)</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 20, height: 190, justifyContent: 'space-between', paddingVertical: 8, marginRight: 12 }}>
                        {yAxisLabels.map((label, index) => (
                          <Text key={`y-label-${index}`} style={[styles.yAxisLabel, {color: colors.subText, fontSize: fontSize(12)}]}>
                            {String(label || '0')}
                          </Text>
                        ))}
                      </View>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ paddingRight: 12 }}>
                        <LineChart
                          data={chartData}
                          width={Math.max((chartData.labels?.length || 7) * 72 + 80, 320)}
                          height={190}
                          yAxisLabel=""
                          withHorizontalLabels={false}
                          fromZero
                          segments={4}
                          formatYLabel={() => ''}
                          chartConfig={{
                            backgroundColor: colors.card,
                            backgroundGradientFrom: colors.card,
                            backgroundGradientTo: colors.card,
                            decimalPlaces: 0,
                            color: (opacity = 1) => `rgba(37, 99, 235, ${opacity})`,
                            labelColor: (opacity = 1) => `rgba(71, 85, 105, ${opacity})`,
                            propsForDots: { r: '4', strokeWidth: '2', stroke: colors.primary },
                            propsForBackgroundLines: { stroke: colors.border, strokeDasharray: '4' },
                            style: { borderRadius: 20 },
                          }}
                          bezier
                          style={{
                            borderRadius: 20,
                            paddingRight: 28,
                            paddingLeft: 8,
                          }}
                        />
                      </ScrollView>
                    </View>
                  </View>

                  {/* 4. 📊 카테고리별 분석 */}
                  <Text style={[styles.sectionTitle, {color: colors.subText, fontSize: fontSize(13)}]}>카테고리별 분석</Text>
                  {categoryList.length === 0 ? (
                    <Text style={[styles.emptyText, {color: colors.subText, fontSize: fontSize(13)}]}>분석할 지출 데이터가 없어요.</Text>
                  ) : (
                    // 💡 괄호 짝을 완벽하게 맞추고 내부 오타를 수정한 올바른 map 루프입니다.
                    categoryList.map((item) => (
                      <View key={item.category} style={[styles.analyticsRow, {backgroundColor: colors.card, borderColor: colors.border}]}> 
                        <View style={styles.analyticsHeaderInfo}>
                          <Text style={[styles.analyticsCatText, {color: colors.text, fontSize: fontSize(15)}]}> 
                            {emojiMap[item.category] || '💰'} {item.category}
                          </Text>
                          <Text style={[styles.analyticsAmountText, {color: colors.subText, fontSize: fontSize(13)}]}> 
                            ₩{item.amount.toLocaleString()} ({item.percentage}%)
                          </Text>
                        </View>
                        
                        {/* 📊 게이지 바 */}
                        <View style={[styles.gaugeBackground, {backgroundColor: colors.inputBg}]}> 
                          {/* 💡 핵심 수정: '${item.percentage}%' 대신 키보드 숫자 1 왼쪽에 있는 백틱(`) 기호를 정확히 사용해야 합니다. */}
                          <View style={[styles.gaugeFill, { width: `${item.percentage}%`, backgroundColor: colors.primary }]} />
                        </View>
                      </View>
                    )) // 💡 여기서 맵 함수의 소괄호 )가 정확히 닫혀야 에러가 안 납니다.
                  )}
                  <View style={{ height: 40 }} /> {/* 맨 아래 여백 */}
                </View>
              );
            })()}
          </View>
        )}

        {/* 지출 상세 보기 */}
        <Modal
          visible={!!selectedExpense}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedExpense(null)}>
          <View style={styles.modal}>
            <View style={[styles.modalContent, {backgroundColor: colors.card}] }>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>지출 상세</Text>
                <View style={{flexDirection: 'row', gap: 8}}>
                  <TouchableOpacity
                    style={[styles.modalClose, {backgroundColor: '#FAEEDA'}]}
                    onPress={() => {
                      setSelectedExpense(null);
                      setEditEntry(selectedExpense);
                      setEditVisible(true);
                    }}>
                    <Text style={{fontSize: 14, color: '#854F0B'}}>✏️</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.modalClose}
                    onPress={() => setSelectedExpense(null)}>
                    <Text style={styles.modalCloseText}>✕</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.modalMeta}>
                <Text style={styles.modalEmoji}>💰</Text>
                <View>
                  <Text style={[styles.modalDate, {fontSize: 22, fontWeight: '700', color: '#BA7517'}]}>
                    ₩{selectedExpense?.amount?.toLocaleString()}
                  </Text>
                  <Text style={styles.modalDate}>{selectedExpense?.created_at?.slice(0, 10)}</Text>
                </View>
              </View>

              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {selectedExpense?.sub_category && (
                  <View style={[styles.diaryTag, {marginBottom: 12, alignSelf: 'flex-start'}]}>
                    <Text style={styles.diaryTagText}>{selectedExpense.sub_category}</Text>
                  </View>
                )}
                <Text style={styles.modalText}>
                  {selectedExpense?.text}
                </Text>
                {selectedExpense?.summary && (
                  <View style={styles.modalSummaryBox}>
                    <Text style={styles.modalSummaryLabel}>✨ AI 요약</Text>
                    <Text style={styles.modalSummary}>{selectedExpense.summary}</Text>
                  </View>
                )}
                <View style={{height: 20}} />
              </ScrollView>
            </View>
          </View>
        </Modal>



        {/* 약속 탭 */}
        {activeTab === 'appointment' && (
          <View>
            <Text style={styles.sectionTitle}>약속 목록</Text>
            {appointmentEntries.length === 0 ? (
              <Text style={styles.emptyText}>약속 기록이 없어요.</Text>
            ) : (
              [...appointmentEntries]
                .sort((a, b) => {
                  const dateA = new Date(a.appointment_date || a.created_at || 0).getTime();
                  const dateB = new Date(b.appointment_date || b.created_at || 0).getTime();
                  return dateA - dateB;
                })
                .map(entry => (
                  <Swipeable
                    key={entry.id}
                    renderRightActions={() => renderSwipeActions(entry)}
                    rightThreshold={100}
                    onSwipeableOpen={async () => {
                      await handleDeleteEntry(entry);
                    }}>
                    <TouchableOpacity
                      style={styles.appointmentCard}
                      onPress={() => setSelectedAppointment(entry)}>
                      <View style={styles.appointmentRight}>
                        <Text style={styles.appointmentText}>
                          {entry.summary || entry.text}
                        </Text>
                        <View style={styles.appointmentMetaRow}>
                          {entry.appointment_date && (
                            <Text style={styles.appointmentMetaText} numberOfLines={1}>
                              🕒 {formatMonthDayTime(entry.appointment_date) || entry.appointment_date}
                            </Text>
                          )}
                          {entry.work_partner && (
                            <Text style={styles.appointmentMetaText} numberOfLines={1}>
                              👤 {entry.work_partner}
                            </Text>
                          )}
                          {entry.location && (
                            <Text style={styles.appointmentMetaText} numberOfLines={1}>
                              📍 {entry.location}
                            </Text>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                  </Swipeable>
                ))
            )}
          </View>
        )}
        {/* 업무 탭 */}
        {activeTab === 'work' && (
          <View>
            {/* 다가오는 일정 */}
            {(() => {
              const workEntries = entries.filter(e => {
                try { return JSON.parse(e.categories || '[]').includes('work'); }
                catch { return false; }
              });

              const scheduled = workEntries
                .filter(e => e.due_date && e.work_status !== '완료')
                .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());

              // 할일 = is_todo가 1이거나 due_date가 없는 것
              const todos = workEntries.filter(e => e.is_todo === 1 || !e.due_date);
              const todosPending = todos.filter(e => e.work_status !== '완료');
              const todosDone = todos.filter(e => e.work_status === '완료');

              const getDday = (dateStr: string) => {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const due = new Date(dateStr);
                due.setHours(0, 0, 0, 0);
                const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (diff === 0) return 'D-day';
                if (diff > 0) return `D-${diff}`;
                return `D+${Math.abs(diff)}`;
              };

              const getPriorityColor = (priority: string) => {
                if (priority === '높음') return '#E53E3E';
                if (priority === '낮음') return '#3B6D11';
                return '#BA7517';
              };

              const getWorkIcon = (subCategory: string) => {
                if (subCategory === '미팅') return '🤝';
                if (subCategory === '발표') return '🎤';
                if (subCategory === '마감') return '📋';
                if (subCategory === 'D-day') return '📅';
                if (subCategory === '보고') return '📊';
                return '💼';
              };

              return (
                <>
                  {/* 다가오는 일정 */}
                  <View style={styles.workSection}>
                    <Text style={styles.sectionTitle}>다가오는 일정</Text>
                    {scheduled.length === 0 ? (
                      <Text style={styles.emptyText}>다가오는 일정이 없어요.</Text>
                    ) : (
                      scheduled.map(entry => (
                        <Swipeable
                          key={entry.id}
                          renderRightActions={() => renderSwipeActions(entry)}
                          rightThreshold={100}
                          onSwipeableOpen={async () => {
                            await handleDeleteEntry(entry);
                          }}>
                          <TouchableOpacity
                            style={styles.workScheduleCard}
                            onPress={() => setSelectedWork(entry)}>
                            <View style={styles.workDdayBox}>
                              <Text style={styles.workDday}>{getDday(entry.due_date)}</Text>
                            </View>
                            <View style={styles.workCardContent}>
                              <View style={styles.workCardHeader}>
                                <Text style={styles.workCardTitle}>
                                  {getWorkIcon(entry.sub_category)} {entry.summary || entry.text}
                                </Text>
                                {entry.work_priority && (
                                  <View style={[styles.priorityDot, {backgroundColor: getPriorityColor(entry.work_priority)}]} />
                                )}
                              </View>
                              {entry.work_partner && (
                                <Text style={styles.workPartner}>@ {entry.work_partner}</Text>
                              )}
                              <Text style={styles.workDate}>{formatMonthDayTime(entry.due_date) || entry.due_date}</Text>
                            </View>
                          </TouchableOpacity>
                        </Swipeable>
                      ))
                    )}
                  </View>

                  {/* 할일 체크리스트 */}
                  <View style={styles.workSection}>
                    <Text style={styles.sectionTitle}>할일</Text>
                    {todosPending.length === 0 && todosDone.length === 0 ? (
                      <Text style={styles.emptyText}>할일이 없어요.</Text>
                    ) : (
                      <>
                        {todosPending.map(entry => (
                          <Swipeable
                            key={entry.id}
                            renderRightActions={() => renderSwipeActions(entry)}
                            rightThreshold={100}
                            onSwipeableOpen={async () => {
                              await handleDeleteEntry(entry);
                            }}>
                            <TouchableOpacity
                              style={styles.todoCard}
                              onPress={() => setSelectedWork(entry)}>
                              <TouchableOpacity
                                style={styles.todoCheckbox}
                                onPress={async () => {
                                  await toggleTodo(entry.id, entry.work_status);
                                  loadData();
                                }}>
                                <Text style={styles.todoCheckIcon}>☐</Text>
                              </TouchableOpacity>
                              <View style={styles.todoContent}>
                                <Text style={styles.todoText}>
                                  {entry.summary || entry.text}
                                </Text>
                                {entry.work_priority && (
                                  <Text style={[styles.priorityLabel, {color: getPriorityColor(entry.work_priority)}]}>
                                    {entry.work_priority === '높음' ? '🔴' : entry.work_priority === '낮음' ? '🟢' : '🟡'} {entry.work_priority}
                                  </Text>
                                )}
                              </View>
                            </TouchableOpacity>
                          </Swipeable>
                        ))}

                        {/* 완료된 할일 */}
                        {todosDone.length > 0 && (
                          <>
                            <Text style={[styles.sectionTitle, {marginTop: 16}]}>완료</Text>
                            {todosDone.map(entry => (
                              <TouchableOpacity key={entry.id} style={[styles.todoCard, {opacity: 0.5}]} onPress={() => setSelectedWork(entry)}>
                                <TouchableOpacity
                                  style={styles.todoCheckbox}
                                  onPress={async () => {
                                    await toggleTodo(entry.id, entry.work_status);
                                    loadData();
                                  }}>
                                  <Text style={styles.todoCheckIcon}>☑</Text>
                                </TouchableOpacity>
                                <View style={styles.todoContent}>
                                  <Text style={[styles.todoText, {textDecorationLine: 'line-through', color: '#aaa'}]}>
                                    {entry.summary || entry.text}
                                  </Text>
                                </View>
                              </TouchableOpacity>
                            ))}
                          </>
                        )}
                      </>
                    )}
                  </View>
                </>
              );
            })()}
          </View>
        )}

        {/* 운동 탭 */}
        {activeTab === 'exercise' && (
          <View>
            {/* 주간 운동 통계 */}
            <View style={styles.exerciseSummaryBox}>
              <Text style={styles.exerciseSummaryTitle}>이번 달 운동 통계</Text>
              <View style={styles.exerciseStatsRow}>
                <View style={styles.exerciseStat}>
                  <Text style={styles.exerciseStatVal}>
                    {entries.filter(e => {
                      try { return JSON.parse(e.categories || '[]').includes('exercise'); }
                      catch { return false; }
                    }).length}
                  </Text>
                  <Text style={styles.exerciseStatLbl}>운동 횟수</Text>
                </View>
                <View style={styles.exerciseStat}>
                  <Text style={styles.exerciseStatVal}>
                    {entries.filter(e => {
                      try { return JSON.parse(e.categories || '[]').includes('exercise'); }
                      catch { return false; }
                    }).reduce((sum, e) => sum + (e.exercise_minutes || 0), 0)}분
                  </Text>
                  <Text style={styles.exerciseStatLbl}>총 운동 시간</Text>
                </View>
                <View style={styles.exerciseStat}>
                  <Text style={styles.exerciseStatVal}>
                    {entries.filter(e => {
                      try { return JSON.parse(e.categories || '[]').includes('exercise'); }
                      catch { return false; }
                    }).reduce((sum, e) => sum + (e.exercise_calories || 0), 0)}
                  </Text>
                  <Text style={styles.exerciseStatLbl}>총 칼로리(kcal)</Text>
                </View>
              </View>
            </View>

            <Text style={styles.sectionTitle}>운동 기록</Text>
            {entries.filter(e => {
              try { return JSON.parse(e.categories || '[]').includes('exercise'); }
              catch { return false; }
            }).length === 0 ? (
              <Text style={styles.emptyText}>운동 기록이 없어요.</Text>
            ) : (
              entries.filter(e => {
                try { return JSON.parse(e.categories || '[]').includes('exercise'); }
                catch { return false; }
              }).map(entry => (
                <Swipeable
                  key={entry.id}
                  renderRightActions={() => renderSwipeActions(entry)}
                  rightThreshold={100}
                  onSwipeableOpen={async () => {
                    await handleDeleteEntry(entry);
                  }}>
                  <View key={entry.id} style={styles.exerciseCard}>
                    <Text style={styles.exerciseEmoji}>🏃</Text>
                    <View style={styles.appointmentRight}>
                      <Text style={styles.appointmentText}>
                        {entry.summary || entry.text}
                      </Text>
                      <View style={{flexDirection: 'row', gap: 8, marginTop: 3}}>
                        {entry.exercise_minutes ? (
                          <Text style={styles.exercisePill}>
                            ⏱️ {entry.exercise_minutes}분
                          </Text>
                        ) : null}
                        {entry.exercise_calories ? (
                          <Text style={styles.exercisePill}>
                            🔥 {entry.exercise_calories}kcal
                          </Text>
                        ) : null}
                      </View>
                      <Text style={styles.appointmentDate}>
                        {entry.exercise_type && `${entry.exercise_type} · `}
                        {entry.created_at?.slice(0, 10)}
                      </Text>
                    </View>
                  </View>
                </Swipeable>
              ))
            )}
          </View>
        )}

        {/* 건강 탭 */}
        {activeTab === 'health' && (
          <View>
            <Text style={styles.sectionTitle}>건강 기록</Text>
            {entries.filter(e => {
              try { return JSON.parse(e.categories || '[]').includes('health'); }
              catch { return false; }
            }).length === 0 ? (
              <Text style={styles.emptyText}>건강 기록이 없어요.</Text>
            ) : (
              entries.filter(e => {
                try { return JSON.parse(e.categories || '[]').includes('health'); }
                catch { return false; }
              }).map(entry => (
                <Swipeable
                  key={entry.id}
                  renderRightActions={() => renderSwipeActions(entry)}
                  rightThreshold={100}
                  onSwipeableOpen={async () => {
                    await handleDeleteEntry(entry);
                  }}>
                  <View key={entry.id} style={styles.appointmentCard}>
                    <View style={[styles.appointmentDot, {backgroundColor: '#E53E3E'}]} />
                    <View style={styles.appointmentRight}>
                      <Text style={styles.appointmentText}>
                        {entry.summary || entry.text}
                      </Text>
                      <Text style={styles.appointmentDate}>
                        {entry.sub_category && `${entry.sub_category} · `}
                        {entry.created_at?.slice(0, 10)}
                      </Text>
                    </View>
                  </View>
                </Swipeable>
              ))
            )}
          </View>
        )}

        {/* 학습 탭 */}
        {activeTab === 'study' && (
          <View>
            <Text style={styles.sectionTitle}>학습 기록</Text>
            {entries.filter(e => {
              try { return JSON.parse(e.categories || '[]').includes('study'); }
              catch { return false; }
            }).length === 0 ? (
              <Text style={styles.emptyText}>학습 기록이 없어요.</Text>
            ) : (
              entries.filter(e => {
                try { return JSON.parse(e.categories || '[]').includes('study'); }
                catch { return false; }
              }).map(entry => (
                <Swipeable
                  key={entry.id}
                  renderRightActions={() => renderSwipeActions(entry)}
                  rightThreshold={100}
                  onSwipeableOpen={async () => {
                    await handleDeleteEntry(entry);
                  }}>
                  <View key={entry.id} style={styles.appointmentCard}>
                    <View style={[styles.appointmentDot, {backgroundColor: '#2B6CB0'}]} />
                    <View style={styles.appointmentRight}>
                      <Text style={styles.appointmentText}>
                        {entry.summary || entry.text}
                      </Text>
                      <Text style={styles.appointmentDate}>
                        {entry.sub_category && `${entry.sub_category} · `}
                        {entry.created_at?.slice(0, 10)}
                      </Text>
                    </View>
                  </View>
                </Swipeable>
              ))
            )}
          </View>
        )}

        {/* 여행 탭 */}
        {activeTab === 'travel' && (
          <View>
            <Text style={styles.sectionTitle}>여행 기록</Text>
            {entries.filter(e => {
              try { return JSON.parse(e.categories || '[]').includes('travel'); }
              catch { return false; }
            }).length === 0 ? (
              <Text style={styles.emptyText}>여행 기록이 없어요.</Text>
            ) : (
              entries.filter(e => {
                try { return JSON.parse(e.categories || '[]').includes('travel'); }
                catch { return false; }
              }).map(entry => (
                <Swipeable
                  key={entry.id}
                  renderRightActions={() => renderSwipeActions(entry)}
                  rightThreshold={100}
                  onSwipeableOpen={async () => {
                    await handleDeleteEntry(entry);
                  }}>
                  <View key={entry.id} style={styles.appointmentCard}>
                    <View style={[styles.appointmentDot, {backgroundColor: '#38A169'}]} />
                    <View style={styles.appointmentRight}>
                      <Text style={styles.appointmentText}>
                        {entry.summary || entry.text}
                      </Text>
                      <Text style={styles.appointmentDate}>
                        {entry.sub_category && `${entry.sub_category} · `}
                        {entry.created_at?.slice(0, 10)}
                      </Text>
                    </View>
                  </View>
                </Swipeable>
              ))
            )}
          </View>
        )}
              </ScrollView>
            </View>
          );
        }

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#fff'},
  content: {flex: 1, padding: 20, paddingTop: 12},
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  emptyText: {fontSize: 13, color: '#aaa', textAlign: 'center', marginTop: 40},
  // 감정
  emotionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  emotionEmoji: {fontSize: 24},
  emotionRight: {flex: 1},
  emotionText: {fontSize: 13, color: '#1a1a1a'},
  emotionMeta: {fontSize: 11, color: '#999', marginTop: 3},
  // 지출
  totalBox: {
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  totalLabel: {fontSize: 12, color: '#475569', marginBottom: 4, fontWeight: '600'},
  totalAmount: {fontSize: 28, fontWeight: '700'},
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 12,
    gap: 12,
  },
  expenseLeft: {alignItems: 'flex-end', minWidth: 80},
  expenseAmount: {fontSize: 15, fontWeight: '700'},
  expenseDate: {fontSize: 11, marginTop: 2},
  expenseText: {flex: 1, fontSize: 14, fontWeight: '500'},
  // 약속
  appointmentCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 12,
    marginBottom: 8,
    gap: 10,
  },
  appointmentDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#BA7517',
    marginTop: 4,
  },
  tabScroll: {
    paddingTop: 16,
    maxHeight: 120,
    backgroundColor: '#fff',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  tab: {
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    // backgroundColor: '#fff',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tabActive: {
    backgroundColor: '#1F2937',
    borderColor: '#1F2937',
  },
  tabActiveDragging: {
    opacity: 0.9,
  },
  tabText: {
    color: '#1F2937',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#fff',
  },
  swipeActions: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 12,
  },
  swipeAction: {
    width: 70,
    height: '90%',  // 카드 높이에 맞춤
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
  },
  editSwipeAction: {
    backgroundColor: '#60A5FA',
  },
  deleteSwipeAction: {
    backgroundColor: '#F87171',
  },
  swipeActionText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 12,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#EAF3DE',
    borderRadius: 12,
    marginBottom: 8,
    gap: 10,
  },
  diaryCard: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  diaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  diaryEmoji: {fontSize: 24},
  diaryHeaderRight: {flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6},
  diaryDate: {fontSize: 12, color: '#666'},
  diaryTag: {
    backgroundColor: '#FAEEDA',
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  diaryTagText: {fontSize: 10, color: '#854F0B'},
  diaryText: {fontSize: 14, color: '#1a1a1a', lineHeight: 20},
  diarySummary: {fontSize: 12, color: '#666', marginTop: 8},
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',  // 반투명 배경
    justifyContent: 'center',            // 가운데 정렬
    alignItems: 'center',
    zIndex: 100,
    padding: 24,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 24,                    // 둥근 카드
    padding: 24,
    width: '100%',
    maxHeight: '75%',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  modalClose: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f5f5f5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {fontSize: 14, color: '#666'},
  modalMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  modalEmoji: {fontSize: 36},
  modalDate: {fontSize: 14, color: '#666', marginBottom: 4},
  modalBody: {maxHeight: 300},
  modalText: {
    fontSize: 15,
    color: '#1a1a1a',
    lineHeight: 26,
    marginBottom: 16,
  },
  modalSummaryBox: {
    backgroundColor: '#FAEEDA',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  modalSummaryLabel: {
    fontSize: 11,
    color: '#854F0B',
    fontWeight: '600',
    marginBottom: 6,
  },
  modalSummary: {fontSize: 14, color: '#412402', lineHeight: 20},
  modalEmotion: {
    fontSize: 13,
    color: '#999',
    marginTop: 8,
  },
  exerciseEmoji: {fontSize: 24},
  appointmentRight: {flex: 1},
  appointmentText: {fontSize: 13, color: '#1a1a1a', fontWeight: '600', marginBottom: 8},
  appointmentMetaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  appointmentMetaText: {
    fontSize: 11,
    color: '#666',
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginRight: 8,
    marginBottom: 6,
  },
  appointmentDate: {fontSize: 11, color: '#999', marginTop: 3},
  exerciseSummaryBox: {
    backgroundColor: '#EAF3DE',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  exerciseSummaryTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3B6D11',
    marginBottom: 12,
  },
  exerciseStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  exerciseStat: {alignItems: 'center'},
  exerciseStatVal: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3B6D11',
  },
  exerciseStatLbl: {
    fontSize: 11,
    color: '#3B6D11',
    marginTop: 2,
  },
  exercisePill: {
    fontSize: 11,
    color: '#3B6D11',
    backgroundColor: '#EAF3DE',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
  },
  workSection: {marginBottom: 20},
  workScheduleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f9f9f9',
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  workDdayBox: {
    backgroundColor: '#BA7517',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 52,
    alignItems: 'center',
  },
  workDday: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  workCardContent: {flex: 1},
  workCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 3,
  },
  workCardTitle: {fontSize: 14, fontWeight: '500', color: '#1a1a1a', flex: 1},
  priorityDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  workPartner: {fontSize: 12, color: '#BA7517', marginBottom: 2},
  workDate: {fontSize: 11, color: '#999'},
  todoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
    gap: 10,
  },
  todoCheckbox: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  todoCheckIcon: {fontSize: 22, color: '#BA7517'},
  todoContent: {flex: 1},
  todoText: {fontSize: 14, color: '#1a1a1a'},
  priorityLabel: {fontSize: 11, marginTop: 3},
  workDdayBanner: {
  backgroundColor: '#BA7517',
  borderRadius: 12,
  padding: 12,
  alignItems: 'center',
  marginBottom: 16,
  },
  workDdayBannerText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  workDetailTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 16,
    lineHeight: 26,
  },
  workDetailRows: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    gap: 10,
  },
  workDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
  },
  workDetailLabel: {fontSize: 13, color: '#999'},
  workDetailValue: {fontSize: 13, color: '#1a1a1a', fontWeight: '500'},
  workDetailMemo: {
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  workDetailMemoLabel: {
    fontSize: 11,
    color: '#999',
    marginBottom: 6,
    fontWeight: '600',
  },
  workDetailMemoText: {fontSize: 14, color: '#1a1a1a', lineHeight: 22},
  workCompleteBtn: {
    backgroundColor: '#EAF3DE',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
  },
  workCompleteBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B6D11',
  },
    appointmentDetailMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
  },
  appointmentDetailMetaText: {
    fontSize: 14,
    color: '#1a1a1a',
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  expenseFilterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  expenseFilterBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 0.5,
    borderColor: 'transparent',
  },
  expenseFilterBtnActive: {
    borderColor: 'transparent',
  },
  expenseFilterText: {fontSize: 12, fontWeight: '500'},
  expenseFilterTextActive: {fontWeight: '700'},
  // 세부 탭 디자인 (내역 / 분석)
  subTabRow: {
    flexDirection: 'row',
    borderRadius: 18,
    padding: 6,
    marginBottom: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subTabBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 14,
    marginHorizontal: 4,
    minWidth: 96,
    justifyContent: 'center',
    alignItems: 'center',
  },
  subTabBtnActive: {
    // backgroundColor: 'rgba(255,255,255,0.98)',
    borderWidth: 0,
  },
  subTabKey: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  subTabKeyActive: {
    fontWeight: '700',
  },

  // 기간 필터 (이번달 / 전체)
  periodToggleRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  periodBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    minWidth: 84,
    justifyContent: 'center',
    alignItems: 'center',
  },
  periodBtnActive: {
    borderColor: 'transparent',
  },
  periodText: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  periodTextActive: {
    fontWeight: '700',
  },

  // 대시보드 카드 디자인
  analysisTotalCard: {
    borderRadius: 18,
    padding: 20, // 내부 여백을 조금 더 주어 숨통 트이게
    borderWidth: 1,
    marginBottom: 20,
    // marginHorizontal: -10, ❌ 이거 삭제! (화면 밖으로 튀어나가게 하는 주범)
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: {width: 0, height: 4},
    shadowRadius: 12,
  },
  analysisTotalLabel: {
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  analysisTotalAmount: {
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: 0.2,
  },
  aiBriefBox: {
    borderRadius: 12, // 카드 테두리와 다르게 살짝 덜 둥글게 하면 세련됨
    padding: 14,
    borderWidth: 1,
  },
  aiBriefText: {
    fontWeight: '600',
    lineHeight: 20,
  },
  chartContainer: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1,
    padding: 16, // 차트 주변 여백 확보
    marginBottom: 20,
    // marginHorizontal: -10, ❌ 이것도 삭제!
  },
  chartTitle: {
    alignSelf: 'flex-start',
    fontWeight: '700',
    marginBottom: 14, // 차트와 타이틀 사이 간격 확보
    paddingHorizontal: 4,
  },
  yAxisLabel: {
    textAlign: 'right',
  },
  
  // 카테고리 바 컨테이너
  analyticsRow: {
    marginBottom: 12,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
  },
  analyticsHeaderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8, // 바와 글자 사이 간격 늘림
  },
  analyticsCatText: {
    fontWeight: '600',
  },
  analyticsAmountText: {
    fontWeight: '700',
  },
  gaugeBackground: {
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    width: '100%', // 💡 가득 차도록 너비 고정
  },
  gaugeFill: {
    height: '100%',
    borderRadius: 6,
  },
});

