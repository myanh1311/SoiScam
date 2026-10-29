-- ============================================================
-- SOISCAM - MIGRATION BỔ SUNG (chạy 1 lần, sau khi đã import schema.sql)
-- Thêm tính năng: khoá tạm tài khoản (is_locked), phân biệt thông báo
-- "đã duyệt" / "bị từ chối" (cột type trong notifications) - phục vụ
-- trang "Tố cáo của tôi" và trang "Quản lý tài khoản" bản nâng cấp.
--
-- CÁCH CHẠY: mở phpMyAdmin -> chọn database soiscam -> tab SQL -> dán
-- toàn bộ nội dung file này vào -> bấm Go/Thực hiện. An toàn chạy nhiều
-- lần (dùng IF NOT EXISTS) nên lỡ chạy trùng cũng không lỗi.
-- ============================================================

USE soiscam;

ALTER TABLE users
    ADD COLUMN IF NOT EXISTS is_locked TINYINT(1) NOT NULL DEFAULT 0 AFTER role;

ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS type ENUM('approved', 'rejected') NOT NULL DEFAULT 'rejected' AFTER reason;
