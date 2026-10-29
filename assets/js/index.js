// Variables
const warningHeader = document.querySelectorAll(".warning__header");
const scammerList = document.querySelector(".scammer__list");
const today = document.querySelector(".today");
const alertScamDesc = document.querySelector(".alert-scam__desc");
const alertScamFull = document.querySelector(".alert-scam__custom");
let groupedScammers = [];  // dữ liệu đã gộp theo số tài khoản (tải sẵn từ backend, dùng để render + search)
const SCAMMER_PAGE_SIZE = 9; // số thẻ hiển thị mỗi lượt tải (trang Scamer)
let scammerRenderQueue = [];
let scammerRenderIndex = 0;
let scammerScrollObserver = null;
// End Variables

// Lưu ý: nhúng assets/js/scammer-data.js TRƯỚC file này (có normalizeBankNumber và API_BASE).

// HANDLE FORMAT DATE
function formatDate(dateString) {
    const date = dateString ? new Date(dateString) : new Date();

    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();

    const formattedDay = day < 10 ? `0${day}` : day;
    const formattedMonth = month < 10 ? `0${month}` : month;

    return `${formattedDay}/${formattedMonth}/${year}`;
}
// END HANDLE FORMAT DATE

if (today) {
    today.textContent = `Hôm nay ${formatDate(new Date())}`;
}

// Handle dropdown warning
warningHeader.forEach((item) => item.addEventListener("click", handleShowDropdown));

function handleShowDropdown(e) {
    const warningContent = e.target.nextElementSibling;
    const warningContentAll = document.querySelectorAll(".warning__content");
    const warningIcon = e.target.querySelector(".warning__header-icon");
    warningIconAll = document.querySelectorAll(".warning__header-icon");

    warningIconAll.forEach(item => {
        if (item !== warningIcon) {
            item.classList.remove("active");
        }
    })

    warningContentAll.forEach(item => {
        if (item != warningContent) {
            item.style.height = 0;
            item.classList.remove("active");
        }
    })

    warningContent.style.height = `${warningContent.scrollHeight}px`;
    warningContent.classList.toggle("active")
    warningIcon.classList.toggle("active");
    if (!warningContent.classList.contains("active")) {
        warningContent.style.height = 0
    }
}
// endHandle dropdown warning

// HTML 1 thẻ scammer (dùng cho trang chủ và trang Scamer).
// Cả thẻ là link sang scammerDetail.html?id=... để có URL thật, chia sẻ được.
function scammerItemHTML(item) {
    const badgeHTML = item.reportCount > 1
        ? `<span class="scammer__badge">${item.reportCount} lượt tố</span>`
        : "";
    return `<li class="scammer__item">
                    <a class="scammer__item-link" href="scammerDetail.html?id=${encodeURIComponent(item.id)}">
                        <img src="./assets/images/avatar-1.png" alt="avatar" class="scammer__avatar">
                        <div class="scammer__info">
                            <h3 class="scammer__name">${escapeHtml(item.nameScammer)}</h3>
                            <div class="scammer__date">#${item.id} - ${formatDate(item.latestDate)}</div>
                        </div>
                        ${badgeHTML}
                    </a>
                </li>`;
}

// HANDLE RENDER SCAMMER LIST (cảnh báo hôm nay - trang chủ)
function renderScammerToday(data) {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0); // Set time to midnight for comparison

    const todayData = data.filter(item => {
        const itemDate = new Date(item.latestDate || item.date);
        itemDate.setHours(0, 0, 0, 0); // Set time to midnight for comparison
        return itemDate.getTime() === todayDate.getTime();
    })

    alertScamDesc.textContent = `CÓ ${todayData.length} CẢNH BÁO`;
    scammerList.innerHTML = "";
    if (todayData && todayData.length > 0) {
        // Có thẻ thật thì bỏ class rút gọn padding (nếu lần trước đang rỗng).
        scammerList.classList.remove("scammer__list--empty");
        todayData
            .sort((a, b) => new Date(b.latestDate) - new Date(a.latestDate))
            .forEach((item) => {
                scammerList.insertAdjacentHTML("beforeend", scammerItemHTML(item));
            });
    } else {
        // Không có cảnh báo nào: thêm class để CSS rút gọn padding của khối trống.
        scammerList.classList.add("scammer__list--empty");
        scammerList.innerHTML = `<li class="scammer__state">Chưa có cảnh báo nào hôm nay</li>`;
    }
}

//END HANDLE RENDER SCAMMER LIST

