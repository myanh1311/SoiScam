// ============================================================
// Tìm kiếm
// Tìm mờ (fuzzy, không phân biệt hoa/thường & dấu tiếng Việt)
// theo tên, số điện thoại, số tài khoản, tên ngân hàng.
// Kết quả hiển thị dạng dropdown ngay dưới ô tìm kiếm. Mỗi kết quả là
// 1 link điều hướng sang trang chi tiết riêng (scammer-detail.html?id=...),
// dùng groupedScammers từ index.js - đây là dữ liệu ĐÃ GỘP theo số tài
// khoản nên search cũng thấy luôn số lượt tố.
// ============================================================
(function () {
    const searchForms = document.querySelectorAll(".form-search");
    if (!searchForms.length) return;

    const MAX_RESULTS = 8;

    // Bỏ dấu tiếng Việt + chuẩn hoá chuỗi để so khớp
    // (NFD tách chữ cái và dấu ra làm 2 ký tự riêng, dải ̀-ͯ là các dấu
    // combining diacritical marks, xoá chúng đi để còn lại chữ cái không dấu)
    var DIACRITICS_REGEX = new RegExp("[̀-ͯ]", "g");
    function normalize(str) {
        return String(str || "")
            .normalize("NFD")
            .replace(DIACRITICS_REGEX, "")
            .replace(/đ/g, "d")
            .replace(/Đ/g, "D")
            .toLowerCase()
            .trim();
    }

    function debounce(fn, delay) {
        let timer;
        return (...args) => {
            clearTimeout(timer);
            timer = setTimeout(() => fn(...args), delay);
        };
    }

    function escapeHtml(str) {
        return String(str || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    // Bôi vàng phần khớp với từ khoá (giữ nguyên chữ gốc, chỉ so khớp phần đã bỏ dấu)
    function highlight(text, keyword) {
        const safeText = escapeHtml(text);
        if (!keyword) return safeText;
        const normalizedText = normalize(text);
        const idx = normalizedText.indexOf(keyword);
        if (idx === -1) return safeText;
        return `${escapeHtml(text.slice(0, idx))}<mark>${escapeHtml(text.slice(idx, idx + keyword.length))}</mark>${escapeHtml(text.slice(idx + keyword.length))}`;
    }

    function matchScammer(item, keyword) {
        const fields = [item.nameScammer, item.phoneScammer, item.bankNumber, item.bankName];
        return fields.some((field) => normalize(field).includes(keyword));
    }

    searchForms.forEach((form) => {
        const input = form.querySelector(".form-search__input");
        if (!input) return;

        const dropdown = document.createElement("div");
        dropdown.className = "search-results";
        dropdown.hidden = true;
        form.appendChild(dropdown);

        function closeDropdown() {
            dropdown.hidden = true;
            dropdown.innerHTML = "";
        }

        function showState(message) {
            dropdown.innerHTML = `<div class="search-results__state">${escapeHtml(message)}</div>`;
            dropdown.hidden = false;
        }

        function renderResults(keyword) {
            const data = typeof groupedScammers !== "undefined" ? groupedScammers : [];

            if (!data.length) {
                showState("Đang tải dữ liệu, vui lòng thử lại sau giây lát...");
                return;
            }

            const matches = data.filter((item) => matchScammer(item, keyword)).slice(0, MAX_RESULTS);

            if (!matches.length) {
                showState(`Không tìm thấy kết quả phù hợp với "${input.value.trim()}"`);
                return;
            }

            dropdown.innerHTML = matches
                .map((item) => {
                    const countText = item.reportCount > 1 ? ` · ${item.reportCount} lượt tố` : "";
                    return `
                <a class="search-results__item" href="scammer-detail.html?id=${encodeURIComponent(item.id)}">
                    <img src="./assets/images/avatar-1.png" alt="avatar" class="search-results__avatar">
                    <div class="search-results__info">
                        <h4 class="search-results__name">${highlight(item.nameScammer, keyword)}</h4>
                        <div class="search-results__meta">STK: ${highlight(item.bankNumber, keyword)} · ${escapeHtml(item.bankName || "")}${countText}</div>
                    </div>
                </a>`;
                })
                .join("");
            dropdown.hidden = false;
        }

        const debouncedSearch = debounce(() => {
            const keyword = normalize(input.value);
            if (!keyword) {
                closeDropdown();
                return;
            }
            renderResults(keyword);
        }, 250);

        input.addEventListener("input", debouncedSearch);

        input.addEventListener("focus", () => {
            if (input.value.trim()) debouncedSearch();
        });

        input.addEventListener("keydown", (e) => {
            if (e.key === "Escape") closeDropdown();
        });

        form.addEventListener("submit", (e) => {
            e.preventDefault();
            const keyword = normalize(input.value);
            if (keyword) renderResults(keyword);
        });

        document.addEventListener("click", (e) => {
            if (!form.contains(e.target)) {
                closeDropdown();
            }
        });
    });
})();
