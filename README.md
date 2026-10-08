# SUBAI — AI Video Translator

Web app dịch video AI tối ưu cho VPS **2 CPU / 2 GB RAM / NAT**, dùng FFmpeg + API AI bên ngoài, không chạy AI local.

## Stack
- Node.js 20 + Fastify
- SQLite WAL, không Redis/PostgreSQL
- Vanilla HTML/CSS/JS
- FFmpeg/ffprobe
- OpenRouter, mặc định `openrouter/auto`
- STT/TTS provider API độc lập
- SSE progress
- Queue **1 job video mặc định** để tránh quá tải CPU/RAM/disk
- Bind localhost, phù hợp Cloudflare Tunnel/reverse proxy

## Cấu hình VPS hiện tại

Khuyến nghị cho VPS **2 CPU / 2 GB RAM / 15 GB NVMe**:

```env
MAX_FILE_SIZE=838860800
MAX_VIDEO_DURATION=10800
MAX_CONCURRENT_JOBS=1
AI_TIMEOUT_MS=180000
HOST=127.0.0.1
PORT=3000
OPENROUTER_MODEL=openrouter/auto
```

Không nên tăng `MAX_CONCURRENT_JOBS` lên 2 chỉ vì VPS có 2 CPU: burn/encode video có thể chiếm CPU và tạo nhiều file tạm, trong khi RAM và đặc biệt là disk 15 GB là giới hạn thực tế. Có thể tăng sau khi đo tải thực tế.

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

Node được giới hạn heap khoảng 768 MB qua `NODE_OPTIONS`; FFmpeg chạy process riêng và làm việc trực tiếp trên disk.

App mặc định nghe `127.0.0.1:3000`; không cần mở inbound port. Cloudflare Tunnel có thể trỏ tới `http://127.0.0.1:3000`.

## ENV

`OPENROUTER_API_KEY` và `OPENROUTER_MODEL=openrouter/auto` dùng cho dịch AI. STT/TTS cần API tương thích OpenAI và cấu hình URL/key/model riêng. API key chỉ nằm server-side.

Nếu dùng Docker, `docker-compose.yml` giới hạn container ở **1.5 GB RAM / 2 CPU**, dành phần còn lại cho hệ điều hành, tunnel và dịch vụ nền.

## API

POST /api/jobs · GET /api/jobs · GET /api/jobs/:id · POST /api/jobs/:id/cancel · POST /api/jobs/:id/translate · POST /api/jobs/:id/tts · POST /api/jobs/:id/burn · POST /api/subtitle/import · GET/PUT /api/jobs/:id/subtitle · GET /api/jobs/:id/download/:name · GET /api/jobs/:id/events

## Tối ưu tài nguyên

- Không AI local, Redis, PostgreSQL hoặc worker nhiều process.
- Upload video được stream xuống disk, không nạp toàn bộ video vào RAM.
- FFmpeg xử lý file trực tiếp trên disk.
- Concurrency mặc định 1.
- SQLite WAL.
- Node heap giới hạn khoảng 768 MB khi chạy systemd.
- Docker giới hạn 1.5 GB RAM và 2 CPU.
- File tạm cần được dọn định kỳ bằng `cleanup.sh`.

## Disk 15 GB

Giới hạn upload 800 MB là lựa chọn cân bằng. Khi burn video, đồng thời có thể tồn tại video gốc, audio, subtitle, file tạm và output; vì vậy không nên coi 15 GB là toàn bộ dung lượng dành cho video.

Nên giữ ít nhất **4 GB trống** trước khi chạy job lớn và chạy:

```bash
./cleanup.sh
df -h
```

Nếu cần xử lý video lớn hơn 800 MB hoặc dài hơn 3 giờ, nên nâng disk trước khi tăng các giới hạn.

## Lưu ý

Burn video bằng FFmpeg là công đoạn CPU/I/O nặng nhất. Với video dài, hãy tăng timeout của reverse proxy/tunnel nếu cần.
