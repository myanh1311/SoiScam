// ============================================================
// NÚT "ĐĂNG NHẬP BẰNG GOOGLE" (login.html) - dùng thư viện chính thức
// "Google Identity Services" của Google để hiện nút chọn tài khoản
// Google, nhận về 1 "ID token" (JWT) rồi gửi lên server (googleLoginUser
// trong auth.js -> api/auth.php action "google-login") để server tự
// xác thực lại với Google trước khi mở phiên đăng nhập thật.
//
// initGoogleSignIn() được gọi qua thuộc tính onload của thẻ <script>
// nạp thư viện Google (xem login.html) - không tự chạy ngay khi file
// này tải xong, vì thư viện Google (async) có thể tải xong trước hoặc
// sau file này, không đoán trước thứ tự được.
// ============================================================
function initGoogleSignIn() {
    const container = document.getElementById("googleBtnContainer");
    if (!container) return; // trang không có nút Google (không phải login.html)

    if (!window.google || !google.accounts || !google.accounts.id) {
        console.error("Không tải được thư viện Google Identity Services.");
        return;
    }

    // Chưa điền Client ID thật (còn để nguyên placeholder) -> im lặng ẩn
    // nút đi, không hiện lỗi rối mắt cho người dùng bình thường, chỉ log
    // ra console cho người đang phát triển biết.
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID.indexOf("DIEN_GOOGLE_CLIENT_ID") === 0) {
        console.warn(
            "Chưa cấu hình GOOGLE_CLIENT_ID trong assets/js/google-config.js " +
            "(và api/config/google.php) nên nút Đăng nhập bằng Google đang bị ẩn."
        );
        container.closest(".login-box__divider")?.remove?.();
        container.remove();
        return;
    }

    google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
    });

    // theme "outline" (nền trắng đồng nhất) thay vì "filled_black": nền
    // tối làm lộ rõ ô nền trắng bắt buộc quanh logo "G" nhiều màu (Google
    // không cho tuỳ biến chỗ này) -> nhìn bị vá 2 màu chỏi nhau. Nền
    // trắng cho cả nút thì đồng nhất, đây cũng là kiểu rất quen thuộc
    // (nhiều web nền tối vẫn để nguyên nút Google trắng như hàng thật).
    // shape "rectangular" để bo góc vừa phải, khớp các nút/ô khác trên
    // trang thay vì bo tròn hết viên thuốc như "pill".
    // size "large" để nút to/bo góc bằng các ô input và nút "Đăng nhập"
    // khác trên trang. LƯU Ý: với size "large", nếu trình duyệt đang
    // đăng nhập sẵn 1 tài khoản Google ĐÃ từng đồng ý đăng nhập vào web
    // này trước đó, Google sẽ tự hiện lại avatar/tên/email tài khoản đó
    // (nút "cá nhân hoá") - đây là hành vi cố định của Google, không tuỳ
    // biến được khi dùng size to. Với người dùng thật chưa từng đăng
    // nhập Google trên web này, nút vẫn hiện dạng "Sign in with Google"
    // chung chung bình thường.
    google.accounts.id.renderButton(container, {
        theme: "outline",
        shape: "rectangular",
        size: "large",
        text: "signin_with",
        logo_alignment: "left",
        width: Math.min(400, Math.round(container.clientWidth || 320)),
    });
}

async function handleGoogleCredential(response) {
    const errorEl = document.getElementById("googleLoginError");
    if (errorEl) errorEl.textContent = "";

    try {
        const user = await googleLoginUser({ idToken: response.credential });
        // getPostLoginRedirect() định nghĩa ở login.js (nạp trước file này,
        // xem thứ tự script trong login.html) - tôn trọng ?next= nếu có.
        window.location.replace(getPostLoginRedirect(user));
    } catch (error) {
        console.error(error);
        if (errorEl) errorEl.textContent = error.message || "Có lỗi khi đăng nhập bằng Google, vui lòng thử lại.";
    }
}
