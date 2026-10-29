<?php
// ============================================================
// KẾT NỐI DATABASE
// Mặc định khớp XAMPP mới cài (localhost, user "root", không mật khẩu).
// Khi deploy: copy db.local.example.php thành db.local.php rồi điền thông tin
// thật. File local được nạp trước nên thắng giá trị mặc định, và không bị đưa lên Git.
// ============================================================
if (is_file(__DIR__ . '/db.local.php')) {
    require_once __DIR__ . '/db.local.php';
}
defined('DB_HOST') or define('DB_HOST', 'localhost');
defined('DB_NAME') or define('DB_NAME', 'soiscam');
defined('DB_USER') or define('DB_USER', 'root');
defined('DB_PASS') or define('DB_PASS', '');
defined('DB_CHARSET') or define('DB_CHARSET', 'utf8mb4');

function get_pdo(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
        try {
            $pdo = new PDO($dsn, DB_USER, DB_PASS, [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]);
        } catch (PDOException $e) {
            http_response_code(500);
            echo json_encode([
                'error' => 'Không kết nối được database. Kiểm tra MySQL đã bật và đã import api/schema.sql chưa.',
            ]);
            exit;
        }
    }
    return $pdo;
}
