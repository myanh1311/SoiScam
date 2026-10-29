-- ============================================================
-- MIGRATION: THÊM ĐĂNG NHẬP BẰNG GOOGLE
-- Chạy file này qua phpMyAdmin (chọn database "soiscam" -> tab SQL ->
-- dán nội dung -> Go) SAU KHI đã có sẵn database từ schema.sql.
--
-- - Thêm cột google_id để liên kết tài khoản với ID Google (mỗi tài
--   khoản Google chỉ gắn được với đúng 1 user, nên đặt UNIQUE).
-- - Cho phép password_hash NULL: tài khoản tạo lần đầu qua Google sẽ
--   không có mật khẩu thật nào cả (không đăng nhập bằng username/mật
--   khẩu được, chỉ đăng nhập lại bằng đúng tài khoản Google đó) - xem
--   thêm api/auth.php action "google-login".
-- ============================================================
USE soiscam;

ALTER TABLE users
    ADD COLUMN google_id VARCHAR(255) NULL UNIQUE AFTER email,
    MODIFY password_hash VARCHAR(255) NULL;
