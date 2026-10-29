<?php
// ============================================================
// TẢI ẢNH BẰNG CHỨNG (trung gian phía server)
// Ưu tiên ImgBB; ImgBB lỗi hoặc chưa cấu hình khoá thì tự lưu ảnh vào thư
// mục uploads/ của web (trả về đường dẫn "uploads/<tên>.jpg").
//
// Trước đây trình duyệt gọi thẳng ImgBB và khoá API nằm ngay trong file JS
// (ai xem mã nguồn cũng lấy được). Giờ trình duyệt chỉ gửi ảnh tới file
// này; khoá ImgBB (IMGBB_API_KEY trong api/config/app.local.php) chỉ nằm
// trên server. Kèm kiểm tra loại file thật, dung lượng và giới hạn tần suất.
// ============================================================
require_once __DIR__ . '/lib/helpers.php';

send_cors_headers();
start_api_session();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_error('Phương thức không hợp lệ.', 405);
}

$pdo = get_pdo();
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
if (rate_limit_exceeded($pdo, 'upload_ip', $ip, 40, 60)) {
    rate_limit_error('Bạn tải ảnh quá nhiều, vui lòng thử lại sau.');
}

$file = $_FILES['image'] ?? null;
if (!$file || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || !is_uploaded_file($file['tmp_name'])) {
    json_error('Không nhận được file ảnh (có thể ảnh quá lớn).');
}
if ($file['size'] > 5 * 1024 * 1024) {
    json_error('Ảnh quá lớn (tối đa 5MB).');
}

// Kiểm tra bằng nội dung thật của file, không tin đuôi file / Content-Type do client gửi.
$info = @getimagesize($file['tmp_name']);
$allowed = [IMAGETYPE_JPEG, IMAGETYPE_PNG, IMAGETYPE_GIF, IMAGETYPE_WEBP];
if (!$info || !in_array($info[2], $allowed, true)) {
    json_error('Chỉ chấp nhận ảnh JPG, PNG, GIF hoặc WEBP.');
}

rate_limit_record($pdo, 'upload_ip', $ip);

// Gửi ảnh sang ImgBB. Trả về [url, lý do lỗi] - lý do chỉ để ghi log / chẩn đoán.
function upload_to_imgbb(string $tmpPath): array {
    $endpoint = 'https://api.imgbb.com/1/upload?key=' . urlencode(IMGBB_API_KEY);
    $body = http_build_query(['image' => base64_encode(file_get_contents($tmpPath))]);

    if (function_exists('curl_init')) {
        $ch = curl_init($endpoint);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 25,
        ]);
        $raw = curl_exec($ch);
        $reason = $raw === false ? 'curl: ' . curl_error($ch) : '';
        $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
    } else {
        $context = stream_context_create(['http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
            'content' => $body,
            'timeout' => 25,
            'ignore_errors' => true,
        ]]);
        $raw = @file_get_contents($endpoint, false, $context);
        $status = 0;
        $reason = $raw === false ? 'file_get_contents: không kết nối được ImgBB (kiểm tra extension openssl)' : '';
    }

    if ($raw === false) return ['', $reason];

    $data = json_decode($raw, true);
    $url = is_array($data) ? ($data['data']['url'] ?? '') : '';
    if (is_string($url) && strpos($url, 'https://') === 0) return [$url, ''];

    $apiMessage = is_array($data) ? ($data['error']['message'] ?? '') : '';
    return ['', 'ImgBB trả lỗi (HTTP ' . $status . '): ' . ($apiMessage ?: substr((string) $raw, 0, 200))];
}

// Lưu ảnh vào uploads/ cạnh thư mục api. Tên ngẫu nhiên, đuôi theo loại file thật.
function save_image_locally(string $tmpPath, int $imageType): string {
    $extensions = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_GIF => 'gif', IMAGETYPE_WEBP => 'webp'];
    $dir = dirname(__DIR__) . '/uploads';
    if (!is_dir($dir) && !mkdir($dir, 0755, true)) return '';

    // Chặn truy cập file PHP trong thư mục này (phòng hờ; tên file vốn đã ngẫu nhiên).
    $htaccess = $dir . '/.htaccess';
    if (!file_exists($htaccess)) {
        file_put_contents($htaccess, "<FilesMatch \"\\.(php|phtml|phar)$\">\n    Require all denied\n</FilesMatch>\n");
    }

    $name = bin2hex(random_bytes(16)) . '.' . $extensions[$imageType];
    return copy($tmpPath, $dir . '/' . $name) ? 'uploads/' . $name : '';
}

$url = '';
$reason = IMGBB_API_KEY === '' ? 'chưa cấu hình IMGBB_API_KEY' : '';
if (IMGBB_API_KEY !== '') {
    [$url, $reason] = upload_to_imgbb($file['tmp_name']);
    if ($url === '') error_log('SoiScam upload: ImgBB lỗi, chuyển sang lưu trên server. ' . $reason);
}
if ($url === '') {
    $url = save_image_locally($file['tmp_name'], $info[2]);
    $savedLocally = true;
}
if ($url === '') {
    json_error('Không lưu được ảnh, vui lòng thử lại sau.', 500);
}

$response = ['url' => $url];
// Chạy trên máy mình mà phải lưu cục bộ thì cho biết vì sao ImgBB không nhận.
if (!empty($savedLocally) && is_local_request()) $response['imgbbError'] = $reason;
json_response($response);
