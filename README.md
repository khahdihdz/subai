# SUBAI — AI Video Translator

Web app dịch video AI tối ưu cho VPS **512 MB RAM / 1 vCPU / NAT**.

## Stack
- Node.js 20 + Fastify
- SQLite WAL, không Redis
- Vanilla HTML/CSS/JS
- FFmpeg/ffprobe
- OpenRouter, mặc định `openrouter/auto`
- STT/TTS provider API độc lập
- SSE progress
- Queue 1 job mặc định
- Bind localhost, phù hợp Cloudflare Tunnel/reverse proxy

## Cài đặt Z-Ubuntu
```bash
git clone https://github.com/khahdihdz/subai.git /opt/subai
cd /opt/subai
chmod +x *.sh
./install.sh
nano .env
./start.sh
```

## systemd
```bash
cp subai.service /etc/systemd/system/subai.service
systemctl daemon-reload
systemctl enable --now subai
journalctl -u subai -f
```

App mặc định nghe `127.0.0.1:3000`; không cần mở inbound port. Cloudflare Tunnel có thể trỏ tới `http://127.0.0.1:3000`.

## ENV
`OPENROUTER_API_KEY` và `OPENROUTER_MODEL=openrouter/auto` dùng cho dịch AI. STT/TTS cần API tương thích OpenAI và cấu hình URL/key/model riêng. API key chỉ nằm server-side.

## API
POST /api/jobs · GET /api/jobs · GET /api/jobs/:id · POST /api/jobs/:id/cancel · POST /api/jobs/:id/translate · POST /api/jobs/:id/tts · POST /api/jobs/:id/burn · POST /api/subtitle/import · GET/PUT /api/jobs/:id/subtitle · GET /api/jobs/:id/download/:name · GET /api/jobs/:id/events

## Tối ưu 512 MB
Không AI local, Redis, PostgreSQL hay worker nhiều process. FFmpeg làm việc trên disk; concurrency mặc định 1; SQLite WAL; file tạm có cleanup; Docker giới hạn 450 MB.

## Lưu ý
Burn video bằng FFmpeg là công đoạn CPU nặng nhất trên 1 vCPU. Với video dài nên tăng thời gian timeout của reverse proxy/tunnel nếu cần.