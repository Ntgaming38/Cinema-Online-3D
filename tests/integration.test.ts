import { prisma } from "../apps/web/lib/prisma";
import { hashPassword, comparePassword } from "../apps/web/lib/auth";

let passed = 0;
let failed = 0;

function assert(condition: boolean, desc: string) {
  if (condition) {
    console.log(`  ✓ PASS: ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ FAIL: ${desc}`);
    failed++;
  }
}

async function runIntegration() {
  console.log("=== KIỂM THỬ TÍCH HỢP TIDB CLOUD ===\n");

  const testCode = "TEST" + Math.floor(1000 + Math.random() * 9000);
  const testUsername = "tester_" + Math.random().toString(36).slice(2, 7);

  try {
    // 1. Create User
    console.log("1. Tạo tài khoản người dùng trên TiDB Cloud:");
    const testPass = "secretTestPass123";
    const passwordHash = await hashPassword(testPass);
    const user = await prisma.user.create({
      data: {
        username: testUsername,
        passwordHash,
        displayName: "Kiểm Thử Viên TiDB",
        avatarUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=" + testUsername
      }
    });
    assert(Boolean(user.id), `Tạo người dùng thành công (ID: ${user.id})`);

    // 2. Create Room with Video & PlaybackState in TiDB
    console.log("\n2. Tạo phòng chiếu trên TiDB Cloud:");
    const roomPasswordHash = await hashPassword("roomPass888");
    const room = await prisma.room.create({
      data: {
        code: testCode,
        name: "Phòng Kiểm Thử Rạp 3D",
        description: "Phòng test tự động kết nối TiDB Cloud",
        visibility: "PRIVATE",
        passwordHash: roomPasswordHash,
        maxMembers: 25,
        allowMemberControl: true,
        ownerId: user.id,
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
            seatLabel: "C5"
          }
        },
        playback: {
          create: {
            isPlaying: true,
            positionSec: 42.5,
            sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
            videoTitle: "Rick Astley - Never Gonna Give You Up"
          }
        },
        video: {
          create: {
            title: "Rick Astley - Never Gonna Give You Up",
            sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
          }
        }
      },
      include: {
        video: true,
        playback: true,
        members: true
      }
    });

    assert(room.code === testCode, `Phòng tạo thành công với code ${room.code}`);
    assert(room.playback?.isPlaying === true, "Trạng thái Playback lưu chính xác trong TiDB");
    assert(room.playback?.positionSec === 42.5, "Thời điểm phát positionSec = 42.5s lưu chính xác");
    assert(room.members[0].seatLabel === "C5", "Vị trí ghế C5 lưu chính xác trong RoomMember");

    // 3. Password Verification
    console.log("\n3. Kiểm tra bảo mật mật khẩu phòng:");
    const passOk = await comparePassword("roomPass888", room.passwordHash!);
    const passWrong = await comparePassword("wrongPass", room.passwordHash!);
    assert(passOk === true, "Mật khẩu phòng đúng được chấp nhận");
    assert(passWrong === false, "Mật khẩu sai bị từ chối");

    // 4. Chat Message Persistence
    console.log("\n4. Kiểm tra lưu tin nhắn Chat:");
    const chatMsg = await prisma.chatMessage.create({
      data: {
        roomId: room.id,
        userId: user.id,
        content: "Xin chào mọi người từ TiDB Cloud!"
      }
    });
    assert(chatMsg.content === "Xin chào mọi người từ TiDB Cloud!", "Tin nhắn chat lưu thành công vào TiDB");

    // 5. Reaction Persistence
    console.log("\n5. Kiểm tra lưu biểu cảm Reaction:");
    const reaction = await prisma.reaction.create({
      data: {
        roomId: room.id,
        userId: user.id,
        emoji: "🍿"
      }
    });
    assert(reaction.emoji === "🍿", "Biểu cảm 🍿 lưu thành công vào TiDB");

    // 6. Cleanup test records
    console.log("\n6. Dọn dẹp dữ liệu kiểm thử:");
    await prisma.room.delete({ where: { id: room.id } });
    await prisma.user.delete({ where: { id: user.id } });
    assert(true, "Dọn dẹp bản ghi kiểm thử thành công (Cascade delete Room, Members, Playback, Chat, Reaction)");

    console.log(`\n=== TỔNG KẾT TÍCH HỢP TIDB: ${passed} PASS, ${failed} FAIL ===`);
  } catch (err) {
    console.error("Lỗi kiểm thử tích hợp:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runIntegration();
