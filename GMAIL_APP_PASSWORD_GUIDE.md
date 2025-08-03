# 🔐 GMAIL APP PASSWORD - HƯỚNG DẪN CHI TIẾT

## 📖 App Password là gì?

**Gmail App Password** là mật khẩu đặc biệt được Google tạo ra để các ứng dụng bên thứ 3 có thể truy cập Gmail một cách an toàn.

### 🔑 Tại sao cần App Password?

1. **Bảo mật 2 lớp (2FA)**: Khi bạn bật 2FA, Google không cho phép dùng mật khẩu thường
2. **Mật khẩu riêng biệt**: App Password khác với mật khẩu đăng nhập Gmail
3. **An toàn hơn**: Có thể thu hồi riêng lẻ mà không ảnh hưởng tài khoản chính

### 📊 So sánh:

| Loại mật khẩu | Mục đích | Ví dụ |
|---------------|----------|-------|
| **Mật khẩu Gmail** | Đăng nhập Gmail trên web/app | `MyPassword123!` |
| **App Password** | Ứng dụng gửi email tự động | `vzlhsybsptpvbmuz` |

## 🎯 Tình trạng hiện tại của bạn:

✅ **EMAIL_USER**: `nghiaht28102003@gmail.com`  
✅ **EMAIL_PASS**: `vzlhsybsptpvbmuz` (Đây chính là App Password!)

**➡️ Bạn đã có App Password rồi!** Hãy test ngay xem có hoạt động không.

## 🧪 Cách test:

```bash
# Test email configuration
node test-email-config.js

# Restart server với cấu hình mới
node server-email-secure.js

# Test forgot password
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'
```

## 🆘 Nếu App Password không hoạt động:

### Bước 1: Kiểm tra 2FA
- Vào: https://myaccount.google.com/security
- Đảm bảo "2-Step Verification" đang BẬT

### Bước 2: Tạo App Password mới
1. Vào: https://myaccount.google.com/apppasswords
2. Chọn "Select app" → "Mail"
3. Chọn "Select device" → "Other" → Nhập "Cow Social Network"
4. Click "Generate"
5. Copy mật khẩu 16 ký tự (VD: `abcd efgh ijkl mnop`)
6. Cập nhật `.env`: `EMAIL_PASS=abcdefghijklmnop` (bỏ dấu cách)

### Bước 3: Xử lý lỗi thường gặp

#### Lỗi "Invalid credentials":
- Kiểm tra email và App Password đúng chưa
- Đảm bảo đã bật 2FA

#### Lỗi "Application-specific password required":
- App Password cũ/sai → Tạo mới
- 2FA chưa bật → Bật 2FA trước

#### Lỗi "Connection timeout":
- Firewall chặn port 587
- Mạng công ty chặn SMTP

## 🔧 Troubleshooting Commands:

```bash
# Kiểm tra cấu hình hiện tại
node check-email-config.js

# Test kết nối SMTP
node test-email-config.js

# Xem server logs
# (Xem terminal server để thấy lỗi chi tiết)
```

## 💡 Mẹo bảo mật:

1. **Không chia sẻ App Password**
2. **Tạo App Password riêng cho từng ứng dụng**
3. **Thu hồi App Password khi không dùng**
4. **Định kỳ thay đổi**

## 🎉 Khi nào biết thành công?

Server sẽ hiển thị:
```
✅ Password reset email sent successfully
📧 Password reset email sent successfully to: test@example.com
```

Thay vì:
```
❌ Failed to send password reset email: Invalid login
```
