import AsyncStorage from '@react-native-async-storage/async-storage';

type TabType = 'diary' | 'expense' | 'appointment' | 'work' | 'exercise' | 'health' | 'study' | 'travel';

export interface AppSettings {
  fontSize: 'small' | 'medium' | 'large';
  darkMode: boolean;
  primaryColor: string;
  categories: {
    diary: boolean;      // emotion → diary
    expense: boolean;
    appointment: boolean;
    work: boolean;
    exercise: boolean;
    health: boolean;
    study: boolean;
    travel: boolean;
  };
  categoryOrder?: TabType[];
  bodyWeight: number;
  notificationEnabled: boolean;
  notificationTime: 'day_before' | 'morning' | 'both';
  reportPeriod: 'week' | 'month';
  wakeTime: string;           // "07:00"
  caffeineSensitivity: 'low' | 'medium' | 'high';
}

export const DEFAULT_SETTINGS: AppSettings = {
  fontSize: 'medium',
  darkMode: false,
  primaryColor: '#BA7517',
  categories: {
    diary: true,         // emotion → diary
    expense: true,
    appointment: true,
    work: true,
    exercise: true,
    health: false,
    study: false,
    travel: false,
  },
  categoryOrder: ['diary', 'expense', 'appointment', 'work', 'exercise', 'health', 'study', 'travel'],
  bodyWeight: 70,
  notificationEnabled: false,
  notificationTime: 'morning',
  reportPeriod: 'month',
  wakeTime: '07:00',
  caffeineSensitivity: 'medium',
};

const SETTINGS_KEY = 'app_settings';

export const loadSettings = async (): Promise<AppSettings> => {
  try {
    const raw = await AsyncStorage.getItem(SETTINGS_KEY);
    if (raw) return {...DEFAULT_SETTINGS, ...JSON.parse(raw)};
    return DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

export const saveSettings = async (settings: AppSettings): Promise<void> => {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('설정 저장 실패:', error);
  }
};