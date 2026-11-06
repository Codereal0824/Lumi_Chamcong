# FieldFlow Backend

## Chạy local

```powershell
cd backend
Copy-Item .env.example .env
npm install
npm run dev
```

API chạy tại `http://localhost:5000`. Tài khoản demo:

- Admin: `admin` / `admin123`
- Kỹ thuật viên: `minhanh` / `demo123`

SQLite được tạo tự động tại `backend/data/fieldflow.db`. Có thể đổi vị trí bằng `DATABASE_PATH`.

Giờ chuẩn là `08:00 — 17:30`. Backend tự động tính `ot_hours` khi Check-out sau
17:30 và `early_leave_hours` là số âm khi Check-out trước 17:30; không nhận giá
trị phát sinh do người dùng tự nhập. Khi chọn làm Chủ nhật/ngày lễ, API yêu cầu
thêm `sundayCheckIn` và `sundayCheckOut`. `fieldTripDays` chỉ nhận `0` (Không)
hoặc `1` (Có).

Trên biểu mẫu, chọn `Không đi làm` sẽ khóa các nội dung chi tiết và gửi báo cáo
với `leave_days = 1`. Backend khi nhận ngày nghỉ sẽ tự lưu giờ phát sinh, làm
Chủ nhật và đi xa bằng `0`.

Mỗi tài khoản chỉ được gửi một báo cáo cho một ngày. Nếu gửi lại cùng ngày,
API trả lỗi `409` và không tạo thêm dòng chấm công.

## Database hiện tại và SQL Server

Hiện tại dự án đã có database SQLite thật, được tạo tự động khi server khởi động. File schema để chuyển sang SQL Server nằm tại `backend/database/sqlserver-schema.sql`. Backend hiện tại đang dùng SQLite driver; sau khi bạn tạo SQL Server, cần thay lớp truy vấn trong `config/database.js` bằng driver SQL Server (`mssql`) và giữ nguyên các controller/routes.

File xuất báo cáo dùng định dạng `.xlsx` chuẩn qua ExcelJS, gồm các cột theo dữ liệu trên form (bao gồm khung giờ làm Chủ nhật/ngày lễ) và mở trực tiếp bằng Microsoft Excel không bị dồn dữ liệu vào cột A.
