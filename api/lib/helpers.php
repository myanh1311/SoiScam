<?php
// ============================================================
// HÀM DÙNG CHUNG CHO TOÀN BỘ API
// Các nhóm hàm lớn được tách ra file riêng cùng thư mục:
//   rate-limit.php  giới hạn số lần thử (chống spam, đoán mật khẩu)
//   mail.php        gửi email mã xác nhận (EmailJS hoặc SMTP/Gmail)
//   google.php      xác thực đăng nhập bằng Google
// ============================================================

require_once __DIR__ . '/../config/db.php';
require_once __DIR__ . '/../config/app.php';
require_once __DIR__ . '/rate-limit.php';
require_once __DIR__ . '/mail.php';
require_once __DIR__ . '/google.php';

// ------------------------------------------------------------
// REQUEST / RESPONSE
// ------------------------------------------------------------
function request_host(): string {
    $host = $_SERVER['HTTP_HOST'] ?? '';
    return strtolower(preg_replace('/:\d+$/', '', $host));
}

function client_ip(): string {
    return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0';
}

function is_https_request(): bool {
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

// Request đang chạy ngay trên máy mình (XAMPP) hay trên server thật.
function is_local_request(): bool {
    return in_array(client_ip(), ['127.0.0.1', '::1'], true)
        && in_array(request_host(), ['localhost', '127.0.0.1', '[::1]', '::1'], true);
}

function json_response($data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

function json_error(string $message, int $status = 400): void {
    json_response(['error' => $message], $status);
}

// Đọc body JSON của request (POST/PUT) thành mảng PHP.
function read_json_body(): array {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

// ------------------------------------------------------------
// CORS: chỉ cho phép web cùng domain (hoặc domain trong ALLOWED_ORIGINS
// ở api/config/app.php) gọi API kèm cookie đăng nhập.
// ------------------------------------------------------------
function origin_is_allowed(string $origin): bool {
    $host = parse_url($origin, PHP_URL_HOST);
    if (!$host) return false;
    if (strcasecmp($host, request_host()) === 0) return true;
    return in_array(rtrim($origin, '/'), ALLOWED_ORIGINS, true);
}

function send_cors_headers(): void {
    header('Content-Type: application/json; charset=utf-8');
    header('X-Content-Type-Options: nosniff');

    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== '') {
        if (!origin_is_allowed($origin)) {
            json_error('Nguồn truy cập không được phép.', 403);
        }
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Access-Control-Allow-Credentials: true');
        header('Vary: Origin');
    }
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit;
    }
}

// ------------------------------------------------------------
// PHIÊN ĐĂNG NHẬP
// ------------------------------------------------------------
function start_api_session(): void {
    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_set_cookie_params([
            'httponly' => true,
            'samesite' => 'Lax',
            'secure' => is_https_request(),
        ]);
        session_start();
    }
}

// Mở phiên cho user vừa đăng nhập. Đổi session id để chặn tấn công
// "session fixation".
function login_session(array $user): void {
    start_api_session();
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['id'];
    $_SESSION['username'] = $user['username'];
    $_SESSION['name'] = $user['name'];
    $_SESSION['role'] = $user['role'];
}

// Người dùng đang đăng nhập (hoặc null). Luôn đối chiếu lại database để
// tài khoản vừa bị khoá/xoá hoặc bị hạ quyền có hiệu lực ngay.
function current_user(): ?array {
    static $cached = false;
    if ($cached !== false) return $cached;

    start_api_session();
    if (empty($_SESSION['user_id'])) return $cached = null;

    $stmt = get_pdo()->prepare('SELECT id, username, name, role, is_locked FROM users WHERE id = ?');
    $stmt->execute([$_SESSION['user_id']]);
    $row = $stmt->fetch();
    if (!$row || !empty($row['is_locked'])) {
        $_SESSION = [];
        session_destroy();
        return $cached = null;
    }

    $_SESSION['username'] = $row['username'];
    $_SESSION['name'] = $row['name'];
    $_SESSION['role'] = $row['role'];
    return $cached = [
        'id' => (int) $row['id'],
        'username' => $row['username'],
        'name' => $row['name'],
        'role' => $row['role'],
    ];
}

function require_login(): array {
    $user = current_user();
    if (!$user) {
        json_error('Vui lòng đăng nhập.', 401);
    }
    return $user;
}

function require_admin(): array {
    $user = require_login();
    if ($user['role'] !== 'admin') {
        json_error('Bạn không có quyền admin.', 403);
    }
    return $user;
}

// ------------------------------------------------------------
// DỮ LIỆU TỐ CÁO
// ------------------------------------------------------------
function normalize_bank_number(string $bankNumber): string {
    return preg_replace('/[\s-]/', '', trim($bankNumber));
}

// Chỉ giữ link ảnh https hợp lệ hoặc ảnh do server tự lưu (uploads/<32 ký tự>.jpg...)
// (tối đa $max ảnh) để không ai nhét được mã độc vào thuộc tính src của thẻ <img>.
function sanitize_image_urls($images, int $max = 10): array {
    $clean = [];
    if (!is_array($images)) return $clean;
    foreach ($images as $url) {
        if (!is_string($url)) continue;
        $url = trim($url);
        if ($url === '' || strlen($url) > 500) continue;
        if (preg_match('#^uploads/[a-f0-9]{32}\.(jpg|png|gif|webp)$#', $url)) {
            $clean[] = $url;
            if (count($clean) >= $max) break;
            continue;
        }
        if (!preg_match('#^https://[^\s"\'<>`\\\\]+$#i', $url)) continue;
        if (!filter_var($url, FILTER_VALIDATE_URL)) continue;
        $clean[] = $url;
        if (count($clean) >= $max) break;
    }
    return array_values(array_unique($clean));
}
