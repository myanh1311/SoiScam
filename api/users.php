<?php
// ============================================================
// QUẢN LÝ TÀI KHOẢN NGƯỜI DÙNG (trang admin, view "Quản lý tài khoản")
// Chỉ admin gọi được các action này.
// ============================================================
require_once __DIR__ . '/lib/helpers.php';

send_cors_headers();
start_api_session();

$pdo = get_pdo();
$action = $_GET['action'] ?? 'list';
$method = $_SERVER['REQUEST_METHOD'];

if ($action === 'list' && $method === 'GET') {
    require_admin();
    // reportCount: tổng số report (chờ + đã duyệt) người này từng gửi, để admin sắp xếp/tìm.
    $rows = $pdo->query(
        'SELECT u.id, u.name, u.username, u.email, u.role, u.is_locked, u.created_at,
                (SELECT COUNT(*) FROM reports r WHERE r.user_id = u.id) AS report_count
         FROM users u ORDER BY u.created_at DESC'
    )->fetchAll();
    $result = array_map(function ($row) {
        return [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'username' => $row['username'],
            'email' => $row['email'],
            'role' => $row['role'],
            'isLocked' => (bool) $row['is_locked'],
            'reportCount' => (int) $row['report_count'],
            'createdAt' => str_replace(' ', 'T', $row['created_at']) . 'Z',
        ];
    }, $rows);
    json_response($result);
}

// ---------- Admin: xem tất cả tố cáo của 1 tài khoản ----------
// Gồm report còn tồn tại (chờ/đã duyệt) và lịch sử bị từ chối. Report bị từ chối đã bị xoá,
// nên lấy lại từ notifications type=rejected (bản ghi duy nhất còn lại).
if ($action === 'account-reports' && $method === 'GET') {
    require_admin();
    $id = (int) ($_GET['id'] ?? 0);
    if (!$id) json_error('Thiếu id.');

    $stmt = $pdo->prepare(
        'SELECT r.id, r.status, r.created_at, r.name_sender, r.phone_sender, r.option_role, r.content_report, r.images,
                s.name_scammer, s.bank_number, s.bank_name
         FROM reports r JOIN scammers s ON s.id = r.scammer_id
         WHERE r.user_id = ? ORDER BY r.created_at DESC'
    );
    $stmt->execute([$id]);
    $reports = array_map(function ($row) {
        return [
            'id' => (int) $row['id'],
            'nameScammer' => $row['name_scammer'],
            'bankNumber' => $row['bank_number'],
            'bankName' => $row['bank_name'],
            'status' => $row['status'],
            'date' => str_replace(' ', 'T', $row['created_at']) . 'Z',
            // Tên/sđt người gửi tự điền trong form (có thể khác tên tài khoản, vd gửi hộ người khác).
            'nameSender' => $row['name_sender'],
            'phoneSender' => $row['phone_sender'],
            'option' => $row['option_role'],
            'contentReport' => $row['content_report'],
            'images' => $row['images'] ? json_decode($row['images'], true) : [],
        ];
    }, $stmt->fetchAll());

    $stmt2 = $pdo->prepare(
        "SELECT * FROM notifications WHERE user_id = ? AND type = 'rejected' ORDER BY created_at DESC"
    );
    $stmt2->execute([$id]);
    $rejectedHistory = array_map(function ($row) {
        return [
            'id' => (int) $row['id'],
            'nameScammer' => $row['name_scammer'],
            'bankNumber' => $row['bank_number'],
            'reason' => $row['reason'],
            'date' => str_replace(' ', 'T', $row['created_at']) . 'Z',
        ];
    }, $stmt2->fetchAll());

    json_response(['reports' => $reports, 'rejectedHistory' => $rejectedHistory]);
}

// ---------- Admin: khoá / mở khoá tài khoản ----------
// Nhẹ tay hơn xoá hẳn: tài khoản bị khoá không đăng nhập được (kiểm tra ở auth.php action=login).
if ($action === 'toggle-lock' && $method === 'POST') {
    $admin = require_admin();
    $body = read_json_body();
    $id = (int) ($body['id'] ?? 0);
    if (!$id) json_error('Thiếu id.');
    if ($id === (int) $admin['id']) {
        json_error('Không thể tự khoá tài khoản đang đăng nhập.');
    }

    $stmt = $pdo->prepare('SELECT is_locked FROM users WHERE id = ?');
    $stmt->execute([$id]);
    $row = $stmt->fetch();
    if (!$row) json_error('Không tìm thấy tài khoản.', 404);

    $newLocked = $row['is_locked'] ? 0 : 1;
    $pdo->prepare('UPDATE users SET is_locked = ? WHERE id = ?')->execute([$newLocked, $id]);
    json_response(['success' => true, 'isLocked' => (bool) $newLocked]);
}

