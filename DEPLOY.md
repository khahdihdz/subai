# 🚀 Hướng Dẫn Deploy SubAI lên Render.com

---

## Bước 1 — Chuẩn bị GitHub Repo

1. Tạo repo mới tại **https://github.com/new**
   - Tên: `subai` (hoặc tùy ý)
   - Visibility: **Private** (khuyến nghị — có chứa code API)
   - Click **Create repository**

2. Upload toàn bộ code lên repo:
   ```bash
   git init
   git add .
   git commit -m "feat: SubAI initial deploy"
   git remote add origin https://github.com/TEN_BAN/subai.git
   git push -u origin main
   ```
   > **Lưu ý**: File `.env` đã được `.gitignore` — sẽ KHÔNG bị push lên GitHub ✓

---

## Bước 2 — Tạo Web Service trên Render

1. Đăng nhập **https://dashboard.render.com**
2. Click **+ New → Web Service**
3. Chọn **Connect a repository** → chọn repo `subai`
4. Cấu hình:

| Trường | Giá trị |
|--------|---------|
| **Name** | `subai` (hoặc tùy ý) |
| **Region** | Singapore (gần VN nhất) |
| **Branch** | `main` |
| **Runtime** | **Docker** |
| **Instance Type** | Free (hoặc Starter $7/tháng) |

5. Click **Advanced** → bỏ qua, không cần chỉnh
6. Click **Create Web Service**

---

## Bước 3 — Thêm Environment Variables

Trong trang Web Service vừa tạo:

1. Vào tab **Environment**
2. Click **Add Environment Variable** và thêm:

```
ASSEMBLYAI_API_KEY = <key của bạn>
GEMINI_API_KEY     = <key của bạn>
```

3. Click **Save Changes** → Render sẽ tự restart

---

## Bước 4 — Chờ Deploy

- Render sẽ build Docker image (~3-5 phút lần đầu)
- Xem log tại tab **Logs**
- Khi thấy dòng:
  ```
  PHP x.x.x Development Server started at http://0.0.0.0:10000
  ```
  → Deploy thành công ✅

- URL app: `https://subai.onrender.com` (hoặc tên bạn đặt)

---

## 🔑 Lấy API Keys miễn phí

### AssemblyAI (Nhận dạng giọng nói)
1. Đăng ký: https://www.assemblyai.com
2. Dashboard → Copy **API Key**
3. **Miễn phí**: 5 giờ audio/tháng

### Google Gemini (Dịch thuật)
1. Vào: https://aistudio.google.com/app/apikey
2. **Get API Key** → Create API key
3. **Miễn phí**: 1,500,000 token/ngày (Gemini 1.5 Flash)

---

## ⚠️ Lưu ý quan trọng

### Free tier của Render
- Server **tắt sau 15 phút không có request**
- Lần đầu truy cập sau khi tắt mất ~30 giây để khởi động lại
- Để tránh: nâng lên Starter ($7/tháng) hoặc dùng uptime monitor

### Upload file lớn
- Free tier có RAM 512MB — video > 200MB có thể lỗi
- Khuyên dùng video < 100MB hoặc nâng plan

### Disk (uploads/tmp)
- Free tier KHÔNG có persistent disk
- File upload sẽ mất khi server restart (bình thường — chỉ cần trong quá trình xử lý)

---

## 🔄 Update code sau này

```bash
git add .
git commit -m "update: mô tả thay đổi"
git push
```
→ Render tự động detect và redeploy

---

## 🐛 Debug

Xem log tại: Render Dashboard → Web Service → **Logs**

Lỗi thường gặp:
- `curl: command not found` → Dockerfile đã cài, thử rebuild
- `Permission denied: uploads/` → mkdir + chmod đã có trong Dockerfile
- `AssemblyAI 401` → Sai API key, kiểm tra Environment Variables
- `Gemini 429` → Vượt quota miễn phí, chờ hết ngày
