<?php
// ============================================================
// THỐNG KÊ TỔNG QUAN CHO DASHBOARD ADMIN
// ============================================================
require_once __DIR__ . '/lib/helpers.php';

send_cors_headers();
start_api_session();

$pdo = get_pdo();
$action = $_GET['action'] ?? 'overview';

// ------------------------------------------------------------
// SỐ LIỆU CÔNG KHAI cho hero trang chủ (index.html) - AI CŨNG GỌI ĐƯỢC,
// không cần đăng nhập. Chỉ trả về 2 con số vô hại (không lộ số tài
// khoản người dùng, số đơn đang chờ duyệt...) để khoe uy tín cộng đồng.
// ------------------------------------------------------------
if ($action === 'public-overview') {
    $totalScammers = (int) $pdo->query('SELECT COUNT(*) FROM scammers')->fetchColumn();
    // Tổng SỐ TỐ CÁO nói chung (mọi trạng thái) - không dùng riêng số "đã
    // duyệt" cho ô số liệu công khai ở hero, vì chữ "đã duyệt" vô tình để
    // lộ ra rằng có quy trình xét duyệt nội bộ (giống đang khoe thông tin
    // dành cho admin). Số "đã duyệt" vẫn tồn tại, chỉ không phải là con
    // số chính hiển thị to ở trang chủ nữa.
    $totalReports = (int) $pdo->query('SELECT COUNT(*) FROM reports')->fetchColumn();
    $totalApproved = (int) $pdo->query("SELECT COUNT(*) FROM reports WHERE status = 'approved'")->fetchColumn();

    $approvedActions = (int) $pdo->query("SELECT COUNT(*) FROM report_actions WHERE action = 'approved'")->fetchColumn();
    $rejectedActions = (int) $pdo->query("SELECT COUNT(*) FROM report_actions WHERE action = 'rejected'")->fetchColumn();
    $totalActions = $approvedActions + $rejectedActions;
    $approvalRate = $totalActions > 0 ? round(($approvedActions / $totalActions) * 100) : null;

    json_response([
        'totalScammers' => $totalScammers,
        'totalReports' => $totalReports,
        'totalApprovedReports' => $totalApproved,
        'approvalRate' => $approvalRate,
    ]);
}

// Mọi action còn lại (dashboard admin) vẫn yêu cầu đăng nhập role admin.
require_admin();

if ($action === 'overview') {
    $totalScammers = (int) $pdo->query('SELECT COUNT(*) FROM scammers')->fetchColumn();
    $totalApproved = (int) $pdo->query("SELECT COUNT(*) FROM reports WHERE status = 'approved'")->fetchColumn();
    $totalPending = (int) $pdo->query("SELECT COUNT(*) FROM reports WHERE status = 'pending'")->fetchColumn();
    $totalUsers = (int) $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'user'")->fetchColumn();
    $totalAdmins = (int) $pdo->query("SELECT COUNT(*) FROM users WHERE role = 'admin'")->fetchColumn();

    $approvedActions = (int) $pdo->query("SELECT COUNT(*) FROM report_actions WHERE action = 'approved'")->fetchColumn();
    $rejectedActions = (int) $pdo->query("SELECT COUNT(*) FROM report_actions WHERE action = 'rejected'")->fetchColumn();
    $totalActions = $approvedActions + $rejectedActions;
    $approvalRate = $totalActions > 0 ? round(($approvedActions / $totalActions) * 100, 1) : null;

    json_response([
        'totalScammers' => $totalScammers,
        'totalApprovedReports' => $totalApproved,
        'totalPendingReports' => $totalPending,
        'totalUsers' => $totalUsers,
        'totalAdmins' => $totalAdmins,
        'approvedActions' => $approvedActions,
        'rejectedActions' => $rejectedActions,
        'approvalRate' => $approvalRate, // % trên tổng số đơn ĐÃ XỬ LÝ (không tính đơn còn đang chờ)
    ]);
}

// Số tố cáo GỬI LÊN mỗi ngày trong N ngày gần nhất (mặc định 30 ngày).
if ($action === 'timeline') {
    $days = max(7, min(90, (int) ($_GET['days'] ?? 30)));

    $stmt = $pdo->prepare(
        "SELECT DATE(created_at) AS day, COUNT(*) AS total
         FROM reports
         WHERE created_at >= (CURDATE() - INTERVAL ? DAY)
         GROUP BY DATE(created_at)
         ORDER BY day ASC"
    );
    $stmt->execute([$days - 1]);
    $rows = $stmt->fetchAll();
    $byDay = [];
    foreach ($rows as $row) {
        $byDay[$row['day']] = (int) $row['total'];
    }

    // Điền đủ các ngày không có tố cáo nào (giá trị 0) để vẽ biểu đồ liền mạch.
    $labels = [];
    $values = [];
    for ($i = $days - 1; $i >= 0; $i--) {
        $day = (new DateTime())->modify("-{$i} day")->format('Y-m-d');
        $labels[] = $day;
        $values[] = $byDay[$day] ?? 0;
    }

    json_response(['labels' => $labels, 'values' => $values]);
}

json_error('Không tìm thấy action phù hợp.', 404);
