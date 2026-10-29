// ============================================================
// TRANG "TỐ CÁO CỦA TÔI" (cũng là trang cá nhân)
// Cần đăng nhập, chưa thì về login.html. Hiện tất cả report của user (kể cả đang chờ
// duyệt) và cho xoá report của chính mình. Chờ AUTH_READY (hỏi server ai đang đăng
// nhập) rồi mới quyết định có chặn trang không.
// ============================================================
const myReportsList = document.getElementById("myReportsList");
const myReportsStatus = document.getElementById("myReportsStatus");
const myNotifications = document.getElementById("myNotifications");
const myNotificationsList = document.getElementById("myNotificationsList");
const myNotificationsFilters = document.getElementById("myNotificationsFilters");
const changePasswordForm = document.getElementById("changePasswordForm");

// Hồ sơ cá nhân + thống kê + tìm kiếm/lọc + sửa thông tin + xoá tài khoản
const myProfileAvatar = document.getElementById("myProfileAvatar");
const myProfileName = document.getElementById("myProfileName");
const myProfileUsername = document.getElementById("myProfileUsername");
const myProfileEmail = document.getElementById("myProfileEmail");
const myProfileBadge = document.getElementById("myProfileBadge");
const editProfileForm = document.getElementById("editProfileForm");
const editProfileCancelBtn = document.getElementById("editProfileCancelBtn");
const editNameInput = document.getElementById("editNameInput");
const editEmailInput = document.getElementById("editEmailInput");
const editProfileError = document.getElementById("editProfileError");
const editProfileSuccess = document.getElementById("editProfileSuccess");
const editProfileSubmitBtn = document.getElementById("editProfileSubmitBtn");
const statMyTotal = document.getElementById("statMyTotal");
const statMyApproved = document.getElementById("statMyApproved");
const statMyPending = document.getElementById("statMyPending");
const statMyRejected = document.getElementById("statMyRejected");
const myReportsSearchInput = document.getElementById("myReportsSearchInput");
const myReportsStatusFilter = document.getElementById("myReportsStatusFilter");
const deleteAccountBtn = document.getElementById("deleteAccountBtn");
const myMenuItems = document.querySelectorAll(".my-menu__item[data-my-view]");
const myViews = document.querySelectorAll(".my-view[id^='myView-']");
const myMenuIndicator = document.getElementById("myMenuIndicator");

let currentUser = null;
let myNotificationsCache = []; // giữ lại để tính thống kê "bị từ chối"
let myNotificationsFilter = "all"; // "all" | "approved" | "rejected" - xem renderMyNotifications()

// ---------- Điều hướng giữa các mục (giống tab bên trang admin) ----------
// Bấm 1 mục thì ẩn các mục khác; thanh gạch chân trượt sang mục đang chọn.
function moveMenuIndicator(activeBtn) {
    if (!myMenuIndicator || !activeBtn) return;
    myMenuIndicator.style.left = `${activeBtn.offsetLeft}px`;
    myMenuIndicator.style.width = `${activeBtn.offsetWidth}px`;
    myMenuIndicator.classList.toggle("my-menu__indicator--danger", activeBtn.classList.contains("my-menu__item--danger"));
}

function switchMyView(view) {
    const activeBtn = Array.from(myMenuItems).find((item) => item.dataset.myView === view);
    myViews.forEach((section) => {
        const isTarget = section.id === `myView-${view}`;
        section.hidden = !isTarget;
        if (isTarget) {
            // Bỏ rồi thêm lại class để animation chạy lại mỗi lần chuyển mục.
            section.classList.remove("my-view--enter");
            void section.offsetWidth; // ép trình duyệt tính lại layout (restart animation)
            section.classList.add("my-view--enter");
        }
    });
    myMenuItems.forEach((item) => {
        item.classList.toggle("active", item.dataset.myView === view);
    });
    moveMenuIndicator(activeBtn);
    if (view === "profile") {
        editNameInput.value = currentUser?.name || "";
        editEmailInput.value = currentUser?.email || "";
        editProfileError.textContent = "";
        editProfileSuccess.hidden = true;
    }
}

myMenuItems.forEach((item) => {
    item.addEventListener("click", () => switchMyView(item.dataset.myView));
});

window.addEventListener("resize", () => {
    const active = Array.from(myMenuItems).find((item) => item.classList.contains("active"));
    if (active) moveMenuIndicator(active);
});

