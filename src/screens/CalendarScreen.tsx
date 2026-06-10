import {useSettings} from '../services/SettingsContext';
import React, {useState, useCallback} from 'react';
import {
  SafeAreaView,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {getAllEntries} from '../database/db';

export default function CalendarScreen() {
  // 1. 모든 hooks 먼저
  const {colors, fontSize} = useSettings();
  const [entries, setEntries] = useState<any[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewYear, setViewYear] = useState(new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(new Date().getMonth());

  // 2. 일반 변수는 hooks 다음에
  const today = new Date();
  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  // 3. 함수들
  const loadData = async () => {
    const all = await getAllEntries();
    setEntries(all);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, []),
  );

  // 이전달
  const goPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
    setSelectedDate(null);
  };

  // 다음달
  const goNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
    setSelectedDate(null);
  };

  // 날짜별 기록 그룹핑
  // const entriesByDate: Record<string, any[]> = {};
  // entries.forEach(entry => {
  //   try {
  //     const cats = JSON.parse(entry.categories || '[]');
  //     const isAppointment = cats.includes('appointment');
  //     const date = isAppointment && entry.appointment_date
  //       ? entry.appointment_date.slice(0, 10)  
  //       : entry.created_at?.slice(0, 10);
  //     if (date) {
  //       if (!entriesByDate[date]) entriesByDate[date] = [];
  //       entriesByDate[date].push(entry);
  //     }
  //   } catch {
  //     const date = entry.created_at?.slice(0, 10);
  //     if (date) {
  //       if (!entriesByDate[date]) entriesByDate[date] = [];
  //       entriesByDate[date].push(entry);
  //     }
  //   }
  // });
  const entriesByDate: Record<string, any[]> = {};
  entries.forEach(entry => {
    try {
      const cats = JSON.parse(entry.categories || '[]');
      const isAppointment = cats.includes('appointment');
      const isWork = cats.includes('work');
      let date;
      if (isAppointment && entry.appointment_date) {
        date = entry.appointment_date.slice(0, 10);
      } else if (isWork && entry.due_date) {
        date = entry.due_date.slice(0, 10);
      } else {
        date = entry.created_at?.slice(0, 10);
      }

      if (date) {
        if (!entriesByDate[date]) entriesByDate[date] = [];
        entriesByDate[date].push(entry);
      }
    } catch {
      const date = entry.created_at?.slice(0, 10);
      if (date) {
        if (!entriesByDate[date]) entriesByDate[date] = [];
        entriesByDate[date].push(entry);
      }
    }
  });

  const selectedEntries = selectedDate ? entriesByDate[selectedDate] || [] : [];

  const getDayDots = (dateStr: string) => {
    const dayEntries = entriesByDate[dateStr] || [];
    const hasExpense = dayEntries.some(e => {
      try { return JSON.parse(e.categories || '[]').includes('expense'); }
      catch { return false; }
    });
    const hasWork = dayEntries.some(e => {
      try { return JSON.parse(e.categories || '[]').includes('work'); }
      catch { return false; }
    });
  
    const hasAppointment = dayEntries.some(e => {
      try { return JSON.parse(e.categories || '[]').includes('appointment'); }
      catch { return false; }
    });
    const hasEmotion = dayEntries.some(e => {
      try { return JSON.parse(e.categories || '[]').includes('emotion'); }
      catch { return false; }
    });
    return {hasExpense, hasAppointment, hasEmotion, hasWork, hasAny: dayEntries.length > 0};
  };

  const getEmotionEmoji = (emotion: string) => {
    if (emotion === 'positive') return '😊';
    if (emotion === 'negative') return '😔';
    return '😐';
  };

  const days = ['일', '월', '화', '수', '목', '금', '토'];

  return (
    <SafeAreaView style={[styles.safeArea, {backgroundColor: colors.background}]}> 
      <ScrollView style={[styles.container, {backgroundColor: colors.background}]}>
      {/* 헤더 + 월 이동 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.arrowBtn} onPress={goPrevMonth}>
          <Text style={styles.arrowText}>‹</Text>
        </TouchableOpacity>
        <Text style={[styles.title, {color: colors.text, fontSize: fontSize(22)}]}>
          {viewYear}년 {viewMonth + 1}월
        </Text>
        <TouchableOpacity style={styles.arrowBtn} onPress={goNextMonth}>
          <Text style={styles.arrowText}>›</Text>
        </TouchableOpacity>
      </View>

      {/* 달력 */}
      <View style={[styles.calendarBox, {backgroundColor: colors.card}]}>
        <View style={styles.dayRow}>
          {days.map(d => (
            <Text key={d} style={[styles.dayHead, {color: colors.subText, fontSize: fontSize(11)}, d === '일' && {color: '#E53E3E'}]}>
              {d}
            </Text>
          ))}
        </View>

        <View style={styles.grid}>
          {Array.from({length: firstDay}).map((_, i) => (
            <View key={`empty-${i}`} style={styles.dayCell} />
          ))}
          {Array.from({length: daysInMonth}).map((_, i) => {
            const day = i + 1;
            const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const dots = getDayDots(dateStr);

            return (
              <TouchableOpacity
                key={dateStr}
                style={[
                  styles.dayCell,
                  isToday && styles.todayCell,
                  isSelected && !isToday && styles.selectedCell,
                ]}
                onPress={() => setSelectedDate(dateStr === selectedDate ? null : dateStr)}>
                <Text
                  style={[
                      styles.dayText,
                      {color: colors.text, fontSize: fontSize(13)},
                    isToday && styles.todayText,
                    isSelected && !isToday && styles.selectedText,
                    new Date(viewYear, viewMonth, day).getDay() === 0 && styles.sundayText,
                  ]}>
                  {day}
                </Text>
                {dots.hasAny && (
                  <View style={styles.dotsRow}>
                    {dots.hasExpense && (
                      <View style={[styles.dot, {backgroundColor: '#BA7517'}]} />
                    )}
                    {dots.hasAppointment && (
                      <View style={[styles.dot, {backgroundColor: '#185FA5'}]} />
                    )}
                    {dots.hasEmotion && (
                      <View style={[styles.dot, {backgroundColor: '#3B6D11'}]} />
                    )}
                    {dots.hasWork && (
                      <View style={[styles.dot, {backgroundColor: '#6B46C1'}]} />
                    )}
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* 범례 */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, {backgroundColor: '#BA7517'}]} />
          <Text style={[styles.legendText, {fontSize: fontSize(11), color: colors.subText}]}>지출</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, {backgroundColor: '#185FA5'}]} />
          <Text style={[styles.legendText, {fontSize: fontSize(11), color: colors.subText}]}>약속</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, {backgroundColor: '#3B6D11'}]} />
          <Text style={[styles.legendText, {fontSize: fontSize(11), color: colors.subText}]}>감정</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.dot, {backgroundColor: '#6B46C1'}]} />
          <Text style={[styles.legendText, {fontSize: fontSize(11), color: colors.subText}]}>업무</Text>
        </View>
      </View>

      {/* 선택된 날짜 기록 */}
      {selectedDate && (
        <View style={[styles.selectedSection, {backgroundColor: colors.card}]}>
          <Text style={[styles.selectedDateTitle, {fontSize: fontSize(15), color: colors.text}]}>{selectedDate}</Text>
          {selectedEntries.length === 0 ? (
            <Text style={[styles.emptyText, {fontSize: fontSize(13), color: colors.subText}]}>이 날의 기록이 없어요.</Text>
          ) : (
            selectedEntries.map(entry => (
              <View key={entry.id} style={styles.entryCard}>
                <Text style={styles.entryEmoji}>
                  {entry.emotion ? getEmotionEmoji(entry.emotion) : '📝'}
                </Text>
                <View style={styles.entryRight}>
                  <Text style={[styles.entryText, {fontSize: fontSize(13), color: colors.text}]}> 
                    {entry.summary || entry.text}
                  </Text>
                  <View style={styles.tagRow}>
                    {entry.sub_category ? (
                      <View style={styles.tag}>
                        <Text style={[styles.tagText, {fontSize: fontSize(10)}]}>{entry.sub_category}</Text>
                      </View>
                    ) : null}
                    {entry.amount ? (
                      <Text style={[styles.entryAmount, {fontSize: fontSize(12), color: colors.primary}]}> 
                        ₩{entry.amount.toLocaleString()}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </View>
            ))
          )}
        </View>
      )}

      <View style={{height: 40}} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {flex: 1},
  container: {flex: 1, backgroundColor: '#fff'},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 16,
  },
  arrowBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#f5f5f5',
  },
  arrowText: {fontSize: 24, color: '#1a1a1a', lineHeight: 28},
  title: {fontSize: 20, fontWeight: '600', color: '#1a1a1a'},
  calendarBox: {
    marginHorizontal: 16,
    backgroundColor: '#f9f9f9',
    borderRadius: 16,
    padding: 12,
  },
  dayRow: {flexDirection: 'row', marginBottom: 8},
  dayHead: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: '#999',
  },
  grid: {flexDirection: 'row', flexWrap: 'wrap'},
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 8,
  },
  todayCell: {backgroundColor: '#BA7517'},
  selectedCell: {backgroundColor: '#FAEEDA'},
  dayText: {fontSize: 13, color: '#1a1a1a'},
  todayText: {color: '#fff', fontWeight: '600'},
  selectedText: {color: '#854F0B', fontWeight: '600'},
  sundayText: {color: '#E53E3E'},
  dotsRow: {flexDirection: 'row', gap: 2, marginTop: 2},
  dot: {width: 4, height: 4, borderRadius: 2},
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 12,
  },
  legendItem: {flexDirection: 'row', alignItems: 'center', gap: 4},
  legendText: {fontSize: 11, color: '#999'},
  selectedSection: {
    margin: 16,
    padding: 16,
    backgroundColor: '#f5f5f5',
    borderRadius: 16,
  },
  selectedDateTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    marginBottom: 12,
  },
  entryCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: '#e0e0e0',
  },
  entryEmoji: {fontSize: 20},
  entryRight: {flex: 1},
  entryText: {fontSize: 13, color: '#1a1a1a'},
  tagRow: {flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3},
  tag: {
    backgroundColor: '#FAEEDA',
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  tagText: {fontSize: 10, color: '#854F0B'},
  entryAmount: {fontSize: 12, color: '#BA7517', marginTop: 2},
  emptyText: {fontSize: 13, color: '#aaa', textAlign: 'center', marginTop: 8},
});