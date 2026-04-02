# SubAI — Phụ Đề Thông Minh

> Tự động tạo phụ đề và dịch video bằng **AssemblyAI** + **Google Gemini 1.5 Flash**

---

## 🗂 Cấu trúc dự án

```
subai/
├── index.php               ← Giao diện chính (Bootstrap 5)
├── config.php              ← Cấu hình & helper functions
├── .env                    ← API keys (tự tạo sau khi deploy)
├── api/
│   ├── upload.php          ← Nhận video → upload lên AssemblyAI CDN
│   ├── transcribe.php      ← Gửi job nhận dạng giọng nói
│   ├── status.php          ← Poll trạng thái & lấy kết quả
│   ├── translate.php       ← Dịch phụ đề bằng Gemini
│   ├── export.php          ← Xuất SRT / WebVTT
│   ├── save_keys.php       ← Lưu API keys
│   └── check_keys.php      ← Kiểm tra API keys
├── assets/
│   ├── css/subai.css       ← Custom CSS (kết hợp Bootstrap)
│   └── js/subai.js         ← Frontend logic
├── uploads/                ← Video tạm (tự dọn sau xử lý)
└── tmp/                    ← Metadata jobs
```

---

## 🚀 Deploy lên Render.com

### 1. Tạo Web Service

- **Runtime**: PHP
- **Build Command**: `composer install` (nếu có) hoặc để trống
- **Start Command**: `php -S 0.0.0.0:$PORT -t .`

### 2. Environment Variables

Trong Render Dashboard → Environment → Add:

```
ASSEMBLYAI_API_KEY = your_assemblyai_key_here
GEMINI_API_KEY     = your_gemini_key_here
```

### 3. php.ini (tuỳ chọn)

Tạo file `php.ini` ở root nếu cần tăng upload size:

```ini
upload_max_filesize = 500M
post_max_size       = 510M
max_execution_time  = 600
memory_limit        = 512M
```

---

## 🔑 Lấy API Keys

### AssemblyAI (Nhận dạng giọng nói)
1. Đăng ký tại https://www.assemblyai.com
2. Vào Dashboard → Copy API key
3. **Miễn phí**: 5 giờ audio/tháng

### Google Gemini (Dịch thuật)
1. Vào https://aistudio.google.com/app/apikey
2. Tạo API key mới
3. **Miễn phí**: 1,500,000 token/ngày (Gemini 1.5 Flash)

---

## 📌 Tính năng

| Tính năng | Chi tiết |
|-----------|----------|
| Nhận dạng giọng nói | AssemblyAI — hỗ trợ 10+ ngôn ngữ, word-level timing |
| Tự động phát hiện ngôn ngữ | AssemblyAI language detection |
| Dịch thuật | Gemini 1.5 Flash — batch 30 dòng, context-aware |
| Phụ đề overlay | Hiển thị trực tiếp trên video, sync theo thời gian |
| Chế độ song ngữ | Hiển thị cả gốc + dịch cùng lúc |
| Xuất file | SRT gốc, SRT dịch, SRT song ngữ, WebVTT (6 loại) |
| Lưu API key | Qua giao diện modal, lưu vào `.env` |

---

## ⚙️ Luồng xử lý

```
[Upload video]
      ↓
[AssemblyAI CDN] ← file binary stream
      ↓
[Submit transcription job]
      ↓
[Poll status mỗi 5 giây] → completed
      ↓
[Parse word-level timing → subtitle segments]
      ↓
[Gemini translate (batch 30)] ← tuỳ chọn
      ↓
[Render danh sách + video overlay]
      ↓
[Export SRT / VTT]
```
