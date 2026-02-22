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
      pos: 0  // 0〜100のパーセンテージ
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

    // 前に進む（1%ずつ）
    game.players[socket.id].pos += 1;

    // ゴール判定（100%到達）
    if (game.players[socket.id].pos >= 100) {
      game.players[socket.id].pos = 100;
      
      // 初めてのゴール = 勝者確定
      if (!game.finished) {
        game.finished = true;
        game.winner = {
          id: socket.id,
          name: game.players[socket.id].name
        };
      }
    }

    // 他のプレイヤーにジャンプを通知（送信者自身は除く）
    socket.broadcast.to(room).emit("jumped", { id: socket.id });

    // 全員に同期
    io.to(room).emit("state", game);
  });

  // ===== ゲームリセット =====
  socket.on("reset", ({room}) => {

    let game = rooms[room];
    if (!game) return;

    // 全プレイヤーの位置をリセット
    Object.keys(game.players).forEach(id => {
      game.players[id].pos = 0;
    });

    // ゲーム状態をリセット
    game.finished = false;
    game.winner = null;

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
