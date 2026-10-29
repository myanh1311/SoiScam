// ============================================================
// TRANG ADMIN: Thống kê / Danh sách scammer / Đợi duyệt / Quản lý tài khoản
// Chỉ tài khoản role "admin" vào được (server kiểm tra bằng require_admin()).
// report.id là khoá chính thật trong bảng reports. Có chọn nhiều dòng để
// duyệt/xoá hàng loạt và phân trang.
// ============================================================
const adminShell = document.getElementById("adminShell");
const adminViewTitle = document.getElementById("adminViewTitle");
const adminStatusMsg = document.getElementById("adminStatusMsg");
const adminSearchInput = document.getElementById("adminSearchInput");
const adminProfileName = document.getElementById("adminProfileName");
const adminLogoutBtn = document.getElementById("adminLogoutBtn");

const listTableBody = document.getElementById("listTableBody");
const listCountLabel = document.getElementById("listCountLabel");
const listPagination = document.getElementById("listPagination");
const pendingTableBody = document.getElementById("pendingTableBody");
const pendingCountLabel = document.getElementById("pendingCountLabel");
const pendingPagination = document.getElementById("pendingPagination");
const pendingBadge = document.getElementById("pendingBadge");

const reportDetailModal = document.getElementById("reportDetailModal");
const reportDetailBody = document.getElementById("reportDetailBody");

const accountsTableBody = document.getElementById("accountsTableBody");
const accountsCountLabel = document.getElementById("accountsCountLabel");
const accountsSearchInput = document.getElementById("accountsSearchInput");
const accountsRoleFilter = document.getElementById("accountsRoleFilter");
const accountsExportBtn = document.getElementById("accountsExportBtn");
const sortByReportCountBtn = document.getElementById("sortByReportCountBtn");
const sortReportCountIcon = document.getElementById("sortReportCountIcon");
const accountDetailModal = document.getElementById("accountDetailModal");
const accountDetailBody = document.getElementById("accountDetailBody");

const rejectReasonModal = document.getElementById("rejectReasonModal");
const rejectReasonInput = document.getElementById("rejectReasonInput");
const rejectModalDesc = document.getElementById("rejectModalDesc");
const confirmRejectBtn = document.getElementById("confirmRejectBtn");

const VIEW_TITLES = {
    stats: "Thống kê tổng quan",
    list: "Quản lý tố cáo lừa đảo",
    pending: "Tố cáo đang chờ duyệt",
    accounts: "Quản lý tài khoản người dùng",
};

const PAGE_SIZE = 10;

let groupedScammersAll = [];
let approvedFlatReports = [];
let pendingFlatReports = [];
let accountsAll = [];
let currentAdmin = null;

let listPage = 1;
let pendingPage = 1;
const selectedListIds = new Set();
const selectedPendingIds = new Set();

let statsTimelineChart = null;

// null = không sắp xếp (theo ngày tạo mới nhất), "asc"/"desc" = theo số tố cáo
let reportCountSortDir = null;

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

function showStatus(message, isError) {
    adminStatusMsg.textContent = message;
    adminStatusMsg.hidden = false;
    adminStatusMsg.classList.toggle("admin-status--error", Boolean(isError));
    clearTimeout(showStatus._timer);
    showStatus._timer = setTimeout(() => {
        adminStatusMsg.hidden = true;
    }, 4000);
}

// ---------- Cổng đăng nhập: chặn nếu chưa đăng nhập hoặc không phải admin ----------
(async function initAdminPage() {
    await AUTH_READY;
    const user = getCurrentUser();
    if (!user || user.role !== "admin") {
        window.location.replace("login.html");
        return;
    }
    currentAdmin = user;
    adminProfileName.textContent = user.name || user.username;
    adminShell.hidden = false;

    loadAdminData();
    loadAccountsData();
    loadStats();
})();

adminLogoutBtn.addEventListener("click", async () => {
    await logoutUser();
    window.location.replace("login.html");
});

// ---------- Chuyển tab sidebar ----------
document.querySelectorAll(".admin-sidebar__link[data-view]").forEach((link) => {
    link.addEventListener("click", () => {
        const view = link.dataset.view;
        document.querySelectorAll(".admin-sidebar__link[data-view]").forEach((el) => {
            el.classList.toggle("active", el === link);
        });
        document.querySelectorAll(".admin-view").forEach((section) => {
            section.hidden = section.id !== `view-${view}`;
        });
        adminViewTitle.textContent = VIEW_TITLES[view] || "Quản trị";
        if (view === "stats") loadStats();
    });
});

// ---------- Tải và làm phẳng dữ liệu (mỗi report giữ report.id thật) ----------
function flattenReports(groups) {
    const flat = [];
    groups.forEach((group) => {
        group.reports.forEach((report) => {
            flat.push({
                report,
                groupId: group.id,
                nameScammer: group.nameScammer,
                bankNumber: group.bankNumber,
                bankName: group.bankName,
                phoneScammer: group.phoneScammer,
            });
        });
    });
    flat.sort((a, b) => new Date(b.report.date) - new Date(a.report.date));
    return flat;
}

