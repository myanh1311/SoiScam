// ============================================================
// NÚT "HIỆN/ẨN MẬT KHẨU" (icon con mắt) DÙNG CHUNG cho mọi trang có
// form mật khẩu (đăng nhập, đăng ký, quên/đặt lại mật khẩu, đổi mật
// khẩu ở trang cá nhân...). Tự động tìm mọi ô input type="password"
// nằm trong .login-box__field và chèn thêm 1 nút icon bên trong ô đó -
// không cần sửa tay từng file HTML, chỉ cần nhúng file JS này vào trang.
//
// Bấm nút thì đổi input giữa type="password" (ẩn, hiện chấm tròn) và
// type="text" (hiện chữ thật), icon cũng đổi theo giữa "con mắt mở"
// (đang ẩn, bấm để xem) và "con mắt gạch chéo" (đang hiện, bấm để ẩn
// lại) - giống kiểu quen thuộc trên các web khác. Không lưu hay gửi đi
// đâu cả, chỉ đổi cách hiển thị ngay trên trình duyệt của chính họ.
// ============================================================
const EYE_ICON_OPEN = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z"></path><circle cx="12" cy="12" r="3"></circle></svg>`;
const EYE_ICON_OFF = `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.9 10.9 0 0 1 12 19c-7 0-11-7-11-7a21.6 21.6 0 0 1 5.06-6.06"></path><path d="M9.9 4.24A10.9 10.9 0 0 1 12 4c7 0 11 7 11 7a21.6 21.6 0 0 1-2.16 3.19"></path><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>`;

document.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".login-box__field input[type='password']").forEach((input) => {
        const wrap = document.createElement("div");
        wrap.className = "login-box__password-wrap";
        input.parentNode.insertBefore(wrap, input);
        wrap.appendChild(input);

        const toggleBtn = document.createElement("button");
        toggleBtn.type = "button";
        toggleBtn.className = "login-box__toggle-pass";
        toggleBtn.innerHTML = EYE_ICON_OPEN;
        toggleBtn.setAttribute("aria-label", "Hiện mật khẩu");
        wrap.appendChild(toggleBtn);

        toggleBtn.addEventListener("click", () => {
            const showing = input.type === "text";
            input.type = showing ? "password" : "text";
            toggleBtn.innerHTML = showing ? EYE_ICON_OPEN : EYE_ICON_OFF;
            toggleBtn.setAttribute("aria-label", showing ? "Hiện mật khẩu" : "Ẩn mật khẩu");
        });
    });
});
