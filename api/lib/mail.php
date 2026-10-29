<?php
// ============================================================
// GỬI EMAIL (mã xác nhận OTP + thông báo kết quả tố cáo)
// Hai cách gửi, cấu hình trong api/config/app.local.php:
//   1) EmailJS  (EMAILJS_*)  - gọi REST API của EmailJS
//   2) SMTP     (SMTP_*)     - vd. Gmail với "mật khẩu ứng dụng"
// Nếu có cả hai thì dùng EmailJS cho mã OTP. Email thông báo kết quả tố cáo
// có nội dung riêng nên chỉ gửi được bằng SMTP.
// ============================================================

function email_is_configured(): bool {
    return EMAILJS_SERVICE_ID !== '' && EMAILJS_TEMPLATE_ID !== ''
        && EMAILJS_PUBLIC_KEY !== '' && EMAILJS_PRIVATE_KEY !== '';
}

function smtp_is_configured(): bool {
    return SMTP_HOST !== '' && SMTP_USER !== '' && SMTP_PASS !== '';
}

function mail_is_configured(): bool {
    return email_is_configured() || smtp_is_configured();
}

// Gửi mã OTP tới email người dùng. Trả true nếu nơi gửi báo đã nhận.
function send_otp_email(string $toEmail, string $toName, string $code, int $expiresMinutes): bool {
    if (email_is_configured()) {
        return send_otp_via_emailjs($toEmail, $toName, $code, $expiresMinutes);
    }
    if (smtp_is_configured()) {
        return smtp_send(
            $toEmail,
            'SoiScam - Mã xác nhận: ' . $code,
            otp_email_html($toName, $code, $expiresMinutes)
        );
    }
    return false;
}

function otp_email_html(string $toName, string $code, int $expiresMinutes): string {
    $name = htmlspecialchars($toName !== '' ? $toName : 'bạn', ENT_QUOTES, 'UTF-8');
    return '<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#111">'
        . '<h2 style="margin:0 0 12px">SoiScam - Mã xác nhận</h2>'
        . '<p>Xin chào ' . $name . ',</p>'
        . '<p>Mã xác nhận của bạn là:</p>'
        . '<p style="font-size:34px;font-weight:700;letter-spacing:8px;margin:16px 0">' . $code . '</p>'
        . '<p>Mã có hiệu lực trong ' . $expiresMinutes . ' phút. Tuyệt đối không chia sẻ mã này cho ai.</p>'
        . '<p style="color:#666;font-size:13px">Nếu bạn không yêu cầu, hãy bỏ qua email này.</p>'
        . '</div>';
}

// ------------------------------------------------------------
// CÁCH 1: EmailJS. Template nên dùng {{otp_code}} và {{expires_minutes}}.
// ------------------------------------------------------------
function send_otp_via_emailjs(string $toEmail, string $toName, string $code, int $expiresMinutes): bool {
    return emailjs_send([
        'to_email' => $toEmail,
        'to_name' => $toName,
        'otp_code' => $code,
        'passcode' => $code,
        'expires_minutes' => (string) $expiresMinutes,
        'time' => $expiresMinutes . ' phút',
        'message' => 'Mã xác nhận SoiScam của bạn là ' . $code
            . ' (hiệu lực ' . $expiresMinutes . ' phút). Không chia sẻ mã này cho ai.',
    ]);
}

// Gọi EmailJS REST API với các biến của template.
function emailjs_send(array $templateParams): bool {
    $payload = json_encode([
        'service_id' => EMAILJS_SERVICE_ID,
        'template_id' => EMAILJS_TEMPLATE_ID,
        'user_id' => EMAILJS_PUBLIC_KEY,
        'accessToken' => EMAILJS_PRIVATE_KEY,
        'template_params' => $templateParams,
    ]);
    $context = stream_context_create(['http' => [
        'method' => 'POST',
        'header' => "Content-Type: application/json\r\n",
        'content' => $payload,
        'timeout' => 12,
        'ignore_errors' => true,
    ]]);
    $raw = @file_get_contents('https://api.emailjs.com/api/v1.0/email/send', false, $context);
    if ($raw === false) return false;

    $statusLine = $http_response_header[0] ?? '';
    if (!preg_match('#\s200\s#', $statusLine)) {
        error_log('SoiScam: EmailJS từ chối: ' . $statusLine . ' ' . substr((string) $raw, 0, 200));
        return false;
    }
    return true;
}

// ------------------------------------------------------------
// CÁCH 2: SMTP tối giản (không cần cài thư viện). Cổng 465 dùng SSL trực
// tiếp, cổng 587 dùng STARTTLS; đăng nhập kiểu AUTH LOGIN.
// ------------------------------------------------------------

// Đọc 1 phản hồi của SMTP server, trả [mã, nội dung].
function smtp_read($fp): array {
    $text = '';
    $code = 0;
    while (($line = fgets($fp, 1024)) !== false) {
        $text .= $line;
        $code = (int) substr($line, 0, 3);
        if (strlen($line) < 4 || $line[3] !== '-') break;
    }
    return [$code, $text];
}