// ---------- Người dùng tự sửa họ tên / email ----------
if ($action === 'update-profile' && $method === 'POST') {
    $user = require_login();
    $body = read_json_body();
    $name = trim($body['name'] ?? '');
    $email = trim($body['email'] ?? '');

    if ($name === '' || $email === '') {
        json_error('Vui lòng nhập đầy đủ họ tên và email.');
    }
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen($email) > 255) {
        json_error('Email không hợp lệ.');
    }
    if (mb_strlen($name) > 100) {
        json_error('Họ và tên quá dài (tối đa 100 ký tự).');
    }

    $check = $pdo->prepare('SELECT id FROM users WHERE email = ? AND id != ?');
    $check->execute([$email, $user['id']]);
    if ($check->fetch()) {
        json_error('Email này đã có tài khoản khác sử dụng.');
    }

    $pdo->prepare('UPDATE users SET name = ?, email = ? WHERE id = ?')->execute([$name, $email, $user['id']]);
    // Cập nhật session để header hiện tên mới ngay.
    $_SESSION['name'] = $name;

    json_response(['success' => true, 'name' => $name, 'email' => $email]);
}

// ---------- Người dùng tự xoá tài khoản của mình ----------
// Admin không được tự xoá ở đây (tránh mất admin cuối cùng); nhờ admin khác xoá trong trang quản trị.
if ($action === 'delete-own' && $method === 'POST') {
    $user = require_login();
    if ($user['role'] === 'admin') {
        json_error('Tài khoản admin không thể tự xoá ở đây. Nhờ một admin khác xoá giúp trong trang Quản lý tài khoản.');
    }

    $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$user['id']]);
    $_SESSION = [];
    session_destroy();
    json_response(['success' => true]);
}

if ($action === 'delete' && $method === 'POST') {
    $admin = require_admin();
    $body = read_json_body();
    $id = (int) ($body['id'] ?? 0);
    if (!$id) json_error('Thiếu id.');
    if ($id === (int) $admin['id']) {
        json_error('Không thể tự xoá tài khoản đang đăng nhập.');
    }

    $pdo->prepare('DELETE FROM users WHERE id = ?')->execute([$id]);
    json_response(['success' => true]);
}

// Đổi tài khoản thường thành admin hoặc ngược lại.
if ($action === 'set-role' && $method === 'POST') {
    $admin = require_admin();
    $body = read_json_body();
    $id = (int) ($body['id'] ?? 0);
    $role = $body['role'] ?? '';
    if (!$id || !in_array($role, ['user', 'admin'], true)) {
        json_error('Thiếu id hoặc role không hợp lệ.');
    }
    if ($id === (int) $admin['id']) {
        json_error('Không thể tự đổi quyền của chính mình.');
    }

    $pdo->prepare('UPDATE users SET role = ? WHERE id = ?')->execute([$role, $id]);
    json_response(['success' => true]);
}

// Đổi mật khẩu của chính người đang đăng nhập.
if ($action === 'change-password' && $method === 'POST') {
    $user = require_login();
    $body = read_json_body();
    $currentPassword = (string) ($body['currentPassword'] ?? '');
    $newPassword = (string) ($body['newPassword'] ?? '');

    if ($currentPassword === '' || $newPassword === '') {
        json_error('Vui lòng nhập đầy đủ mật khẩu hiện tại và mật khẩu mới.');
    }
    if (mb_strlen($newPassword) < 6) {
        json_error('Mật khẩu mới phải có ít nhất 6 ký tự.');
    }

    $stmt = $pdo->prepare('SELECT password_hash FROM users WHERE id = ?');
    $stmt->execute([$user['id']]);
    $row = $stmt->fetch();
    if (!$row || !password_verify($currentPassword, $row['password_hash'])) {
        json_error('Mật khẩu hiện tại không đúng.', 401);
    }

    $hash = password_hash($newPassword, PASSWORD_BCRYPT);
    $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([$hash, $user['id']]);

    json_response(['success' => true]);
}

json_error('Không tìm thấy action phù hợp.', 404);
