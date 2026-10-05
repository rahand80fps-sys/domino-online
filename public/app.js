const socket = io();

const lobby = document.getElementById("lobby");
const game = document.getElementById("game");

const playerNameInput = document.getElementById("playerName");
const joinCodeInput = document.getElementById("joinCode");

const createBtn = document.getElementById("createBtn");
const joinBtn = document.getElementById("joinBtn");

const roomCodeElement = document.getElementById("roomCode");
const lobbyMessage = document.getElementById("lobbyMessage");
const gameMessage = document.getElementById("gameMessage");

const handElement = document.getElementById("hand");
const boardElement = document.getElementById("board");

const leftButton = document.getElementById("leftButton");
const rightButton = document.getElementById("rightButton");

const turnMessage = document.getElementById("turnMessage");

const player1Count = document.getElementById("player1Count");
const player2Count = document.getElementById("player2Count");

const player1Card = document.getElementById("player1");
const player2Card = document.getElementById("player2");

const rematchBtn = document.getElementById("rematchBtn");
const leaveBtn = document.getElementById("leaveBtn");

const gameOver = document.getElementById("gameOver");
const winnerText = document.getElementById("winnerText");
const modalRematch = document.getElementById("modalRematch");

let myId = "";
let myHand = [];
let selectedTileId = null;
let currentTurn = null;

console.log("DOM loaded");
console.log("Socket:", socket);

socket.on("connect", () => {
    myId = socket.id;
    console.log("CONNECTED TO SERVER:", myId);
});

socket.on("connect_error", (error) => {
    console.error("SOCKET ERROR:", error);

    if (lobbyMessage) {
        lobbyMessage.textContent =
            "Cannot connect to server. Make sure node server.js is running.";
    }
});

createBtn.addEventListener("click", () => {
    console.log("CREATE ROOM BUTTON CLICKED");

    const name =
        playerNameInput.value.trim() || "Player 1";

    lobbyMessage.textContent =
        "Creating room...";

    socket.emit(
        "createRoom",
        name,
        (response) => {

            console.log(
                "CREATE ROOM RESPONSE:",
                response
            );

            if (!response || !response.success) {

                lobbyMessage.textContent =
                    response?.message ||
                    "Could not create room.";

                return;
            }

            roomCodeElement.textContent =
                response.roomCode;

            lobbyMessage.textContent =
                "Room created. Waiting for player 2...";

            showGame();
        }
    );
});

joinBtn.addEventListener("click", () => {

    console.log("JOIN BUTTON CLICKED");

    const name =
        playerNameInput.value.trim() || "Player 2";

    const roomCode =
        joinCodeInput.value.trim().toUpperCase();

    if (!roomCode) {

        lobbyMessage.textContent =
            "Please enter a room code.";

        return;
    }

    lobbyMessage.textContent =
        "Joining room...";

    socket.emit(
        "joinRoom",
        {
            roomCode: roomCode,
            playerName: name
        },
        (response) => {

            console.log(
                "JOIN ROOM RESPONSE:",
                response
            );

            if (!response || !response.success) {

                lobbyMessage.textContent =
                    response?.message ||
                    "Could not join room.";

                return;
            }

            roomCodeElement.textContent =
                response.roomCode;

            showGame();
        }
    );
});

function showGame() {

    if (!lobby || !game) {

        console.error(
            "ERROR: #lobby or #game is missing from index.html"
        );

        return;
    }

    lobby.classList.add("hidden");
    game.classList.remove("hidden");

    console.log("GAME SCREEN OPENED");
}

socket.on("yourHand", (hand) => {

    console.log("YOUR HAND:", hand);

    myHand =
        Array.isArray(hand)
            ? hand
            : [];

    renderHand();
});

socket.on("roomState", (state) => {

    console.log("ROOM STATE:", state);

    currentTurn =
        state.turn || null;

    if (state.roomCode) {

        roomCodeElement.textContent =
            state.roomCode;
    }

    renderBoard(
        Array.isArray(state.board)
            ? state.board
            : []
    );

    updatePlayers(state);
    updateTurn(state);
    updateButtons();
});

function getTileValue(value) {

    const number = Number(value);

    if (
        Number.isInteger(number) &&
        number >= 0 &&
        number <= 6
    ) {
        return number;
    }

    return 0;
}

function createDomino(tile, clickable) {

    const domino =
        document.createElement("div");

    domino.className = "domino";

    if (clickable) {
        domino.classList.add("clickable");
    }

    if (
        clickable &&
        selectedTileId === tile.id
    ) {
        domino.classList.add("selected");
    }

    const top =
        document.createElement("div");

    top.className =
        "domino-half pip-area";

    createPips(
        top,
        getTileValue(tile.a)
    );

    const divider =
        document.createElement("div");

    divider.className =
        "domino-divider";

    const bottom =
        document.createElement("div");

    bottom.className =
        "domino-half pip-area";

    createPips(
        bottom,
        getTileValue(tile.b)
    );

    domino.appendChild(top);
    domino.appendChild(divider);
    domino.appendChild(bottom);

    if (clickable) {

        domino.addEventListener(
            "click",
            () => {

                selectedTileId =
                    tile.id;

                gameMessage.textContent =
                    "Selected " +
                    getTileValue(tile.a) +
                    " - " +
                    getTileValue(tile.b) +
                    ". Choose LEFT or RIGHT.";

                renderHand();
                updateButtons();
            }
        );
    }

    return domino;
}

