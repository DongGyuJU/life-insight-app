import React from 'react';
import {SafeAreaView, StyleSheet, Text, Platform} from 'react-native';
import Svg, {Defs, LinearGradient, Stop, Rect} from 'react-native-svg';
import {useSettings} from '../services/SettingsContext';

type Props = {title: string; subtitle?: string; noGradient?: boolean};

const GradientHeader = ({title, subtitle, noGradient}: Props) => {
  const {colors, fontSize} = useSettings();
  const start = (colors as any).gradientStart || '#1E40AF';
  const end = (colors as any).gradientEnd || '#4F46E5';
  const safeTop = Platform.OS === 'ios' ? 44 : 20;

  if (noGradient) {
    return (
      <SafeAreaView style={[styles.plainWrapper, {backgroundColor: colors.background}]}> 
        <Text style={[styles.titlePlain, {color: colors.text, fontSize: fontSize(22), paddingTop: 12, paddingHorizontal: 20}]}>{title}</Text>
        {subtitle ? <Text style={[styles.subPlain, {color: colors.subText, fontSize: fontSize(14), paddingHorizontal: 20, marginTop: 6}]}>{subtitle}</Text> : null}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.wrapper, {height: 140}]}> 
      <Svg height="100%" width="100%" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="g1" x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor={start} stopOpacity="0.95" />
            <Stop offset="1" stopColor={end} stopOpacity="0.9" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="100%" height="100%" fill="url(#g1)" />
      </Svg>
      <Text style={[styles.title, {color: 'rgba(255,255,255,0.98)', fontSize: fontSize(22), paddingTop: safeTop, paddingHorizontal: 20}]}>{title}</Text>
      {subtitle ? <Text style={[styles.sub, {color: 'rgba(255,255,255,0.88)', fontSize: fontSize(14), paddingHorizontal: 20, marginTop: 6}]}>{subtitle}</Text> : null}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  wrapper: {height: 120, position: 'relative', overflow: 'hidden'},
  content: {padding: 20, paddingTop: 30},
  title: {fontWeight: '700'},
  sub: {marginTop: 6},
  plainWrapper: {paddingBottom: 12},
  titlePlain: {fontWeight: '700'},
  subPlain: {marginTop: 6},
});

export default GradientHeader;
