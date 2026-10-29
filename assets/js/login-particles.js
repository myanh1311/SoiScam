// ============================================================
// HIỆU ỨNG HẠT TRÔI NHẸ Ở NỀN TRANG ĐĂNG NHẬP - lấy cảm hứng từ 1 video
// demo "Glassmorphism Login" trên Pinterest (khung kính mờ + lá mùa thu
// rơi ở nền). Khung kính mờ (.login-box) thì SoiScam đã có sẵn từ trước
// rồi, ở đây chỉ mượn Ý TƯỞNG "có hạt trôi động ở nền" - đổi lá mùa thu
// (không hợp 1 web cảnh báo lừa đảo) thành các đốm sáng nhỏ, trung tính,
// rơi rất chậm và mờ dần, để không làm rối mắt hay phá bố cục tối màu
// đang có.
//
// Thuần CSS animation (xem .login-particle trong login.css), file này
// chỉ tạo ra 1 số lượng phần tử ngẫu nhiên (vị trí/thời gian/kích thước
// khác nhau) rồi thả vào nền - không cần ảnh, không cần thư viện ngoài.
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
    // Tôn trọng lựa chọn "giảm chuyển động" của người dùng (accessibility) -
    // không tạo hạt động nếu trình duyệt/OS báo prefers-reduced-motion.
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return;
    }

    const loginPage = document.querySelector(".login-page");
    if (!loginPage) return;

    const wrap = document.createElement("div");
    wrap.className = "login-particles";
    wrap.setAttribute("aria-hidden", "true");

    const PARTICLE_COUNT = 22;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        const p = document.createElement("span");
        p.className = "login-particle";

        const size = (Math.random() * 3 + 2).toFixed(1); // 2px -> 5px
        const left = (Math.random() * 100).toFixed(2); // % ngang
        const duration = (Math.random() * 10 + 10).toFixed(1); // 10s -> 20s
        const delay = (Math.random() * -20).toFixed(1); // âm để hạt đã "đang rơi" ngay khi tải trang, không dồn cục lúc đầu
        const drift = (Math.random() * 60 - 30).toFixed(0); // trôi ngang -30px -> 30px

        p.style.width = `${size}px`;
        p.style.height = `${size}px`;
        p.style.left = `${left}%`;
        p.style.animationDuration = `${duration}s`;
        p.style.animationDelay = `${delay}s`;
        p.style.setProperty("--login-particle-drift", `${drift}px`);

        wrap.appendChild(p);
    }

    loginPage.prepend(wrap);
});
