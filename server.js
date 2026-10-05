const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server);

const PORT = process.env.PORT || 3000;

app.use(express.static("public"));

const rooms = new Map();


// =============================
// DOMINO DECK
// =============================

function createDeck() {
    const deck = [];

    for (let a = 0; a <= 6; a++) {
        for (let b = a; b <= 6; b++) {
            deck.push({
                id: `${a}-${b}`,
                a,
                b
            });
        }
    }

    return deck;
}


// =============================
// SHUFFLE
// =============================

function shuffle(array) {

    for (let i = array.length - 1; i > 0; i--) {

        const j =
            Math.floor(Math.random() * (i + 1));

        [array[i], array[j]] =
            [array[j], array[i]];
    }

    return array;
}


// =============================
// ROOM CODE
// =============================

function createRoomCode() {

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    let code;

    do {

        code = "";

        for (let i = 0; i < 5; i++) {

            code +=
                chars[
                    Math.floor(
                        Math.random() * chars.length
                    )
                ];
        }

    } while (rooms.has(code));

    return code;
}


// =============================
// FIND PLAYER ROOM
// =============================

function findRoomForPlayer(socketId) {

    for (const room of rooms.values()) {

        if (
            room.players.some(
                player => player.id === socketId
            )
        ) {
            return room;
        }
    }

    return null;
}


// =============================
// PUBLIC ROOM STATE
// =============================

function publicState(room) {

    return {

        roomCode: room.code,

        board: room.board,

        turn: room.turn,

        started: room.started,

        winner: room.winner,

        players: room.players.map(player => ({

            id: player.id,

            name: player.name,

            handCount: player.hand.length

        }))
    };
}


// =============================
// SEND STATE
// =============================

function sendRoomState(room) {

    io.to(room.code).emit(
        "roomState",
        publicState(room)
    );

    for (const player of room.players) {

        io.to(player.id).emit(
            "yourHand",
            player.hand
        );
    }
}


// =============================
// START GAME
// =============================

function startGame(room) {

    if (room.players.length !== 2) {
        return;
    }

    let deck =
        shuffle(createDeck());

    room.players[0].hand =
        deck.splice(0, 7);

    room.players[1].hand =
        deck.splice(0, 7);

    room.board = [];

    room.started = true;

    room.winner = null;

    room.turn =
        room.players[0].id;

    sendRoomState(room);

    io.to(room.code).emit(
        "message",
        "Game started! Player 1 goes first."
    );
}


// =============================
// SOCKET CONNECTION
// =============================

