import {useSettings} from '../services/SettingsContext';
import React, {useState, useCallback} from 'react';
import {loadSettings, saveSettings, AppSettings} from '../services/settings';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from 'react-native';
import {formatMonthDayTime} from '../services/api';
import {useFocusEffect} from '@react-navigation/native';
import EditModal from '../components/EditModal';
import {updateEntry, deleteEntry} from '../database/db';
import {getAllEntries, markAsReviewed, toggleTodo} from '../database/db';
import {Swipeable} from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator } from 'react-native-draggable-flatlist';
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

  // 지출 데이터
  const expenseEntries = entries.filter(e => {
    try {
      const cats = JSON.parse(e.categories || '[]');
      return cats.includes('expense') && e.amount;
    } catch {
      return false;
    }
  });

  // 약속 데이터
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

  // const renderSwipeActions = (entry: any) => (
  //   <View style={styles.swipeActions}>
  //     <TouchableOpacity
  //       style={[styles.swipeAction, styles.editSwipeAction]}
  //       onPress={() => {
  //         setEditEntry(entry);
  //         setEditVisible(true);
  //       }}>
  //       <Text style={styles.swipeActionText}>✏️ 수정</Text>
  //     </TouchableOpacity>
  //     <TouchableOpacity
  //       style={[styles.swipeAction, styles.deleteSwipeAction]}
  //       onPress={() => handleDeleteEntry(entry)}>
  //       <Text style={styles.swipeActionText}>🗑️ 삭제</Text>
  //     </TouchableOpacity>
  //   </View>
  // );

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
            <View style={styles.modalContent}>
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
            <View style={styles.modalContent}>
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
            <View style={styles.modalContent}>
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
          <View>
            {/* 총 지출 */}
            <View style={styles.totalBox}>
              <Text style={styles.totalLabel}>이번 달 총 지출</Text>
              <Text style={styles.totalAmount}>
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
                    expenseFilter === filter && styles.expenseFilterBtnActive,
                  ]}
                  onPress={() => setExpenseFilter(filter)}>
                  <Text style={[
                    styles.expenseFilterText,
                    expenseFilter === filter && styles.expenseFilterTextActive,
                  ]}>
                    {filter}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.sectionTitle}>지출 내역</Text>
            {expenseEntries.length === 0 ? (
              <Text style={styles.emptyText}>지출 기록이 없어요.</Text>
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
                      style={styles.expenseCard}
                      onPress={() => setSelectedExpense(entry)}>
                      <View style={styles.expenseLeft}>
                        <Text style={styles.expenseAmount}>
                          ₩{entry.amount?.toLocaleString()}
                        </Text>
                        <Text style={styles.expenseDate}>
                          {entry.created_at?.slice(0, 10)}
                        </Text>
                      </View>
                      <View style={{flex: 1}}>
                        <Text style={styles.expenseText} numberOfLines={1}>
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

        {/* 지출 상세 보기 */}
        <Modal
          visible={!!selectedExpense}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setSelectedExpense(null)}>
          <View style={styles.modal}>
            <View style={styles.modalContent}>
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
                        {entry.exercise_minutes && (
                          <Text style={styles.exercisePill}>
                            ⏱️ {entry.exercise_minutes}분
                          </Text>
                        )}
                        {entry.exercise_calories && (
                          <Text style={styles.exercisePill}>
                            🔥 {entry.exercise_calories}kcal
                          </Text>
                        )}
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
  content: {flex: 1, padding: 20},
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
    backgroundColor: '#FAEEDA',
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
  },
  totalLabel: {fontSize: 12, color: '#854F0B', marginBottom: 4},
  totalAmount: {fontSize: 28, fontWeight: '600', color: '#412402'},
  expenseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#f0f0f0',
    gap: 12,
  },
  expenseLeft: {alignItems: 'flex-end', minWidth: 80},
  expenseAmount: {fontSize: 15, fontWeight: '600', color: '#BA7517'},
  expenseDate: {fontSize: 10, color: '#aaa', marginTop: 2},
  expenseText: {flex: 1, fontSize: 13, color: '#1a1a1a'},
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
    paddingTop: 60,
    maxHeight: 120,
    backgroundColor: '#fff',
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  tab: {
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
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
    backgroundColor: '#f5f5f5',
    borderWidth: 0.5,
    borderColor: '#e0e0e0',
  },
  expenseFilterBtnActive: {
    backgroundColor: '#be8d47',
    borderColor: '#806845',
  },
  expenseFilterText: {fontSize: 12, color: '#666'},
  expenseFilterTextActive: {color: '#fff', fontWeight: '600'},
});

