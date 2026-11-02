// Biến dùng chung
// Ảnh gửi qua api/upload.php (khoá ImgBB nằm trên server).
const uploadImageInput = document.getElementById("uploadImage");
const formUploadWrap = document.querySelector(".form__upload-wrap");
let arrayImage = [];
const phoneScammerInput = document.getElementById("phoneScammer");
const phoneSenderInput = document.getElementById("phoneSender");
const contentReportInput = document.getElementById("contentReport");
// Hết biến dùng chung

// ---------- Điền sẵn thông tin scammer từ URL ----------
// Link "Tôi cũng bị lừa bởi STK này" có dạng report.html?bankNumber=...&bankName=...&nameScammer=...
// Server tự gộp vào hồ sơ cũ nhờ trùng số tài khoản.
(function prefillFromQueryString() {
    const params = new URLSearchParams(window.location.search);
    const fieldMap = {
        bankNumber: document.getElementById("bankNumber"),
        bankName: document.getElementById("bankName"),
        nameScammer: document.getElementById("nameScammer"),
    };
    Object.keys(fieldMap).forEach((key) => {
        const value = params.get(key);
        if (value && fieldMap[key]) {
            fieldMap[key].value = value;
        }
    });
})();
// Hết điền sẵn thông tin scammer từ URL

// ---------- Lưu tạm form khi chưa đăng nhập ----------
// Bấm "Gửi tố cáo" mà chưa đăng nhập: lưu form (kể cả ảnh) vào sessionStorage rồi sang login.html.
// Quay lại report.html thì restoreReportDraftIfAny() điền lại. Server vẫn tự chặn bằng require_login().
const REPORT_DRAFT_KEY = "soiscam_report_draft";

function saveReportDraft(formValues) {
    try {
        sessionStorage.setItem(
            REPORT_DRAFT_KEY,
            JSON.stringify({ ...formValues, imageUrls: arrayImage })
        );
    } catch (error) {
        console.error("Không lưu tạm được form tố cáo:", error);
    }
}

function restoreReportDraftIfAny() {
    let raw;
    try {
        raw = sessionStorage.getItem(REPORT_DRAFT_KEY);
    } catch (error) {
        return;
    }
    if (!raw) return;
    sessionStorage.removeItem(REPORT_DRAFT_KEY); // chỉ dùng 1 lần rồi xoá

    let draft;
    try {
        draft = JSON.parse(raw);
    } catch (error) {
        return;
    }

    const setValue = (id, value) => {
        const el = document.getElementById(id);
        if (el && value) el.value = value;
    };
    setValue("nameScammer", draft.nameScammer);
    setValue("phoneScammer", draft.phoneScammer);
    setValue("bankNumber", draft.bankNumber);
    setValue("bankName", draft.bankName);
    setValue("nameSender", draft.nameSender);
    setValue("phoneSender", draft.phoneSender);

    if (draft.contentReport) {
        contentReportInput.value = draft.contentReport;
        // Gán value bằng JS không bắn event "input" nên phải gọi tay để textarea giãn chiều cao.
        contentReportInput.style.height = "auto";
        contentReportInput.style.height = contentReportInput.scrollHeight + "px";
    }

    if (draft.option) {
        const radio = document.querySelector(
            `input[name="option"][value="${CSS.escape(draft.option)}"]`
        );
        if (radio) radio.checked = true;
    }

    if (Array.isArray(draft.imageUrls) && draft.imageUrls.length) {
        // Bỏ URL rỗng/không hợp lệ (vd "null" do lần upload lỗi trước đó).
        const validUrls = draft.imageUrls.filter((url) => typeof url === "string" && url);
        arrayImage = validUrls.slice();
        validUrls.forEach((url) => addImagePreview(url));
    }
}
restoreReportDraftIfAny();
// Hết lưu tạm form khi chưa đăng nhập mà đã bấm "Gửi tố cáo"

// ---------- Điền sẵn tên người gửi nếu đã đăng nhập ----------
// Không khoá ô để vẫn sửa được khi gửi hộ người khác.
(async function prefillSenderFromAccount() {
    await AUTH_READY; // đợi hỏi xong server đã đăng nhập hay chưa
    const currentUser = typeof getCurrentUser === "function" ? getCurrentUser() : null;
    if (!currentUser) return;
    const nameSenderInput = document.getElementById("nameSender");
    if (nameSenderInput && !nameSenderInput.value) {
        nameSenderInput.value = currentUser.name || "";
    }
})();
// Hết điền sẵn thông tin người gửi

