<?php
// ============================================================
// TỐ CÁO SCAMMER: danh sách (gộp theo số tài khoản) / gửi tố cáo mới /
// admin duyệt / admin từ chối (xoá + gửi phản hồi)
// Việc gộp theo số tài khoản làm thẳng trong SQL (bảng scammers + reports
// liên kết scammer_id); admin duyệt/xoá chỉ cần report.id.
// ============================================================
require_once __DIR__ . '/lib/helpers.php';

send_cors_headers();
start_api_session();

$pdo = get_pdo();
$action = $_GET['action'] ?? 'list';
$method = $_SERVER['REQUEST_METHOD'];

// ---------- Gộp scammers + reports thành JSON cho frontend ----------
// Mỗi scammer kèm mảng reports. $publicOnly = true: chỉ lấy report đã duyệt,
// bỏ scammer không còn report công khai nào.
function fetch_grouped_scammers(PDO $pdo, bool $publicOnly): array {
    $reportsSql = 'SELECT * FROM reports';
    if ($publicOnly) {
        $reportsSql .= " WHERE status = 'approved'";
    }
    $reportsSql .= ' ORDER BY created_at DESC';
    $reportRows = $pdo->query($reportsSql)->fetchAll();

    $reportsByScammer = [];
    foreach ($reportRows as $row) {
        $reportsByScammer[$row['scammer_id']][] = [
            'id' => (int) $row['id'],
            'nameSender' => $row['name_sender'],
            'phoneSender' => $row['phone_sender'],
            'option' => $row['option_role'],
            'contentReport' => $row['content_report'],
            'images' => $row['images'] ? json_decode($row['images'], true) : [],
            'date' => str_replace(' ', 'T', $row['created_at']),
            'status' => $row['status'],
            'userId' => $row['user_id'] !== null ? (int) $row['user_id'] : null,
        ];
    }

    $scammerRows = $pdo->query('SELECT * FROM scammers ORDER BY latest_reported_at DESC')->fetchAll();

    $grouped = [];
    foreach ($scammerRows as $s) {
        $reports = $reportsByScammer[$s['id']] ?? [];
        if ($publicOnly && count($reports) === 0) {
            continue; // toàn bộ report của scammer này đang chờ duyệt -> ẩn khỏi trang công khai
        }
        $grouped[] = [
            'id' => (int) $s['id'],
            'bankNumber' => $s['bank_number'],
            'bankName' => $s['bank_name'],
            'nameScammer' => $s['name_scammer'],
            'phoneScammer' => $s['phone_scammer'],
            'date' => str_replace(' ', 'T', $s['first_reported_at']),
            'latestDate' => str_replace(' ', 'T', $s['latest_reported_at']),
            'reportCount' => count($reports),
            'reports' => $reports,
        ];
    }
    return $grouped;
}

if ($action === 'list' && $method === 'GET') {
    $publicOnly = ($_GET['publicOnly'] ?? '') === '1';
    if (!$publicOnly) {
        // Xem cả report đang chờ duyệt: chỉ admin.
        require_admin();
    }
    json_response(fetch_grouped_scammers($pdo, $publicOnly));
}

