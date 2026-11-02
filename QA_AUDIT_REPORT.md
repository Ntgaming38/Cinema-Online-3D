# QA Audit Report — Cinema Online 3D

**Ngày kiểm thử:** 03/11/2026 (Asia/Tokyo)  
**Phạm vi:** Kiểm tra runtime chỉ đọc, unit tests, giao diện phòng chiếu và rà soát mã nguồn liên quan.  
**Giới hạn:** Không sửa code, không commit/push và không ghi/xóa dữ liệu DB.

## 1. Tổng quan

| Kết quả | Số lượng |
|---|---:|
| PASS | 24 |
| FAIL | 4 |
| BLOCKED / chưa kiểm thử | 7 nhóm kịch bản |

28 điểm kiểm tra đã chạy gồm 14 unit assertions, 8 HTTP/API probes, 4 viewport checks và 2 đối chiếu dữ liệu UI/API. Tổng số này không bao gồm các kịch bản BLOCKED.

Web trả HTTP 200 tại cổng 3000 và 3001. Realtime `/health` trả HTTP 200 và báo database `connected`; API danh sách phòng, chi tiết phòng, chat và `/auth/me` phản hồi thành công. API phòng không tồn tại trả 404 như mong đợi. `npm run test:unit`: **14 PASS, 0 FAIL**.

### Ma trận kiểm thử

| Chức năng | Kết quả | Lỗi / ghi chú | Mức độ |
|---|---|---|---|
| URL parser và auth/token unit tests | PASS | 14/14 assertions; chưa bao phủ playback thật | — |
| Web/API đọc và realtime health | PASS | 8 probes; DB báo connected | — |
| Giao diện 1920×1080, 1366×768 | PASS | Không tràn khung tài liệu ở hai viewport desktop | — |
| Giao diện 390×844, 430×932 | FAIL | Player co còn khoảng 70px và 103px; khu vực nội dung bị ép/clipped | High |
| Lịch sử chat | FAIL | UI hiển thị tin nhắn mẫu trong khi API trả `messages: []` | Medium |
| Số thành viên | FAIL | UI hiển thị 2 người, REST `activeMemberCount` trả 1 trong lần đối chiếu | Medium |
| Phát YouTube | BLOCKED | IFrame được tạo và có duration 03:34; trạng thái lưu là paused tại 0s. Không thao tác play vì phiên hiện tại không có quyền chủ phòng | — |
| Đồng bộ play/pause/seek giữa 3 người | BLOCKED | Không có ba phiên độc lập/owner session để kiểm tra; không đo drift | — |
| Thêm/đổi/xóa video và lỗi nguồn phát | BLOCKED | Không thực hiện thao tác ghi lên phòng đang dùng | — |
| Tạo/rời/đóng phòng, mật khẩu và quyền | BLOCKED | Không chạy POST/PATCH/DELETE; chưa xác định DB có phải môi trường production hay không | — |
| Gửi chat/reaction/chọn ghế và lưu DB | BLOCKED | Không phát sinh dữ liệu thử nghiệm | — |
| TiDB sau restart, transaction và phục hồi mạng | BLOCKED | Integration suite tạo rồi xóa user/room; không chạy trên DB chưa xác nhận an toàn | — |
| Các nút/menu còn lại, tablet, FPS/GPU mobile | BLOCKED | Chỉ rà soát code/DOM; chưa thao tác hoặc đo thiết bị thật | — |

## 2. Chi tiết lỗi

### QA-001 — Bố cục phòng chiếu không dùng được trên mobile