// Ô nội dung tố cáo tự giãn chiều cao
contentReportInput.addEventListener("input", (e) => {
    e.target.style.height = "auto"; // Đặt lại chiều cao để tính lại scrollHeight
    e.target.style.height = e.target.scrollHeight + "px"; // Gán chiều cao bằng scrollHeight
})
// Hết ô nội dung tố cáo tự giãn chiều cao

// Ô số chỉ cho nhập chữ số
phoneScammerInput.addEventListener("keypress", handleInputOnlyNumber)
phoneSenderInput.addEventListener("keypress", handleInputOnlyNumber)
function handleInputOnlyNumber(e) {
    if (e.charCode < 48 || e.charCode > 57) {
        e.preventDefault();
    }
}
// Hết ô số chỉ cho nhập chữ số

// Tải ảnh lên server

async function uploadImgBB(file) {
    const formData = new FormData();
    formData.append("image", file);

    try {
        // Gửi ảnh lên api/upload.php, server kiểm tra rồi chuyển tiếp lên ImgBB.
        const response = await axios.post(`${API_BASE}upload.php`, formData);
        return response.data.url;
    } catch (error) {
        console.log(error);
        // Hiện lỗi cụ thể server trả về (sai loại file, quá lớn...).
        const message = error?.response?.data?.error;
        if (message && typeof FuiToast !== "undefined") FuiToast.error(message);
        return null;
    }
}

// Hết tải ảnh lên server

// Chọn và xem trước ảnh
uploadImageInput.addEventListener("change", handleUploadImage);

// Thêm ô preview ảnh (ảnh mới chọn hoặc ảnh cũ từ bản nháp).
// Ảnh không tải được thì tự gỡ preview và gỡ URL khỏi arrayImage.
function addImagePreview(url) {
    // Chỉ nhận link https hoặc uploads/... và escape (URL có thể đến từ sessionStorage).
    if (!/^(https:\/\/|uploads\/)/i.test(String(url))) return;
    const rawUrl = String(url);
    const safeUrl = rawUrl.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const imgHTML = `
    <div class="form__image-preview">
                <div class="form__preview-remove" data-url = "${safeUrl}">
                    <img src="./assets/images/close-icon.svg" alt="">
                </div>
                <img src="${safeUrl}"
                alt=""
                class="form__preview-img">
            </div>`;
    formUploadWrap.insertAdjacentHTML("afterbegin", imgHTML);

    const preview = formUploadWrap.querySelector(".form__image-preview");
    const previewImg = preview ? preview.querySelector(".form__preview-img") : null;
    if (previewImg) {
        previewImg.addEventListener(
            "error",
            () => {
                preview.remove();
                arrayImage = arrayImage.filter((item) => item !== rawUrl);
            },
            { once: true }
        );
    }
}

async function handleUploadImage(e) {
    const imageList = [...e.target.files];
    imageList.forEach(async (item) => {
        const urlImg = await uploadImgBB(item);
        if (!urlImg) {
            // Upload lỗi thì báo, không thêm ô preview rỗng.
            FuiToast.error("Tải ảnh lên thất bại, vui lòng thử chọn lại ảnh này.");
            return;
        }
        addImagePreview(urlImg);
        arrayImage.push(urlImg);
    });
}

formUploadWrap.addEventListener("click", (e) => {
    if (e.target.matches(".form__preview-remove")) {
        const formImagePreview = e.target.parentNode;
        formImagePreview.remove();
        arrayImage = arrayImage.filter((item) => item !== e.target.dataset.url)
        console.log(arrayImage);
    }
});
// Hết chọn và xem trước ảnh