// ---------- Gửi tố cáo mới (gộp theo số tài khoản nếu đã có) ----------
if ($action === 'submit' && $method === 'POST') {
    // Bắt buộc đăng nhập: require_login() trả 401 nếu chưa có phiên, kể cả khi gọi thẳng API.
    $user = require_login();
    check_report_rate_limit($pdo);

    $body = read_json_body();
    $bankNumber = trim($body['bankNumber'] ?? '');
    $bankName = trim($body['bankName'] ?? '');
    $nameScammer = trim($body['nameScammer'] ?? '');
    $phoneScammer = trim($body['phoneScammer'] ?? '');
    $nameSender = trim($body['nameSender'] ?? '');
    $phoneSender = trim($body['phoneSender'] ?? '');
    $optionRole = trim($body['option'] ?? '');
    $contentReport = trim($body['contentReport'] ?? '');
    // Chỉ nhận link ảnh hợp lệ (xem sanitize_image_urls trong helpers.php).
    $images = sanitize_image_urls($body['images'] ?? []);

    if ($bankNumber === '' || $bankName === '' || $nameScammer === '' || $contentReport === '') {
        json_error('Thiếu thông tin bắt buộc.');
    }
    // Giới hạn độ dài khớp cột trong database (tránh lỗi 500).
    if (mb_strlen($bankNumber) > 50 || mb_strlen($bankName) > 255 || mb_strlen($nameScammer) > 255
        || mb_strlen($phoneScammer) > 20 || mb_strlen($phoneSender) > 20
        || mb_strlen($nameSender) > 255 || mb_strlen($optionRole) > 100) {
        json_error('Một số thông tin nhập vào quá dài, vui lòng rút gọn lại.');
    }
    if (mb_strlen($contentReport) > 5000) {
        json_error('Nội dung tố cáo quá dài (tối đa 5000 ký tự).');
    }

    $normalized = normalize_bank_number($bankNumber);
    $now = (new DateTime())->format('Y-m-d H:i:s');

    $find = $pdo->prepare('SELECT * FROM scammers WHERE bank_number_normalized = ?');
    $find->execute([$normalized]);
    $scammer = $find->fetch();

    if ($scammer) {
        // Đã có scammer trùng số tài khoản: chỉ thêm report mới, không ghi đè tên/ngân hàng/sđt
        // (tránh 1 đơn gõ nhầm đổi tên của tất cả đơn cũ). Chỉ cập nhật mốc tố cáo gần nhất
        // và điền sđt nếu trước đó chưa có.
        $scammerId = $scammer['id'];
        $pdo->prepare(
            'UPDATE scammers SET phone_scammer = ?, latest_reported_at = ? WHERE id = ?'
        )->execute([$scammer['phone_scammer'] ?: $phoneScammer, $now, $scammerId]);
    } else {
        $insertScammer = $pdo->prepare(
            'INSERT INTO scammers (bank_number, bank_number_normalized, bank_name, name_scammer, phone_scammer, first_reported_at, latest_reported_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $insertScammer->execute([$bankNumber, $normalized, $bankName, $nameScammer, $phoneScammer, $now, $now]);
        $scammerId = (int) $pdo->lastInsertId();
    }

    $insertReport = $pdo->prepare(
        'INSERT INTO reports (scammer_id, user_id, name_sender, phone_sender, option_role, content_report, images, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $insertReport->execute([
        $scammerId,
        $user['id'],
        $nameSender,
        $phoneSender,
        $optionRole,
        $contentReport,
        json_encode($images, JSON_UNESCAPED_UNICODE),
        'pending',
    ]);

    json_response(['success' => true, 'scammerId' => $scammerId]);
}

// ---------- Gửi email báo kết quả cho người tố cáo ----------
// Chỉ gửi nếu họ có tài khoản và đã cấu hình SMTP; lỗi gửi mail không làm hỏng thao tác của admin.
function email_reporter(PDO $pdo, array $report, bool $approved, string $reason = ''): void {
    if (!$report['user_id'] || !smtp_is_configured()) return;

    $stmt = $pdo->prepare('SELECT name, username, email FROM users WHERE id = ?');
    $stmt->execute([$report['user_id']]);
    $user = $stmt->fetch();
    if (!$user || $user['email'] === '') return;

    try {
        send_report_result_email(
            $user['email'],
            $user['name'] ?: $user['username'],
            $report['name_scammer'],
            $approved,
            $reason
        );
    } catch (Throwable $e) {
        error_log('SoiScam: gửi email kết quả tố cáo thất bại: ' . $e->getMessage());
    }
}

// ---------- Admin: duyệt 1 lượt tố cáo ----------
if ($action === 'approve' && $method === 'POST') {
    require_admin();
    $body = read_json_body();
    $reportId = (int) ($body['reportId'] ?? 0);
    if (!$reportId) json_error('Thiếu reportId.');

    // Lấy trước report (kèm tên scammer) để báo kết quả cho người tố cáo.
    $find = $pdo->prepare(
        'SELECT r.*, s.name_scammer, s.bank_number FROM reports r JOIN scammers s ON s.id = r.scammer_id WHERE r.id = ?'
    );
    $find->execute([$reportId]);
    $report = $find->fetch();
    if (!$report) json_error('Không tìm thấy tố cáo này.', 404);

    $pdo->prepare("UPDATE reports SET status = 'approved' WHERE id = ?")->execute([$reportId]);
    $pdo->prepare("INSERT INTO report_actions (action) VALUES ('approved')")->execute();

    if ($report['user_id']) {
        $pdo->prepare(
            'INSERT INTO notifications (user_id, name_scammer, bank_number, reason, type) VALUES (?, ?, ?, ?, ?)'
        )->execute([
            $report['user_id'],
            $report['name_scammer'],
            $report['bank_number'],
            'Tố cáo của bạn đã được duyệt và hiển thị công khai. Cảm ơn bạn đã góp phần cảnh báo cộng đồng!',
            'approved',
        ]);
    }
    email_reporter($pdo, $report, true);

    json_response(['success' => true]);
}

