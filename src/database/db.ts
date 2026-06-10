import SQLite from 'react-native-sqlite-storage';
import uuid from 'react-native-uuid'; // npm install react-native-uuid

SQLite.enablePromise(true);

const DATABASE_NAME = 'lifeinsight.db';

let db: SQLite.SQLiteDatabase;

export const getDB = async () => {
  if (db) return db;
  db = await SQLite.openDatabase({
    name: DATABASE_NAME,
    location: 'default',
  });
  await createTables(db);
  return db;
};

const createTables = async (database: SQLite.SQLiteDatabase) => {
  await database.executeSql(`
    CREATE TABLE IF NOT EXISTS entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      categories TEXT,
      sub_category TEXT,
      emotion TEXT,
      amount REAL,
      appointment_date TEXT,
      location TEXT,
      summary TEXT,
      exercise_type TEXT,
      exercise_minutes INTEGER,
      exercise_calories INTEGER,
      reviewed INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    );
  `);

  // 기존 DB에 컬럼 추가 (없으면 추가, 있으면 무시)
  const migrations = [
    `ALTER TABLE entries ADD COLUMN exercise_type TEXT`,
    `ALTER TABLE entries ADD COLUMN exercise_minutes INTEGER`,
    `ALTER TABLE entries ADD COLUMN exercise_calories INTEGER`,
    `ALTER TABLE entries ADD COLUMN sub_category TEXT`,
    `ALTER TABLE entries ADD COLUMN work_partner TEXT`,
    `ALTER TABLE entries ADD COLUMN work_priority TEXT`,
    `ALTER TABLE entries ADD COLUMN work_status TEXT`,
    `ALTER TABLE entries ADD COLUMN is_todo INTEGER DEFAULT 0`,
    `ALTER TABLE entries ADD COLUMN due_date TEXT`,
    `ALTER TABLE entries ADD COLUMN location TEXT`,
    // ── 생태계 싱크용 컬럼 추가 ──────────────────────────
    `ALTER TABLE entries ADD COLUMN uuid TEXT`,
    `ALTER TABLE entries ADD COLUMN sync_status TEXT DEFAULT 'pending'`,
    // 'pending' | 'synced' | 'failed'
  ];

  for (const sql of migrations) {
    try {
      await database.executeSql(sql);
    } catch (e) {
      // 이미 컬럼 있으면 무시
    }
  }
};

