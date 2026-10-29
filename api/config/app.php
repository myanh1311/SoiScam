<?php
// ============================================================
// CẤU HÌNH CHUNG CỦA BACKEND (CORS + gửi email mã xác nhận quên mật khẩu)
//
// File này KHÔNG chứa bí mật nào nên có thể đưa lên GitHub. Mọi giá trị
// thật (khoá EmailJS, domain thật khi deploy...) hãy đặt trong file
// api/config/app.local.php (đã nằm trong .gitignore) - file local được nạp
// TRƯỚC nên giá trị trong đó luôn thắng giá trị mặc định bên dưới.
// Xem mẫu: api/config/app.local.example.php
// ============================================================
if (is_file(__DIR__ . '/app.local.php')) {
    require_once __DIR__ . '/app.local.php';
}

// Các origin KHÁC domain của web mà vẫn được phép gọi API kèm cookie đăng
// nhập (mặc định để trống = chỉ chính domain của web mới gọi được API).
// Ví dụ khi deploy: ['https://ten-ban.com']
defined('ALLOWED_ORIGINS') or define('ALLOWED_ORIGINS', []);

// Địa chỉ gốc của web, dùng để tạo link "đặt lại mật khẩu" gửi qua email,
// ví dụ 'https://ten-ban.com'. Để trống thì chỉ tự
// suy ra được khi chạy trên localhost (an toàn trước tấn công giả Host).
defined('APP_BASE_URL') or define('APP_BASE_URL', '');

// EmailJS gọi từ SERVER (không còn gọi từ trình duyệt nữa). Cần bật mục
// "Allow EmailJS API for non-browser applications" trong EmailJS >
// Account > Security, và lấy Private Key ở cùng trang. Để trống = chưa
// cấu hình, khi đó chạy trên localhost sẽ hiện link đặt lại mật khẩu ngay
// trên trang để test (không bao giờ làm vậy trên server thật).
defined('EMAILJS_SERVICE_ID') or define('EMAILJS_SERVICE_ID', '');
defined('EMAILJS_TEMPLATE_ID') or define('EMAILJS_TEMPLATE_ID', '');
defined('EMAILJS_PUBLIC_KEY') or define('EMAILJS_PUBLIC_KEY', '');
defined('EMAILJS_PRIVATE_KEY') or define('EMAILJS_PRIVATE_KEY', '');

// Khoá API ImgBB (https://api.imgbb.com/) - dùng ở api/upload.php để tải ảnh
// bằng chứng lên. Chỉ nằm trên server, không bao giờ gửi xuống trình duyệt.
defined('IMGBB_API_KEY') or define('IMGBB_API_KEY', '');

// Gửi mã xác nhận quên mật khẩu qua SMTP (cách 2, dùng thay EmailJS) - vd Gmail:
// SMTP_HOST 'smtp.gmail.com', SMTP_PORT 465 (hoặc 587), SMTP_USER = địa chỉ
// Gmail, SMTP_PASS = "Mật khẩu ứng dụng" 16 ký tự (Tài khoản Google > Bảo mật
// > Xác minh 2 bước > Mật khẩu ứng dụng). KHÔNG dùng mật khẩu Gmail thật.
defined('SMTP_HOST') or define('SMTP_HOST', '');
defined('SMTP_PORT') or define('SMTP_PORT', 465);
defined('SMTP_USER') or define('SMTP_USER', '');
defined('SMTP_PASS') or define('SMTP_PASS', '');
defined('SMTP_FROM') or define('SMTP_FROM', '');
defined('SMTP_FROM_NAME') or define('SMTP_FROM_NAME', 'SoiScam');
