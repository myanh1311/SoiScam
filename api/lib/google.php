<?php
// ============================================================
// XÁC THỰC "ĐĂNG NHẬP BẰNG GOOGLE"
// Trình duyệt gửi lên 1 ID token (JWT); server nhờ chính Google kiểm tra
// hộ qua endpoint tokeninfo. Trả về thông tin (email, name, sub...) nếu
// hợp lệ, hoặc null nếu token giả/hết hạn/cấp cho ứng dụng khác.
// ============================================================
require_once __DIR__ . '/../config/google.php';

function verify_google_id_token(string $idToken): ?array {
    if ($idToken === '') return null;

    $url = 'https://oauth2.googleapis.com/tokeninfo?id_token=' . urlencode($idToken);
    $context = stream_context_create(['http' => ['timeout' => 8, 'ignore_errors' => true]]);
    $raw = @file_get_contents($url, false, $context);
    if ($raw === false) return null;

    $payload = json_decode($raw, true);
    if (!is_array($payload) || isset($payload['error'])) return null;
    // Bắt buộc kiểm tra "aud" đúng là Client ID của mình, nếu không token
    // cấp cho ứng dụng khác vẫn đăng nhập giả mạo được.
    if (($payload['aud'] ?? '') !== GOOGLE_CLIENT_ID) return null;
    if (($payload['email_verified'] ?? 'false') !== 'true') return null;
    if (empty($payload['email']) || empty($payload['sub'])) return null;

    return $payload;
}
