import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import {useSettings} from '../services/SettingsContext';

const CATEGORY_LABELS: Record<string, string> = {
  diary: '📔 일기',
  expense: '💰 지출',
  appointment: '📅 약속',
  work: '💼 업무',
  exercise: '🏃 운동',
  health: '❤️ 건강',
  study: '📚 학습',
  travel: '✈️ 여행',
};

const CATEGORY_DESCS: Record<string, string> = {
  diary: '일기, 감정, 하루 기록',
  expense: '지출, 영수증, 가계부',
  appointment: '약속, 데이트, 모임',
  work: '미팅, 마감, D-day, 업무',
  exercise: '운동 종목, 시간, 칼로리',
  health: '수면, 식단, 몸무게',
  study: '공부 시간, 독서, 강의',
  travel: '여행 장소, 경비, 일정',
};

export default function SettingsScreen() {
  const {settings, updateSetting, colors, fontSize} = useSettings();
  const [weightInput, setWeightInput] = useState(String(settings.bodyWeight));

  const toggleCategory = async (cat: string) => {
    const updated = {
      ...settings.categories,
      [cat]: !settings.categories[cat as keyof typeof settings.categories],
    };
    await updateSetting('categories', updated);
  };

  const handleWeightSave = async () => {
    const weight = parseFloat(weightInput);
    if (isNaN(weight) || weight < 20 || weight > 300) {
      Alert.alert('오류', '올바른 체중을 입력해주세요 (20~300kg)');
      return;
    }
    await updateSetting('bodyWeight', weight);
    Alert.alert('저장 완료', '체중이 저장됐어요!');
  };

  return (
    <ScrollView style={[styles.container, {backgroundColor: colors.background}]}>
      <View style={styles.header}>
        <Text style={[styles.title, {color: colors.text, fontSize: fontSize(28)}]}>설정</Text>
      </View>

      {/* 디스플레이 */}
      <View style={[styles.section, {backgroundColor: colors.card}]}>
        <Text style={[styles.sectionTitle, {color: colors.text, fontSize: fontSize(14)}]}>
          🎨 디스플레이
        </Text>

        <View style={styles.row}>
          <Text style={[styles.rowLabel, {color: colors.text, fontSize: fontSize(14)}]}>
            글자 크기
          </Text>
          <View style={styles.segmented}>
            {(['small', 'medium', 'large'] as const).map(size => (
              <TouchableOpacity
                key={size}
                style={[
                  styles.segBtn,
                  {backgroundColor: colors.inputBg},
                  settings.fontSize === size && {backgroundColor: colors.primary},
                ]}
                onPress={() => updateSetting('fontSize', size)}>
                <Text style={[
                  styles.segText,
                  {color: colors.subText},
                  settings.fontSize === size && {color: '#fff', fontWeight: '600'},
                ]}>
                  {size === 'small' ? '작게' : size === 'medium' ? '보통' : '크게'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={[styles.row, {borderBottomColor: colors.border}]}>
          <View>
            <Text style={[styles.rowLabel, {color: colors.text, fontSize: fontSize(14)}]}>
              다크모드
            </Text>
            <Text style={[styles.rowDesc, {color: colors.subText, fontSize: fontSize(11)}]}>
              어두운 화면으로 전환
            </Text>
          </View>
          <Switch
            value={settings.darkMode}
            onValueChange={v => updateSetting('darkMode', v)}
            trackColor={{true: colors.primary}}
          />
        </View>
      </View>

      {/* 카테고리 */}
      <View style={[styles.section, {backgroundColor: colors.card}]}>
        <Text style={[styles.sectionTitle, {color: colors.text, fontSize: fontSize(14)}]}>
          📂 카테고리 관리
        </Text>
        <Text style={[styles.sectionDesc, {color: colors.subText, fontSize: fontSize(12)}]}>
          사용할 카테고리를 선택하면 분류 화면에 표시돼요
        </Text>
        {Object.keys(CATEGORY_LABELS).map(cat => (
          <View key={cat} style={[styles.row, {borderBottomColor: colors.border}]}>
            <View style={styles.rowLeft}>
              <Text style={[styles.rowLabel, {color: colors.text, fontSize: fontSize(14)}]}>
                {CATEGORY_LABELS[cat]}
              </Text>
              <Text style={[styles.rowDesc, {color: colors.subText, fontSize: fontSize(11)}]}>
                {CATEGORY_DESCS[cat]}
              </Text>
            </View>
            <Switch
              value={settings.categories[cat as keyof typeof settings.categories]}
              onValueChange={() => toggleCategory(cat)}
              trackColor={{true: colors.primary}}
            />
          </View>
        ))}
      </View>

      {/* 운동 설정 */}
      <View style={[styles.section, {backgroundColor: colors.card}]}>
        <Text style={[styles.sectionTitle, {color: colors.text, fontSize: fontSize(14)}]}>
          🏃 운동 설정
        </Text>
        <View style={[styles.row, {borderBottomColor: colors.border}]}>
          <View>
            <Text style={[styles.rowLabel, {color: colors.text, fontSize: fontSize(14)}]}>
              내 체중
            </Text>
            <Text style={[styles.rowDesc, {color: colors.subText, fontSize: fontSize(11)}]}>
              칼로리 계산에 사용돼요
            </Text>
          </View>
          <View style={styles.weightRow}>
            <TextInput
              style={[styles.weightInput, {
                borderColor: colors.border,
                color: colors.text,
                backgroundColor: colors.background,
              }]}
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="numeric"
              maxLength={5}
            />
            <Text style={[styles.weightUnit, {color: colors.subText}]}>kg</Text>
            <TouchableOpacity
              style={[styles.weightSaveBtn, {backgroundColor: colors.primary}]}
              onPress={handleWeightSave}>
              <Text style={styles.weightSaveText}>저장</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* 알림 설정 */}
      <View style={[styles.section, {backgroundColor: colors.card}]}>
        <Text style={[styles.sectionTitle, {color: colors.text, fontSize: fontSize(14)}]}>
          🔔 알림 설정
        </Text>
        <View style={[styles.row, {borderBottomColor: colors.border}]}>
          <View>
            <Text style={[styles.rowLabel, {color: colors.text, fontSize: fontSize(14)}]}>
              약속/미팅 알림
            </Text>
            <Text style={[styles.rowDesc, {color: colors.subText, fontSize: fontSize(11)}]}>
              약속 전에 알림을 보내드려요
            </Text>
          </View>
          <Switch
            value={settings.notificationEnabled}
            onValueChange={v => updateSetting('notificationEnabled', v)}
            trackColor={{true: colors.primary}}
          />
        </View>

        {settings.notificationEnabled && (
          <View style={[styles.subSection, {backgroundColor: colors.inputBg}]}>
            <Text style={[styles.subSectionTitle, {color: colors.subText}]}>알림 시점</Text>
            {([
              {key: 'day_before', label: '하루 전 오전 9시'},
              {key: 'morning', label: '당일 오전 9시'},
              {key: 'both', label: '하루 전 + 당일'},
            ] as const).map(item => (
              <TouchableOpacity
                key={item.key}
                style={styles.radioRow}
                onPress={() => updateSetting('notificationTime', item.key)}>
                <View style={[
                  styles.radio,
                  {borderColor: colors.border},
                  settings.notificationTime === item.key && {
                    borderColor: colors.primary,
                    backgroundColor: colors.primary,
                  },
                ]} />
                <Text style={[styles.radioLabel, {color: colors.text}]}>{item.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>

      {/* 리포트 */}
      <View style={[styles.section, {backgroundColor: colors.card}]}>
        <Text style={[styles.sectionTitle, {color: colors.text, fontSize: fontSize(14)}]}>
          📋 리포트 설정
        </Text>
        <View style={[styles.row, {borderBottomColor: colors.border}]}>
          <Text style={[styles.rowLabel, {color: colors.text, fontSize: fontSize(14)}]}>
            리포트 주기
          </Text>
          <View style={styles.segmented}>
            {(['week', 'month'] as const).map(p => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.segBtn,
                  {backgroundColor: colors.inputBg},
                  settings.reportPeriod === p && {backgroundColor: colors.primary},
                ]}
                onPress={() => updateSetting('reportPeriod', p)}>
                <Text style={[
                  styles.segText,
                  {color: colors.subText},
                  settings.reportPeriod === p && {color: '#fff', fontWeight: '600'},
                ]}>
                  {p === 'week' ? '주간' : '월간'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      <View style={{height: 40}} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1},
  header: {padding: 24, paddingTop: 60},
  title: {fontWeight: '700'},
  section: {
    marginHorizontal: 20,
    marginBottom: 24,
    borderRadius: 16,
    padding: 16,
  },
  sectionTitle: {fontWeight: '700', marginBottom: 4},
  sectionDesc: {marginBottom: 12},
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  rowLeft: {flex: 1, marginRight: 12},
  rowLabel: {fontWeight: '500'},
  rowDesc: {marginTop: 2},
  segmented: {flexDirection: 'row', gap: 4},
  segBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  segText: {fontSize: 12},
  weightRow: {flexDirection: 'row', alignItems: 'center', gap: 6},
  weightInput: {
    borderWidth: 0.5,
    borderRadius: 8,
    padding: 6,
    width: 60,
    textAlign: 'center',
    fontSize: 14,
  },
  weightUnit: {fontSize: 13},
  weightSaveBtn: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  weightSaveText: {color: '#fff', fontSize: 12, fontWeight: '500'},
  subSection: {
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  subSectionTitle: {fontSize: 12, fontWeight: '600', marginBottom: 8},
  radioRow: {flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6},
  radio: {width: 16, height: 16, borderRadius: 8, borderWidth: 2},
  radioLabel: {fontSize: 13},
});