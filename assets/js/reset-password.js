// ============================================================
// TRANG "ĐẶT LẠI MẬT KHẨU" - bước cuối: sau khi nhập đúng mã xác nhận ở
// trang Quên mật khẩu, người dùng được chuyển tới đây với ?token=... (token
// dùng 1 lần, hiệu lực 15 phút) rồi nhập mật khẩu mới.
// ============================================================
const resetForm = document.getElementById("resetForm");
const resetPassword = document.getElementById("resetPassword");
const resetPasswordConfirm = document.getElementById("resetPasswordConfirm");
const resetError = document.getElementById("resetError");
const resetSuccess = document.getElementById("resetSuccess");
const resetSubmitBtn = document.getElementById("resetSubmitBtn");
const resetDesc = document.getElementById("resetDesc");

const token = new URLSearchParams(window.location.search).get("token");
if (!token) {
    resetDesc.textContent = "Thiếu thông tin xác nhận. Vui lòng quay lại trang Quên mật khẩu để nhận mã xác nhận qua email.";
    resetForm.querySelectorAll("input, button").forEach((el) => (el.disabled = true));
}

resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    resetError.textContent = "";
    resetSuccess.hidden = true;

    const password = resetPassword.value;
    const passwordConfirm = resetPasswordConfirm.value;

    if (password.length < 6) {
        resetError.textContent = "Mật khẩu phải có ít nhất 6 ký tự.";
        return;
    }
    if (password !== passwordConfirm) {
        resetError.textContent = "Mật khẩu nhập lại không khớp.";
        return;
    }

    resetSubmitBtn.disabled = true;
    resetSubmitBtn.textContent = "Đang xử lý...";
    try {
        await resetPasswordWithToken(token, password);
        resetSuccess.hidden = false;
        resetForm.querySelectorAll("input, button").forEach((el) => (el.disabled = true));
        setTimeout(() => window.location.replace("login.html"), 2000);
    } catch (error) {
        console.error(error);
        resetError.textContent = error.message || "Có lỗi xảy ra, vui lòng thử lại.";
        resetSubmitBtn.disabled = false;
        resetSubmitBtn.textContent = "Đặt lại mật khẩu";
    }
});
