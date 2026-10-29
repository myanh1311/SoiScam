// ============================================================
// HERO TRANG CHỦ (index.html)
// Lấy số liệu THẬT từ database qua api/stats.php?action=public-overview
// (endpoint công khai, không cần đăng nhập - xem api/stats.php) rồi cho
// chạy số đếm dần lên thay vì hiện thẳng. Nút Play + mũi tên cuộn xuống
// đều chỉ để cuộn mượt tới phần "Một số kiểu lừa đảo thường gặp" bên
// dưới - hero không có video/audio thật nên không cần điều khiển phát.
// ============================================================
(function () {
    const statScammersEl = document.getElementById("heroStatScammers");
    const statReportsEl = document.getElementById("heroStatReports");
    const approvalRateEl = document.getElementById("heroApprovalRate");
    const approvalBarEl = document.getElementById("heroApprovalBar");

    function animateNumber(el, target) {
        if (!el) return;
        const duration = 900;
        const start = performance.now();
        function tick(now) {
            const progress = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out
            el.textContent = Math.round(target * eased).toLocaleString("vi-VN");
            if (progress < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    async function loadHeroStats() {
        try {
            const { data } = await axios.get(`${API_BASE}stats.php`, { params: { action: "public-overview" } });
            // Chỉ hiện số ĐÃ DUYỆT (data.totalScammers giờ server đã lọc sẵn theo
            // đơn đã duyệt, data.totalApprovedReports là số đơn đã duyệt) - đơn
            // đang chờ duyệt sẽ KHÔNG làm 2 số này tăng ngay, đợi admin duyệt xong
            // mới tăng, dù chữ hiển thị vẫn ghi "Tổng tố cáo" chứ không ghi "đã duyệt".
            animateNumber(statScammersEl, data.totalScammers || 0);
            animateNumber(statReportsEl, data.totalApprovedReports || 0);

            if (approvalRateEl) {
                if (data.approvalRate === null || data.approvalRate === undefined) {
                    approvalRateEl.textContent = "Chưa có dữ liệu";
                } else {
                    approvalRateEl.textContent = `${data.approvalRate}%`;
                    if (approvalBarEl) approvalBarEl.style.width = `${data.approvalRate}%`;
                }
            }
        } catch (error) {
            console.error("Không tải được số liệu hero:", error);
        }
    }

    function scrollPastHero() {
        const target = document.querySelector(".warning__title") || document.querySelector(".alert-scam");
        if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    const playBtn = document.getElementById("heroPlayBtn");
    const scrollCue = document.getElementById("heroScrollCue");
    if (playBtn) playBtn.addEventListener("click", scrollPastHero);
    if (scrollCue) scrollCue.addEventListener("click", scrollPastHero);

    loadHeroStats();
})();
