const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

let rooms = {};

io.on("connection", socket => {

  socket.on("join", room => {
    socket.join(room);

    if (!rooms[room]) {
      rooms[room] = {
        board: Array(9).fill(""),
        turn: "X"
      };
    }

    socket.emit("state", rooms[room]);
  });

  socket.on("move", ({room, index}) => {
    let game = rooms[room];
    if (!game) return;

    // すでに埋まっていたら無視
    if (game.board[index] !== "") return;

    // 石を置く
    game.board[index] = game.turn;

    // 手番交代
    game.turn = game.turn === "X" ? "O" : "X";

    // 部屋の全員に盤面送信
    io.to(room).emit("state", game);
  });

});

http.listen(process.env.PORT || 3000);
