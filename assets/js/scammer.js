// ============================================================
// TRANG CHI TIẾT SCAMMER (scammer-detail.html?id=...)
// Có URL thật để chia sẻ và Google index. Dùng dữ liệu từ scammer-data.js.
// ============================================================
const detailContainer = document.getElementById("scammerDetail");

// Dữ liệu người dùng nhập phải qua escapeHtml trước khi chèn innerHTML (chống XSS).
function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Chỉ cho phép link https hoặc uploads/... (server cũng đã lọc, đây là lớp thứ 2).
function safeImageUrl(url) {
    return /^(https:\/\/|uploads\/)/i.test(String(url)) ? escapeHtml(url) : "";
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

function getScammerIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    return params.get("id");
}

// Không có id hợp lệ hoặc không tìm thấy scammer thì về 404.html.
function goToNotFound() {
    window.location.replace("404.html");
}

function renderScammerDetail(scammer) {
    document.title = `SOISCAM - ${scammer.nameScammer}`; // gán vào title là an toàn (không phải HTML)

    const reportsHTML = scammer.reports
        .map((report, index) => {
            const imageListHTML = (report.images || [])
                .map((item) => safeImageUrl(item))
                .filter(Boolean)
                .map((src) => `<img src="${src}" alt="Ảnh minh chứng">`)
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
                            <p class="modal__textarea-content">
                                ${escapeHtml(report.contentReport || "")}
                            </p>
                        </div>
                        ${imageListHTML ? `
                        <div class="modal__images">
                            <span class="modal__detail-title">Hình ảnh liên quan</span>
                            <div class="modal__preview-images">
                                ${imageListHTML}
                            </div>
                        </div>` : ""}
                    </div>`;
        })
        .join("");

    const reportAgainHref = `report.html?bankNumber=${encodeURIComponent(scammer.bankNumber || "")}&bankName=${encodeURIComponent(scammer.bankName || "")}&nameScammer=${encodeURIComponent(scammer.nameScammer || "")}`;

    detailContainer.innerHTML = `
        <div class="modal__group">
            <div class="modal__profile">
                <div class="modal__profile-avatar">
                    <img src="./assets/images/avatar-1.png" alt="avatar">
                </div>
                <div class="modal__info">
                    <h4 class="modal__info-name">${escapeHtml(scammer.nameScammer)}</h4>
                    <p class="modal__info-desc">#${escapeHtml(scammer.id)} - Bị tố lần đầu ngày ${formatDate(scammer.date)}</p>
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
                <span class="modal__detail-text modal__detail-text--highlight">${escapeHtml(scammer.reportCount)} lượt</span>
            </div>
            <div class="scammer-detail__actions">
                <button type="button" id="copyLinkBtn" class="btn scammer-detail__action-btn">Sao chép liên kết chia sẻ</button>
                <a href="${escapeHtml(reportAgainHref)}" class="btn scammer-detail__action-btn scammer-detail__action-btn--outline">Tôi cũng bị lừa bởi STK này</a>
            </div>
        </div>
        ${reportsHTML}
    `;

    const copyBtn = document.getElementById("copyLinkBtn");
    if (copyBtn) {
        copyBtn.addEventListener("click", async () => {
            try {
                await navigator.clipboard.writeText(window.location.href);
                copyBtn.textContent = "Đã sao chép!";
                setTimeout(() => {
                    copyBtn.textContent = "Sao chép liên kết chia sẻ";
                }, 2000);
            } catch (err) {
                console.error(err);
            }
        });
    }
}

async function initScammerDetail() {
    const id = getScammerIdFromUrl();
    if (!id) {
        goToNotFound();
        return;
    }
    try {
        // publicOnly: true - scammer chỉ có report chờ duyệt thì coi như chưa công khai.
        const { grouped } = await fetchGroupedScammers({ publicOnly: true });
        const scammer = grouped.find((item) => String(item.id) === String(id));
        if (!scammer) {
            goToNotFound();
            return;
        }
        renderScammerDetail(scammer);
    } catch (error) {
        console.error(error);
        detailContainer.innerHTML = `<p class="scammer-detail__loading">Có lỗi xảy ra khi tải dữ liệu, vui lòng tải lại trang.</p>`;
    }
}

initScammerDetail();
