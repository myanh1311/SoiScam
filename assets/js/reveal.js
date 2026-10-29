// ============================================================
// HIỆN DẦN KHI CUỘN TỚI (dùng chung mọi trang)
// Phần tử có class .reveal-up-scroll hoặc .reveal-el sẽ được gắn class
// "is-visible" khi cuộn tới gần; CSS (base.css) làm phần animation.
// Trình duyệt không có IntersectionObserver thì hiện ngay, không để nội
// dung bị kẹt ẩn.
// ============================================================
(function () {
    var targets = document.querySelectorAll(".reveal-up-scroll, .reveal-el");
    if (!targets.length) return;

    if (!("IntersectionObserver" in window)) {
        targets.forEach(function (el) {
            el.classList.add("is-visible");
        });
        return;
    }

    var observer = new IntersectionObserver(
        function (entries) {
            entries.forEach(function (entry) {
                if (entry.isIntersecting) {
                    entry.target.classList.add("is-visible");
                    observer.unobserve(entry.target);
                }
            });
        },
        { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );

    targets.forEach(function (el) {
        observer.observe(el);
    });
})();