// Đếm số chạy dần lên cho các thẻ thống kê.
function animateNumber(el, target) {
    const from = Number(el.dataset.raw || 0);
    const to = Number(target) || 0;
    el.dataset.raw = to;
    if (from === to) {
        el.textContent = to;
        return;
    }
    const duration = 500;
    const start = performance.now();
    function tick(now) {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out
        el.textContent = Math.round(from + (to - from) * eased);
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

function showStatus(message, isError) {
    myReportsStatus.textContent = message;
    myReportsStatus.hidden = false;
    myReportsStatus.classList.toggle("my-reports__inline-status--error", Boolean(isError));
    clearTimeout(showStatus._timer);
    showStatus._timer = setTimeout(() => {
        myReportsStatus.hidden = true;
    }, 4000);
}

function formatDate(dateString) {
    const date = dateString ? new Date(dateString) : new Date();
    const day = date.getDate();
    const month = date.getMonth() + 1;
    const year = date.getFullYear();
    const formattedDay = day < 10 ? `0${day}` : day;
    const formattedMonth = month < 10 ? `0${month}` : month;
    return `${formattedDay}/${formattedMonth}/${year}`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function normalizeForSearch(text) {
    return String(text ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/đ/g, "d")
        .replace(/Đ/g, "D")
        .toLowerCase()
        .trim();
}

// Avatar chữ cái đầu (giống bảng "Quản lý tài khoản" bên trang admin).
function initials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    const first = parts[0][0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
}

// ---------- Huy hiệu uy tín ----------
// Tính từ số tố cáo đã được duyệt (không tính chờ/bị từ chối).
function reputationInfo(approvedCount) {
    if (approvedCount >= 10) return { label: "Chuyên gia chống lừa đảo", tier: "diamond" };
    if (approvedCount >= 5) return { label: "Cộng tác viên tích cực", tier: "gold" };
    if (approvedCount >= 1) return { label: "Người đóng góp", tier: "silver" };
    return null; // chưa có tố cáo nào được duyệt -> chưa hiện huy hiệu
}

function renderProfile() {
    if (!currentUser) return;
    myProfileAvatar.textContent = initials(currentUser.name || currentUser.username);
    myProfileName.textContent = currentUser.name || currentUser.username;
    myProfileUsername.textContent = `@${currentUser.username || ""}`;
    myProfileEmail.textContent = currentUser.email || "";

    const approvedCount = myItems.filter((i) => i.status === "approved").length;
    const rep = reputationInfo(approvedCount);
    if (rep) {
        myProfileBadge.textContent = rep.label;
        myProfileBadge.hidden = false;
        myProfileBadge.className = `my-profile__badge my-profile__badge--${rep.tier}`;
    } else {
        myProfileBadge.hidden = true;
    }
}

function renderStats() {
    const approvedCount = myItems.filter((i) => i.status === "approved").length;
    const pendingCount = myItems.filter((i) => i.status !== "approved").length;
    const rejectedCount = myNotificationsCache.filter((n) => n.type === "rejected").length;
    animateNumber(statMyApproved, approvedCount);
    animateNumber(statMyPending, pendingCount);
    animateNumber(statMyRejected, rejectedCount);
    animateNumber(statMyTotal, approvedCount + pendingCount + rejectedCount);
}

let myItems = [];

async function loadMyReports() {
    myReportsList.innerHTML = `<p class="my-reports__state">Đang tải dữ liệu...</p>`;
    try {
        const { data } = await axios.get(`${API_BASE}scammers.php`, { params: { action: "mine" } });
        myItems = data;
        renderProfile();
        renderStats();
        renderMyReports();
    } catch (error) {
        console.error(error);
        myReportsList.innerHTML = `<p class="my-reports__state">Có lỗi khi tải dữ liệu, vui lòng thử lại.</p>`;
    }
}

// Lọc theo trạng thái (select) + tìm theo từ khoá (tên/STK/ngân hàng).
function getFilteredMyItems() {
    const status = myReportsStatusFilter ? myReportsStatusFilter.value : "all";
    const keyword = normalizeForSearch(myReportsSearchInput ? myReportsSearchInput.value.trim() : "");
    return myItems.filter((item) => {
        if (status !== "all" && item.status !== status) return false;
        if (!keyword) return true;
        const haystack = normalizeForSearch(`${item.nameScammer} ${item.bankNumber} ${item.bankName}`);
        return haystack.includes(keyword);
    });
}

if (myReportsSearchInput) {
    myReportsSearchInput.addEventListener("input", renderMyReports);
}
if (myReportsStatusFilter) {
    myReportsStatusFilter.addEventListener("change", renderMyReports);
}

function renderMyReports() {
    if (!myItems.length) {
        myReportsList.innerHTML = `<p class="my-reports__state">Bạn chưa gửi tố cáo nào kể từ khi có tài khoản. <a href="report.html">Gửi tố cáo ngay</a>.</p>`;
        return;
    }

    const filtered = getFilteredMyItems();
    if (!filtered.length) {
        myReportsList.innerHTML = `<p class="my-reports__state">Không tìm thấy tố cáo phù hợp với bộ lọc.</p>`;
        return;
    }

    myReportsList.innerHTML = filtered
        .map((item) => {
            const isApproved = item.status === "approved";
            const statusHTML = isApproved
                ? `<span class="my-reports__status my-reports__status--approved">Đã duyệt</span>`
                : `<span class="my-reports__status my-reports__status--pending">Đang chờ duyệt</span>`;
            const linkHTML = isApproved
                ? `<a href="scammerDetail.html?id=${encodeURIComponent(item.groupId)}" class="my-reports__link">Xem trang công khai</a>`
                : "";

            return `
                <div class="my-reports__item">
                    <div class="my-reports__item-main">
                        <h3 class="my-reports__item-name">${escapeHtml(item.nameScammer)}</h3>
                        <p class="my-reports__item-meta">STK ${escapeHtml(item.bankNumber)} · ${escapeHtml(item.bankName || "")} · ${formatDate(item.date)}</p>
                        <p class="my-reports__item-content">${escapeHtml(item.contentReport || "")}</p>
                    </div>
                    <div class="my-reports__item-side">
                        ${statusHTML}
                        ${linkHTML}
                        <button type="button" class="my-reports__delete-btn" data-report-id="${item.reportId}">Xoá tố cáo này</button>
                    </div>
                </div>`;
        })
        .join("");
}

myReportsList.addEventListener("click", async (e) => {
    const btn = e.target.closest(".my-reports__delete-btn");
    if (!btn) return;
    const reportId = Number(btn.dataset.reportId);
    const item = myItems.find((i) => i.reportId === reportId);
    if (!item) return;

    const confirmed = confirm("Xoá tố cáo này? Hành động này không thể hoàn tác.");
    if (!confirmed) return;

    btn.disabled = true;
    btn.textContent = "Đang xoá...";
    try {
        await deleteOwnReport({ id: reportId });
        showStatus("Đã xoá tố cáo.", false);
        await loadMyReports();
    } catch (error) {
        console.error(error);
        showStatus(error.message || "Có lỗi khi xoá, vui lòng thử lại.", true);
        btn.disabled = false;
        btn.textContent = "Xoá tố cáo này";
    }
});

// ---------- Phản hồi từ admin (tố cáo bị từ chối/xoá kèm lý do) ----------
async function loadMyNotifications() {
    try {
        const { data } = await axios.get(`${API_BASE}notifications.php`, { params: { action: "list" } });
        myNotificationsCache = data;
        renderStats();
        renderMyNotifications();
    } catch (error) {
        console.error(error);
    }
}

// Đọc từ myNotificationsCache + myNotificationsFilter hiện tại, nên đổi bộ lọc không cần gọi lại API.
function renderMyNotifications() {
    if (!myNotificationsCache.length) {
        myNotifications.hidden = true;
        return;
    }
    myNotifications.hidden = false;

    const filtered =
        myNotificationsFilter === "all"
            ? myNotificationsCache
            : myNotificationsCache.filter((n) => n.type === myNotificationsFilter);

    if (!filtered.length) {
        // Còn thông báo nhưng loại đang chọn rỗng: báo rõ thay vì để trống.
        myNotificationsList.innerHTML = `<p class="my-notifications__empty">Không có phản hồi nào thuộc mục này.</p>`;
        return;
    }

    myNotificationsList.innerHTML = filtered
        .map((n) => {
            const isApproved = n.type === "approved";
            const titleHTML = isApproved
                ? `Tố cáo "<strong>${escapeHtml(n.nameScammer || "")}</strong>" (STK ${escapeHtml(n.bankNumber || "")}) đã được duyệt`
                : `Tố cáo "<strong>${escapeHtml(n.nameScammer || "")}</strong>" (STK ${escapeHtml(n.bankNumber || "")}) đã bị từ chối`;
            // Bị từ chối thì cho gửi lại nhanh, điền sẵn 3 ô qua query string của report.html.
            const reportAgainHTML = !isApproved
                ? `<a class="my-notifications__again-btn" href="report.html?bankNumber=${encodeURIComponent(n.bankNumber || "")}&bankName=${encodeURIComponent(n.bankName || "")}&nameScammer=${encodeURIComponent(n.nameScammer || "")}">Tố cáo lại</a>`
                : "";

            return `
                <div class="my-notifications__item my-notifications__item--${isApproved ? "approved" : "rejected"}">
                    <div class="my-notifications__item-main">
                        <p class="my-notifications__item-title">${titleHTML}</p>
                        <p class="my-notifications__item-reason">${escapeHtml(n.reason || (isApproved ? "" : "Không có lý do cụ thể."))}</p>
                        <p class="my-notifications__item-date">${formatDate(n.createdAt)}</p>
                    </div>
                    <div class="my-notifications__item-side">
                        ${reportAgainHTML}
                        <button type="button" class="my-notifications__dismiss-btn" data-notification-id="${n.id}">Đã xem</button>
                    </div>
                </div>`;
        })
        .join("");
}

myNotificationsList.addEventListener("click", async (e) => {
    const btn = e.target.closest(".my-notifications__dismiss-btn");
    if (!btn) return;
    btn.disabled = true;
    try {
        await axios.post(`${API_BASE}notifications.php`, { id: Number(btn.dataset.notificationId) }, { params: { action: "dismiss" } });
        await loadMyNotifications();
    } catch (error) {
        console.error(error);
        btn.disabled = false;
    }
});

// Bấm nút lọc: chỉ đổi state và render lại từ cache.
if (myNotificationsFilters) {
    myNotificationsFilters.addEventListener("click", (e) => {
        const btn = e.target.closest(".my-notifications__filter-btn");
        if (!btn) return;
        myNotificationsFilter = btn.dataset.filter;
        myNotificationsFilters
            .querySelectorAll(".my-notifications__filter-btn")
            .forEach((item) => item.classList.toggle("active", item === btn));
        renderMyNotifications();
    });
}

// ---------- Đổi mật khẩu ----------
if (changePasswordForm) {
    const changePasswordError = document.getElementById("changePasswordError");
    const changePasswordSuccess = document.getElementById("changePasswordSuccess");
    const changePasswordSubmitBtn = document.getElementById("changePasswordSubmitBtn");

    changePasswordForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        changePasswordError.textContent = "";
        changePasswordSuccess.hidden = true;

        const currentPassword = document.getElementById("currentPasswordInput").value;
        const newPassword = document.getElementById("newPasswordInput").value;
        const newPasswordConfirm = document.getElementById("newPasswordConfirmInput").value;

        if (newPassword.length < 6) {
            changePasswordError.textContent = "Mật khẩu mới phải có ít nhất 6 ký tự.";
            return;
        }
        if (newPassword !== newPasswordConfirm) {
            changePasswordError.textContent = "Mật khẩu nhập lại không khớp.";
            return;
        }

        changePasswordSubmitBtn.disabled = true;
        changePasswordSubmitBtn.textContent = "Đang xử lý...";
        try {
            await changeOwnPassword(currentPassword, newPassword);
            changePasswordForm.reset();
            changePasswordSuccess.hidden = false;
        } catch (error) {
            console.error(error);
            changePasswordError.textContent = error.message || "Có lỗi xảy ra, vui lòng thử lại.";
        } finally {
            changePasswordSubmitBtn.disabled = false;
            changePasswordSubmitBtn.textContent = "Đổi mật khẩu";
        }
    });
}

// ---------- Sửa họ tên / email ----------
// Điền sẵn mỗi khi chuyển sang mục "profile" (xem switchMyView).
if (editProfileForm) {
    if (editProfileCancelBtn) {
        editProfileCancelBtn.addEventListener("click", () => switchMyView("overview"));
    }

    editProfileForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        editProfileError.textContent = "";
        editProfileSuccess.hidden = true;

        const name = editNameInput.value.trim();
        const email = editEmailInput.value.trim();
        if (!name || !email) {
            editProfileError.textContent = "Vui lòng nhập đầy đủ họ tên và email.";
            return;
        }

        editProfileSubmitBtn.disabled = true;
        editProfileSubmitBtn.textContent = "Đang lưu...";
        try {
            currentUser = await updateOwnProfile(name, email);
            editProfileSuccess.hidden = false;
            renderProfile();
        } catch (error) {
            console.error(error);
            editProfileError.textContent = error.message || "Có lỗi xảy ra, vui lòng thử lại.";
        } finally {
            editProfileSubmitBtn.disabled = false;
            editProfileSubmitBtn.textContent = "Lưu thay đổi";
        }
    });
}

// ---------- Tự xoá tài khoản (vùng nguy hiểm) ----------
if (deleteAccountBtn) {
    deleteAccountBtn.addEventListener("click", async () => {
        const confirmed = confirm(
            "Xoá tài khoản của bạn? Bạn sẽ không thể đăng nhập lại được nữa. Hành động này không thể hoàn tác."
        );
        if (!confirmed) return;

        deleteAccountBtn.disabled = true;
        deleteAccountBtn.textContent = "Đang xoá...";
        try {
            await deleteOwnAccount();
            window.location.replace("index.html");
        } catch (error) {
            console.error(error);
            showStatus(error.message || "Có lỗi khi xoá tài khoản, vui lòng thử lại.", true);
            deleteAccountBtn.disabled = false;
            deleteAccountBtn.textContent = "Xoá tài khoản của tôi";
        }
    });
}

(async function init() {
    await AUTH_READY;
    currentUser = getCurrentUser();
    if (!currentUser) {
        window.location.replace("login.html");
        return;
    }
    switchMyView("overview");
    renderProfile();
    loadMyReports();
    loadMyNotifications();
})();
