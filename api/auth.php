<?php
// ============================================================
// XÁC THỰC: đăng ký / đăng nhập / Google / đăng xuất / quên mật khẩu
// Phiên đăng nhập dùng PHP session (cookie), server biết thật sự ai đang
// đăng nhập nên chặn được đúng các API chỉ admin được gọi.
// ============================================================
require_once __DIR__ . '/lib/helpers.php';

send_cors_headers();
start_api_session();

$pdo = get_pdo();
$action = $_GET['action'] ?? '';
$method = $_SERVER['REQUEST_METHOD'];

// Mã xác nhận quên mật khẩu: hiệu lực bao lâu, bao lâu được gửi lại.
const OTP_MINUTES = 10;
const OTP_RESEND_SECONDS = 60;

// ------------------------------------------------------------
// HÀM PHỤ
// ------------------------------------------------------------

// Thông tin user trả về cho trình duyệt (không có mật khẩu).
function user_payload(array $user): array {
    return [
        'id' => (int) $user['id'],
        'name' => $user['name'],
        'username' => $user['username'],
        'email' => $user['email'],
        'role' => $user['role'],
    ];
}

// Tạo username từ phần trước @ của email, thêm số cho tới khi không trùng.
function unique_username_from_email(PDO $pdo, string $email): string {
    $base = preg_replace('/[^a-zA-Z0-9]/', '', explode('@', $email)[0]);
    if ($base === '') $base = 'user';

    $username = $base;
    $suffix = 0;
    $check = $pdo->prepare('SELECT id FROM users WHERE username = ?');
    while (true) {
        $check->execute([$username]);
        if (!$check->fetch()) return $username;
        $suffix++;
        $username = $base . $suffix;
    }
}

// Bản băm của mã OTP lưu trong DB. Tiền tố "o" để mã OTP không bao giờ
// dùng nhầm được như 1 token đặt lại mật khẩu (token là 64 ký tự hex).
function otp_hash(int $userId, string $code): string {
    return 'o' . substr(hash('sha256', 'otp:' . $userId . ':' . $code), 0, 63);
}

// ------------------------------------------------------------
// ĐĂNG KÝ
// ------------------------------------------------------------
if ($action === 'register' && $method === 'POST') {
    $body = read_json_body();
    $name = trim($body['name'] ?? '');
    $username = trim($body['username'] ?? '');
    $email = trim($body['email'] ?? '');
    $password = (string) ($body['password'] ?? '');

    if ($name === '' || $username === '' || $email === '' || $password === '') {
        json_error('Vui lòng nhập đầy đủ thông tin.');
    }
    if (mb_strlen($password) < 6) {
        json_error('Mật khẩu phải có ít nhất 6 ký tự.');
    }
    if (mb_strlen($password) > 200) {
        json_error('Mật khẩu quá dài.');
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 255) {
        json_error('Email không hợp lệ.');
    }
    if (mb_strlen($name) > 100) {
        json_error('Họ và tên quá dài (tối đa 100 ký tự).');
    }
    if (!preg_match('/^[^\s<>"\']{3,50}$/u', $username)) {
        json_error('Tên đăng nhập dài 3-50 ký tự, không chứa khoảng trắng hay ký tự < > " \'.');
    }

    // Chống tạo tài khoản hàng loạt từ 1 IP.
    if (rate_limit_exceeded($pdo, 'register', client_ip(), 10, 60)) {
        rate_limit_error('Bạn đã đăng ký quá nhiều lần, vui lòng thử lại sau ít phút.');
    }
    rate_limit_record($pdo, 'register', client_ip());

    $check = $pdo->prepare('SELECT id FROM users WHERE username = ? OR email = ?');
    $check->execute([$username, $email]);
    if ($check->fetch()) {
        json_error('Tên đăng nhập hoặc email này đã có người sử dụng.');
    }

    $hash = password_hash($password, PASSWORD_BCRYPT);
    $insert = $pdo->prepare(
        'INSERT INTO users (name, username, email, password_hash, role) VALUES (?, ?, ?, ?, ?)'
    );
    $insert->execute([$name, $username, $email, $hash, 'user']);

    json_response(['success' => true]);
}

