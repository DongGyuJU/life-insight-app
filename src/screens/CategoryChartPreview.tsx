import React from 'react';
import { View, Text, ScrollView, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';

export default function CategoryChartPreview() {
  const labels = ['05-16','05-17','05-18','05-19','05-20','05-21','05-22'];
  // Dummy amounts (in 원)
  const data = [0, 0, 30000, 0, 0, 40000, 35000];

  const chartData = {
    labels,
    datasets: [{ data }],
  };

  // compute step in 만원 units similar to CategoryScreen logic
  const maxValue = Math.max(...data, 0);
  const divisions = 4;
  const roundupToMan = (v: number) => Math.max(10000, Math.ceil(v / 10000) * 10000);
  let top = roundupToMan(maxValue);
  let step = Math.max(10000, Math.ceil(top / divisions / 10000) * 10000);
  while (step * divisions < top) step += 10000;
  top = step * divisions;
  const yAxisLabels: string[] = [];
  for (let i = divisions; i >= 0; i--) {
    const value = step * i;
    yAxisLabels.push(value === 0 ? '0' : `${value / 10000}만`);
  }

  const colors = {
    card: '#fff',
    subText: '#718096',
    primary: '#2563eb',
    border: '#e2e8f0',
  };

  return (
    <View style={{flex:1, padding: 16}}>
      <Text style={{fontWeight:'700', marginBottom:8}}>Preview: 일별 지출 추이 (더미 데이터)</Text>
      <View style={{flexDirection:'row', alignItems:'center'}}>
        <View style={{width:56, height:190, justifyContent:'space-between', paddingVertical:8, marginRight:12}}>
          {yAxisLabels.map(l => (
            <Text key={l} style={{color: colors.subText}}>{l}</Text>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingRight:12}}>
          <LineChart
            data={chartData}
            width={Math.max((labels.length || 7) * 72 + 80, 320)}
            height={190}
            yAxisLabel=""
            withHorizontalLabels={false}
            fromZero
            segments={4}
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
            style={{borderRadius:20, paddingRight:28, paddingLeft:8}}
          />
        </ScrollView>
      </View>
    </View>
  );
}