function itemId(item) {
    return item.report.id;
}

function findItemById(id, list) {
    return list.find((item) => item.report.id === Number(id));
}

async function loadAdminData() {
    listTableBody.innerHTML = `<tr><td colspan="9" class="admin-table__state">Đang tải dữ liệu...</td></tr>`;
    pendingTableBody.innerHTML = `<tr><td colspan="9" class="admin-table__state">Đang tải dữ liệu...</td></tr>`;
    try {
        const { grouped } = await fetchGroupedScammers(); // không publicOnly -> lấy cả report đang chờ duyệt
        groupedScammersAll = grouped;

        const allFlat = flattenReports(groupedScammersAll);
        approvedFlatReports = allFlat.filter((item) => item.report.status === "approved");
        pendingFlatReports = allFlat.filter((item) => item.report.status !== "approved");

        listPage = 1;
        pendingPage = 1;
        selectedListIds.clear();
        selectedPendingIds.clear();
        renderListTable();
        renderPendingTable();
        updatePendingBadge();
    } catch (error) {
        console.error(error);
        const errorRow = `<tr><td colspan="9" class="admin-table__state">${escapeHtml(error.message || "Có lỗi khi tải dữ liệu, vui lòng thử lại.")}</td></tr>`;
        listTableBody.innerHTML = errorRow;
        pendingTableBody.innerHTML = errorRow;
    }
}

function updatePendingBadge() {
    if (pendingFlatReports.length > 0) {
        pendingBadge.textContent = pendingFlatReports.length;
        pendingBadge.hidden = false;
    } else {
        pendingBadge.hidden = true;
    }
}

// ---------- Phân trang (dùng chung cho 2 bảng) ----------
function paginate(list, page) {
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return { pageItems: list.slice(start, start + PAGE_SIZE), totalPages, safePage };
}

function renderPagination(container, totalPages, currentPage, onChange) {
    if (totalPages <= 1) {
        container.innerHTML = "";
        return;
    }
    container.innerHTML = `
        <button type="button" class="admin-pagination__btn" data-dir="prev" ${currentPage <= 1 ? "disabled" : ""}>‹ Trước</button>
        <span class="admin-pagination__info">Trang ${currentPage} / ${totalPages}</span>
        <button type="button" class="admin-pagination__btn" data-dir="next" ${currentPage >= totalPages ? "disabled" : ""}>Sau ›</button>
    `;
    container.querySelectorAll("[data-dir]").forEach((btn) => {
        btn.addEventListener("click", () => {
            onChange(btn.dataset.dir === "prev" ? currentPage - 1 : currentPage + 1);
        });
    });
}

// ---------- Bảng Danh sách scammer (report đã duyệt, có tìm kiếm) ----------
function getFilteredApprovedReports() {
    const keyword = normalizeForSearch(adminSearchInput.value.trim());
    if (!keyword) return approvedFlatReports;
    return approvedFlatReports.filter((item) => {
        const haystack = normalizeForSearch(
            `${item.nameScammer} ${item.bankNumber} ${item.bankName} ${item.phoneScammer}`
        );
        return haystack.includes(keyword);
    });
}

function renderListTable() {
    const filtered = getFilteredApprovedReports();
    listCountLabel.textContent = `(có ${approvedFlatReports.length} đơn tố cáo)`;

    if (!filtered.length) {
        const message = approvedFlatReports.length
            ? "Không tìm thấy đơn tố cáo phù hợp."
            : "Chưa có đơn tố cáo nào được duyệt.";
        listTableBody.innerHTML = `<tr><td colspan="9" class="admin-table__state">${message}</td></tr>`;
        listPagination.innerHTML = "";
        updateBatchBar("list");
        return;
    }

    const { pageItems, totalPages, safePage } = paginate(filtered, listPage);
    listPage = safePage;
    const totalForDisplayId = filtered.length;
    const startIndex = (safePage - 1) * PAGE_SIZE;

    listTableBody.innerHTML = pageItems
        .map((item, index) => adminRowHTML(item, totalForDisplayId - startIndex - index, "list"))
        .join("");
    renderPagination(listPagination, totalPages, safePage, (page) => {
        listPage = page;
        renderListTable();
    });
    updateBatchBar("list");
}

adminSearchInput.addEventListener("input", () => {
    listPage = 1;
    renderListTable();
});

