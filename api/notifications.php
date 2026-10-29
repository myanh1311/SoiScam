<?php
// ============================================================
// THÔNG BÁO CHO NGƯỜI DÙNG (khi admin từ chối tố cáo kèm lý do)
// ============================================================
require_once __DIR__ . '/lib/helpers.php';

send_cors_headers();
start_api_session();

$pdo = get_pdo();
$action = $_GET['action'] ?? 'list';
$method = $_SERVER['REQUEST_METHOD'];

if ($action === 'list' && $method === 'GET') {
    $user = require_login();
    $stmt = $pdo->prepare('SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC');
    $stmt->execute([$user['id']]);
    $rows = $stmt->fetchAll();

    $result = array_map(function ($row) {
        return [
            'id' => (int) $row['id'],
            'nameScammer' => $row['name_scammer'],
            'bankNumber' => $row['bank_number'],
            'reason' => $row['reason'],
            'type' => $row['type'] ?? 'rejected',
            'createdAt' => str_replace(' ', 'T', $row['created_at']) . 'Z',
        ];
    }, $rows);

    json_response($result);
}

if ($action === 'dismiss' && $method === 'POST') {
    $user = require_login();
    $body = read_json_body();
    $id = (int) ($body['id'] ?? 0);
    if (!$id) json_error('Thiếu id.');

    $stmt = $pdo->prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?');
    $stmt->execute([$id, $user['id']]);

    json_response(['success' => true]);
}

json_error('Không tìm thấy action phù hợp.', 404);
