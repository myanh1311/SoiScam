// ============================================================
// TRANG ĐĂNG NHẬP / ĐĂNG KÝ
// 1 form đăng nhập chung: role "admin" vào admin.html, role "user" vào trang chủ.
// Form đăng ký luôn tạo tài khoản role "user"; nâng quyền admin xem admin.js.
// ============================================================

// ---------- Quay lại trang cũ sau khi đăng nhập (?next=...) ----------
// Chỉ nhận đường dẫn tương đối, không nhận domain hay "//" và "\\" đầu chuỗi (chặn open redirect).
function getPostLoginRedirect(user) {
    const next = new URLSearchParams(window.location.search).get("next");
    const isSafeRelativePath = next && !/^https?:\/\//i.test(next) && !next.startsWith("//") && !next.startsWith("\\");
    if (isSafeRelativePath) return next;
    return user.role === "admin" ? "admin.html" : "index.html";
}

// Có ?next= thì đổi dòng mô tả để người dùng hiểu vì sao đang ở đây.
(function showRedirectNotice() {
    if (!new URLSearchParams(window.location.search).get("next")) return;
    const desc = document.querySelector("#loginForm .login-box__desc");
    if (desc) desc.textContent = "Bạn cần đăng nhập để tiếp tục.";
})();

// Đã đăng nhập sẵn thì chuyển đi luôn.
AUTH_READY.then((user) => {
    if (!user) return;
    window.location.replace(getPostLoginRedirect(user));
});

const loginForm = document.getElementById("loginForm");
const loginUsername = document.getElementById("loginUsername");
const loginPassword = document.getElementById("loginPassword");
const loginError = document.getElementById("loginError");
const loginSubmitBtn = document.getElementById("loginSubmitBtn");

const registerForm = document.getElementById("registerForm");
const registerName = document.getElementById("registerName");
const registerUsername = document.getElementById("registerUsername");
const registerEmail = document.getElementById("registerEmail");
const registerPassword = document.getElementById("registerPassword");
const registerPasswordConfirm = document.getElementById("registerPasswordConfirm");
const registerError = document.getElementById("registerError");
const registerSubmitBtn = document.getElementById("registerSubmitBtn");

document.getElementById("showRegisterBtn").addEventListener("click", () => {
    loginForm.hidden = true;
    registerForm.hidden = false;
});
document.getElementById("showLoginBtn").addEventListener("click", () => {
    registerForm.hidden = true;
    loginForm.hidden = false;
});

loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.textContent = "";
    loginError.classList.remove("login-box__error--success");

    const username = loginUsername.value.trim();
    const password = loginPassword.value;

    if (!username || !password) {
        loginError.textContent = "Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.";
        return;
    }

    loginSubmitBtn.disabled = true;
    loginSubmitBtn.textContent = "Đang đăng nhập...";
    try {
        const user = await loginUser({ username, password });
        window.location.replace(getPostLoginRedirect(user));
    } catch (error) {
        console.error(error);
        loginError.textContent = error.message || "Có lỗi khi đăng nhập, vui lòng thử lại.";
    } finally {
        loginSubmitBtn.disabled = false;
        loginSubmitBtn.textContent = "Đăng nhập";
    }
});

registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    registerError.textContent = "";

    const name = registerName.value.trim();
    const username = registerUsername.value.trim();
    const email = registerEmail.value.trim();
    const password = registerPassword.value;
    const passwordConfirm = registerPasswordConfirm.value;

    if (!name || !username || !email || !password) {
        registerError.textContent = "Vui lòng nhập đầy đủ thông tin.";
        return;
    }
    if (password.length < 6) {
        registerError.textContent = "Mật khẩu phải có ít nhất 6 ký tự.";
        return;
    }
    if (password !== passwordConfirm) {
        registerError.textContent = "Mật khẩu nhập lại không khớp.";
        return;
    }

    registerSubmitBtn.disabled = true;
    registerSubmitBtn.textContent = "Đang đăng ký...";
    try {
        await registerUser({ name, username, email, password });
        // Đăng ký xong KHÔNG tự động đăng nhập: chuyển sang form đăng nhập,
        // điền sẵn tên đăng nhập để người dùng tự đăng nhập lại.
        registerForm.reset();
        registerForm.hidden = true;
        loginForm.hidden = false;
        loginUsername.value = username;
        loginPassword.value = "";
        loginPassword.focus();
        loginError.textContent = "Đăng ký thành công! Vui lòng đăng nhập.";
        loginError.classList.add("login-box__error--success");
    } catch (error) {
        console.error(error);
        registerError.textContent = error.message || "Có lỗi khi đăng ký, vui lòng thử lại.";
    } finally {
        registerSubmitBtn.disabled = false;
        registerSubmitBtn.textContent = "Đăng ký";
    }
});