// ---------- Bảng Đợi duyệt ----------
function renderPendingTable() {
    pendingCountLabel.textContent = `(có ${pendingFlatReports.length} tố cáo chờ duyệt)`;

    if (!pendingFlatReports.length) {
        pendingTableBody.innerHTML = `<tr><td colspan="9" class="admin-table__state">Không có tố cáo nào đang chờ duyệt.</td></tr>`;
        pendingPagination.innerHTML = "";
        updateBatchBar("pending");
        return;
    }

    const { pageItems, totalPages, safePage } = paginate(pendingFlatReports, pendingPage);
    pendingPage = safePage;
    const startIndex = (safePage - 1) * PAGE_SIZE;

    pendingTableBody.innerHTML = pageItems
        .map((item, index) => adminRowHTML(item, pendingFlatReports.length - startIndex - index, "pending"))
        .join("");
    renderPagination(pendingPagination, totalPages, safePage, (page) => {
        pendingPage = page;
        renderPendingTable();
    });
    updateBatchBar("pending");
}

// ---------- 1 dòng trong bảng (dùng chung 2 bảng, khác nhau ở nút hành động) ----------
function adminRowHTML(item, displayId, mode) {
    const { report } = item;
    const id = itemId(item);
    const selected = mode === "pending" ? selectedPendingIds.has(id) : selectedListIds.has(id);
    const actionsHTML =
        mode === "pending"
            ? `
                <button type="button" class="admin-action-link" data-action="view" data-id="${id}">Chi tiết</button>
                <button type="button" class="admin-icon-btn admin-icon-btn--approve" data-action="approve" data-id="${id}" title="Duyệt">✔️</button>
                <button type="button" class="admin-icon-btn admin-icon-btn--danger" data-action="reject" data-id="${id}" title="Từ chối / Xoá">🗑️</button>`
            : `
                <button type="button" class="admin-action-link" data-action="view" data-id="${id}">Chi tiết</button>
                <button type="button" class="admin-icon-btn admin-icon-btn--danger" data-action="reject" data-id="${id}" title="Xoá">🗑️</button>`;

    return `
        <tr>
            <td><input type="checkbox" class="admin-row-select" data-scope="${mode}" data-id="${id}" ${selected ? "checked" : ""}></td>
            <td>#${displayId}</td>
            <td>
                <button type="button" class="admin-table__name-link" data-action="view" data-id="${id}">
                    ${escapeHtml(item.nameScammer)}
                </button>
            </td>
            <td>${escapeHtml(item.bankNumber)}</td>
            <td>${escapeHtml(item.bankName)}</td>
            <td>${escapeHtml(item.phoneScammer || "Chưa rõ")}</td>
            <td>${escapeHtml(report.nameSender || "Ẩn danh")}</td>
            <td>${formatDate(report.date)}</td>
            <td class="admin-table__actions">${actionsHTML}</td>
        </tr>`;
}

// ---------- Chọn nhiều dòng + thanh hành động hàng loạt ----------
function updateBatchBar(scope) {
    const bar = document.getElementById(`${scope}BatchBar`);
    const countLabel = document.getElementById(`${scope}SelectedCount`);
    const selected = scope === "pending" ? selectedPendingIds : selectedListIds;
    if (selected.size > 0) {
        bar.hidden = false;
        countLabel.textContent = `Đã chọn ${selected.size}`;
    } else {
        bar.hidden = true;
    }
}

document.addEventListener("change", (e) => {
    if (e.target.matches(".admin-row-select")) {
        const scope = e.target.dataset.scope;
        const id = Number(e.target.dataset.id);
        const selected = scope === "pending" ? selectedPendingIds : selectedListIds;
        if (e.target.checked) selected.add(id);
        else selected.delete(id);
        updateBatchBar(scope);
    }
    if (e.target.matches(".admin-select-all")) {
        const scope = e.target.dataset.scope;
        const body = scope === "pending" ? pendingTableBody : listTableBody;
        const selected = scope === "pending" ? selectedPendingIds : selectedListIds;
        body.querySelectorAll(".admin-row-select").forEach((cb) => {
            cb.checked = e.target.checked;
            const id = Number(cb.dataset.id);
            if (e.target.checked) selected.add(id);
            else selected.delete(id);
        });
        updateBatchBar(scope);
    }
});

document.querySelectorAll("[data-batch-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
        const scope = btn.dataset.batchScope;
        const action = btn.dataset.batchAction;
        const selected = scope === "pending" ? selectedPendingIds : selectedListIds;
        const sourceList = scope === "pending" ? pendingFlatReports : approvedFlatReports;
        const items = [...selected].map((id) => findItemById(id, sourceList)).filter(Boolean);
        if (!items.length) return;

        if (action === "approve") {
            btn.disabled = true;
            try {
                await Promise.all(items.map((item) => approveReport(item.report)));
                showStatus(`Đã duyệt ${items.length} tố cáo.`, false);
                await loadAdminData();
            } catch (error) {
                console.error(error);
                showStatus(error.message || "Có lỗi khi duyệt hàng loạt.", true);
            } finally {
                btn.disabled = false;
            }
        } else if (action === "reject") {
            openRejectReasonModal(items);
        }
    });
});

