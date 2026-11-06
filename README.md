# FieldFlow

Hệ thống chấm công gồm:

- `frontend`: giao diện website.
- `backend`: API Node.js và cơ sở dữ liệu SQLite.

## Yêu cầu

- Node.js 18 trở lên
- npm
- VS Code (khuyến nghị)

## Cách chạy

### 1. Chạy backend

Mở Terminal thứ nhất tại thư mục dự án:

```powershell
cd backend
Copy-Item .env.example .env
npm install
npm start
```

Backend chạy tại:

```text
http://localhost:5000
```

Kiểm tra backend:

[http://localhost:5000/api/health](http://localhost:5000/api/health)

Nếu thấy `status: ok` là backend đang chạy.

### 2. Chạy frontend

Mở Terminal thứ hai tại thư mục dự án:

```powershell
cd frontend
python -m http.server 5500
```

Sau đó mở trang:

[http://localhost:5500/index.html](http://localhost:5500/index.html)

Trang đăng nhập:

[http://localhost:5500/auth.html](http://localhost:5500/auth.html)

## Tài khoản mẫu

| Loại tài khoản | Tên đăng nhập | Mật khẩu |
|---|---|---|
| Admin | `admin` | `admin123` |
| Nhân viên | `minhanh` | `demo123` |

## Các trang chính

- Admin Dashboard: [http://localhost:5500/views/admin/dashboard.html](http://localhost:5500/views/admin/dashboard.html)
- Quản lý đội ngũ: [http://localhost:5500/views/admin/team.html](http://localhost:5500/views/admin/team.html)
- Timesheet: [http://localhost:5500/views/admin/timesheet.html](http://localhost:5500/views/admin/timesheet.html)
- Báo cáo cuối ngày: [http://localhost:5500/views/technician/report.html](http://localhost:5500/views/technician/report.html)

## Database

SQLite được tạo tự động tại:

```text
backend/data/fieldflow.db
```

Không cần tạo database thủ công. Không xóa file database nếu muốn giữ tài khoản
và lịch sử chấm công.

## Cấu hình email khôi phục mật khẩu

Sao chép `.env.example` thành `.env`, sau đó điền thông tin SMTP Gmail:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-gmail-app-password
SMTP_FROM=your-gmail@gmail.com
ADMIN_NOTIFICATION_EMAIL=admin@example.com
```

Gmail cần bật xác thực 2 bước và tạo **App Password**. Không dùng mật khẩu
Gmail thông thường và không đưa file `.env` lên Git. Nếu chưa cấu hình SMTP,
email sẽ không được gửi.

## Lưu ý

- Tài khoản đăng ký mới luôn có quyền nhân viên.
- Admin gán chức vụ: Kỹ thuật viên, Kế toán, Sale hoặc Marketing.
- Không chọn vai trò khi đăng nhập; hệ thống tự nhận diện vai trò từ database.
- Mỗi tài khoản chỉ gửi được một báo cáo cho một ngày.
- File Excel xuất ra có dòng tổng cho nghỉ phép, về sớm, OT, làm Chủ nhật và đi xa.

## Dừng chương trình

Trong mỗi Terminal đang chạy, nhấn:

```text
Ctrl + C
```
