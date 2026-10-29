// ============================================================
// DỮ LIỆU DÙNG CHUNG: gọi API tố cáo và vài hàm tiện ích.
// Các trang đều nhúng file này TRƯỚC script riêng của trang. Việc gộp
// tố cáo theo số tài khoản do server làm (api/scammers.php).
// ============================================================

// API_BASE trỏ tới thư mục api/ cùng cấp với các file .html.
const API_BASE = "api/";

// Gửi kèm cookie phiên đăng nhập theo mỗi request axios (không có thì server luôn coi là chưa đăng nhập).
axios.defaults.withCredentials = true;

function normalizeBankNumber(bankNumber) {
    return String(bankNumber || "").replace(/\s|-/g, "").trim();
}

// Bọc lỗi axios thành thông báo tiếng Việt dễ hiểu.
function wrapApiError(error, fallbackMessage) {
    if (error?.response?.data?.error) {
        return new Error(error.response.data.error);
    }
    if (!error?.response) {
        return new Error("Không kết nối được tới máy chủ. Kiểm tra Apache/MySQL trong XAMPP đã bật chưa.");
    }
    return new Error(fallbackMessage || "Có lỗi xảy ra, vui lòng thử lại.");
}

// Tải danh sách scammer đã gộp sẵn. publicOnly = true: chỉ report đã duyệt (trang công khai);
// bỏ qua: lấy cả report đang chờ, chỉ admin gọi được.
async function fetchGroupedScammers(options = {}) {
    try {
        const { data: grouped } = await axios.get(`${API_BASE}scammers.php`, {
            params: { action: "list", publicOnly: options.publicOnly ? "1" : "0" },
        });
        return { grouped };
    } catch (error) {
        throw wrapApiError(error, "Có lỗi khi tải dữ liệu tố cáo.");
    }
}

// ---------- Duyệt / xoá 1 lượt tố cáo (trang admin) ----------
async function approveReport(report) {
    try {
        await axios.post(`${API_BASE}scammers.php`, { reportId: report.id }, { params: { action: "approve" } });
    } catch (error) {
        throw wrapApiError(error, "Có lỗi khi duyệt tố cáo.");
    }
}

// reason: lý do admin từ chối; server gửi thông báo cho người tố cáo nếu report có gắn tài khoản.
async function rejectReport(report, reason) {
    try {
        await axios.post(
            `${API_BASE}scammers.php`,
            { reportId: report.id, reason: reason || "" },
            { params: { action: "reject" } }
        );
    } catch (error) {
        throw wrapApiError(error, "Có lỗi khi xoá tố cáo.");
    }
}

// Người dùng tự xoá 1 tố cáo CỦA CHÍNH MÌNH (trang "Tố cáo của tôi").
async function deleteOwnReport(report) {
    try {
        await axios.post(`${API_BASE}scammers.php`, { reportId: report.id }, { params: { action: "delete-own" } });
    } catch (error) {
        throw wrapApiError(error, "Có lỗi khi xoá tố cáo.");
    }
}