// Gửi 1 lệnh và kiểm tra server trả đúng mã mong đợi.
function smtp_cmd($fp, string $cmd, array $okCodes): bool {
    fwrite($fp, $cmd . "\r\n");
    [$code, $text] = smtp_read($fp);
    if (!in_array($code, $okCodes, true)) {
        // Không ghi tên đăng nhập/mật khẩu (đã mã hoá base64) vào log.
        $shown = preg_match('/^(EHLO|STARTTLS|AUTH|MAIL|RCPT|DATA)/', $cmd) ? $cmd : '(dữ liệu đăng nhập)';
        error_log('SoiScam SMTP: lệnh "' . $shown . '" bị từ chối: ' . trim($text));
        return false;
    }
    return true;
}

function smtp_send(string $to, string $subject, string $html): bool {
    $port = (int) SMTP_PORT;
    $fp = @stream_socket_client(
        ($port === 465 ? 'ssl://' : 'tcp://') . SMTP_HOST . ':' . $port,
        $errno, $errstr, 12
    );
    if (!$fp) {
        error_log("SoiScam SMTP: không kết nối được ($errno) $errstr");
        return false;
    }
    stream_set_timeout($fp, 15);

    try {
        [$code] = smtp_read($fp);
        if ($code !== 220) return false;
        if (!smtp_cmd($fp, 'EHLO localhost', [250])) return false;

        // Cổng 587 phải nâng cấp lên TLS trước khi đăng nhập.
        if (!in_array($port, [465, 25, 2525], true)) {
            if (!smtp_cmd($fp, 'STARTTLS', [220])) return false;
            if (!@stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) return false;
            if (!smtp_cmd($fp, 'EHLO localhost', [250])) return false;
        }

        $from = SMTP_FROM !== '' ? SMTP_FROM : SMTP_USER;
        if (!smtp_cmd($fp, 'AUTH LOGIN', [334])) return false;
        if (!smtp_cmd($fp, base64_encode(SMTP_USER), [334])) return false;
        if (!smtp_cmd($fp, base64_encode(SMTP_PASS), [235])) return false;
        if (!smtp_cmd($fp, 'MAIL FROM:<' . $from . '>', [250])) return false;
        if (!smtp_cmd($fp, 'RCPT TO:<' . $to . '>', [250, 251])) return false;
        if (!smtp_cmd($fp, 'DATA', [354])) return false;

        fwrite($fp, smtp_build_message($from, $to, $subject, $html) . "\r\n.\r\n");
        [$code, $text] = smtp_read($fp);
        if ($code !== 250) {
            error_log('SoiScam SMTP: gửi thư thất bại: ' . trim($text));
            return false;
        }
        fwrite($fp, "QUIT\r\n");
        return true;
    } finally {
        fclose($fp);
    }
}

// Ghép header + nội dung HTML (base64 để giữ nguyên tiếng Việt có dấu).
function smtp_build_message(string $from, string $to, string $subject, string $html): string {
    $headers = [
        'From: =?UTF-8?B?' . base64_encode(SMTP_FROM_NAME) . '?= <' . $from . '>',
        'To: <' . $to . '>',
        'Subject: =?UTF-8?B?' . base64_encode($subject) . '?=',
        'Date: ' . date('r'),
        'Message-ID: <' . bin2hex(random_bytes(8)) . '@soiscam>',
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
    ];
    return implode("\r\n", $headers) . "\r\n\r\n" . chunk_split(base64_encode($html), 76, "\r\n");
}

// ------------------------------------------------------------
// EMAIL THÔNG BÁO KẾT QUẢ TỐ CÁO (admin duyệt / từ chối)
// Chỉ gửi khi đã cấu hình SMTP; lỗi gửi chỉ ghi log, không làm hỏng thao tác của admin.
// ------------------------------------------------------------
function send_report_result_email(string $toEmail, string $toName, string $scammerName, bool $approved, string $reason): bool {
    if (!smtp_is_configured()) return false;

    $name = htmlspecialchars($toName !== '' ? $toName : 'bạn', ENT_QUOTES, 'UTF-8');
    $scammer = htmlspecialchars($scammerName, ENT_QUOTES, 'UTF-8');

    if ($approved) {
        $subject = 'SoiScam - Tố cáo của bạn đã được duyệt';
        $message = 'Tố cáo của bạn về <b>' . $scammer . '</b> đã được duyệt và hiển thị công khai. '
            . 'Cảm ơn bạn đã góp phần cảnh báo cộng đồng!';
    } else {
        $subject = 'SoiScam - Tố cáo của bạn chưa được duyệt';
        $message = 'Rất tiếc, tố cáo của bạn về <b>' . $scammer . '</b> chưa được duyệt.'
            . '<br><br><b>Lý do:</b> ' . htmlspecialchars($reason, ENT_QUOTES, 'UTF-8')
            . '<br><br>Bạn có thể bổ sung thông tin và gửi lại tố cáo.';
    }

    $html = '<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;color:#111">'
        . '<h2 style="margin:0 0 12px">' . $subject . '</h2>'
        . '<p>Xin chào ' . $name . ',</p>'
        . '<p>' . $message . '</p>'
        . '<p style="color:#666;font-size:13px">Đây là email tự động từ SoiScam.</p>'
        . '</div>';

    return smtp_send($toEmail, $subject, $html);
}