// ---------- Gửi tố cáo lên api/scammers.php?action=submit ----------
// Server lo việc gộp theo số tài khoản, chống spam và gắn report với tài khoản đang đăng nhập.
async function submitScammerReport(formValues) {
    try {
        await axios.post(
            `${API_BASE}scammers.php`,
            {
                bankNumber: formValues.bankNumber,
                bankName: formValues.bankName,
                nameScammer: formValues.nameScammer,
                phoneScammer: formValues.phoneScammer,
                nameSender: formValues.nameSender,
                phoneSender: formValues.phoneSender,
                option: formValues.option,
                contentReport: formValues.contentReport,
                images: arrayImage,
            },
            { params: { action: "submit" } }
        );
    } catch (error) {
        throw wrapApiError(error, "Có lỗi xảy ra. Vui lòng thử lại.");
    }

    await FuiToast.success("Gửi tố cáo thành công! Tố cáo của bạn sẽ hiển thị công khai sau khi Admin duyệt.");
}
// Hết gộp báo cáo theo số tài khoản

// Kiểm tra và gửi form tố cáo
Validator({
    form: "#form-report",
    formGroupSelector: ".form__group",
    errorSelector: ".form-message",
    rules: [
        Validator.isRequired("#nameScammer", "Vui lòng nhập tên chủ tài khoản"),
        Validator.minLength("#nameScammer", 6, "Tên chủ tài khoản phải có ít nhất 6 ký tự"),
        // Ô không bắt buộc, nhưng nếu nhập thì phải đúng định dạng.
        // Không dùng Validator.isPhoneNumber vì nó chặn cả khi để trống.
        {
            selector: "#phoneScammer",
            test: function (value) {
                if (!value) return undefined; // để trống -> hợp lệ, không bắt buộc
                var regex = /^(0|\+84)(3|5|7|8|9)[0-9]{8,9}$/;
                return regex.test(value) ? undefined : "Vui lòng nhập số điện thoại hợp lệ";
            },
        },
        Validator.isRequired("#bankNumber", "Vui lòng nhập số tài khoản"),
        Validator.isNumber("#bankNumber", "Vui lòng nhập số tài khoản hợp lệ"),
        Validator.minLength("#bankNumber", 8, "Số tài khoản phải có ít nhất 8 số"),
        Validator.isRequired("#bankName", "Vui lòng nhập tên ngân hàng"),
        Validator.minLength("#bankName", 3, "Tên ngân hàng phải có ít nhất 3 ký tự"),
        Validator.isRequired("#contentReport", "Vui lòng nhập nội dung tố cáo"),
        Validator.minLength("#contentReport", 10, "Nội dung tố cáo phải có ít nhất 10 ký tự"),
        // Kiểm tra arrayImage.length thay vì input.files: sau khi điền lại từ bản nháp, input.files rỗng.
        {
            selector: "#uploadImage",
            test: function () {
                return arrayImage.length > 0 ? undefined : "Vui lòng tải lên ít nhất một ảnh";
            },
        },
        Validator.isRequired("#nameSender", "Vui lòng nhập tên của bạn"),
        Validator.minLength("#nameSender", 6, "Tên phải có ít nhất 6 ký tự"),
        Validator.isRequired("#phoneSender", "Vui lòng nhập số điện thoại"),
        Validator.isPhoneNumber("#phoneSender", "Vui lòng nhập số điện thoại hợp lệ"),
    ],
    onSubmit: async function ({ images, ...rest }) {
        await AUTH_READY; // chắc chắn đã biết đăng nhập hay chưa trước khi quyết định
        if (!getCurrentUser()) {
            // Chưa đăng nhập: lưu nháp rồi sang login.html?next=... để quay lại đây.
            saveReportDraft(rest);
            const next = encodeURIComponent("report.html" + window.location.search);
            window.location.href = `login.html?next=${next}`;
            return;
        }

        const formImagePreviews = document.querySelectorAll(".form__image-preview");
        try {
            await submitScammerReport(rest);
            formImagePreviews.forEach((item) => item.remove());
            arrayImage = []; // reset để không dính ảnh cũ nếu gửi thêm 1 tố cáo khác cùng phiên trang
        }
        catch (error) {
            console.error(error);
            FuiToast.error(error.message || "Có lỗi xảy ra. Vui lòng thử lại.")
            formImagePreviews.forEach((item) => item.remove());
        }
        console.log({ images: arrayImage, ...rest });  // Dữ liệu form sau khi xác thực thành công
    },
    resetOnSubmit: true,  // Reset form sau khi submit thành công
});
// Hết kiểm tra và gửi form tố cáo
