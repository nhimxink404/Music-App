# Sonora - webapp nghe nhạc cá nhân

Sonora gồm React/Vite, Node.js/Express, MongoDB, Telegram bot, Docker và Nginx. File MP3 **không được lưu trong MongoDB**. MongoDB chỉ giữ metadata bài hát, yêu thích và playlist; dữ liệu nhạc nằm trong `backend/storage/music` khi chạy local hoặc Docker named volume `sonora_music_files` khi deploy.

## Chức năng

- Nhận MP3 từ Telegram bot, giữ tiêu đề theo tên file.
- Upload MP3 trực tiếp trên web, tự đồng bộ MP3 được chép vào folder.
- Phát/tạm dừng, tua, âm lượng, bài trước/sau và HTTP Range streaming.
- Phát ngẫu nhiên, lặp một bài, lặp toàn bộ hàng đợi.
- Yêu thích, tạo/xóa playlist, thêm/xóa bài trong playlist.
- Hẹn tắt nhạc sau 15/30/45/60/90 phút.
- Responsive cho desktop, tablet và điện thoại.

## Chạy local

Yêu cầu: Node.js 22+, npm và một MongoDB URI.

```powershell
Copy-Item backend/.env.example backend/.env
# Sua MONGODB_URI va cac bien Telegram trong backend/.env

cd backend
npm install
npm run dev
```

Mở terminal thứ hai:

```powershell
cd frontend
npm install
npm run dev
```

Truy cập `http://localhost:5173`. Vite proxy API sang `http://localhost:5000`.

## Cấu hình Telegram bot

1. Nhắn `/newbot` cho `@BotFather`, hoàn tất tạo bot và lấy token.
2. Lấy Telegram numeric user ID của bạn bằng `@userinfobot`.
3. Điền `TELEGRAM_BOT_TOKEN` và `TELEGRAM_ALLOWED_USER_IDS` trong env. Nhiều ID phân tách bằng dấu phẩy.
4. Khởi động backend, mở bot và gửi MP3 dưới dạng Audio hoặc Document.

Nếu có token nhưng thiếu allow-list, bot chủ động không chạy. Telegram Bot API tải được tối đa 20 MB; file lớn hơn có thể upload trên web tới 300 MB bằng cơ chế chia chunk.

## Env

| Biến | Bắt buộc | Mô tả |
|---|---:|---|
| `MONGODB_URI` | Có | MongoDB Atlas URI hoặc MongoDB local |
| `CLIENT_ORIGIN` | Có | Origin frontend được phép gọi API; nhiều origin phân tách dấu phẩy |
| `TELEGRAM_BOT_TOKEN` | Không | Token từ BotFather; bỏ trống để tắt bot |
| `TELEGRAM_ALLOWED_USER_IDS` | Khi bật bot | Danh sách Telegram user ID được upload |
| `MUSIC_DIR` | Không | Folder MP3, mặc định `backend/storage/music` |
| `MAX_UPLOAD_MB` | Không | Kích thước MP3 upload trên web, mặc định 300 MB (tự chia chunk) |
| `TELEGRAM_DOWNLOAD_LIMIT_MB` | Không | Giới hạn tải xuống của Telegram Bot API, mặc định 20 MB |
| `PORT` | Không | Port backend, mặc định 5000 |
| `VITE_API_URL` | Không | API URL khi frontend không dùng reverse proxy |

## Docker + Nginx

Từ thư mục gốc:

```powershell
Copy-Item .env.example .env
# Sua MONGODB_URI, CLIENT_ORIGIN va Telegram trong .env
docker compose up -d --build
docker compose ps
```

Truy cập port đặt ở `APP_PORT` (mặc định `10017`). Container chỉ bind vào `127.0.0.1` để aaPanel/Nginx reverse proxy, không mở trực tiếp ra Internet. Nginx phục vụ React và proxy `/api` sang backend. Không bind MP3 ra public; backend kiểm soát stream. Named volume giữ file qua các lần recreate/update container:

```powershell
docker volume inspect sonora_music_files
```

Để backup nhạc, nên backup named volume định kỳ. Không chạy nhiều backend replica với cùng bot token vì Telegram long polling chỉ nên có một consumer.

## GitHub Actions

Workflow `.github/workflows/ci-cd.yml` chạy test backend, lint/build frontend trên pull request. Khi push vào `main`, workflow build và đẩy:

- `ghcr.io/<owner>/sonora-backend:latest`
- `ghcr.io/<owner>/sonora-frontend:latest`

Trên máy deploy, đặt `BACKEND_IMAGE` và `FRONTEND_IMAGE` trong `.env` theo hai image trên, rồi chạy `docker compose pull && docker compose up -d`. Repository private cần đăng nhập GHCR bằng token có quyền `read:packages`.

Để tự động deploy qua SSH, tạo các GitHub Actions repository secrets:

- `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PORT`, `DEPLOY_SSH_KEY`
- `MONGODB_URI`, `CLIENT_ORIGIN`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_ALLOWED_USER_IDS`

Workflow deploy vào `/opt/sonora`, dùng port loopback `10017` và volume `sonora_music_files`. Trong aaPanel, tạo Proxy Project trỏ domain về `http://127.0.0.1:10017`.

Cấu hình aaPanel/Nginx hiện dùng cho `https://collabos.xyz` được lưu tại `deploy/collabos.xyz.conf`.

## API chính

- `GET /api/tracks`, `POST /api/tracks/upload`, `GET /api/tracks/:id/stream`
- `GET|POST|DELETE /api/favorites`
- `GET|POST|PATCH|DELETE /api/playlists`
- `GET /api/health`

Backend quét folder MP3 khi khởi động. Có thể buộc đồng bộ lại bằng `GET /api/tracks?sync=true` sau khi chép file trực tiếp vào folder.