// ---------- Modal xem chi tiết 1 đơn tố cáo ----------
function openReportDetailModal(item, mode) {
    const { report } = item;
    const imageListHTML = (report.images || [])
        .filter((url) => /^(https:\/\/|uploads\/)/i.test(String(url)))
        .map((url) => `<img src="${escapeHtml(url)}" alt="ảnh minh chứng">`)
        .join("");

    const actionsHTML =
        mode === "pending"
            ? `
                <div class="admin-detail-modal__actions">
                    <button type="button" class="btn admin-detail-modal__approve" data-action="approve" data-id="${itemId(item)}">Duyệt tố cáo này</button>
                    <button type="button" class="admin-detail-modal__reject" data-action="reject" data-id="${itemId(item)}">Từ chối / Xoá</button>
                </div>`
            : `
                <div class="admin-detail-modal__actions">
                    <button type="button" class="admin-detail-modal__reject" data-action="reject" data-id="${itemId(item)}">Xoá đơn tố cáo này</button>
                </div>`;

    reportDetailBody.innerHTML = `
        <div class="modal__group">
            <div class="modal__detail">
                <span class="modal__detail-title">Chủ tài khoản</span>
                <span class="modal__detail-text">${escapeHtml(item.nameScammer)}</span>
            </div>
            <div class="modal__detail">
                <span class="modal__detail-title">Số tài khoản</span>
                <span class="modal__detail-text">${escapeHtml(item.bankNumber)}</span>
            </div>
            <div class="modal__detail">
                <span class="modal__detail-title">Ngân hàng</span>
                <span class="modal__detail-text">${escapeHtml(item.bankName)}</span>
            </div>
            <div class="modal__detail">
                <span class="modal__detail-title">Sđt đối tượng</span>
                <span class="modal__detail-text">${escapeHtml(item.phoneScammer || "Chưa rõ")}</span>
            </div>
        </div>
        <div class="modal__group">
            <div class="modal__detail">
                <span class="modal__detail-title">Người gửi đơn</span>
                <span class="modal__detail-text">${escapeHtml(report.nameSender || "Ẩn danh")}</span>
            </div>
            <div class="modal__detail">
                <span class="modal__detail-title">Liên hệ</span>
                <span class="modal__detail-text">${escapeHtml(report.phoneSender || "")}</span>
            </div>
            <div class="modal__detail">
                <span class="modal__detail-title">Vai trò</span>
                <span class="modal__detail-text">${escapeHtml(report.option || "")}</span>
            </div>
            <div class="modal__detail">
                <span class="modal__detail-title">Ngày gửi</span>
                <span class="modal__detail-text">${formatDate(report.date)}</span>
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
        </div>
        ${actionsHTML}
    `;

    reportDetailModal.hidden = false;
}

function closeReportDetailModal() {
    reportDetailModal.hidden = true;
    reportDetailBody.innerHTML = "";
}

reportDetailModal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-modal]")) {
        closeReportDetailModal();
    }
});

// ---------- Xử lý sự kiện: xem / duyệt / xoá ----------
async function handleView(id) {
    let item = findItemById(id, approvedFlatReports) || findItemById(id, pendingFlatReports);
    if (!item) return;
    const mode = pendingFlatReports.includes(item) ? "pending" : "list";
    openReportDetailModal(item, mode);
}

async function handleApprove(id, triggerEl) {
    const item = findItemById(id, pendingFlatReports);
    if (!item) return;

    if (triggerEl) triggerEl.disabled = true;
    try {
        await approveReport(item.report);
        showStatus("Đã duyệt tố cáo.", false);
        closeReportDetailModal();
        await loadAdminData();
    } catch (error) {
        console.error(error);
        showStatus(error.message || "Có lỗi khi duyệt, vui lòng thử lại.", true);
        if (triggerEl) triggerEl.disabled = false;
    }
}

// ---------- Từ chối / xoá tố cáo (có modal nhập lý do) ----------
// pendingRejectItems là 1 item (xoá đơn) hoặc mảng (xoá hàng loạt); cùng 1 lý do gửi cho tất cả.
let pendingRejectItems = null;

function openRejectReasonModal(itemOrItems) {
    pendingRejectItems = Array.isArray(itemOrItems) ? itemOrItems : [itemOrItems];
    rejectModalDesc.textContent =
        pendingRejectItems.length > 1
            ? `${pendingRejectItems.length} tố cáo sẽ bị xoá khỏi hệ thống. Nếu người gửi có tài khoản, lý do bạn ghi bên dưới sẽ được gửi tới tất cả họ.`
            : `Tố cáo sẽ bị xoá khỏi hệ thống. Nếu người gửi có tài khoản, lý do bạn ghi bên dưới sẽ được gửi vào mục "Tố cáo của tôi" của họ để họ biết vì sao tố cáo không được duyệt.`;
    rejectReasonInput.value = "";
    rejectReasonModal.hidden = false;
    rejectReasonInput.focus();
}