io.on("connection", (socket) => {

    console.log(
        "Player connected:",
        socket.id
    );


    // =========================
    // CREATE ROOM
    // =========================

    socket.on(
        "createRoom",
        (playerName, callback) => {

            const code =
                createRoomCode();

            const room = {

                code,

                players: [],

                board: [],

                turn: null,

                started: false,

                winner: null
            };

            const player = {

                id: socket.id,

                name:
                    playerName ||
                    "Player 1",

                hand: []
            };

            room.players.push(player);

            rooms.set(
                code,
                room
            );

            socket.join(code);

            callback({

                success: true,

                roomCode: code

            });

            sendRoomState(room);

            console.log(
                `Room ${code} created`
            );
        }
    );


    // =========================
    // JOIN ROOM
    // =========================

    socket.on(
        "joinRoom",
        ({ roomCode, playerName }, callback) => {

            const code =
                String(roomCode || "")
                    .toUpperCase();

            const room =
                rooms.get(code);

            if (!room) {

                callback({

                    success: false,

                    message:
                        "Room not found."

                });

                return;
            }

            if (room.players.length >= 2) {

                callback({

                    success: false,

                    message:
                        "Room is already full."

                });

                return;
            }

            if (room.started) {

                callback({

                    success: false,

                    message:
                        "Game already started."

                });

                return;
            }

            const player = {

                id: socket.id,

                name:
                    playerName ||
                    "Player 2",

                hand: []
            };

            room.players.push(player);

            socket.join(code);

            callback({

                success: true,

                roomCode: code

            });

            startGame(room);

            console.log(
                `Player joined room ${code}`
            );
        }
    );


    // =========================
    // PLAY TILE
    // =========================

    socket.on(
        "playTile",
        ({ tileId, side }) => {

            const room =
                findRoomForPlayer(
                    socket.id
                );

            if (!room) {
                return;
            }

            if (!room.started) {
                return;
            }

            if (room.winner) {
                return;
            }

            if (
                room.turn !== socket.id
            ) {

                socket.emit(
                    "errorMessage",
                    "It's not your turn."
                );

                return;
            }

            const player =
                room.players.find(
                    p =>
                        p.id ===
                        socket.id
                );

            if (!player) {
                return;
            }

            const tileIndex =
                player.hand.findIndex(
                    tile =>
                        tile.id ===
                        tileId
                );

            if (tileIndex === -1) {

                socket.emit(
                    "errorMessage",
                    "You don't have that tile."
                );

                return;
            }

            const tile =
                player.hand[tileIndex];


            // =====================
            // FIRST TILE
            // =====================

            if (room.board.length === 0) {

                player.hand.splice(
                    tileIndex,
                    1
                );

                room.board.push({

                    id: tile.id,

                    a: tile.a,

                    b: tile.b

                });

            }


            // =====================
            // EXISTING BOARD
            // =====================

            else {

                const leftValue =
                    room.board[0].a;

                const rightValue =
                    room.board[
                        room.board.length - 1
                    ].b;


                // =================
                // LEFT
                // =================

                if (side === "left") {

                    let placedTile;

                    if (
                        tile.b ===
                        leftValue
                    ) {

                        placedTile = {

                            id: tile.id,

                            a: tile.a,

                            b: tile.b

                        };

                    }

                    else if (
                        tile.a ===
                        leftValue
                    ) {

                        placedTile = {

                            id: tile.id,

                            a: tile.b,

                            b: tile.a

                        };

                    }

                    else {

                        socket.emit(
                            "errorMessage",
                            `Tile ${tile.a}-${tile.b} does not fit on the left.`
                        );

                        return;
                    }

                    player.hand.splice(
                        tileIndex,
                        1
                    );

                    room.board.unshift(
                        placedTile
                    );
                }


                // =================
                // RIGHT
                // =================

                else if (side === "right") {

                    let placedTile;

                    if (
                        tile.a ===
                        rightValue
                    ) {

                        placedTile = {

                            id: tile.id,

                            a: tile.a,

                            b: tile.b

                        };

                    }

                    else if (
                        tile.b ===
                        rightValue
                    ) {

                        placedTile = {

                            id: tile.id,

                            a: tile.b,

                            b: tile.a

                        };

                    }

                    else {

                        socket.emit(
                            "errorMessage",
                            `Tile ${tile.a}-${tile.b} does not fit on the right.`
                        );

                        return;
                    }

                    player.hand.splice(
                        tileIndex,
                        1
                    );

                    room.board.push(
                        placedTile
                    );
                }


                else {

                    socket.emit(
                        "errorMessage",
                        "Choose left or right."
                    );

                    return;
                }
            }


            // =====================
            // WINNER
            // =====================

            if (
                player.hand.length === 0
            ) {

                room.winner =
                    player.id;

                room.turn = null;

                sendRoomState(room);

                io.to(room.code).emit(
                    "gameOver",
                    `${player.name} wins! 🎉`
                );

                return;
            }


            // =====================
            // NEXT PLAYER
            // =====================

            const otherPlayer =
                room.players.find(
                    p =>
                        p.id !==
                        socket.id
                );

            if (otherPlayer) {

                room.turn =
                    otherPlayer.id;
            }

            sendRoomState(room);
        }
    );


    // =========================
    // REMATCH
    // =========================

    socket.on(
        "rematch",
        () => {

            const room =
                findRoomForPlayer(
                    socket.id
                );

            if (!room) {
                return;
            }

            if (
                room.players.length !== 2
            ) {
                return;
            }

            let deck =
                shuffle(createDeck());

            room.players[0].hand =
                deck.splice(0, 7);

            room.players[1].hand =
                deck.splice(0, 7);

            room.board = [];

            room.winner = null;

            room.started = true;

            room.turn =
                room.players[0].id;

            sendRoomState(room);

            io.to(room.code).emit(
                "message",
                "New game started!"
            );
        }
    );


    // =========================
    // DISCONNECT
    // =========================

    socket.on(
        "disconnect",
        () => {

            console.log(
                "Player disconnected:",
                socket.id
            );

            const room =
                findRoomForPlayer(
                    socket.id
                );

            if (!room) {
                return;
            }

            room.players =
                room.players.filter(
                    player =>
                        player.id !==
                        socket.id
                );

            if (
                room.players.length === 0
            ) {

                rooms.delete(
                    room.code
                );

                console.log(
                    `Room ${room.code} deleted`
                );

            }

            else {

                room.started = false;

                room.board = [];

                room.winner = null;

                room.turn = null;

                io.to(room.code).emit(
                    "message",
                    "The other player disconnected."
                );

                sendRoomState(room);
            }
        }
    );

});


// =============================
// START SERVER
// =============================

server.listen(
    PORT,
    "0.0.0.0",
    () => {

        console.log("");
        console.log(
            "================================="
        );
        console.log(
            "       DOMINO ONLINE SERVER"
        );
        console.log(
            "================================="
        );
        console.log(
            `Server running on port: ${PORT}`
        );
        console.log("");

    }
);