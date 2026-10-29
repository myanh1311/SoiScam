# SoiScam

Website cộng đồng tra cứu và tố cáo tài khoản ngân hàng, số điện thoại lừa đảo. Người dùng tìm kiếm trước khi chuyển khoản, gửi tố cáo kèm ảnh bằng chứng; quản trị viên duyệt hoặc từ chối và hệ thống báo kết quả lại cho người gửi.

## Tính năng

**Người dùng**
- Tra cứu theo số tài khoản, số điện thoại hoặc tên; danh sách scammer có lọc theo ngân hàng, sắp xếp và cuộn tải thêm.
- Trang chi tiết riêng cho từng scammer (có URL để chia sẻ).
- Gửi tố cáo kèm ảnh; tố cáo trùng số tài khoản được gộp vào cùng một hồ sơ.
- Đăng ký, đăng nhập (tài khoản thường hoặc Google), quên mật khẩu bằng mã xác nhận 6 số gửi qua email.
- Trang cá nhân: theo dõi trạng thái tố cáo, nhận phản hồi khi bị từ chối, sửa thông tin, đổi mật khẩu, xoá tài khoản.
- Email báo kết quả khi tố cáo được duyệt hoặc bị từ chối.

**Quản trị viên**
- Thống kê tổng quan, duyệt/từ chối (kèm lý do), thao tác hàng loạt, phân trang.
- Quản lý tài khoản: khoá/mở khoá, phân quyền, xuất danh sách ra Excel.

## Công nghệ

- Backend: PHP 8 (PDO, không dùng framework), MySQL/MariaDB, PHP session.
- Frontend: HTML, CSS, JavaScript thuần, Axios.
- Dịch vụ ngoài: Google Sign-In, SMTP (Gmail) hoặc EmailJS để gửi mail, ImgBB lưu ảnh (tự lưu vào thư mục `uploads/` nếu ImgBB lỗi).

## Bảo mật đã xử lý

- Truy vấn dùng prepared statements; mật khẩu băm bcrypt; mã xác nhận và token chỉ lưu dạng băm.
- Chống XSS (escape mọi dữ liệu người dùng, lọc URL ảnh), chống open redirect, CORS theo danh sách cho phép.
- Giới hạn số lần thử theo IP và theo tài khoản (đăng nhập, quên mật khẩu, nhập mã, gửi tố cáo, tải ảnh).
- Phân quyền kiểm tra ở server (`require_login`, `require_admin`), kiểm tra file ảnh bằng nội dung thật.
- Khoá API và mật khẩu nằm trong `api/config/*.local.php`, không đưa lên Git.

## Cấu trúc thư mục

```
index.html, scammerList.html, ...   các trang giao diện
assets/css, assets/js               giao diện và script từng trang
api/                                backend PHP (auth, scammers, users, stats, upload...)
api/lib/                            hàm dùng chung (helpers, mail, rate-limit, google)
api/config/                         cấu hình (app.php, db.php + file .local.php riêng từng máy)
api/schema.sql                      cấu trúc database
api/sample-data.sql                 dữ liệu mẫu (tuỳ chọn, toàn dữ liệu giả)
```

## Chạy trên máy (XAMPP)

1. Chép thư mục dự án vào `htdocs/SoiScam`, bật Apache và MySQL.
2. Vào phpMyAdmin, import `api/schema.sql` (tạo database `soiscam` và các bảng).
3. Mở `http://localhost/SoiScam/`.
4. (Tuỳ chọn) Copy `api/config/app.local.example.php` thành `app.local.php` rồi điền khoá ImgBB, SMTP... Chưa cấu hình email thì mã xác nhận hiện thẳng trên trang khi chạy ở localhost.

Tài khoản admin mặc định được tạo bởi `schema.sql`; **hãy đổi mật khẩu ngay sau lần đăng nhập đầu tiên**.

## Triển khai lên hosting

1. Tạo database và user MySQL trong cPanel, import `api/schema.sql`.
2. Tải toàn bộ mã nguồn lên `public_html` (không cần tải `.git`).
3. Copy `api/config/db.local.example.php` thành `db.local.php`, điền thông tin database.
4. Copy `api/config/app.local.example.php` thành `app.local.php`, điền `APP_BASE_URL` (vd `https://ten-ban.com`), khoá ImgBB, SMTP.
5. Bật HTTPS (SSL). Với đăng nhập Google, thêm tên miền vào "Authorized JavaScript origins" trong Google Cloud Console.
6. Đăng nhập admin và đổi mật khẩu mặc định.
