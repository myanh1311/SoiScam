// ============================================================
// TRANG QUÊN MẬT KHẨU: bước 1 (nhập email) và bước 2 (nhập mã 6 số)
// trên cùng 1 trang. Mã đúng thì chuyển sang reset-password.html.
// ============================================================
const forgotForm = document.getElementById("forgotForm");
const forgotEmail = document.getElementById("forgotEmail");
const forgotError = document.getElementById("forgotError");
const forgotSubmitBtn = document.getElementById("forgotSubmitBtn");

const codeForm = document.getElementById("codeForm");
const codeInput = document.getElementById("codeInput");
const codeError = document.getElementById("codeError");
const codeDesc = document.getElementById("codeDesc");
const codeDev = document.getElementById("codeDev");
const codeSubmitBtn = document.getElementById("codeSubmitBtn");
const resendBtn = document.getElementById("resendBtn");
const changeEmailBtn = document.getElementById("changeEmailBtn");

let pendingEmail = "";
let resendTimer = null;

function showCodeStep(email, result) {
    pendingEmail = email;
    forgotForm.hidden = true;
    codeForm.hidden = false;
    codeError.textContent = "";
    codeDesc.textContent =
        `Chúng tôi đã gửi mã gồm 6 chữ số tới ${email}. Mã có hiệu lực trong ${result.expiresMinutes || 10} phút (kiểm tra cả mục Spam nhé).`;

    if (result.devCode) {
        codeDev.hidden = false;
        codeDev.textContent = `[Chế độ thử trên máy] Chưa cấu hình gửi email nên mã của bạn là: ${result.devCode}`;
        codeInput.value = result.devCode;
    } else {
        codeDev.hidden = true;
        codeInput.value = "";
    }
    codeInput.focus();
    startResendCountdown(result.resendSeconds || 60);
}

function startResendCountdown(seconds) {
    clearInterval(resendTimer);
    let left = seconds;
    resendBtn.disabled = true;
    resendBtn.textContent = `Gửi lại mã (${left}s)`;
    resendTimer = setInterval(() => {
        left -= 1;
        if (left <= 0) {
            clearInterval(resendTimer);
            resendBtn.disabled = false;
            resendBtn.textContent = "Gửi lại mã";
        } else {
            resendBtn.textContent = `Gửi lại mã (${left}s)`;
        }
    }, 1000);
}

forgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    forgotError.textContent = "";

    const email = forgotEmail.value.trim();
    if (!email) {
        forgotError.textContent = "Vui lòng nhập email.";
        return;
    }

    forgotSubmitBtn.disabled = true;
    forgotSubmitBtn.textContent = "Đang gửi...";
    try {
        const result = await requestPasswordReset(email);
        showCodeStep(email, result);
    } catch (error) {
        console.error(error);
        forgotError.textContent = error.message || "Có lỗi xảy ra, vui lòng thử lại.";
    } finally {
        forgotSubmitBtn.disabled = false;
        forgotSubmitBtn.textContent = "Gửi mã xác nhận";
    }
});

// Chỉ cho gõ số (kể cả khi dán mã có khoảng trắng).
codeInput.addEventListener("input", () => {
    codeInput.value = codeInput.value.replace(/\D/g, "").slice(0, 6);
});

codeForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    codeError.textContent = "";

    const code = codeInput.value.trim();
    if (!/^\d{6}$/.test(code)) {
        codeError.textContent = "Vui lòng nhập đủ 6 chữ số.";
        return;
    }

    codeSubmitBtn.disabled = true;
    codeSubmitBtn.textContent = "Đang kiểm tra...";
    try {
        const resetToken = await verifyResetCode(pendingEmail, code);
        window.location.href = "reset-password.html?token=" + encodeURIComponent(resetToken);
    } catch (error) {
        console.error(error);
        codeError.textContent = error.message || "Có lỗi xảy ra, vui lòng thử lại.";
        codeSubmitBtn.disabled = false;
        codeSubmitBtn.textContent = "Xác nhận";
    }
});

resendBtn.addEventListener("click", async () => {
    codeError.textContent = "";
    resendBtn.disabled = true;
    try {
        const result = await requestPasswordReset(pendingEmail);
        showCodeStep(pendingEmail, result);
    } catch (error) {
        codeError.textContent = error.message || "Không gửi lại được mã, vui lòng thử lại.";
        resendBtn.disabled = false;
    }
});

changeEmailBtn.addEventListener("click", () => {
    clearInterval(resendTimer);
    codeForm.hidden = true;
    forgotForm.hidden = false;
    forgotEmail.focus();
});
