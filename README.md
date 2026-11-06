# LumiTech - Hệ thống chấm công

Ứng dụng quản lý chấm công, báo cáo công việc hiện trường, ứng lương và quản trị nhân viên.

## 1. Yêu cầu

- Node.js 18 trở lên
- npm
- Python 3 (dùng để chạy giao diện frontend tĩnh)
- SQLite được tích hợp sẵn trong backend

## 2. Cấu trúc chương trình

```text
backend/     API Node.js/Express và cơ sở dữ liệu SQLite
frontend/    Giao diện website HTML/CSS/JavaScript
```

Cơ sở dữ liệu nằm tại `backend/data/fieldflow.db` và được tạo/cập nhật tự động khi backend khởi động.

## 3. Khởi động chương trình trên Windows

Mở **Terminal 1** tại thư mục dự án:

```powershell
cd backend
npm install
npm start
```

Backend chạy tại:

```text
http://localhost:5000
```

Kiểm tra backend:
http://localhost:5500/index.html
[http://localhost:5000/api/health](http://localhost:5000/api/health)

Nếu hiển thị `status: ok` nghĩa là API đang hoạt động.

Mở **Terminal 2** tại thư mục dự án:

```powershell
cd frontend
python -m http.server 5500
```

Mở website:

[](http://localhost:5500/index.html)

Trang đăng nhập:

[http://localhost:5500/auth.html](http://localhost:5500/auth.html)

## 4. Truy cập bằng điện thoại

Điện thoại và máy tính phải kết nối cùng một mạng Wi-Fi.

Thay `192.168.1.23` bằng địa chỉ IPv4 Wi-Fi của máy tính nếu địa chỉ đã thay đổi:

```text
http://192.168.1.23:5500/index.html
```

Trang đăng nhập trên điện thoại:

```text
http://192.168.1.23:5500/auth.html
```

Nếu không truy cập được, kiểm tra Windows Firewall và cho phép Node.js/Python truy cập mạng riêng tư.

## 5. Tài khoản mẫu

| Vai trò   | Tên đăng nhập | Mật khẩu ban đầu |
| --------- | ------------- | ---------------- |
| Admin     | `admin`       | `admin123`       |
| Nhân viên | `minhanh`     | `demo123`        |
| Nhân viên | `quocbao`     | `demo123`        |
| Nhân viên | `hoangnam`    | `demo123`        |
| Nhân viên | `giahuy`      | `demo123`        |
| Nhân viên | `thanhtung`   | `demo123`        |

> Nếu mật khẩu Admin đã được đổi trong trang **Đổi mật khẩu**, hãy dùng mật khẩu mới thay cho mật khẩu ban đầu.

## 6. Chức năng chính

### Nhân viên

1. Đăng nhập bằng tài khoản nhân viên.
2. Nhập báo cáo cuối ngày:
   - Trạng thái đi làm/nghỉ.
   - Giờ check-in và check-out.
   - Nghỉ phép.
   - Về sớm và tăng ca.
   - Làm Chủ nhật/ngày lễ.
   - Đi công tác và địa điểm.
   - Nội dung công việc.
   - Số tiền ứng lương trong ngày.
3. Gửi báo cáo cho Admin.

Số tiền ứng lương nhập tại mục **Giờ phát sinh & ứng lương**, đơn vị VNĐ. Nhập `0` nếu không ứng lương.

### Admin

Các trang quản trị:

- Dashboard: [http://localhost:5500/views/admin/dashboard.html](http://localhost:5500/views/admin/dashboard.html)
- Bảng chấm công: [http://localhost:5500/views/admin/timesheet.html](http://localhost:5500/views/admin/timesheet.html)
- Quản lý đội ngũ: [http://localhost:5500/views/admin/team.html](http://localhost:5500/views/admin/team.html)
- Đổi mật khẩu: [http://localhost:5500/views/admin/change-password.html](http://localhost:5500/views/admin/change-password.html)

Admin có thể:

- Xem và lọc danh sách chấm công.
- Duyệt hoặc từ chối báo cáo.
- Xem số tiền ứng lương của từng nhân viên.
- Xuất file Excel có cột **Ứng lương (VNĐ)** và dòng tổng.
- Thêm, sửa và khóa/mở khóa tài khoản nhân viên.
- Đổi mật khẩu bằng cách nhập mật khẩu cũ, mật khẩu mới và xác nhận mật khẩu mới.

## 7. Xuất Excel

1. Đăng nhập bằng tài khoản Admin.
2. Mở trang **Bảng Timesheet**.
3. Chọn nhân viên hoặc khoảng thời gian nếu cần.
4. Nhấn **Xuất Excel**.

File Excel bao gồm giờ làm, nghỉ phép, tăng ca, đi công tác, ứng lương, nội dung công việc và trạng thái duyệt.

## 8. Dừng chương trình

Trong mỗi Terminal đang chạy, nhấn:

```text
Ctrl + C
```

## 9. Lưu ý bảo mật

- Không chia sẻ file `backend/.env`.
- Không đưa mật khẩu SMTP hoặc JWT secret lên Git.
- Nên đổi mật khẩu Admin ngay sau lần đăng nhập đầu tiên.
- Không xóa `backend/data/fieldflow.db` nếu muốn giữ tài khoản và lịch sử chấm công.