// ---------- Render danh sách đầy đủ (trang Scamer) có infinite scroll ----------
// Tải 1 lần toàn bộ (để search), nhưng chỉ render từng đợt SCAMMER_PAGE_SIZE thẻ;
// cuộn gần cuối thì render thêm (IntersectionObserver).
function renderAllScammers(data) {
    scammerRenderQueue = data;
    scammerRenderIndex = 0;
    scammerList.innerHTML = "";

    if (scammerScrollObserver) {
        scammerScrollObserver.disconnect();
    }

    if (!data.length) {
        const message = groupedScammers.length
            ? "Không có scammer nào phù hợp với bộ lọc"
            : "Chưa có scammer nào được tố cáo";
        scammerList.classList.add("scammer__list--empty");
        scammerList.innerHTML = `<li class="scammer__state">${message}</li>`;
        return;
    }

    scammerList.classList.remove("scammer__list--empty");
    renderNextScammerPage();
}

function renderNextScammerPage() {
    const existingSentinel = scammerList.querySelector(".scammer__sentinel");
    if (existingSentinel) existingSentinel.remove();

    const nextItems = scammerRenderQueue.slice(scammerRenderIndex, scammerRenderIndex + SCAMMER_PAGE_SIZE);
    nextItems.forEach((item) => {
        scammerList.insertAdjacentHTML("beforeend", scammerItemHTML(item));
    });
    scammerRenderIndex += nextItems.length;

    if (scammerRenderIndex < scammerRenderQueue.length) {
        scammerList.insertAdjacentHTML(
            "beforeend",
            `<li class="scammer__sentinel scammer__state">Đang tải thêm...</li>`
        );
        observeScammerSentinel();
    } else if (scammerScrollObserver) {
        scammerScrollObserver.disconnect();
    }
}

function observeScammerSentinel() {
    const sentinel = scammerList.querySelector(".scammer__sentinel");
    if (!sentinel) return;

    if (!scammerScrollObserver) {
        scammerScrollObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    renderNextScammerPage();
                }
            });
        }, { rootMargin: "200px" });
    }
    scammerScrollObserver.observe(sentinel);
}
// END HANDLE RENDER FULL SCAMMER LIST

// ---------- Lọc + sắp xếp danh sách scammer (trang Scamer) ----------
// Dữ liệu đã tải đủ ở groupedScammers nên lọc ngay trên trình duyệt.
const filterBank = document.getElementById("filterBank");
const filterSort = document.getElementById("filterSort");

const SCAMMER_SORTERS = {
    latest: (a, b) => new Date(b.latestDate) - new Date(a.latestDate),
    oldest: (a, b) => new Date(a.latestDate) - new Date(b.latestDate),
    mostReports: (a, b) => b.reportCount - a.reportCount || new Date(b.latestDate) - new Date(a.latestDate),
    name: (a, b) => a.nameScammer.localeCompare(b.nameScammer, "vi"),
};

// Điền danh sách ngân hàng (không trùng) vào ô chọn.
function fillBankOptions() {
    const banks = [...new Set(groupedScammers.map((item) => (item.bankName || "").trim()).filter(Boolean))];
    banks.sort((a, b) => a.localeCompare(b, "vi"));
    filterBank.innerHTML =
        `<option value="">Tất cả ngân hàng</option>` +
        banks.map((bank) => `<option value="${escapeHtml(bank)}">${escapeHtml(bank)}</option>`).join("");
}

function applyScammerFilters() {
    const bank = filterBank.value;
    let result = groupedScammers.filter((item) => !bank || (item.bankName || "").trim() === bank);
    result = [...result].sort(SCAMMER_SORTERS[filterSort.value]);

    alertScamDesc.textContent = bank
        ? `CÓ ${result.length} SCAMMER THUỘC ${bank.toUpperCase()}`
        : `CÓ ${result.length} SCAMMER ĐÃ BỊ TỐ CÁO`;
    renderAllScammers(result);
}

if (filterBank && filterSort) {
    filterBank.addEventListener("change", applyScammerFilters);
    filterSort.addEventListener("change", applyScammerFilters);
}
// END LỌC + SẮP XẾP

// HANDLE GET SCAMMER DATA
async function getScammer() {
    try {
        // publicOnly: true - trang công khai chỉ hiện report đã được admin duyệt (server đã gộp sẵn).
        const { grouped } = await fetchGroupedScammers({ publicOnly: true });
        groupedScammers = grouped;
        if (today) {
            renderScammerToday(groupedScammers);
        }
        if (alertScamFull) {
            fillBankOptions();
            applyScammerFilters();
        }
    } catch (error) {
        console.error(error);
        if (alertScamFull) {
            alertScamDesc.textContent = "Không tải được dữ liệu";
            scammerList.classList.add("scammer__list--empty");
            scammerList.innerHTML = `<li class="scammer__state">Có lỗi xảy ra, vui lòng tải lại trang</li>`;
        }
    }
}
getScammer();
// END HANDLE GET SCAMMER DATA