// ---------- Admin: từ chối / xoá 1 lượt tố cáo ----------
// Kèm lý do và thông báo cho người tố cáo (nếu có tài khoản). Hồ sơ scammer được giữ lại để
// lưu lịch sử, chỉ ẩn khỏi danh sách công khai khi hết report đã duyệt.
if ($action === 'reject' && $method === 'POST') {
    require_admin();
    $body = read_json_body();
    $reportId = (int) ($body['reportId'] ?? 0);
    $reason = trim($body['reason'] ?? '');
    if (!$reportId) json_error('Thiếu reportId.');

    $find = $pdo->prepare(
        'SELECT r.*, s.name_scammer, s.bank_number FROM reports r JOIN scammers s ON s.id = r.scammer_id WHERE r.id = ?'
    );
    $find->execute([$reportId]);
    $report = $find->fetch();
    if (!$report) json_error('Không tìm thấy tố cáo này.', 404);

    $pdo->prepare('DELETE FROM reports WHERE id = ?')->execute([$reportId]);
    $pdo->prepare("INSERT INTO report_actions (action) VALUES ('rejected')")->execute();

    if ($report['user_id']) {
        $pdo->prepare(
            'INSERT INTO notifications (user_id, name_scammer, bank_number, reason, type) VALUES (?, ?, ?, ?, ?)'
        )->execute([
            $report['user_id'],
            $report['name_scammer'],
            $report['bank_number'],
            $reason ?: 'Không có lý do cụ thể.',
            'rejected',
        ]);
    }
    email_reporter($pdo, $report, false, $reason ?: 'Không có lý do cụ thể.');

    json_response(['success' => true]);
}

// ---------- Tố cáo của tôi (myReports.html) ----------
// Report do chính người đang đăng nhập gửi, kể cả đang chờ duyệt.
if ($action === 'mine' && $method === 'GET') {
    $user = require_login();
    $stmt = $pdo->prepare(
        'SELECT r.*, s.id AS scammer_id, s.name_scammer, s.bank_number, s.bank_name
         FROM reports r JOIN scammers s ON s.id = r.scammer_id
         WHERE r.user_id = ? ORDER BY r.created_at DESC'
    );
    $stmt->execute([$user['id']]);
    $rows = $stmt->fetchAll();

    $result = array_map(function ($row) {
        return [
            'reportId' => (int) $row['id'],
            'groupId' => (int) $row['scammer_id'],
            'nameScammer' => $row['name_scammer'],
            'bankNumber' => $row['bank_number'],
            'bankName' => $row['bank_name'],
            'contentReport' => $row['content_report'],
            'status' => $row['status'],
            'date' => str_replace(' ', 'T', $row['created_at']),
        ];
    }, $rows);

    json_response($result);
}

// ---------- Người dùng tự xoá tố cáo của mình ----------
// Kiểm tra user_id khớp phiên đăng nhập (khác với reject của admin).
if ($action === 'delete-own' && $method === 'POST') {
    $user = require_login();
    $body = read_json_body();
    $reportId = (int) ($body['reportId'] ?? 0);
    if (!$reportId) json_error('Thiếu reportId.');

    $find = $pdo->prepare('SELECT * FROM reports WHERE id = ?');
    $find->execute([$reportId]);
    $report = $find->fetch();
    if (!$report) json_error('Không tìm thấy tố cáo này.', 404);
    if ((int) $report['user_id'] !== (int) $user['id']) {
        json_error('Bạn không có quyền xoá tố cáo này.', 403);
    }

    $pdo->prepare('DELETE FROM reports WHERE id = ?')->execute([$reportId]);
    json_response(['success' => true]);
}

json_error('Không tìm thấy action phù hợp.', 404);