function createPips(container, number) {

    container.innerHTML = "";

    const positions = {

        0: [],

        1: [5],

        2: [1, 9],

        3: [1, 5, 9],

        4: [1, 3, 7, 9],

        5: [1, 3, 5, 7, 9],

        6: [1, 4, 7, 3, 6, 9]
    };

    const active =
        positions[number] || [];

    for (let i = 1; i <= 9; i++) {

        const pip =
            document.createElement("span");

        pip.className = "pip";

        if (active.includes(i)) {
            pip.classList.add("visible");
        }

        container.appendChild(pip);
    }
}

function renderHand() {

    if (!handElement) {
        return;
    }

    handElement.innerHTML = "";

    if (myHand.length === 0) {

        handElement.innerHTML =
            "<p>No tiles</p>";

        updateButtons();

        return;
    }

    myHand.forEach((tile) => {

        const domino =
            createDomino(tile, true);

        handElement.appendChild(domino);
    });

    updateButtons();
}

function renderBoard(board) {

    if (!boardElement) {
        return;
    }

    boardElement.innerHTML = "";

    if (board.length === 0) {

        const empty =
            document.createElement("div");

        empty.className =
            "empty-board";

        empty.textContent =
            "Select a tile and choose LEFT or RIGHT";

        boardElement.appendChild(empty);

        return;
    }

    board.forEach((tile) => {

        const domino =
            createDomino(tile, false);

        boardElement.appendChild(domino);
    });
}

function updatePlayers(state) {

    const players =
        Array.isArray(state.players)
            ? state.players
            : [];

    if (!player1Card || !player2Card) {
        return;
    }

    player1Card.classList.remove("active");
    player2Card.classList.remove("active");

    if (players[0]) {

        const nameElement =
            player1Card.querySelector("span");

        if (nameElement) {
            nameElement.textContent =
                players[0].name;
        }

        if (player1Count) {
            player1Count.textContent =
                players[0].handCount +
                " tiles";
        }

        if (
            state.turn ===
            players[0].id
        ) {
            player1Card.classList.add("active");
        }

    } else {

        const nameElement =
            player1Card.querySelector("span");

        if (nameElement) {
            nameElement.textContent =
                "Player 1";
        }

        if (player1Count) {
            player1Count.textContent =
                "Waiting...";
        }
    }

    if (players[1]) {

        const nameElement =
            player2Card.querySelector("span");

        if (nameElement) {
            nameElement.textContent =
                players[1].name;
        }

        if (player2Count) {
            player2Count.textContent =
                players[1].handCount +
                " tiles";
        }

        if (
            state.turn ===
            players[1].id
        ) {
            player2Card.classList.add("active");
        }

    } else {

        const nameElement =
            player2Card.querySelector("span");

        if (nameElement) {
            nameElement.textContent =
                "Player 2";
        }

        if (player2Count) {
            player2Count.textContent =
                "Waiting...";
        }
    }
}

function updateTurn(state) {

    if (!turnMessage) {
        return;
    }

    const players =
        Array.isArray(state.players)
            ? state.players
            : [];

    if (players.length < 2) {

        turnMessage.textContent =
            "Waiting for another player...";

        return;
    }

    if (!state.started) {

        turnMessage.textContent =
            "Waiting for game...";

        return;
    }

    if (!state.turn) {

        turnMessage.textContent =
            "Game finished";

        return;
    }

    if (state.turn === myId) {

        turnMessage.textContent =
            "YOUR TURN";

        return;
    }

    const opponent =
        players.find(
            player =>
                player.id ===
                state.turn
        );

    turnMessage.textContent =
        (opponent?.name || "Opponent") +
        "'s turn";
}

function updateButtons() {

    if (!leftButton || !rightButton) {
        return;
    }

    const myTurn =
        currentTurn === myId;

    const hasSelection =
        selectedTileId !== null;

    leftButton.disabled =
        !myTurn || !hasSelection;

    rightButton.disabled =
        !myTurn || !hasSelection;
}

function playSelectedTile(side) {

    if (!selectedTileId) {

        gameMessage.textContent =
            "First click one of your domino tiles.";

        return;
    }

    if (currentTurn !== myId) {

        gameMessage.textContent =
            "Wait for your turn.";

        return;
    }

    console.log(
        "PLAY TILE:",
        selectedTileId,
        side
    );

    socket.emit(
        "playTile",
        {
            tileId: selectedTileId,
            side: side
        }
    );

    selectedTileId = null;

    updateButtons();
}

leftButton.addEventListener(
    "click",
    () => {
        playSelectedTile("left");
    }
);

rightButton.addEventListener(
    "click",
    () => {
        playSelectedTile("right");
    }
);

socket.on("message", (message) => {

    console.log("SERVER MESSAGE:", message);

    gameMessage.textContent =
        message;
});

socket.on("errorMessage", (message) => {

    console.error(
        "SERVER ERROR:",
        message
    );

    gameMessage.textContent =
        "⚠️ " + message;
});

socket.on("gameOver", (message) => {

    winnerText.textContent =
        message;

    gameOver.classList.remove(
        "hidden"
    );
});

if (rematchBtn) {

    rematchBtn.addEventListener(
        "click",
        () => {

            selectedTileId = null;

            socket.emit("rematch");
        }
    );
}

if (modalRematch) {

    modalRematch.addEventListener(
        "click",
        () => {

            selectedTileId = null;

            gameOver.classList.add(
                "hidden"
            );

            socket.emit("rematch");
        }
    );
}

if (leaveBtn) {

    leaveBtn.addEventListener(
        "click",
        () => {

            window.location.reload();
        }
    );
}