// ------------------------------------------------------------
// ĐĂNG NHẬP (khoá tạm khi sai quá nhiều lần, tính theo IP và theo tên)
// ------------------------------------------------------------
if ($action === 'login' && $method === 'POST') {
    $body = read_json_body();
    $username = trim($body['username'] ?? '');
    $password = (string) ($body['password'] ?? '');

    if ($username === '' || $password === '') {
        json_error('Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.');
    }

    $ipKey = client_ip();
    $userKey = mb_strtolower($username);
    if (rate_limit_exceeded($pdo, 'login_fail_ip', $ipKey, 8, 15)
        || rate_limit_exceeded($pdo, 'login_fail_user', $userKey, 10, 15)) {
        rate_limit_error('Bạn đã thử đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút.');
    }

    $stmt = $pdo->prepare('SELECT * FROM users WHERE username = ?');
    $stmt->execute([$username]);
    $user = $stmt->fetch();

    // password_hash NULL = tài khoản tạo qua Google, chưa có mật khẩu thật.
    if (!$user || $user['password_hash'] === null || !password_verify($password, $user['password_hash'])) {
        rate_limit_record($pdo, 'login_fail_ip', $ipKey);
        rate_limit_record($pdo, 'login_fail_user', $userKey);
        json_error('Sai tên đăng nhập hoặc mật khẩu.', 401);
    }
    if (!empty($user['is_locked'])) {
        json_error('Tài khoản của bạn đã bị khoá. Vui lòng liên hệ quản trị viên.', 403);
    }

    rate_limit_clear($pdo, 'login_fail_ip', $ipKey);
    rate_limit_clear($pdo, 'login_fail_user', $userKey);
    login_session($user);

    json_response(user_payload($user));
}

// ------------------------------------------------------------
// ĐĂNG NHẬP BẰNG GOOGLE
// Trình duyệt gửi ID token, server tự xác thực lại với Google. Rồi:
//   - google_id đã có          -> đăng nhập tài khoản đó
//   - email đã có tài khoản    -> gắn google_id vào tài khoản đó
//   - chưa có gì               -> tạo tài khoản mới (không mật khẩu)
// ------------------------------------------------------------
if ($action === 'google-login' && $method === 'POST') {
    $body = read_json_body();
    $idToken = trim($body['idToken'] ?? '');
    if ($idToken === '') {
        json_error('Thiếu idToken.');
    }

    $payload = verify_google_id_token($idToken);
    if (!$payload) {
        json_error('Không xác thực được tài khoản Google, vui lòng thử lại.', 401);
    }

    $googleId = (string) $payload['sub'];
    $email = (string) $payload['email'];
    $name = trim((string) ($payload['name'] ?? '')) ?: explode('@', $email)[0];

    $find = $pdo->prepare('SELECT * FROM users WHERE google_id = ?');
    $find->execute([$googleId]);
    $user = $find->fetch();

    if (!$user) {
        $findByEmail = $pdo->prepare('SELECT * FROM users WHERE email = ?');
        $findByEmail->execute([$email]);
        $user = $findByEmail->fetch();

        if ($user) {
            $pdo->prepare('UPDATE users SET google_id = ? WHERE id = ?')->execute([$googleId, $user['id']]);
        } else {
            $insert = $pdo->prepare(
                'INSERT INTO users (name, username, email, google_id, password_hash, role) VALUES (?, ?, ?, ?, NULL, ?)'
            );
            $insert->execute([$name, unique_username_from_email($pdo, $email), $email, $googleId, 'user']);

            $find = $pdo->prepare('SELECT * FROM users WHERE id = ?');
            $find->execute([(int) $pdo->lastInsertId()]);
            $user = $find->fetch();
        }
    }

    if (!empty($user['is_locked'])) {
        json_error('Tài khoản của bạn đã bị khoá. Vui lòng liên hệ quản trị viên.', 403);
    }

    login_session($user);
    json_response(user_payload($user));
}

