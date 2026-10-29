-- ============================================================
-- DỮ LIỆU MẪU (TÙY CHỌN) - toàn bộ là dữ liệu GIẢ để xem demo giao diện.
-- Import SAU schema.sql. Số tài khoản/SĐT/tên dưới đây đều bịa, không
-- thuộc về người thật. Có thể xoá sạch bằng phần "XOÁ DỮ LIỆU MẪU" cuối file.
-- ============================================================
USE soiscam;

INSERT IGNORE INTO scammers (bank_number, bank_number_normalized, bank_name, name_scammer, phone_scammer, first_reported_at, latest_reported_at) VALUES
('9900000001', '9900000001', 'Vietcombank', 'NGUYEN VAN MAU 1', '0900000001', NOW() - INTERVAL 6 DAY, NOW() - INTERVAL 1 HOUR),
('9900000002', '9900000002', 'MB Bank', 'TRAN THI MAU 2', '0900000002', NOW() - INTERVAL 4 DAY, NOW() - INTERVAL 3 HOUR),
('9900000003', '9900000003', 'Techcombank', 'LE VAN MAU 3', '0900000003', NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 5 HOUR),
('9900000004', '9900000004', 'ACB', 'PHAM THI MAU 4', NULL, NOW() - INTERVAL 1 DAY, NOW() - INTERVAL 20 HOUR),
('9900000005', '9900000005', 'BIDV', 'HOANG VAN MAU 5', '0900000005', NOW() - INTERVAL 10 HOUR, NOW() - INTERVAL 10 HOUR);

INSERT INTO reports (scammer_id, user_id, name_sender, phone_sender, option_role, content_report, images, status, created_at)
SELECT s.id, NULL, v.name_sender, v.phone_sender, v.option_role, v.content_report, JSON_ARRAY(), v.status, v.created_at
FROM (
    SELECT '9900000001' AS bn, 'Người dùng mẫu A' AS name_sender, '0911111111' AS phone_sender, 'Tôi là nạn nhân' AS option_role, '[DỮ LIỆU MẪU] Bán hàng online, nhận cọc xong chặn liên lạc.' AS content_report, 'approved' AS status, NOW() - INTERVAL 6 DAY AS created_at
    UNION ALL SELECT '9900000001', 'Người dùng mẫu B', '0922222222', 'Tôi là nạn nhân', '[DỮ LIỆU MẪU] Chuyển khoản mua hàng nhưng không nhận được sản phẩm.', 'approved', NOW() - INTERVAL 1 HOUR
    UNION ALL SELECT '9900000002', 'Người dùng mẫu C', '0933333333', 'Tôi là nạn nhân', '[DỮ LIỆU MẪU] Giả danh nhân viên ngân hàng yêu cầu chuyển tiền để "xác minh tài khoản".', 'approved', NOW() - INTERVAL 4 DAY
    UNION ALL SELECT '9900000002', 'Người dùng mẫu D', '0944444444', 'Tôi chỉ biết thông tin', '[DỮ LIỆU MẪU] Thấy người này đăng bài mời gọi đầu tư lãi cao bất thường.', 'approved', NOW() - INTERVAL 3 HOUR
    UNION ALL SELECT '9900000003', 'Người dùng mẫu E', '0955555555', 'Tôi là nạn nhân', '[DỮ LIỆU MẪU] Mượn tiền khẩn cấp qua tài khoản Facebook bị chiếm.', 'approved', NOW() - INTERVAL 5 HOUR
    UNION ALL SELECT '9900000004', 'Người dùng mẫu F', '0966666666', 'Tôi là nạn nhân', '[DỮ LIỆU MẪU] Việc nhẹ lương cao: nạp tiền làm nhiệm vụ rồi mất liên lạc.', 'approved', NOW() - INTERVAL 20 HOUR
    UNION ALL SELECT '9900000005', 'Người dùng mẫu G', '0977777777', 'Tôi là nạn nhân', '[DỮ LIỆU MẪU] Đang chờ admin duyệt (xem ở trang quản trị).', 'pending', NOW() - INTERVAL 10 HOUR
) v
JOIN scammers s ON s.bank_number_normalized = v.bn;

-- ---- XOÁ DỮ LIỆU MẪU (bỏ dấu -- ở 2 dòng dưới rồi chạy) ----
-- DELETE FROM scammers WHERE bank_number_normalized LIKE '99000000%';
-- (các report liên quan tự bị xoá theo nhờ ON DELETE CASCADE)
