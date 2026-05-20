import React, {createContext, useContext, useEffect, useState} from 'react';
import {loadSettings, saveSettings, AppSettings, DEFAULT_SETTINGS} from './settings';

interface SettingsContextType {
  settings: AppSettings;
  updateSetting: (key: keyof AppSettings, value: any) => Promise<void>;
  fontSize: (base: number) => number;
  colors: {
    background: string;
    card: string;
    text: string;
    subText: string;
    border: string;
    primary: string;
    inputBg: string;
  };
}

const SettingsContext = createContext<SettingsContextType>({
  settings: DEFAULT_SETTINGS,
  updateSetting: async () => {},
  fontSize: (base) => base,
  colors: {
    background: '#fff',
    card: '#f9f9f9',
    text: '#1a1a1a',
    subText: '#999',
    border: '#e0e0e0',
    primary: '#BA7517',
    inputBg: '#f5f5f5',
  },
});

export const SettingsProvider = ({children}: {children: React.ReactNode}) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  const updateSetting = async (key: keyof AppSettings, value: any) => {
    const updated = {...settings, [key]: value};
    setSettings(updated);
    await saveSettings(updated);
  };

  // 글자 크기 배율
  const fontSize = (base: number): number => {
    if (settings.fontSize === 'small') return base - 2;
    if (settings.fontSize === 'large') return base + 2;
    return base;
  };

  // 다크모드 색상
  const colors = settings.darkMode ? {
    background: '#1a1a1a',
    card: '#2a2a2a',
    text: '#ffffff',
    subText: '#aaaaaa',
    border: '#333333',
    primary: '#FAC775',
    inputBg: '#2a2a2a',
  } : {
    background: '#ffffff',
    card: '#f9f9f9',
    text: '#1a1a1a',
    subText: '#999999',
    border: '#e0e0e0',
    primary: '#BA7517',
    inputBg: '#f5f5f5',
  };

  return (
    <SettingsContext.Provider value={{settings, updateSetting, fontSize, colors}}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => useContext(SettingsContext);