// ------------------------------------------------------------
// ĐĂNG XUẤT / AI ĐANG ĐĂNG NHẬP
// ------------------------------------------------------------
if ($action === 'logout' && $method === 'POST') {
    $_SESSION = [];
    session_destroy();
    json_response(['success' => true]);
}

if ($action === 'me' && $method === 'GET') {
    json_response(['user' => current_user()]);
}

// ------------------------------------------------------------
// QUÊN MẬT KHẨU - 3 bước:
//   forgot-password    : nhập email -> gửi mã 6 số về email
//   verify-reset-code  : nhập mã     -> nhận token đặt lại (dùng 1 lần)
//   reset-password     : token + mật khẩu mới
// Mã và token chỉ lưu dạng băm. Luôn trả success ở bước 1 dù email có
// tồn tại hay không, để không lộ ai đã đăng ký.
// ------------------------------------------------------------

// Bước 1: tạo mã 6 số và gửi email.
if ($action === 'forgot-password' && $method === 'POST') {
    $body = read_json_body();
    $email = trim($body['email'] ?? '');
    if ($email === '') {
        json_error('Vui lòng nhập email.');
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 255) {
        json_error('Email không hợp lệ.');
    }

    // Chống dội email: theo IP và theo từng email.
    $emailKey = hash('sha256', mb_strtolower($email));
    if (rate_limit_exceeded($pdo, 'forgot_ip', client_ip(), 8, 60)
        || rate_limit_exceeded($pdo, 'forgot_email', $emailKey, 5, 60)) {
        rate_limit_error('Bạn đã yêu cầu quá nhiều lần, vui lòng thử lại sau ít phút.');
    }
    rate_limit_record($pdo, 'forgot_ip', client_ip());
    rate_limit_record($pdo, 'forgot_email', $emailKey);

    $stmt = $pdo->prepare('SELECT id, name, username FROM users WHERE email = ? AND is_locked = 0');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    $response = ['success' => true, 'expiresMinutes' => OTP_MINUTES, 'resendSeconds' => OTP_RESEND_SECONDS];

    if ($user) {
        // Vừa gửi mã chưa lâu thì không gửi thêm (chống bấm "gửi lại" liên tục).
        $recent = $pdo->prepare(
            "SELECT COUNT(*) FROM password_resets WHERE user_id = ? AND token LIKE 'o%'
             AND TIMESTAMPDIFF(SECOND, created_at, NOW()) < ?"
        );
        $recent->execute([$user['id'], OTP_RESEND_SECONDS]);

        if ((int) $recent->fetchColumn() === 0) {
            $code = str_pad((string) random_int(0, 999999), 6, '0', STR_PAD_LEFT);
            $expiresAt = (new DateTime('+' . OTP_MINUTES . ' minutes'))->format('Y-m-d H:i:s');

            // Huỷ mã/token cũ chưa dùng, chỉ mã mới nhất có hiệu lực.
            $pdo->prepare('UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0')->execute([$user['id']]);
            $pdo->prepare('INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)')
                ->execute([$user['id'], otp_hash((int) $user['id'], $code), $expiresAt]);

            if (mail_is_configured()) {
                if (!send_otp_email($email, $user['name'] ?: $user['username'], $code, OTP_MINUTES)) {
                    error_log('SoiScam: gửi mã xác nhận thất bại cho user #' . $user['id']);
                }
            } elseif (is_local_request()) {
                // Chỉ khi chạy trên máy mình mà chưa cấu hình email: hiện mã để thử.
                $response['devCode'] = $code;
            } else {
                error_log('SoiScam: chưa cấu hình gửi email (EmailJS/SMTP trong api/config/app.local.php).');
            }
        }
    }

    json_response($response);
}

