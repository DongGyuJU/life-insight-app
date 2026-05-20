import RNPrint from 'react-native-print';

export const generatePDF = async (data: {
  month: string;
  totalEntries: number;
  totalExpense: number;
  positiveCount: number;
  negativeCount: number;
  appointmentCount: number;
  aiSummary: string;
  entries: any[];
}) => {
  const {
    month,
    totalEntries,
    totalExpense,
    positiveCount,
    negativeCount,
    appointmentCount,
    aiSummary,
    entries,
  } = data;

  const expenseEntries = entries.filter(e => {
    try { return JSON.parse(e.categories || '[]').includes('expense'); }
    catch { return false; }
  });

  const appointmentEntries = entries.filter(e => {
    try { return JSON.parse(e.categories || '[]').includes('appointment'); }
    catch { return false; }
  });

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, sans-serif; padding: 40px; color: #1a1a1a; }
    .cover { background: #BA7517; border-radius: 20px; padding: 40px; margin-bottom: 30px; color: white; }
    .cover-title { font-size: 48px; font-weight: bold; }
    .cover-sub { font-size: 13px; opacity: 0.8; margin-top: 8px; }
    .stats-row { display: flex; gap: 12px; margin-bottom: 24px; }
    .stat-box { flex: 1; background: #f5f5f5; border-radius: 12px; padding: 16px; }
    .stat-val { font-size: 24px; font-weight: bold; }
    .stat-lbl { font-size: 11px; color: #999; margin-top: 4px; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 11px; font-weight: bold; color: #999; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px; }
    .highlight-card { border-left: 3px solid #BA7517; padding: 10px 14px; background: #f9f9f9; margin-bottom: 8px; }
    .highlight-label { font-size: 10px; font-weight: bold; color: #BA7517; text-transform: uppercase; margin-bottom: 4px; }
    .ai-box { background: #f5f5f5; border-radius: 12px; padding: 16px; font-size: 13px; line-height: 1.6; }
    .entry-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 0.5px solid #f0f0f0; font-size: 12px; }
    .entry-amount { color: #BA7517; font-weight: bold; }
    .entry-date { color: #aaa; }
    .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #aaa; }
  </style>
</head>
<body>
  <div class="cover">
    <div style="font-size:11px;letter-spacing:2px;opacity:0.8;margin-bottom:8px">MONTHLY INSIGHT</div>
    <div class="cover-title">${month}<br>리포트</div>
    <div class="cover-sub">${month} · 기록 ${totalEntries}건</div>
  </div>

  <div class="stats-row">
    <div class="stat-box"><div class="stat-val">${totalEntries}</div><div class="stat-lbl">총 기록</div></div>
    <div class="stat-box"><div class="stat-val">₩${totalExpense.toLocaleString()}</div><div class="stat-lbl">총 지출</div></div>
    <div class="stat-box"><div class="stat-val">${positiveCount}</div><div class="stat-lbl">긍정 감정</div></div>
    <div class="stat-box"><div class="stat-val">${appointmentCount}</div><div class="stat-lbl">약속</div></div>
  </div>

  <div class="section">
    <div class="section-title">이달의 하이라이트</div>
    <div class="highlight-card">
      <div class="highlight-label">에너지</div>
      <div>${positiveCount > negativeCount ? '긍정적인 기간이었어요 😊' : negativeCount > positiveCount ? '다소 힘든 기간이었어요 😔' : '평온한 기간이었어요 😐'}</div>
    </div>
    <div class="highlight-card">
      <div class="highlight-label">지출</div>
      <div>총 ₩${totalExpense.toLocaleString()} 지출. ${expenseEntries.length}건의 지출 기록.</div>
    </div>
    <div class="highlight-card">
      <div class="highlight-label">약속</div>
      <div>이번 달 약속 ${appointmentCount}건.</div>
    </div>
  </div>

  ${aiSummary ? `
  <div class="section">
    <div class="section-title">AI 총평</div>
    <div class="ai-box">${aiSummary}</div>
  </div>` : ''}

  ${expenseEntries.length > 0 ? `
  <div class="section">
    <div class="section-title">지출 내역</div>
    ${expenseEntries.map(e => `
      <div class="entry-row">
        <span>${e.summary || e.text}</span>
        <span class="entry-amount">₩${(e.amount || 0).toLocaleString()}</span>
        <span class="entry-date">${e.created_at?.slice(0, 10)}</span>
      </div>`).join('')}
  </div>` : ''}

  ${appointmentEntries.length > 0 ? `
  <div class="section">
    <div class="section-title">약속 내역</div>
    ${appointmentEntries.map(e => `
      <div class="entry-row">
        <span>${e.summary || e.text}</span>
        <span class="entry-date">${e.appointment_date || e.created_at?.slice(0, 10)}</span>
      </div>`).join('')}
  </div>` : ''}

  <div class="footer">라이프 인사이트 · ${month} 월간 리포트</div>
</body>
</html>`;

  try {
    await RNPrint.print({html});
    return true;
  } catch (error) {
    console.error('PDF 생성 실패:', error);
    return false;
  }
};