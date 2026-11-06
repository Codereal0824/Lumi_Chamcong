const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');
const { calculateWorkHours } = require('../services/workHours');

function initializeDatabase() {
  const databasePath = path.resolve(__dirname, '..', process.env.DATABASE_PATH || './data/fieldflow.db');
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL, full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('technician', 'admin')),
      email TEXT, phone TEXT, position TEXT NOT NULL DEFAULT 'Kỹ thuật viên',
      account_status TEXT NOT NULL DEFAULT 'active' CHECK (account_status IN ('active', 'inactive')),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS attendances (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
      date TEXT NOT NULL, check_in TEXT NOT NULL, check_out TEXT NOT NULL,
      leave_days REAL NOT NULL DEFAULT 0 CHECK (leave_days IN (0, 0.5, 1)),
      early_leave_hours REAL NOT NULL DEFAULT 0, ot_hours REAL NOT NULL DEFAULT 0,
      late_minutes INTEGER NOT NULL DEFAULT 0,
      sunday_work INTEGER NOT NULL DEFAULT 0, sunday_check_in TEXT, sunday_check_out TEXT,
      field_trip_days REAL NOT NULL DEFAULT 0,
      customer_name TEXT NOT NULL DEFAULT '', note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_attendances_date ON attendances(date);
    CREATE INDEX IF NOT EXISTS idx_attendances_user ON attendances(user_id);
  `);
  const userColumns = db.prepare('PRAGMA table_info(users)').all().map(column => column.name);
  if (!userColumns.includes('email')) db.exec('ALTER TABLE users ADD COLUMN email TEXT');
  if (!userColumns.includes('phone')) db.exec('ALTER TABLE users ADD COLUMN phone TEXT');
  if (!userColumns.includes('position')) db.exec("ALTER TABLE users ADD COLUMN position TEXT NOT NULL DEFAULT 'Kỹ thuật viên'");
  if (!userColumns.includes('account_status')) db.exec("ALTER TABLE users ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active'");
  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email) WHERE email IS NOT NULL AND email <> '';
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL AND phone <> '';
    CREATE INDEX IF NOT EXISTS idx_users_position ON users(position);
    CREATE INDEX IF NOT EXISTS idx_users_status ON users(account_status);
    CREATE TABLE IF NOT EXISTS password_reset_otps (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, otp_hash TEXT NOT NULL,
      expires_at TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, used_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_password_reset_otps_user ON password_reset_otps(user_id, created_at);
    CREATE TABLE IF NOT EXISTS password_reset_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'expired', 'completed')),
      requested_at TEXT NOT NULL DEFAULT (datetime('now')), processed_at TEXT, processed_by INTEGER,
      rejection_reason TEXT, expires_at TEXT NOT NULL,
      otp_hash TEXT, otp_expires_at TEXT, otp_attempts INTEGER NOT NULL DEFAULT 0,
      otp_used_at TEXT, otp_sent_at TEXT, otp_delivery_status TEXT NOT NULL DEFAULT 'not_sent',
      completed_at TEXT,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (processed_by) REFERENCES users(id) ON DELETE SET NULL
    );
    CREATE INDEX IF NOT EXISTS idx_password_reset_requests_status ON password_reset_requests(status, requested_at);
    CREATE INDEX IF NOT EXISTS idx_password_reset_requests_user ON password_reset_requests(user_id, requested_at);
  `);
  const resetColumns = db.prepare('PRAGMA table_info(password_reset_requests)').all().map(column => column.name);
  if (!resetColumns.includes('otp_sent_at')) db.exec('ALTER TABLE password_reset_requests ADD COLUMN otp_sent_at TEXT');
  if (!resetColumns.includes('otp_delivery_status')) db.exec("ALTER TABLE password_reset_requests ADD COLUMN otp_delivery_status TEXT NOT NULL DEFAULT 'not_sent'");
  const columns = db.prepare('PRAGMA table_info(attendances)').all().map(column => column.name);
  if (!columns.includes('late_minutes')) db.exec('ALTER TABLE attendances ADD COLUMN late_minutes INTEGER NOT NULL DEFAULT 0');
  if (!columns.includes('sunday_check_in')) db.exec('ALTER TABLE attendances ADD COLUMN sunday_check_in TEXT');
  if (!columns.includes('sunday_check_out')) db.exec('ALTER TABLE attendances ADD COLUMN sunday_check_out TEXT');
  db.exec('UPDATE attendances SET early_leave_hours = -ABS(early_leave_hours) WHERE early_leave_hours > 0');
  const duplicateAttendanceCount = db.prepare(`SELECT COUNT(*) AS count FROM (
    SELECT user_id, date FROM attendances GROUP BY user_id, date HAVING COUNT(*) > 1
  )`).get().count;
  if (duplicateAttendanceCount === 0) {
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_attendances_user_date ON attendances(user_id, date)');
  } else {
    console.warn(`Found ${duplicateAttendanceCount} duplicate attendance date group(s); unique index was not created.`);
  }
  const users = [
    ['admin', 'admin123', 'Quản trị viên', 'admin'],
    ['minhanh', 'demo123', 'Nguyễn Minh Anh', 'technician'],
    ['quocbao', 'demo123', 'Trần Quốc Bảo', 'technician'],
    ['hoangnam', 'demo123', 'Lê Hoàng Nam', 'technician'],
    ['giahuy', 'demo123', 'Phạm Gia Huy', 'technician'],
    ['thanhtung', 'demo123', 'Võ Thanh Tùng', 'technician']
  ];
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, password_hash, full_name, role) VALUES (?, ?, ?, ?)');
  const hash = value => require('crypto').createHash('sha256').update(value).digest('hex');
  const seed = db.transaction(() => users.forEach(user => insertUser.run(user[0], hash(user[1]), user[2], user[3])));
  if (process.env.NODE_ENV !== 'production') seed();
  db.exec("UPDATE users SET position = 'Kỹ thuật viên' WHERE position IS NULL OR position = ''");
  if (db.prepare('SELECT COUNT(*) AS count FROM attendances').get().count === 0) {
    const insertAttendance = db.prepare(`INSERT INTO attendances
      (user_id, date, check_in, check_out, leave_days, early_leave_hours, ot_hours, sunday_work, field_trip_days, customer_name, note, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const userIds = db.prepare("SELECT id FROM users WHERE role = 'technician' ORDER BY id").all().map(row => row.id);
    const seedAttendance = db.transaction(() => Array.from({ length: 25 }, (_, index) => {
      const day = String(12 - (index % 12)).padStart(2, '0');
      insertAttendance.run(userIds[index % userIds.length], `2024-06-${day}`, index % 7 === 0 ? '08:42' : `08:2${index % 9}`, index % 4 === 0 ? '18:30' : `17:3${index % 9}`, index === 8 ? 0.5 : 0, index === 10 ? 1 : 0, [0, 1, 1.5, 2.5, 0.5][index % 5], index % 9 === 0 ? 1 : 0, index % 4 === 0 ? 1 : 0, ['Công ty TNHH ABC · Quận 7', 'Nhà phố chị Lan · Thủ Đức', 'Văn phòng GreenTech · Bình Thạnh', 'Kho vận Sài Gòn · Quận 9'][index % 4], 'Hoàn thành hạng mục lắp đặt và bàn giao.', ['approved', 'approved', 'pending', 'approved', 'pending', 'rejected'][index % 6]);
    }));
    seedAttendance();
  }
  return db;
}
module.exports = { initializeDatabase };
