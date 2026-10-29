<?php
// ============================================================
// GIỚI HẠN SỐ LẦN THỬ (chống spam, đoán mật khẩu, đoán mã xác nhận)
// Mỗi "bucket" (loại hành động) + "identifier" (IP, email...) chỉ được
// ghi nhận tối đa N lần trong M phút. Dữ liệu lưu ở bảng rate_limits.
// ============================================================

// Tạo bảng rate_limits nếu chưa có (cũng có trong schema.sql) để quên
// import thì web vẫn chạy.
function ensure_rate_limit_table(PDO $pdo): void {
    static $done = false;
    if ($done) return;
    $pdo->exec(
        'CREATE TABLE IF NOT EXISTS rate_limits (
            id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
            bucket VARCHAR(40) NOT NULL,
            identifier VARCHAR(120) NOT NULL,
            created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            KEY idx_bucket_identifier (bucket, identifier, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4'
    );
    $done = true;
}

function rate_limit_exceeded(PDO $pdo, string $bucket, string $identifier, int $max, int $windowMinutes): bool {
    ensure_rate_limit_table($pdo);
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM rate_limits WHERE bucket = ? AND identifier = ? AND created_at >= (NOW() - INTERVAL ? MINUTE)'
    );
    $stmt->execute([$bucket, $identifier, $windowMinutes]);
    return (int) $stmt->fetchColumn() >= $max;
}

function rate_limit_record(PDO $pdo, string $bucket, string $identifier): void {
    ensure_rate_limit_table($pdo);
    $pdo->prepare('INSERT INTO rate_limits (bucket, identifier) VALUES (?, ?)')->execute([$bucket, $identifier]);
    // Thỉnh thoảng dọn dòng cũ (hơn 1 ngày) cho bảng không phình mãi.
    if (random_int(1, 50) === 1) {
        $pdo->exec('DELETE FROM rate_limits WHERE created_at < (NOW() - INTERVAL 1 DAY)');
    }
}

function rate_limit_clear(PDO $pdo, string $bucket, string $identifier): void {
    ensure_rate_limit_table($pdo);
    $pdo->prepare('DELETE FROM rate_limits WHERE bucket = ? AND identifier = ?')->execute([$bucket, $identifier]);
}

function rate_limit_error(string $message): void {
    json_error($message, 429);
}

// ------------------------------------------------------------
// CHỐNG SPAM TỐ CÁO: tối đa MAX_REPORTS_PER_WINDOW lượt gửi mỗi
// WINDOW_MINUTES phút cho cùng 1 địa chỉ IP.
// ------------------------------------------------------------
const MAX_REPORTS_PER_WINDOW = 5;
const WINDOW_MINUTES = 30;

function check_report_rate_limit(PDO $pdo): void {
    $ip = client_ip();
    $stmt = $pdo->prepare(
        'SELECT COUNT(*) FROM report_attempts WHERE ip_address = ? AND created_at >= (NOW() - INTERVAL ? MINUTE)'
    );
    $stmt->execute([$ip, WINDOW_MINUTES]);
    $count = (int) $stmt->fetchColumn();
    if ($count >= MAX_REPORTS_PER_WINDOW) {
        json_error(
            "Bạn đã gửi quá nhiều tố cáo trong thời gian ngắn (tối đa " . MAX_REPORTS_PER_WINDOW . " lượt / " . WINDOW_MINUTES . " phút). Vui lòng thử lại sau.",
            429
        );
    }
    $insert = $pdo->prepare('INSERT INTO report_attempts (ip_address) VALUES (?)');
    $insert->execute([$ip]);
}