// Bước 2: kiểm tra mã, đúng thì đổi thành token đặt lại mật khẩu.
if ($action === 'verify-reset-code' && $method === 'POST') {
    $body = read_json_body();
    $email = trim($body['email'] ?? '');
    $code = trim((string) ($body['code'] ?? ''));
    if ($email === '' || !preg_match('/^\d{6}$/', $code)) {
        json_error('Vui lòng nhập đủ mã xác nhận gồm 6 chữ số.');
    }

    // Tối đa 5 lần nhập sai / 15 phút cho mỗi email.
    $emailKey = hash('sha256', mb_strtolower($email));
    if (rate_limit_exceeded($pdo, 'otp_email', $emailKey, 5, 15)
        || rate_limit_exceeded($pdo, 'otp_ip', client_ip(), 25, 15)) {
        rate_limit_error('Bạn đã nhập sai quá nhiều lần. Vui lòng thử lại sau 15 phút hoặc yêu cầu mã mới.');
    }
    rate_limit_record($pdo, 'otp_email', $emailKey);
    rate_limit_record($pdo, 'otp_ip', client_ip());

    $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ? AND is_locked = 0');
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    $row = null;
    if ($user) {
        $find = $pdo->prepare('SELECT * FROM password_resets WHERE user_id = ? AND token = ? AND used = 0');
        $find->execute([$user['id'], otp_hash((int) $user['id'], $code)]);
        $row = $find->fetch();
    }
    if (!$row || strtotime($row['expires_at']) < time()) {
        json_error('Mã xác nhận không đúng hoặc đã hết hạn.', 400);
    }

    // Mã đúng: đổi thành token dùng 1 lần, hiệu lực 15 phút.
    $resetToken = bin2hex(random_bytes(32));
    $pdo->prepare('UPDATE password_resets SET used = 1 WHERE user_id = ? AND used = 0')->execute([$user['id']]);
    $pdo->prepare('INSERT INTO password_resets (user_id, token, expires_at) VALUES (?, ?, ?)')
        ->execute([$user['id'], hash('sha256', $resetToken), (new DateTime('+15 minutes'))->format('Y-m-d H:i:s')]);
    rate_limit_clear($pdo, 'otp_email', $emailKey);

    json_response(['success' => true, 'resetToken' => $resetToken]);
}

// Bước 3: đặt mật khẩu mới bằng token.
if ($action === 'reset-password' && $method === 'POST') {
    $body = read_json_body();
    $token = trim($body['token'] ?? '');
    $password = (string) ($body['password'] ?? '');

    if ($token === '' || $password === '') {
        json_error('Thiếu thông tin.');
    }
    if (mb_strlen($password) < 6) {
        json_error('Mật khẩu phải có ít nhất 6 ký tự.');
    }
    if (mb_strlen($password) > 200) {
        json_error('Mật khẩu quá dài.');
    }

    // Chống dò token bằng cách thử hàng loạt.
    if (rate_limit_exceeded($pdo, 'reset_ip', client_ip(), 10, 15)) {
        rate_limit_error('Bạn đã thử quá nhiều lần, vui lòng thử lại sau ít phút.');
    }
    rate_limit_record($pdo, 'reset_ip', client_ip());

    $stmt = $pdo->prepare('SELECT * FROM password_resets WHERE token = ?');
    $stmt->execute([hash('sha256', $token)]);
    $reset = $stmt->fetch();

    if (!$reset || $reset['used'] == 1 || strtotime($reset['expires_at']) < time()) {
        json_error('Phiên đặt lại mật khẩu không hợp lệ hoặc đã hết hạn. Vui lòng yêu cầu mã mới.', 400);
    }

    $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')
        ->execute([password_hash($password, PASSWORD_BCRYPT), $reset['user_id']]);
    $pdo->prepare('UPDATE password_resets SET used = 1 WHERE id = ?')->execute([$reset['id']]);

    json_response(['success' => true]);
}

json_error('Không tìm thấy action phù hợp.', 404);