function closeRejectReasonModal() {
    pendingRejectItems = null;
    rejectReasonModal.hidden = true;
    confirmRejectBtn.disabled = false;
    confirmRejectBtn.textContent = "Xác nhận xoá & gửi phản hồi";
}

function handleReject(id) {
    const item = findItemById(id, approvedFlatReports) || findItemById(id, pendingFlatReports);
    if (!item) return;
    openRejectReasonModal(item);
}

async function confirmReject() {
    const items = pendingRejectItems;
    if (!items || !items.length) return;

    confirmRejectBtn.disabled = true;
    confirmRejectBtn.textContent = "Đang xử lý...";
    try {
        const reason = rejectReasonInput.value.trim();
        await Promise.all(items.map((item) => rejectReport(item.report, reason)));
        showStatus(
            items.length > 1 ? `Đã xoá ${items.length} tố cáo và gửi phản hồi (nếu có tài khoản).` : "Đã xoá tố cáo và gửi phản hồi (nếu người gửi có tài khoản).",
            false
        );
        closeRejectReasonModal();
        closeReportDetailModal();
        await loadAdminData();
    } catch (error) {
        console.error(error);
        showStatus(error.message || "Có lỗi khi xoá, vui lòng thử lại.", true);
        confirmRejectBtn.disabled = false;
        confirmRejectBtn.textContent = "Xác nhận xoá & gửi phản hồi";
    }
}

confirmRejectBtn.addEventListener("click", confirmReject);
rejectReasonModal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-reject-modal]")) {
        closeRejectReasonModal();
    }
});

function onActionClick(e) {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const { action, id } = btn.dataset;
    if (action === "view") handleView(id);
    else if (action === "approve") handleApprove(id, btn);
    else if (action === "reject") handleReject(id);
}

listTableBody.addEventListener("click", onActionClick);
pendingTableBody.addEventListener("click", onActionClick);
reportDetailBody.addEventListener("click", onActionClick);

// ---------- Thống kê tổng quan (api/stats.php) ----------
async function loadStats() {
    try {
        const { data: overview } = await axios.get(`${API_BASE}stats.php`, { params: { action: "overview" } });
        document.getElementById("statTotalScammers").textContent = overview.totalScammers;
        document.getElementById("statApprovedReports").textContent = overview.totalApprovedReports;
        document.getElementById("statPendingReports").textContent = overview.totalPendingReports;
        document.getElementById("statTotalUsers").textContent = overview.totalUsers;
        document.getElementById("statApprovalRate").textContent =
            overview.approvalRate === null ? "—" : `${overview.approvalRate}%`;
        document.getElementById("statApprovalSub").textContent =
            overview.approvedActions + overview.rejectedActions > 0
                ? `${overview.approvedActions} duyệt / ${overview.rejectedActions} từ chối`
                : "Chưa có đơn nào được xử lý";
    } catch (error) {
        console.error(error);
    }

    try {
        const { data: timeline } = await axios.get(`${API_BASE}stats.php`, { params: { action: "timeline", days: 30 } });
        renderStatsChart(timeline);
    } catch (error) {
        console.error(error);
    }
}

function renderStatsChart(timeline) {
    const canvas = document.getElementById("statsTimelineChart");
    if (!canvas || typeof Chart === "undefined") return;

    const labels = timeline.labels.map((d) => {
        const [, m, day] = d.split("-");
        return `${day}/${m}`;
    });

    if (statsTimelineChart) {
        statsTimelineChart.data.labels = labels;
        statsTimelineChart.data.datasets[0].data = timeline.values;
        statsTimelineChart.update();
        return;
    }

    statsTimelineChart = new Chart(canvas.getContext("2d"), {
        type: "line",
        data: {
            labels,
            datasets: [
                {
                    label: "Số tố cáo gửi lên",
                    data: timeline.values,
                    borderColor: "#DB2828",
                    backgroundColor: "rgba(219, 40, 40, 0.15)",
                    tension: 0.3,
                    fill: true,
                    pointRadius: 2,
                },
            ],
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, ticks: { precision: 0 } },
            },
        },
    });
}

// ---------- Quản lý tài khoản người dùng (bảng users) ----------
async function loadAccountsData() {
    accountsTableBody.innerHTML = `<tr><td colspan="8" class="admin-table__state">Đang tải dữ liệu...</td></tr>`;
    try {
        const { data } = await axios.get(`${API_BASE}users.php`, { params: { action: "list" } });
        accountsAll = data;
        renderAccountsStats();
        renderAccountsTable();
    } catch (error) {
        console.error(error);
        accountsCountLabel.textContent = "(có 0 tài khoản)";
        accountsTableBody.innerHTML = `<tr><td colspan="8" class="admin-table__state">${escapeHtml(error.message || "Có lỗi khi tải danh sách tài khoản, vui lòng thử lại.")}</td></tr>`;
    }
}

