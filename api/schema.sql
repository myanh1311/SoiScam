-- ============================================================
-- SOISCAM - SCHEMA CƠ SỞ DỮ LIỆU (MySQL / MariaDB, dùng cho XAMPP)
-- Import file này qua phpMyAdmin (hoặc mysql CLI) để tạo toàn bộ
-- database + bảng cần thiết. Xem README.md (mục "Chạy trên máy") để biết cách import.
-- ============================================================

CREATE DATABASE IF NOT EXISTS soiscam
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE soiscam;

-- ------------------------------------------------------------
-- TÀI KHOẢN (người dùng thường + admin dùng chung 1 bảng, phân biệt
-- bằng cột role). password_hash dùng hàm password_hash() chuẩn của
-- PHP (bcrypt) - an toàn hơn hẳn cách băm SHA-256 phía trình duyệt cũ.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    -- google_id: gắn với tài khoản Google nếu đăng nhập/đăng ký bằng nút
    -- "Đăng nhập bằng Google" (xem api/auth.php action "google-login").
    -- NULL nếu tài khoản chỉ dùng username/mật khẩu như bình thường.
    google_id VARCHAR(255) NULL,
    -- NULL nếu tài khoản được tạo lần đầu qua Google (không có mật khẩu
    -- thật, chỉ đăng nhập lại được bằng đúng tài khoản Google đó).
    password_hash VARCHAR(255) NULL,
    role ENUM('user', 'admin') NOT NULL DEFAULT 'user',
    is_locked TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_username (username),
    UNIQUE KEY uniq_email (email),
    UNIQUE KEY uniq_google_id (google_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- HỒ SƠ SCAMMER (1 dòng = 1 số tài khoản duy nhất đã bị tố, các lượt
-- tố cáo trùng số tài khoản sẽ gộp vào chung 1 scammer_id ở bảng reports)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS scammers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    bank_number VARCHAR(50) NOT NULL,
    bank_number_normalized VARCHAR(50) NOT NULL,
    bank_name VARCHAR(255) NOT NULL,
    name_scammer VARCHAR(255) NOT NULL,
    phone_scammer VARCHAR(20) DEFAULT NULL,
    first_reported_at DATETIME NOT NULL,
    latest_reported_at DATETIME NOT NULL,
    UNIQUE KEY uniq_bank_number_normalized (bank_number_normalized)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- TỪNG LƯỢT TỐ CÁO (nhiều report có thể cùng trỏ về 1 scammer_id)
-- images lưu dạng JSON (mảng URL ảnh trên ImgBB)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    scammer_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED DEFAULT NULL,
    name_sender VARCHAR(255) DEFAULT NULL,
    phone_sender VARCHAR(20) DEFAULT NULL,
    option_role VARCHAR(100) DEFAULT NULL,
    content_report TEXT,
    images JSON DEFAULT NULL,
    status ENUM('pending', 'approved') NOT NULL DEFAULT 'pending',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_scammer_id (scammer_id),
    KEY idx_user_id (user_id),
    KEY idx_status (status),
    CONSTRAINT fk_reports_scammer FOREIGN KEY (scammer_id) REFERENCES scammers(id) ON DELETE CASCADE,
    CONSTRAINT fk_reports_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- PHẢN HỒI CHO NGƯỜI DÙNG (khi admin từ chối/xoá 1 tố cáo kèm lý do)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS notifications (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    name_scammer VARCHAR(255),
    bank_number VARCHAR(50),
    reason TEXT,
    type ENUM('approved', 'rejected') NOT NULL DEFAULT 'rejected',
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_user_id (user_id),
    CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- TOKEN ĐẶT LẠI MẬT KHẨU (luồng "Quên mật khẩu"). Cột token lưu bản băm
-- SHA-256 (64 ký tự hex) của token, KHÔNG lưu token gốc - token gốc chỉ có
-- trong email gửi cho chủ tài khoản (server gửi qua EmailJS REST API).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS password_resets (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    token VARCHAR(64) NOT NULL,
    expires_at DATETIME NOT NULL,
    used TINYINT(1) NOT NULL DEFAULT 0,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uniq_token (token),
    KEY idx_user_id (user_id),
    CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- LỊCH SỬ GỬI TỐ CÁO THEO IP (chống spam: giới hạn số lượt gửi
-- trong 1 khoảng thời gian cho mỗi địa chỉ IP)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_attempts (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    ip_address VARCHAR(45) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_ip_created (ip_address, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- GIỚI HẠN SỐ LẦN THỬ (chống đoán mật khẩu, spam quên mật khẩu/đăng ký).
-- Mỗi dòng = 1 lần thử của (bucket, identifier). Backend cũng tự tạo bảng
-- này nếu chưa có (xem ensure_rate_limit_table trong api/lib/helpers.php).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rate_limits (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    bucket VARCHAR(40) NOT NULL,
    identifier VARCHAR(120) NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_bucket_identifier (bucket, identifier, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- NHẬT KÝ DUYỆT/TỪ CHỐI (dùng để tính thống kê "tỷ lệ duyệt/từ chối"
-- và "số tố cáo theo thời gian" ở dashboard admin - ghi lại độc lập,
-- không mất đi kể cả khi report gốc đã bị xoá sau khi từ chối)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report_actions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    action ENUM('approved', 'rejected') NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_action_created (action, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ------------------------------------------------------------
-- TÀI KHOẢN ADMIN MẶC ĐỊNH
-- username: admin | mật khẩu tạm: SoiScam@2026
-- ĐỔI MẬT KHẨU NÀY NGAY sau khi đăng nhập lần đầu (trang "Quản lý tài khoản").
-- Hash bên dưới được tạo sẵn bằng password_hash('SoiScam@2026', PASSWORD_BCRYPT).
-- ------------------------------------------------------------
INSERT IGNORE INTO users (name, username, email, password_hash, role)
VALUES (
    'Quản trị viên',
    'admin',
    'admin@soiscam.local',
    '$2y$12$vUO4v277fbZwBoFwAxPMgOWeanYZ84eqxlzpFt8ZyxQ4KkmiNRtFC',
    'admin'
);