// ---------- Modal xem nhanh 1 scammer (chỉ ở mục "Hôm nay" trang chủ) ----------
// Trang Scamer vẫn chuyển sang scammerDetail.html?id=...; modal có link tới trang đó để chia sẻ.
// Chỉ gắn khi có phần tử "today" (chỉ có ở index.html).
const quickViewModal = document.getElementById("quickViewModal");
const quickViewBody = document.getElementById("quickViewBody");

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function quickViewDetailHTML(scammer) {
    const reportsHTML = (scammer.reports || [])
        .map((report, index) => {
            const imageListHTML = (report.images || [])
                .filter((item) => /^(https:\/\/|uploads\/)/i.test(String(item)))
                .map((item) => `<img src="${escapeHtml(item)}" alt="Ảnh minh chứng">`)
                .join("");
            return `
                <div class="modal__group">
                    <div class="modal__profile">
                        <div class="modal__profile-avatar">
                            <img src="./assets/images/avatar-2.png" alt="avatar">
                        </div>
                        <div class="modal__info">
                            <h4 class="modal__info-name">${escapeHtml(report.nameSender || "Ẩn danh")}</h4>
                            <p class="modal__info-desc">Lượt tố cáo #${index + 1} - ${formatDate(report.date)}</p>
                        </div>
                    </div>
                    <div class="modal__detail">
                        <span class="modal__detail-title">Trạng thái</span>
                        <span class="modal__detail-text">${escapeHtml(report.option || "")}</span>
                    </div>
                    <div class="modal__detail">
                        <span class="modal__detail-title">Liên hệ</span>
                        <span class="modal__detail-text">${escapeHtml(report.phoneSender || "")}</span>
                    </div>
                    <div class="modal__textarea">
                        <span class="modal__detail-title">Nội dung tố cáo</span>
                        <p class="modal__textarea-content">${escapeHtml(report.contentReport || "")}</p>
                    </div>
                    ${imageListHTML ? `
                    <div class="modal__images">
                        <span class="modal__detail-title">Hình ảnh liên quan</span>
                        <div class="modal__preview-images">${imageListHTML}</div>
                    </div>` : ""}
                </div>`;
        })
        .join("");

    return `
        <div class="modal__group">
            <div class="modal__profile">
                <div class="modal__profile-avatar">
                    <img src="./assets/images/avatar-1.png" alt="avatar">
                </div>
                <div class="modal__info">
                    <h4 class="modal__info-name">${escapeHtml(scammer.nameScammer)}</h4>
                    <p class="modal__info-desc">#${scammer.id} - Bị tố lần đầu ngày ${formatDate(scammer.date)}</p>
                </div>
            </div>
            <div class="modal__detail">
                <span class="modal__detail-title">Số điện thoại</span>
                <span class="modal__detail-text">${escapeHtml(scammer.phoneScammer || "Chưa rõ")}</span>
            </div>
            <div class="modal__detail">
                <span class="modal__detail-title">Số tài khoản</span>
                <span class="modal__detail-text">${escapeHtml(scammer.bankNumber)}</span>
            </div>
            <div class="modal__detail">
                <span class="modal__detail-title">Ngân hàng</span>
                <span class="modal__detail-text">${escapeHtml(scammer.bankName)}</span>
            </div>
            <div class="modal__detail">
                <span class="modal__detail-title">Số lượt tố cáo</span>
                <span class="modal__detail-text modal__detail-text--highlight">${scammer.reportCount} lượt</span>
            </div>
            <div class="scammer-detail__actions">
                <a href="scammerDetail.html?id=${encodeURIComponent(scammer.id)}" class="btn scammer-detail__action-btn">Xem trang đầy đủ để chia sẻ</a>
            </div>
        </div>
        ${reportsHTML}
    `;
}

function openQuickViewModal(scammer) {
    quickViewBody.innerHTML = quickViewDetailHTML(scammer);
    quickViewModal.hidden = false;
}

function closeQuickViewModal() {
    quickViewModal.hidden = true;
    quickViewBody.innerHTML = "";
}

if (today && quickViewModal) {
    scammerList.addEventListener("click", (e) => {
        const link = e.target.closest(".scammer__item-link");
        if (!link) return;
        e.preventDefault();
        const id = new URLSearchParams(link.search).get("id");
        const scammer = groupedScammers.find((item) => String(item.id) === String(id));
        if (scammer) {
            openQuickViewModal(scammer);
        } else {
            // Không khớp dữ liệu đã tải (vd vừa có report mới): vẫn chuyển sang trang chi tiết.
            window.location.href = link.href;
        }
    });

    quickViewModal.addEventListener("click", (e) => {
        if (e.target.closest("[data-close-quickview]")) {
            closeQuickViewModal();
        }
    });

    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape" && !quickViewModal.hidden) {
            closeQuickViewModal();
        }
    });
}
// END MODAL XEM NHANH 1 SCAMMER