- **Mức độ:** High
- **Bằng chứng / tái hiện:** Đo trực tiếp trang phòng tại 390×844 và 430×932. Cột chat vẫn giữ chiều rộng 300px; vùng `main` chỉ còn 90px/130px và player còn khoảng 70px/103px. Khung ngoài giấu overflow nên nội dung bị ép/clipped thay vì cuộn ngang.
- **Kết quả mong muốn:** Player và điều khiển giữ kích thước sử dụng được; chat có thể thu gọn hoặc chuyển thành panel riêng trên mobile.
- **Nguyên nhân gốc:** Layout phòng dùng flex với chat `width: 300px; flexShrink: 0`; media query chỉ ẩn `.hidden-mobile`, không ẩn/đổi layout chat. Xem [TheaterRoom.tsx](./apps/web/components/theater/TheaterRoom.tsx#L446), [TheaterRoom.tsx](./apps/web/components/theater/TheaterRoom.tsx#L744), [globals.css](./apps/web/app/globals.css#L454).
- **Hướng khắc phục:** Định nghĩa layout mobile riêng cho vùng theater/chat và xác nhận player có chiều rộng tối thiểu hợp lý tại 390px/430px.

### QA-002 — Phòng riêng và lịch sử chat chưa được bảo vệ đồng nhất ở server

- **Mức độ:** High
- **Bằng chứng:** Rà soát mã nguồn, không thực hiện bypass hoặc truy cập dữ liệu phòng riêng. API chi tiết phòng vẫn trả thông tin room/video/playback/member sau khi chỉ đánh dấu `isPasswordProtected`; API chat đọc lịch sử không xác thực quyền; Socket.IO `room:join` nhận trường password nhưng không kiểm tra password hoặc quyền truy cập trước khi join.
- **Kết quả mong muốn:** Mọi REST và socket path phải xác thực thành viên/quyền truy cập phòng riêng trước khi trả dữ liệu hoặc join room.
- **Nguyên nhân gốc:** Kiểm tra mật khẩu chỉ được thực hiện qua endpoint riêng và trạng thái `passwordRequired` ở client; server không lưu/cấp bằng chứng xác thực phòng cho các API/socket tiếp theo. Xem [room route](./apps/web/app/api/rooms/%5Bcode%5D/route.ts#L8), [chat route](./apps/web/app/api/rooms/%5Bcode%5D/chat/route.ts#L6), [verify-password route](./apps/web/app/api/rooms/%5Bcode%5D/verify-password/route.ts#L12), [realtime index.ts](./apps/realtime/src/index.ts#L129).
- **Hướng khắc phục:** Áp quyền server-side cho chi tiết phòng, chat và socket join; chỉ cho phép truy cập sau khi xác thực mật khẩu/room membership. Không coi cờ client là quyền truy cập.

### QA-003 — Socket chat/reaction chấp nhận room code từ payload mà không ràng buộc membership

- **Mức độ:** High
- **Bằng chứng:** Trong handlers chat và reaction, room code trong payload được dùng để phát sự kiện vào room mà không xác minh socket đã join room đó. Đây là rà soát mã nguồn; không gửi payload kiểm thử.
- **Kết quả mong muốn:** Mỗi sự kiện chỉ được xử lý trong phòng gắn với socket đã xác thực/join thành công.
- **Nguyên nhân gốc:** Handler ưu tiên `payload.roomCode` và phát tới `io.to(code)` mà không kiểm tra `socketMeta.roomCode`/membership. Xem [realtime index.ts](./apps/realtime/src/index.ts#L296), [realtime index.ts](./apps/realtime/src/index.ts#L318), [realtime index.ts](./apps/realtime/src/index.ts#L455), [realtime index.ts](./apps/realtime/src/index.ts#L474).
- **Hướng khắc phục:** Lấy room từ metadata socket server-side, từ chối event nếu socket chưa join hoặc room không khớp; áp dụng cùng quy tắc cho chat, reaction và seat.

### QA-004 — Dữ liệu demo hiển thị như dữ liệu thật

- **Mức độ:** Medium
- **Bằng chứng / tái hiện:** API chat phòng `MUEAEDB` trả `messages: []`, nhưng UI đang hiển thị năm tin nhắn mẫu với tên người dùng và nội dung cụ thể. UI cũng khởi tạo 12.500 lượt thích trước khi nhận reaction thật.
- **Kết quả mong muốn:** Phòng không có dữ liệu phải hiển thị trạng thái rỗng; số liệu không có nguồn lưu trữ/realtime không được trình bày như thống kê thật.
- **Nguyên nhân gốc:** State chat được khởi tạo với dữ liệu mẫu và chỉ thay thế khi lịch sử trả về có ít nhất một tin nhắn; `likeCount` có giá trị mặc định cố định. Xem [TheaterRoom.tsx](./apps/web/components/theater/TheaterRoom.tsx#L93), [TheaterRoom.tsx](./apps/web/components/theater/TheaterRoom.tsx#L103), [TheaterRoom.tsx](./apps/web/components/theater/TheaterRoom.tsx#L172).
- **Hướng khắc phục:** Khởi tạo chat rỗng/loading; hiển thị empty state khi API trả danh sách rỗng; chỉ hiển thị metrics có dữ liệu thật hoặc ghi rõ là demo.

### QA-005 — Số thành viên realtime khác số thành viên lưu trong DB

- **Mức độ:** Medium
- **Bằng chứng / tái hiện:** Cùng lần kiểm tra, trình duyệt hiển thị “2 người đang xem”; REST room detail trả `activeMemberCount: 1`. Giá trị UI lấy từ presence Socket.IO, còn REST lấy từ RoomMember trong DB.
- **Kết quả mong muốn:** Presence và dữ liệu thành viên bền vững hội tụ sau join/leave/disconnect.
- **Nguyên nhân gốc:** Hai con số lấy từ hai nguồn khác nhau (bản đồ users trong RAM và DB); nguyên nhân cụ thể của bản ghi thiếu/chưa đồng bộ chưa thể xác nhận khi không thực hiện thao tác ghi hoặc reconnect.
- **Hướng khắc phục:** Bổ sung kiểm tra kết quả lưu RoomMember và telemetry/lỗi khi upsert thất bại; xác định một định nghĩa thống nhất cho “đang xem” và kiểm tra lại sau join/leave, nhiều tab, reconnect và restart.

### QA-006 — Một số nút hiển thị nhưng chưa thực hiện chức năng tương ứng

- **Mức độ:** Low
- **Bằng chứng:** Nút “Bình chọn” chỉ hiện thông báo rằng tính năng sẽ mở sau; nút “Nâng cấp ngay” không có handler. Chưa click các nút trong runtime.
- **Nguyên nhân gốc:** UI placeholder chưa được nối với chức năng thật. Xem [TheaterRoom.tsx](./apps/web/components/theater/TheaterRoom.tsx#L568), [TheaterRoom.tsx](./apps/web/components/theater/TheaterRoom.tsx#L711).
- **Hướng khắc phục:** Triển khai hành động đích hoặc thể hiện rõ trạng thái chưa khả dụng và không trình bày như nút hoạt động.

### QA-007 — Khóa JWT có giá trị dự phòng cố định

- **Mức độ:** High nếu chạy production thiếu cấu hình; chưa xác nhận tình trạng cấu hình runtime
- **Bằng chứng:** Realtime server dùng một literal fallback khi `JWT_SECRET` không được đặt. Không kiểm tra hoặc tiết lộ giá trị `.env`; môi trường hiện có biến `JWT_SECRET`.
- **Nguyên nhân gốc:** Server tiếp tục chạy thay vì từ chối khởi động khi thiếu secret bắt buộc. Xem [realtime index.ts](./apps/realtime/src/index.ts#L10).
- **Hướng khắc phục:** Bắt buộc secret mạnh qua môi trường, fail-fast nếu thiếu; không dùng fallback dùng chung trong production.

## 3. Ghi chú môi trường và bằng chứng

- Trang trình duyệt hiện có: `http://localhost:3001/rooms/MUEAEDB`; player là YouTube IFrame, không phải thẻ HTML `<video>`.
- `/health` tại cổng 4001 báo `database: connected`. Điều này chỉ xác nhận truy vấn health, không chứng minh tạo/lưu/khôi phục dữ liệu hoạt động đầy đủ.
- Có log console cũ ghi WebSocket đóng trước khi thiết lập và HTTP 401; thời điểm log cũ hơn lần kiểm tra hiện tại nên không dùng làm bằng chứng lỗi realtime hiện tại.
- Tại thời điểm kiểm tra, playback lưu trong DB là paused ở 0 giây. Không có phép đo drift 10/30/60 giây.
- Không chạy integration tests vì test hiện có tạo rồi xóa bản ghi DB; chưa xác định cấu hình đang trỏ tới DB thử nghiệm hay production.
- Chưa xác minh đăng ký/đăng nhập, thay đổi mật khẩu phòng, khôi phục kết nối DB, CORS với nguồn video thật, phát MP4/WebM/HLS, giới hạn thành viên, chống spam, seat collision hoặc hiệu suất GPU/FPS.
- Không thay đổi file mã nguồn, cấu hình, `.env`, DB hoặc git history.

## 4. Kế hoạch khắc phục ưu tiên

1. **P0 — Quyền truy cập phòng riêng:** Bảo vệ API chi tiết/chat và kiểm tra quyền trong socket join trước khi trả dữ liệu.
2. **P0 — Ràng buộc socket theo phòng:** Không nhận room code tùy ý cho chat/reaction/seat; kiểm tra membership server-side.
3. **P1 — Responsive phòng chiếu:** Chuyển chat thành panel/toggle trên mobile; kiểm tra player, controls và 3D tại 390×844, 430×932.
4. **P1 — Presence và persistence:** Xử lý/ghi log lỗi DB rõ ràng; kiểm thử join/leave/reconnect/nhiều tab và đối chiếu socket presence với RoomMember.
5. **P1 — Tính toàn vẹn UI:** Xóa dữ liệu chat/metrics mẫu khỏi luồng production hoặc đánh dấu demo; thêm empty states.
6. **P2 — JWT và nút placeholder:** Fail-fast khi thiếu secret; hoàn thiện hoặc vô hiệu hóa rõ ràng các nút chưa có chức năng.
7. **P2 — Regression suite an toàn:** Tạo DB/schema test riêng trước khi chạy integration suite; thêm E2E đa phiên cho play/pause/seek/video mới và đo sai lệch sau 10/30/60 giây.
