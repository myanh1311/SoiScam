// ============================================================
// XÁC THỰC DÙNG CHUNG CHO TOÀN BỘ WEB (nhúng SAU scammer-data.js)
// Phiên đăng nhập là PHP session (cookie HttpOnly) nên JS không đọc trực
// tiếp được, phải hỏi server qua api/auth.php?action=me.
// Trang nào cần biết user ngay khi tải thì `await AUTH_READY` trước khi
// gọi getCurrentUser().
// ============================================================

let _currentUser = null;

function getCurrentUser() {
    return _currentUser;
}

// Resolve sau khi đã hỏi xong server "đang đăng nhập là ai" (hoặc chưa đăng nhập).
const AUTH_READY = (async () => {
    try {
        const { data } = await axios.get(`${API_BASE}auth.php`, { params: { action: "me" } });
        _currentUser = data.user || null;
    } catch (error) {
        console.error("Không kiểm tra được phiên đăng nhập:", error);
        _currentUser = null;
    }
    renderHeaderAccount();
    return _currentUser;
})();

// ---------- Đăng ký / đăng nhập / đăng xuất ----------
async function registerUser({ name, username, email, password }) {
    try {
        await axios.post(`${API_BASE}auth.php`, { name, username, email, password }, { params: { action: "register" } });
    } catch (error) {
        throw wrapApiError(error, "Có lỗi khi đăng ký, vui lòng thử lại.");
    }
}

// Trả về user (có role "user" | "admin") hoặc throw Error kèm thông báo lỗi.
async function loginUser({ username, password }) {
    try {
        const { data: user } = await axios.post(
            `${API_BASE}auth.php`,
            { username, password },
            { params: { action: "login" } }
        );
        _currentUser = user;
        renderHeaderAccount();
        return user;
    } catch (error) {
        throw wrapApiError(error, "Có lỗi khi đăng nhập, vui lòng thử lại.");
    }
}

// idToken lấy từ Google Identity Services (xem google-auth.js), server tự
// xác thực lại với Google trước khi mở phiên.
async function googleLoginUser({ idToken }) {
    try {
        const { data: user } = await axios.post(
            `${API_BASE}auth.php`,
            { idToken },
            { params: { action: "google-login" } }
        );
        _currentUser = user;
        renderHeaderAccount();
        return user;
    } catch (error) {
        throw wrapApiError(error, "Có lỗi khi đăng nhập bằng Google, vui lòng thử lại.");
    }
}

async function logoutUser() {
    try {
        await axios.post(`${API_BASE}auth.php`, {}, { params: { action: "logout" } });
    } catch (error) {
        console.error(error);
    }
    _currentUser = null;

    // Báo Google biết đã đăng xuất để trang login không tự đăng nhập lại ngay.
    if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
    }
}

// ---------- Quên mật khẩu (3 bước, xem forgot-password.html / reset-password.html) ----------

// Bước 1: server gửi mã 6 số về email. Luôn trả success dù email có tồn tại
// hay không. Khi chạy thử trên localhost chưa cấu hình email thì có thêm devCode.
async function requestPasswordReset(email) {
    try {
        const { data } = await axios.post(
            `${API_BASE}auth.php`,
            { email },
            { params: { action: "forgot-password" } }
        );
        return data;
    } catch (error) {
        throw wrapApiError(error, "Có lỗi khi gửi yêu cầu, vui lòng thử lại.");
    }
}

// Bước 2: mã đúng thì nhận resetToken (dùng 1 lần).
async function verifyResetCode(email, code) {
    try {
        const { data } = await axios.post(
            `${API_BASE}auth.php`,
            { email, code },
            { params: { action: "verify-reset-code" } }
        );
        return data.resetToken;
    } catch (error) {
        throw wrapApiError(error, "Có lỗi khi xác nhận mã, vui lòng thử lại.");
    }
}

// Bước 3: đặt mật khẩu mới.
async function resetPasswordWithToken(token, password) {
    try {
        await axios.post(
            `${API_BASE}auth.php`,
            { token, password },
            { params: { action: "reset-password" } }
        );
    } catch (error) {
        throw wrapApiError(error, "Có lỗi khi đặt lại mật khẩu, vui lòng thử lại.");
    }
}

// ---------- Trang cá nhân ----------

// Sửa họ tên / email, cập nhật luôn _currentUser để header đổi tên ngay.
async function updateOwnProfile(name, email) {
    try {
        const { data } = await axios.post(
            `${API_BASE}users.php`,
            { name, email },
            { params: { action: "update-profile" } }
        );
        if (_currentUser) {
            _currentUser = { ..._currentUser, name: data.name, email: data.email };
        }
        renderHeaderAccount();
        return _currentUser;
    } catch (error) {
        throw wrapApiError(error, "Có lỗi khi cập nhật thông tin, vui lòng thử lại.");
    }
}

async function changeOwnPassword(currentPassword, newPassword) {
    try {
        await axios.post(
            `${API_BASE}users.php`,
            { currentPassword, newPassword },
            { params: { action: "change-password" } }
        );
    } catch (error) {
        throw wrapApiError(error, "Có lỗi khi đổi mật khẩu, vui lòng thử lại.");
    }
}

async function deleteOwnAccount() {
    try {
        await axios.post(`${API_BASE}users.php`, {}, { params: { action: "delete-own" } });
    } catch (error) {
        throw wrapApiError(error, "Có lỗi khi xoá tài khoản, vui lòng thử lại.");
    }
    _currentUser = null;
}

// ---------- Widget đăng nhập ở header ----------
function renderHeaderAccount() {
    const container = document.getElementById("headerAccount");
    if (!container) return;

    const user = getCurrentUser();
    if (!user) {
        container.innerHTML = `<a href="login.html" class="header__auth-link">Đăng nhập</a>`;
        return;
    }

    // Admin có thêm link tắt về trang quản trị.
    const adminLinkHTML = user.role === "admin"
        ? `<a href="admin.html" class="header__auth-link header__auth-link--admin">Trang quản trị</a>`
        : "";

    container.innerHTML = `
        ${adminLinkHTML}
        <a href="my-reports.html" class="header__auth-link header__auth-link--name">Xin chào, ${escapeHeaderText(user.name || user.username)}</a>
        <button type="button" id="headerLogoutBtn" class="header__logout-btn">Đăng xuất</button>
    `;
    document.getElementById("headerLogoutBtn").addEventListener("click", async () => {
        await logoutUser();
        window.location.reload();
    });
}

function escapeHeaderText(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}
