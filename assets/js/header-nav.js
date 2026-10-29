// ============================================================
// MENU DI ĐỘNG CHO HEADER (dùng chung mọi trang có .header)
// Dưới 880px, .header_nav-list ẩn vào 1 bảng thả xuống, mở/đóng bằng
// nút hamburger .header__burger. Không phụ thuộc app.js (trang
// myReports.html/404.html không có app.js) nên tách file riêng.
// ============================================================
(function () {
    const header = document.querySelector(".header");
    if (!header) return;

    const burger = header.querySelector(".header__burger");
    const navList = header.querySelector(".header_nav-list");
    if (!burger || !navList) return;

    function closeMenu() {
        navList.classList.remove("is-open");
        burger.setAttribute("aria-expanded", "false");
    }

    function toggleMenu() {
        const isOpen = navList.classList.toggle("is-open");
        burger.setAttribute("aria-expanded", isOpen ? "true" : "false");
    }

    burger.addEventListener("click", (event) => {
        event.stopPropagation();
        toggleMenu();
    });

    navList.querySelectorAll(".header__nav-link").forEach((link) => {
        link.addEventListener("click", closeMenu);
    });

    document.addEventListener("click", (event) => {
        if (!header.contains(event.target)) closeMenu();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") closeMenu();
    });

    window.addEventListener("resize", () => {
        if (window.innerWidth > 880) closeMenu();
    });
})();
