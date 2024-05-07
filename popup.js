document.getElementById('fetchButton').addEventListener('click', function() {
    const username = document.getElementById('username').value;
    const months = document.getElementById('monthRange').value;
    const display = document.getElementById('ratingDisplay');
    const movesDisplay = document.getElementById('movesDisplay');
    if (username) {
        fetch(`https://api.chess.com/pub/player/${username}/stats`)
            .then(response => response.json())
            .then(data => {
                displayRatings(data);
                fetchMoves(username, months);
            });
    }
    else{
        display.innerHTML = `<p>Enter Username</p>`;
        movesDisplay.innerHTML = ``;
    }
});

document.getElementById('username').addEventListener('keyup', function(event) {
    if (event.key === 'Enter') {  // Check if the Enter key was pressed
        const username = document.getElementById('username').value;
        const months = document.getElementById('monthRange').value;
        const display = document.getElementById('ratingDisplay');
        const movesDisplay = document.getElementById('movesDisplay');
        if (username) {
            fetch(`https://api.chess.com/pub/player/${username}/stats`)
                .then(response => response.json())
                .then(data => {
                    displayRatings(data);
                    fetchMoves(username, months);
                });
        }
        else{
            display.innerHTML = `<p>Enter Username</p>`;
            movesDisplay.innerHTML = ``;
        }
    }
});

document.getElementById('monthRange').addEventListener('input', function() {
    document.getElementById('monthsLabel').textContent = this.value;
    const username = document.getElementById('username').value;
    const months = document.getElementById('monthRange').value;
    if (username) {
        fetchMoves(username, months);
    }
    else{
        display.innerHTML = `<p>Enter Username</p>`;
        movesDisplay.innerHTML = ``;
    }
});

function displayRatings(data) {
    const display = document.getElementById('ratingDisplay');
    display.innerHTML = `
    <p>Rapid Rating: ${data.chess_rapid.last.rating}</p>
    <p>Blitz Rating: ${data.chess_blitz.last.rating}</p>
    <p>Bullet Rating: ${data.chess_bullet.last.rating}</p>
    `
};

function displayMoves(movesWhite, movesBlack, totalGames) {
    const movesDisplay = document.getElementById('movesDisplay');
    const winRateWhite = calculateAverageWinRate(movesWhite).toFixed(2);
    const winRateBlack = calculateAverageWinRate(movesBlack).toFixed(2);
    const winRate = ((parseFloat(winRateBlack)+parseFloat(winRateWhite))/2).toFixed(2);
    let content = `<h3 class = "section-title"> Total Games: ${totalGames} (Win Rate: ${winRate}\%)</h3>`;
    content += `<h3 class="section-title">Opening Moves as White (Win Rate: ${winRateWhite}%)</h3>`;
    for (const [move, stats] of Object.entries(movesWhite)) {
        content += `<div class="move-card">
                      <div class="move-name">${move}</div>
                      <div class="stats-container">
                          <div class="stats wins">${stats.wins}</div>
                          <div class="stats draws">${stats.draws}</div>
                          <div class="stats losses">${stats.losses}</div>
                      </div>
                    </div>`;
    }
    content += `<h3 class="section-title">Opening Moves as Black (Win Rate: ${winRateBlack}%)</h3>`;
    for (const [move, stats] of Object.entries(movesBlack)) {
        content += `<div class="move-card">
                      <div class="move-name">${move}</div>
                      <div class="stats-container">
                          <div class="stats wins">${stats.wins}</div>
                          <div class="stats draws">${stats.draws}</div>
                          <div class="stats losses">${stats.losses}</div>
                      </div>
                    </div>`;
    }
    movesDisplay.innerHTML = content;
}

function updateResults(moveRecord, result) {
    if (result == "win") {
        moveRecord.wins++;
    } else if (result == "loss") {
        moveRecord.losses++;
    } else{
        moveRecord.draws++;
    }
}

