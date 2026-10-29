// ============================================================
// HIỆU ỨNG TINH TẾ DÙNG CHUNG (đi kèm assets/css/fx.css)
//   1. Thanh tiến độ cuộn + nút "lên đầu trang"
//   2. Ánh sáng theo chuột trên thẻ
//   3. Ripple khi bấm nút
//   4. Thẻ mới render hiện so le
//   5. Skeleton khi danh sách đang tải
// Người dùng bật "giảm chuyển động" thì các hiệu ứng chuyển động tự tắt.
// ============================================================
(function () {
    "use strict";

    var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    var hasMouse = window.matchMedia("(hover: hover) and (pointer: fine)").matches;

    // Phần tử nào được áp dụng hiệu ứng nào
    var SPOT_SELECTOR = ".scammer__item-link, .warning__item, .hero__panel, .my-stat-card, .search-results__item";
    var RIPPLE_SELECTOR = ".btn, .hero__cta, .login-box__submit";
    var STAGGER_SELECTOR = ".scammer__item, .my-reports__item, .my-notifications__item";

    // ---------------- 1. Tiến độ cuộn + lên đầu trang ----------------
    var bar = null;
    var toTopBtn = null;

    function buildScrollUI() {
        if (!reduceMotion) {
            var wrap = document.createElement("div");
            wrap.className = "fx-progress";
            wrap.setAttribute("aria-hidden", "true");
            bar = document.createElement("div");
            bar.className = "fx-progress__bar";
            wrap.appendChild(bar);
            document.body.appendChild(wrap);
        }

        toTopBtn = document.createElement("button");
        toTopBtn.type = "button";
        toTopBtn.className = "fx-totop";
        toTopBtn.setAttribute("aria-label", "Lên đầu trang");
        toTopBtn.innerHTML =
            '<svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M4 11l5-5 5 5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
        toTopBtn.addEventListener("click", function () {
            window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
        });
        document.body.appendChild(toTopBtn);
    }

    var scrollQueued = false;
    function onScroll() {
        if (scrollQueued) return;
        scrollQueued = true;
        window.requestAnimationFrame(function () {
            scrollQueued = false;
            var doc = document.documentElement;
            var max = doc.scrollHeight - window.innerHeight;
            var y = window.scrollY || doc.scrollTop || 0;

            if (bar) bar.style.transform = "scaleX(" + (max > 0 ? Math.min(1, y / max) : 0) + ")";
            toTopBtn.classList.toggle("is-shown", y > 600);

            var header = document.querySelector(".header");
            if (header) header.classList.toggle("fx-scrolled", y > 8);
        });
    }

    // ---------------- 2. Ánh sáng theo chuột ----------------
    function markSpotTargets(root) {
        if (root.matches && root.matches(SPOT_SELECTOR)) root.classList.add("fx-spot");
        root.querySelectorAll(SPOT_SELECTOR).forEach(function (el) {
            el.classList.add("fx-spot");
        });
    }

    function onPointerMove(e) {
        if (e.pointerType && e.pointerType !== "mouse") return;
        var el = e.target.closest && e.target.closest(".fx-spot");
        if (!el) return;
        var rect = el.getBoundingClientRect();
        el.style.setProperty("--mx", e.clientX - rect.left + "px");
        el.style.setProperty("--my", e.clientY - rect.top + "px");
    }

    // ---------------- 3. Ripple ----------------
    function onClickRipple(e) {
        var host = e.target.closest && e.target.closest(RIPPLE_SELECTOR);
        if (!host || host.disabled) return;

        var rect = host.getBoundingClientRect();
        var size = Math.max(rect.width, rect.height) * 2;
        var dot = document.createElement("span");
        dot.className = "fx-ripple-dot";
        dot.style.width = dot.style.height = size + "px";
        dot.style.left = e.clientX - rect.left - size / 2 + "px";
        dot.style.top = e.clientY - rect.top - size / 2 + "px";

        if (getComputedStyle(host).position === "static") host.style.position = "relative";
        host.classList.add("fx-ripple-host");
        host.appendChild(dot);
        dot.addEventListener("animationend", function () {
            dot.remove();
        });
    }

    // ---------------- 4. Thẻ hiện so le ----------------
    function staggerIn(nodes) {
        var index = 0;
        nodes.forEach(function (node) {
            if (node.nodeType !== 1) return;
            var items = Array.from(node.querySelectorAll(STAGGER_SELECTOR));
            if (node.matches(STAGGER_SELECTOR)) items.unshift(node);

            items.forEach(function (item) {
                if (item.classList.contains("fx-in")) return;
                item.style.setProperty("--fx-i", Math.min(index, 12));
                item.classList.add("fx-in");
                index++;
            });
        });
    }

    // ---------------- 5. Skeleton ----------------
    function addSkeletons() {
        document.querySelectorAll(".scammer__list").forEach(function (list) {
            if (list.children.length) return;
            list.innerHTML = '<li class="scammer__skeleton" aria-hidden="true"></li>'.repeat(6);
        });
    }

    // ---------------- Khởi chạy ----------------
    // Thẻ được render thêm sau khi tải trang (danh sách, kết quả tìm kiếm...)
    // cũng được áp dụng hiệu ứng nhờ MutationObserver.
    function watchNewNodes() {
        new MutationObserver(function (mutations) {
            var added = [];
            mutations.forEach(function (m) {
                m.addedNodes.forEach(function (n) {
                    if (n.nodeType === 1) added.push(n);
                });
            });
            added.forEach(markSpotTargets);
            if (!reduceMotion) staggerIn(added);
        }).observe(document.body, { childList: true, subtree: true });
    }

    function init() {
        buildScrollUI();
        onScroll();
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll, { passive: true });

        markSpotTargets(document.body);
        if (hasMouse && !reduceMotion) {
            document.addEventListener("pointermove", onPointerMove, { passive: true });
        }
        if (!reduceMotion) {
            document.addEventListener("click", onClickRipple);
            addSkeletons();
            staggerIn([document.body]);
        }
        watchNewNodes();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
