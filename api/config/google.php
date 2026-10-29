<?php
// ============================================================
// CẤU HÌNH ĐĂNG NHẬP BẰNG GOOGLE
// Dán "Google OAuth Client ID" (dạng xxxx.apps.googleusercontent.com)
// lấy từ Google Cloud Console (APIs & Services > Credentials > OAuth
// 2.0 Client IDs > kiểu "Web application") vào dòng dưới đây.
// PHẢI giống hệt GOOGLE_CLIENT_ID trong assets/js/google-config.js.
// KHÔNG cần "Client secret" cho luồng đăng nhập này (chỉ xác thực ID
// token, không đổi lấy access token phía server).
// ============================================================
const GOOGLE_CLIENT_ID = '477566143865-pspfkpco9s3hqeap21as106rebuj57io.apps.googleusercontent.com';