// ---------- Thẻ thống kê tài khoản ----------
function renderAccountsStats() {
    const total = accountsAll.length;
    const admins = accountsAll.filter((u) => u.role === "admin").length;
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const newWeek = accountsAll.filter((u) => new Date(u.createdAt).getTime() >= sevenDaysAgo).length;

    document.getElementById("statAccTotal").textContent = total;
    document.getElementById("statAccAdmins").textContent = admins;
    document.getElementById("statAccUsers").textContent = total - admins;
    document.getElementById("statAccNewWeek").textContent = newWeek;
}

// ---------- Tìm kiếm / lọc quyền / sắp xếp theo số tố cáo ----------
function getFilteredSortedAccounts() {
    const keyword = normalizeForSearch(accountsSearchInput.value.trim());
    const role = accountsRoleFilter.value;

    let result = accountsAll.filter((user) => {
        if (role !== "all" && user.role !== role) return false;
        if (!keyword) return true;
        const haystack = normalizeForSearch(`${user.name} ${user.username} ${user.email}`);
        return haystack.includes(keyword);
    });

    if (reportCountSortDir) {
        result = [...result].sort((a, b) =>
            reportCountSortDir === "asc" ? a.reportCount - b.reportCount : b.reportCount - a.reportCount
        );
    }
    return result;
}

if (accountsSearchInput) {
    accountsSearchInput.addEventListener("input", renderAccountsTable);
}
if (accountsRoleFilter) {
    accountsRoleFilter.addEventListener("change", renderAccountsTable);
}
if (sortByReportCountBtn) {
    sortByReportCountBtn.addEventListener("click", () => {
        reportCountSortDir = reportCountSortDir === "desc" ? "asc" : reportCountSortDir === "asc" ? null : "desc";
        sortReportCountIcon.textContent = reportCountSortDir === "desc" ? "↓" : reportCountSortDir === "asc" ? "↑" : "↕";
        renderAccountsTable();
    });
}

function renderAccountsTable() {
    accountsCountLabel.textContent = `(có ${accountsAll.length} tài khoản)`;

    if (!accountsAll.length) {
        accountsTableBody.innerHTML = `<tr><td colspan="8" class="admin-table__state">Chưa có tài khoản người dùng nào đăng ký.</td></tr>`;
        return;
    }

    const filtered = getFilteredSortedAccounts();
    if (!filtered.length) {
        accountsTableBody.innerHTML = `<tr><td colspan="8" class="admin-table__state">Không tìm thấy tài khoản phù hợp.</td></tr>`;
        return;
    }

    const total = filtered.length;
    accountsTableBody.innerHTML = filtered
        .map((user, index) => accountRowHTML(user, total - index))
        .join("");
}