function extractChessInfo(dataArray, username) {
    const whiteMoves = {};
    const blackMoves = {};
    var games = 0
    dataArray.forEach(data => {
        games+=1;
        const whitePlayerMatch = data.match(/\[White "([^"]+)"\]/);
        const blackPlayerMatch = data.match(/\[Black "([^"]+)"\]/);

        const resultMatch = data.match(/\[Result "([^"]+)"\]/);
        const result = resultMatch ? resultMatch[1] : null;

        const whiteResult = result === "1-0" ? "win" : (result === "0-1" ? "loss" : "draw");
        const blackResult = result === "0-1" ? "win" : (result === "1-0" ? "loss" : "draw");

        const whitePlayer = whitePlayerMatch ? whitePlayerMatch[1] : "Unknown player";
        const blackPlayer = blackPlayerMatch ? blackPlayerMatch[1] : "Unknown player";

        const moves = data.split('\n').find(line => line.startsWith('1. '));
        if (moves) {
            const movePattern = /1\. (\S+)(?: \{[^}]+\})? 1\.\.\. (\S+)(?: \{[^}]+\})?/;
            const movesMatch = moves.match(movePattern);
            if (movesMatch) {
                const firstMoveWhite = movesMatch[1];
                const firstMoveBlack = movesMatch[2];

                if (username === whitePlayer) {
                    if (!whiteMoves[firstMoveWhite]) {
                        whiteMoves[firstMoveWhite] = {wins:0, losses:0, draws:0};
                    }
                    updateResults(whiteMoves[firstMoveWhite], whiteResult);
                }
                else if (username === blackPlayer) {
                    if (!blackMoves[firstMoveBlack]) {
                        blackMoves[firstMoveBlack] ={wins:0, losses:0, draws:0};
                    }
                    updateResults(blackMoves[firstMoveBlack], blackResult);
                }
            }
        }
    });
    return [whiteMoves, blackMoves, games];
}

function calculateAverageWinRate(moves) {
    let totalWinRate = 0;
    let moveCount = 0;

    for (let move in moves) {
        let stats = moves[move];
        let wins = stats.wins;
        let losses = stats.losses;
        let draws = stats.draws;
        let totalGames = wins + losses + draws;
        let winRate = totalGames > 0 ? (wins / totalGames) * 100 : 0; 
        totalWinRate += winRate; 
        moveCount++;
    }
    return moveCount > 0 ? totalWinRate / moveCount : 0;
}


function fetchMoves(username, months) {
    const currentDate = new Date();
    const promises = [];
    const whiteMovesAll = {}; 
    const blackMovesAll = {};
    const winRateWhite = 0;
    const winRateBlack = 0;
    var totalGames = 0;
    const movesDisplay = document.getElementById('movesDisplay');
    movesDisplay.innerHTML = `
    <button class="loader__btn">
        <div class="loader"></div>
        Loading ...
    </button>
  `;

    for (let i = 0; i < months; i++) {
        const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const year = targetDate.getFullYear();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        
        const url = `https://api.chess.com/pub/player/${username}/games/${year}/${month}`;
        promises.push(fetch(url)
            .then(response => response.json())
            .then(data => {
                const pgns = data.games.map(game => game.pgn);
                const [whiteMoves, blackMoves, games]  = extractChessInfo(pgns, username);
                for (let move in whiteMoves) {
                    if (!whiteMovesAll[move]) {
                        whiteMovesAll[move] = { wins: 0, losses: 0, draws: 0 };
                    }
                    whiteMovesAll[move].wins += whiteMoves[move].wins;
                    whiteMovesAll[move].losses += whiteMoves[move].losses;
                    whiteMovesAll[move].draws += whiteMoves[move].draws;
                }
                for (let move in blackMoves) {
                    if (!blackMovesAll[move]) {
                        blackMovesAll[move] = { wins: 0, losses: 0, draws: 0 };
                    }
                    blackMovesAll[move].wins += blackMoves[move].wins;
                    blackMovesAll[move].losses += blackMoves[move].losses;
                    blackMovesAll[move].draws += blackMoves[move].draws;
                }                
                totalGames += games;
            }));
    }

    Promise.all(promises).then(() => {
        displayMoves(whiteMovesAll, blackMovesAll, totalGames);
    });
};
