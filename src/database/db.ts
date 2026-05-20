import SQLite from 'react-native-sqlite-storage';

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
  ];

  for (const sql of migrations) {
    try {
      await database.executeSql(sql);
    } catch (e) {
      // 이미 컬럼 있으면 무시
    }
  }
};

// 기록 저장
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
  await database.executeSql(
    `INSERT INTO entries (text, categories, sub_category, emotion, amount,
      appointment_date, location, summary, exercise_type, exercise_minutes, exercise_calories,
      work_partner, work_priority, work_status, is_todo, due_date, reviewed)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
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

// 업무 상태 업데이트
export const updateWorkStatus = async (id: number, status: string) => {
  const database = await getDB();
  await database.executeSql(
    'UPDATE entries SET work_status = ? WHERE id = ?',
    [status, id],
  );
};

// 할일 완료 토글
export const toggleTodo = async (id: number, currentStatus: string) => {
  const database = await getDB();
  const newStatus = currentStatus === '완료' ? '예정' : '완료';
  await database.executeSql(
    'UPDATE entries SET work_status = ? WHERE id = ?',
    [newStatus, id],
  );
};

// 기록 수정
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

// 기록 삭제
export const deleteEntry = async (id: number) => {
  const database = await getDB();
  await database.executeSql('DELETE FROM entries WHERE id = ?', [id]);
};

// 전체 기록 불러오기
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

// 미검토 기록 불러오기
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

// 검토 완료 처리
export const markAsReviewed = async (id: number) => {
  const database = await getDB();
  await database.executeSql('UPDATE entries SET reviewed = 1 WHERE id = ?', [id]);
};