// ---------- Xuất danh sách tài khoản ra Excel (.xlsx) ----------
// Dùng đúng bộ đang lọc trên màn hình, thư viện SheetJS nạp qua CDN trong admin.html.
function exportAccountsToExcel() {
    const rows = getFilteredSortedAccounts();
    const header = ["id", "Họ và tên", "Tên đăng nhập", "Email", "Quyền", "Số tố cáo", "Trạng thái", "Ngày tạo"];
    const data = rows.map((u) => [
        u.id,
        u.name,
        u.username,
        u.email,
        u.role === "admin" ? "Admin" : "Người dùng",
        u.reportCount,
        u.isLocked ? "Đã khoá" : "Hoạt động",
        formatDate(u.createdAt),
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([header, ...data]);
    // Canh độ rộng cột theo nội dung dài nhất (mặc định SheetJS để cột rất hẹp).
    worksheet["!cols"] = header.map((title, colIndex) => {
        const longest = data.reduce((max, row) => {
            const len = String(row[colIndex] ?? "").length;
            return len > max ? len : max;
        }, title.length);
        return { wch: Math.min(longest + 2, 40) };
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Tài khoản");
    XLSX.writeFile(workbook, `soiscam-tai-khoan-${new Date().toISOString().slice(0, 10)}.xlsx`);
}

if (accountsExportBtn) {
    accountsExportBtn.addEventListener("click", exportAccountsToExcel);
}

function initials(name) {
    const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return "?";
    const first = parts[0][0] || "";
    const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (first + last).toUpperCase();
}

function accountRowHTML(user, displayId) {
    const isSelf = currentAdmin && Number(user.id) === Number(currentAdmin.id);
    const roleLabel = user.role === "admin"
        ? `<span class="admin-role-badge admin-role-badge--admin">Admin</span>`
        : `<span class="admin-role-badge">Người dùng</span>`;
    const toggleLabel = user.role === "admin" ? "Hạ xuống user" : "Nâng lên admin";
    const statusLabel = user.isLocked
        ? `<span class="admin-role-badge admin-role-badge--locked">🔒 Đã khoá</span>`
        : `<span class="admin-role-badge admin-role-badge--active">Hoạt động</span>`;
    const lockBtnLabel = user.isLocked ? "🔓" : "🔒";
    const lockBtnTitle = user.isLocked ? "Mở khoá tài khoản" : "Khoá tạm thời tài khoản";

    return `
        <tr>
            <td>#${displayId}</td>
            <td>
                <button type="button" class="admin-account-cell admin-account-cell--link" data-account-detail-id="${user.id}">
                    <span class="admin-account-avatar">${escapeHtml(initials(user.name))}</span>
                    <span>
                        <span class="admin-account-cell__name">${escapeHtml(user.name || "Chưa rõ")}</span>
                        <span class="admin-account-cell__username">@${escapeHtml(user.username || "")}</span>
                    </span>
                </button>
            </td>
            <td>${escapeHtml(user.email || "")}</td>
            <td>${roleLabel}</td>
            <td>${user.reportCount ?? 0}</td>
            <td>${statusLabel}</td>
            <td>${formatDate(user.createdAt)}</td>
            <td class="admin-table__actions">
                <button type="button" class="admin-action-link" data-role-id="${user.id}" ${isSelf ? "disabled title=\"Không thể tự đổi quyền của chính mình\"" : ""}>${toggleLabel}</button>
                <button type="button" class="admin-icon-btn" data-lock-id="${user.id}" title="${lockBtnTitle}" ${isSelf ? "disabled title=\"Không thể tự khoá chính mình\"" : ""}>${lockBtnLabel}</button>
                <button type="button" class="admin-icon-btn admin-icon-btn--danger" data-account-id="${user.id}" title="Xoá tài khoản" ${isSelf ? "disabled" : ""}>🗑️</button>
            </td>
        </tr>`;
}

async function handleDeleteAccount(id, triggerEl) {
    const account = accountsAll.find((u) => String(u.id) === String(id));
    const confirmed = confirm(
        `Xoá tài khoản "${account ? account.username : id}"? Người này sẽ không đăng nhập được nữa. Không thể hoàn tác.`
    );
    if (!confirmed) return;

    if (triggerEl) triggerEl.disabled = true;
    try {
        await axios.post(`${API_BASE}users.php`, { id: Number(id) }, { params: { action: "delete" } });
        showStatus("Đã xoá tài khoản.", false);
        await loadAccountsData();
    } catch (error) {
        console.error(error);
        showStatus(error.message || "Có lỗi khi xoá tài khoản, vui lòng thử lại.", true);
        if (triggerEl) triggerEl.disabled = false;
    }
}

async function handleToggleRole(id, triggerEl) {
    const account = accountsAll.find((u) => String(u.id) === String(id));
    if (!account) return;
    const newRole = account.role === "admin" ? "user" : "admin";
    const confirmed = confirm(
        newRole === "admin"
            ? `Nâng "${account.username}" lên quyền admin? Người này sẽ vào được trang quản trị.`
            : `Hạ "${account.username}" xuống người dùng thường? Người này sẽ mất quyền vào trang quản trị.`
    );
    if (!confirmed) return;

    if (triggerEl) triggerEl.disabled = true;
    try {
        await axios.post(`${API_BASE}users.php`, { id: Number(id), role: newRole }, { params: { action: "set-role" } });
        showStatus("Đã cập nhật quyền tài khoản.", false);
        await loadAccountsData();
    } catch (error) {
        console.error(error);
        showStatus(error.message || "Có lỗi khi đổi quyền, vui lòng thử lại.", true);
        if (triggerEl) triggerEl.disabled = false;
    }
}

async function handleToggleLock(id, triggerEl) {
    const account = accountsAll.find((u) => String(u.id) === String(id));
    if (!account) return;
    const confirmed = confirm(
        account.isLocked
            ? `Mở khoá tài khoản "${account.username}"? Họ sẽ đăng nhập lại được bình thường.`
            : `Khoá tạm thời tài khoản "${account.username}"? Họ sẽ không đăng nhập được cho tới khi bạn mở lại.`
    );
    if (!confirmed) return;

    if (triggerEl) triggerEl.disabled = true;
    try {
        const { data } = await axios.post(`${API_BASE}users.php`, { id: Number(id) }, { params: { action: "toggle-lock" } });
        showStatus(data.isLocked ? "Đã khoá tài khoản." : "Đã mở khoá tài khoản.", false);
        await loadAccountsData();
    } catch (error) {
        console.error(error);
        showStatus(error.message || "Có lỗi khi khoá/mở khoá tài khoản, vui lòng thử lại.", true);
        if (triggerEl) triggerEl.disabled = false;
    }
}

// ---------- Modal chi tiết 1 tài khoản ----------
// Xem các tố cáo (hiện tại + lịch sử bị từ chối) của tài khoản (api/users.php?action=account-reports).
async function openAccountDetailModal(id) {
    const account = accountsAll.find((u) => String(u.id) === String(id));
    if (!account) return;

    accountDetailBody.innerHTML = `<p class="admin-table__state">Đang tải dữ liệu...</p>`;
    accountDetailModal.hidden = false;

    try {
        const { data } = await axios.get(`${API_BASE}users.php`, { params: { action: "account-reports", id } });
        renderAccountDetailModal(account, data.reports || [], data.rejectedHistory || []);
    } catch (error) {
        console.error(error);
        accountDetailBody.innerHTML = `<p class="admin-table__state">${escapeHtml(error.message || "Có lỗi khi tải dữ liệu, vui lòng thử lại.")}</p>`;
    }
}

function renderAccountDetailModal(account, reports, rejectedHistory) {
    const reportsHTML = reports.length
        ? reports
            .map((r) => {
                const statusHTML = r.status === "approved"
                    ? `<span class="my-reports__status my-reports__status--approved">Đã duyệt</span>`
                    : `<span class="my-reports__status my-reports__status--pending">Đang chờ duyệt</span>`;
                return `
                    <div class="admin-account-report-item">
                        <div class="admin-account-report-item__main">
                            <p class="admin-account-report-item__title">${escapeHtml(r.nameScammer)} <span class="admin-account-report-item__meta">(STK ${escapeHtml(r.bankNumber)} · ${escapeHtml(r.bankName || "")})</span></p>
                            <p class="admin-account-report-item__meta">Người gửi: ${escapeHtml(r.nameSender || account.name || "")}${r.phoneSender ? " · " + escapeHtml(r.phoneSender) : ""} · ${formatDate(r.date)}</p>
                            ${r.contentReport ? `<p class="admin-account-report-item__content">${escapeHtml(r.contentReport)}</p>` : ""}
                        </div>
                        ${statusHTML}
                    </div>`;
            })
            .join("")
        : `<p class="admin-table__state">Chưa có tố cáo nào đang tồn tại.</p>`;

    const rejectedHTML = rejectedHistory.length
        ? rejectedHistory
            .map(
                (r) => `
                    <div class="admin-account-report-item admin-account-report-item--rejected">
                        <div class="admin-account-report-item__main">
                            <p class="admin-account-report-item__title">${escapeHtml(r.nameScammer || "")} <span class="admin-account-report-item__meta">(STK ${escapeHtml(r.bankNumber || "")})</span></p>
                            <p class="admin-account-report-item__meta">Lý do từ chối: ${escapeHtml(r.reason || "Không có lý do cụ thể.")} · ${formatDate(r.date)}</p>
                        </div>
                        <span class="my-reports__status" style="background-color:rgba(219,40,40,0.15); color: var(--redColor);">Đã từ chối</span>
                    </div>`
            )
            .join("")
        : `<p class="admin-table__state">Chưa từng có tố cáo nào bị từ chối.</p>`;

    accountDetailBody.innerHTML = `
        <div class="admin-account-modal__profile">
            <span class="admin-account-avatar admin-account-avatar--lg">${escapeHtml(initials(account.name))}</span>
            <div>
                <p class="admin-account-modal__name">${escapeHtml(account.name || "Chưa rõ")}</p>
                <p class="admin-account-modal__meta">@${escapeHtml(account.username)} · ${escapeHtml(account.email || "")}</p>
                <p class="admin-account-modal__meta">Tham gia ngày ${formatDate(account.createdAt)} · ${account.reportCount ?? 0} tố cáo đã gửi</p>
            </div>
        </div>
        <div class="modal__group admin-account-modal__section">
            <span class="modal__detail-title">Tố cáo hiện có (${reports.length})</span>
            <div class="admin-account-report-list">${reportsHTML}</div>
        </div>
        <div class="modal__group admin-account-modal__section">
            <span class="modal__detail-title">Lịch sử bị từ chối (${rejectedHistory.length})</span>
            <div class="admin-account-report-list">${rejectedHTML}</div>
        </div>
    `;
}

function closeAccountDetailModal() {
    accountDetailModal.hidden = true;
    accountDetailBody.innerHTML = "";
}

accountDetailModal.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-account-modal]")) {
        closeAccountDetailModal();
    }
});

accountsTableBody.addEventListener("click", (e) => {
    const deleteBtn = e.target.closest("[data-account-id]");
    if (deleteBtn) {
        handleDeleteAccount(deleteBtn.dataset.accountId, deleteBtn);
        return;
    }
    const roleBtn = e.target.closest("[data-role-id]");
    if (roleBtn) {
        handleToggleRole(roleBtn.dataset.roleId, roleBtn);
        return;
    }
    const lockBtn = e.target.closest("[data-lock-id]");
    if (lockBtn) {
        handleToggleLock(lockBtn.dataset.lockId, lockBtn);
        return;
    }
    const detailBtn = e.target.closest("[data-account-detail-id]");
    if (detailBtn) {
        openAccountDetailModal(detailBtn.dataset.accountDetailId);
    }
});
