-- FieldFlow SQL Server schema (run this script in SQL Server Management Studio).
-- Create a database first, then execute the script inside that database.
CREATE TABLE Users (
  id INT IDENTITY(1,1) PRIMARY KEY,
  username NVARCHAR(30) NOT NULL UNIQUE,
  password_hash VARCHAR(64) NOT NULL,
  full_name NVARCHAR(150) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('technician', 'admin')),
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
);

CREATE TABLE Attendances (
  id INT IDENTITY(1,1) PRIMARY KEY,
  user_id INT NOT NULL,
  [date] DATE NOT NULL,
  check_in TIME(0) NOT NULL,
  check_out TIME(0) NOT NULL,
  leave_days DECIMAL(2,1) NOT NULL DEFAULT 0 CHECK (leave_days IN (0, 0.5, 1)),
  early_leave_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
  ot_hours DECIMAL(5,2) NOT NULL DEFAULT 0,
  late_minutes INT NOT NULL DEFAULT 0,
  sunday_work BIT NOT NULL DEFAULT 0,
  sunday_check_in TIME(0) NULL,
  sunday_check_out TIME(0) NULL,
  field_trip_days DECIMAL(5,2) NOT NULL DEFAULT 0,
  customer_name NVARCHAR(255) NOT NULL DEFAULT '',
  note NVARCHAR(MAX) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  updated_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
  CONSTRAINT FK_Attendances_Users FOREIGN KEY (user_id) REFERENCES Users(id)
);

CREATE INDEX IX_Attendances_Date ON Attendances([date]);
CREATE INDEX IX_Attendances_User ON Attendances(user_id);

-- Tài khoản admin mẫu. Đổi mật khẩu trước khi dùng production.
INSERT INTO Users (username, password_hash, full_name, role)
VALUES ('admin', CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', 'admin123'), 2), N'Quản trị viên', 'admin');