// ─────────────────────────────────────────────────────────────
// 기록 저장 (uuid 자동 생성 추가)
// ─────────────────────────────────────────────────────────────
export const saveEntry = async (entry: {
  text: string;
  categories?: string;
  sub_category?: string;
  emotion?: string;
  amount?: number;
  appointment_date?: string;
  location?: string;
  summary?: string;
  exercise_type?: string;
  exercise_minutes?: number;
  exercise_calories?: number;
  work_partner?: string;
  work_priority?: string;
  work_status?: string;
  is_todo?: number;
  due_date?: string;
  reviewed?: number;
}) => {
  const database = await getDB();
  const entryUuid = String(uuid.v4()); // ← UUID 자동 생성

  await database.executeSql(
    `INSERT INTO entries (
      uuid, text, categories, sub_category, emotion, amount,
      appointment_date, location, summary, exercise_type, exercise_minutes, exercise_calories,
      work_partner, work_priority, work_status, is_todo, due_date, reviewed,
      sync_status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
    [
      entryUuid,
      entry.text,
      entry.categories || '',
      entry.sub_category || '',
      entry.emotion || '',
      (() => {
        if (typeof entry.amount === 'undefined' || entry.amount === null) return null;
        const rawVal = String(entry.amount).replace(/[^0-9.-]/g, '');
        const num = Number(rawVal);
        return Number.isFinite(num) ? num : null;
      })(),
      entry.appointment_date || null,
      entry.location || '',
      entry.summary || '',
      entry.exercise_type || null,
      entry.exercise_minutes || null,
      entry.exercise_calories || null,
      entry.work_partner || null,
      entry.work_priority || '보통',
      entry.work_status || '예정',
      entry.is_todo || 0,
      entry.due_date || null,
      entry.reviewed || 0,
    ],
  );
};

// ─────────────────────────────────────────────────────────────
// 싱크용: pending 항목 가져오기
// ─────────────────────────────────────────────────────────────
export const getPendingEntries = async () => {
  const database = await getDB();
  const [result] = await database.executeSql(
    `SELECT * FROM entries
     WHERE sync_status = 'pending'
     AND uuid IS NOT NULL
     ORDER BY created_at ASC
     LIMIT 50`, // 한 번에 최대 50개
  );
  const entries = [];
  for (let i = 0; i < result.rows.length; i++) {
    entries.push(result.rows.item(i));
  }
  return entries;
};

// ─────────────────────────────────────────────────────────────
// 싱크용: 싱크 완료 처리
// ─────────────────────────────────────────────────────────────
export const markAsSynced = async (uuids: string[]) => {
  if (uuids.length === 0) return;
  const database = await getDB();
  const placeholders = uuids.map(() => '?').join(', ');
  await database.executeSql(
    `UPDATE entries SET sync_status = 'synced' WHERE uuid IN (${placeholders})`,
    uuids,
  );
};

// ─────────────────────────────────────────────────────────────
// 싱크용: 실패 처리
// ─────────────────────────────────────────────────────────────
export const markSyncFailed = async (uuids: string[]) => {
  if (uuids.length === 0) return;
  const database = await getDB();
  const placeholders = uuids.map(() => '?').join(', ');
  await database.executeSql(
    `UPDATE entries SET sync_status = 'failed' WHERE uuid IN (${placeholders})`,
    uuids,
  );
};

// ─────────────────────────────────────────────────────────────
// 아래는 기존 함수 전부 유지 (변경 없음)
// ─────────────────────────────────────────────────────────────

export const updateWorkStatus = async (id: number, status: string) => {
  const database = await getDB();
  await database.executeSql(
    'UPDATE entries SET work_status = ? WHERE id = ?',
    [status, id],
  );
};

export const toggleTodo = async (id: number, currentStatus: string) => {
  const database = await getDB();
  const newStatus = currentStatus === '완료' ? '예정' : '완료';
  await database.executeSql(
    'UPDATE entries SET work_status = ? WHERE id = ?',
    [newStatus, id],
  );
};

export const updateEntry = async (id: number, entry: {
  text?: string;
  categories?: string;
  sub_category?: string;
  emotion?: string;
  amount?: number;
  appointment_date?: string;
  location?: string;
  work_partner?: string;
  summary?: string;
}) => {
  const database = await getDB();
  await database.executeSql(
    `UPDATE entries SET
      text = COALESCE(?, text),
      categories = COALESCE(?, categories),
      sub_category = COALESCE(?, sub_category),
      emotion = COALESCE(?, emotion),
      amount = COALESCE(?, amount),
      appointment_date = COALESCE(?, appointment_date),
      location = COALESCE(?, location),
      work_partner = COALESCE(?, work_partner),
      summary = COALESCE(?, summary)
    WHERE id = ?`,
    [
      entry.text || null,
      entry.categories || null,
      entry.sub_category || null,
      entry.emotion || null,
      (() => {
        if (typeof entry.amount === 'undefined' || entry.amount === null) return null;
        const rawVal = String(entry.amount).replace(/[^0-9.-]/g, '');
        const num = Number(rawVal);
        return Number.isFinite(num) ? num : null;
      })(),
      entry.appointment_date || null,
      entry.location || null,
      entry.work_partner || null,
      entry.summary || null,
      id,
    ],
  );
};

export const deleteEntry = async (id: number) => {
  const database = await getDB();
  await database.executeSql('DELETE FROM entries WHERE id = ?', [id]);
};

export const getAllEntries = async () => {
  const database = await getDB();
  const [result] = await database.executeSql(
    'SELECT * FROM entries ORDER BY created_at DESC',
  );
  const entries = [];
  for (let i = 0; i < result.rows.length; i++) {
    entries.push(result.rows.item(i));
  }
  return entries;
};

export const getUnreviewedEntries = async () => {
  const database = await getDB();
  const [result] = await database.executeSql(
    'SELECT * FROM entries WHERE reviewed = 0 ORDER BY created_at DESC',
  );
  const entries = [];
  for (let i = 0; i < result.rows.length; i++) {
    entries.push(result.rows.item(i));
  }
  return entries;
};

export const markAsReviewed = async (id: number) => {
  const database = await getDB();
  await database.executeSql('UPDATE entries SET reviewed = 1 WHERE id = ?', [id]);
};

export const getMonthlyReport = async (year: number, month: number) => {
  const database = await getDB();
  const targetMonth = `${year}-${String(month).padStart(2, '0')}`;

  const [result] = await database.executeSql(
    "SELECT * FROM entries WHERE strftime('%Y-%m', created_at) = ?",
    [targetMonth],
  );

  let totalExpense = 0;
  let appointmentCount = 0;
  let diaryCount = 0;
  let totalCalories = 0;

  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows.item(i);
    let cats: string[] = [];
    try {
      cats = row.categories ? JSON.parse(row.categories) : [];
    } catch (e) {
      cats = [];
    }
    if (cats.includes('expense') && row.amount) totalExpense += row.amount;
    if (cats.includes('appointment')) appointmentCount += 1;
    if (cats.includes('diary')) diaryCount += 1;
    if (cats.includes('exercise') && row.exercise_calories) totalCalories += row.exercise_calories;
  }

  return { year, month, totalExpense, appointmentCount, diaryCount, totalCalories };
};

export const getCategoryRanking = async (year: number, month: number) => {
  const database = await getDB();
  const targetMonth = `${year}-${String(month).padStart(2, '0')}`;

  const [result] = await database.executeSql(
    "SELECT * FROM entries WHERE strftime('%Y-%m', created_at) = ?",
    [targetMonth],
  );

  let totalExpense = 0;
  let appointmentCount = 0;
  let pendingWorkCount = 0;
  let urgentWorkCount = 0;
  let extremeEmotionCount = 0;

  for (let i = 0; i < result.rows.length; i++) {
    const row = result.rows.item(i);
    let cats: string[] = [];
    try { cats = row.categories ? JSON.parse(row.categories) : []; } catch (e) {}

    if (cats.includes('expense') && row.amount) totalExpense += row.amount;
    if (cats.includes('appointment')) appointmentCount += 1;
    if (cats.includes('work') && row.work_status !== '완료') {
      pendingWorkCount += 1;
      if (row.due_date) {
        const today = new Date();
        const due = new Date(row.due_date);
        const diff = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (diff >= 0 && diff <= 3) urgentWorkCount += 1;
      }
    }
    if (cats.includes('diary')) {
      const sub = row.sub_category || '';
      if (['기쁨😊', '설렘🥰', '화남😠', '슬픔😢', '불안😰'].includes(sub)) {
        extremeEmotionCount += 1;
      }
    }
  }

  const expenseScore = Math.min((totalExpense / 100000) * 15, 100);
  const appointmentScore = Math.min(appointmentCount * 20, 100);
  const workScore = Math.min((pendingWorkCount * 5) + (urgentWorkCount * 30), 100);
  const emotionScore = Math.min(extremeEmotionCount * 20, 100);

  const rankings = [
    { category: '지출', score: expenseScore, detail: `₩${totalExpense.toLocaleString()} 지출` },
    { category: '약속', score: appointmentScore, detail: `${appointmentCount}건의 약속` },
    { category: '업무', score: workScore, detail: `마감 임박 ${urgentWorkCount}건 포함 총 ${pendingWorkCount}건 대기중` },
    { category: '감정', score: emotionScore, detail: `감정 변화가 컸던 기록 ${extremeEmotionCount}건` },
  ].sort((a, b) => b.score - a.score);

  return rankings.filter(r => r.score > 0).slice(0, 2);
};