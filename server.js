const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http, {
  transports: ["websocket", "polling"] // Render対策
});

app.use(express.static("public"));

/*
roomごとの状態

rooms = {
  room1 : {
    players : {
      socketId : { name:"🐰", pos:0 }
    },
    winner: null,
    finished: false
  }
}
*/
let rooms = {};

io.on("connection", socket => {

  console.log("connect:", socket.id);

  // ===== 部屋参加 =====
  socket.on("join", ({room, name}) => {

    socket.join(room);

    if (!rooms[room]) {
      rooms[room] = {
        players: {},
        winner: null,
        finished: false
      };
    }

    // プレイヤー登録
    rooms[room].players[socket.id] = {
      name: name || "🐱",
      pos: 0
    };

    // 全員へ状態送信
    io.to(room).emit("state", rooms[room]);
  });

  // ===== ボタン連打 =====
  socket.on("tap", ({room}) => {

    let game = rooms[room];
    if (!game) return;
    if (!game.players[socket.id]) return;
    
    // ゴール済みなら何もしない
    if (game.finished) return;

    // 前に進む
    game.players[socket.id].pos += 10;

    // ゴール判定
    if (game.players[socket.id].pos >= 1000) {
      game.players[socket.id].pos = 1000;
      
      // 初めてのゴール = 勝者確定
      if (!game.finished) {
        game.finished = true;
        game.winner = {
          id: socket.id,
          name: game.players[socket.id].name
        };
      }
    }

    // 全員に同期
    io.to(room).emit("state", game);
  });

  // ===== 切断 =====
  socket.on("disconnect", () => {

    for (let room in rooms) {
      if (rooms[room].players[socket.id]) {
        delete rooms[room].players[socket.id];
        io.to(room).emit("state", rooms[room]);
      }
    }

    console.log("disconnect:", socket.id);
  });

});

http.listen(process.env.PORT || 3000, () => {
  console.log("Race server running");
});
