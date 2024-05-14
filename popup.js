document.addEventListener('DOMContentLoaded', () => {
    const usernameInput = document.getElementById('username');
    // const username = usernameInput.value;
    let prevUsername = null; 
    const monthRangeInput = document.getElementById('monthRange');
    const display = document.getElementById('ratingDisplay');
    const movesDisplay = document.getElementById('movesDisplay');
    const monthsLabel = document.getElementById('monthsLabel');
    const fetchButton = document.getElementById('fetchButton');

    usernameInput.addEventListener('keyup', event => {
        if (event.key === 'Enter') {
            if (usernameInput.value !== prevUsername) {
                fetchData(usernameInput.value);
            }
        }
    });

    monthRangeInput.addEventListener('input', () => {
        monthsLabel.textContent = monthRangeInput.value;
        if (usernameInput.value) {
            if (usernameInput.value != prevUsername){
                fetchData(usernameInput.value);
            }
            fetchMoves(usernameInput.value, monthRangeInput.value);  
        }
        else{
            display.innerHTML = `<p>Enter a Chess.com username to continue</p>`;
            movesDisplay.innerHTML = ``;
        }
    });

    fetchButton.addEventListener('click', fetchData);

    async function fetchData(username) {
        const months = monthRangeInput.value;
        prevUsername = username;
        if (!username) {
            display.innerHTML = `<p>Enter a Chess.com username to continue</p>`;
            movesDisplay.innerHTML = ``;
            return;
        }
        display.innerHTML = ``;
        movesDisplay.innerHTML = `<div class="loader">
            <span></span>
        </div>`;
        const statsUrl = `https://api.chess.com/pub/player/${username}/stats`;
        try {
            const response = await fetch(statsUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const data = await response.json();
            displayRatings(data);
            fetchMoves(username, months);
        } catch (error) {
            console.error('Failed to fetch data:', error);
            display.innerHTML = `<p>Error fetching data: ${error.message}</p>`;
            movesDisplay.innerHTML = ``;
        }
    }

    async function fetchMoves(username, months) {
        const currentDate = new Date();
        const promises = [];
        const whiteMovesAll = {};
        const blackMovesAll = {};
        let accuracies = [];
        let colors;
        var totalGames = 0;
        movesDisplay.innerHTML = `
        <div class="loader">
            <span></span>
        </div>`;

        for (let i = 0; i < months; i++) {
            const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
            const year = targetDate.getFullYear();
            const month = String(targetDate.getMonth() + 1).padStart(2, '0');
            const url = `https://api.chess.com/pub/player/${username}/games/${year}/${month}`;

            promises.push(
                fetch(url)
                    .then(response => {
                        if (!response.ok) {
                            throw new Error(`HTTP error! Status: ${response.status}`);
                        }
                        return response.text();  // First convert to text to check if empty
                    })
                    .then(text => {
                        if (!text) {
                            throw new Error("Empty response received from API");
                        }
                        return JSON.parse(text);  // Safely parse JSON after confirming it's not empty
                    })
                    .then(data => {
                        if (!data.games) {
                            console.log(`No games data for ${year}/${month}`);
                            return;
                        }
                        const pgns = data.games.map(game => game.pgn);
                        // accuracies = data.games.map(game => game.accuracies);

                        colors = data.games.map(game => {
                            if (game.white.username == username) {
                                return "white"
                            }
                            else {
                                return "black"
                            }
                        });
                        accuracies = data.games.map(game => {
                            for (color in colors) {
                                if (color == "white") {
                                    return {
                                        accuracy: game.accuracies?.white ?? -1, // Default to 0 if undefined
                                    };
                                }
                                else {
                                    return {
                                        accuracy: game.accuracies?.black ?? -1  // Default to 0 if undefined
                                    };
                                }
                            }

                        });
                        const [whiteMoves, blackMoves, games] = extractChessInfo(pgns, username);
                        mergeMoves(whiteMovesAll, whiteMoves);
                        mergeMoves(blackMovesAll, blackMoves);
                        totalGames += games;
                    })
                    .catch(error => {
                        console.error(`Error fetching or processing data for ${year}/${month}:`, error);
                        return Promise.reject(error);  // Propagate error to be caught by Promise.all
                    })
            );
        }

        Promise.allSettled(promises)
            .then(results => {
                results.forEach((result, index) => {
                    if (result.status === 'rejected') {
                        console.error(`Request failed for month index ${index}:`, result.reason);
                    }
                });
                displayMoves(whiteMovesAll, blackMovesAll, totalGames, accuracies);
            });
    }

    function mergeMoves(allMoves, newMoves) {
        for (let move in newMoves) {
            if (!allMoves[move]) {
                allMoves[move] = { wins: 0, losses: 0, draws: 0 };
            }
            allMoves[move].wins += newMoves[move].wins;
            allMoves[move].losses += newMoves[move].losses;
            allMoves[move].draws += newMoves[move].draws;
        }
    }



    function updateResults(moveRecord, result) {
        if (result == "win") {
            moveRecord.wins++;
        } else if (result == "loss") {
            moveRecord.losses++;
        } else {
            moveRecord.draws++;
        }
    }

    function viewAccuracy(games) {
        let validAccuracies = games.map(game => {
            // Use optional chaining and nullish coalescing to handle missing data
            let accuracy = game.accuracy ?? -1; // Default to -1 if undefined
            if (accuracy !== -1) {
                return accuracy;
            }
            // Returning undefined explicitly, though this is the default return value if nothing is returned
        }).filter(accuracy => accuracy !== undefined); // Filter out undefined values

        // Calculate average if there are any valid accuracies
        if (validAccuracies.length > 0) {
            let total = validAccuracies.reduce((sum, current) => sum + current, 0);
            let average = total / validAccuracies.length;
            return average.toFixed(2);
        } else {
            return 0; // Return 0 if no valid accuracies to avoid division by zero
        }
    }



    function extractChessInfo(dataArray, username) {
        const whiteMoves = {};
        const blackMoves = {};
        var games = 0
        dataArray.forEach(data => {
            games += 1;
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
                            whiteMoves[firstMoveWhite] = { wins: 0, losses: 0, draws: 0 };
                        }
                        updateResults(whiteMoves[firstMoveWhite], whiteResult);
                    }
                    else if (username === blackPlayer) {
                        if (!blackMoves[firstMoveBlack]) {
                            blackMoves[firstMoveBlack] = { wins: 0, losses: 0, draws: 0 };
                        }
                        updateResults(blackMoves[firstMoveBlack], blackResult);
                    }
                }
            }
        });
        return [whiteMoves, blackMoves, games];
    }


    function displayRatings(data) {
        const display = document.getElementById('ratingDisplay');
        display.innerHTML = `
        <p>Rapid Rating: ${data.chess_rapid.last.rating}</p>
        <p>Blitz Rating: ${data.chess_blitz.last.rating}</p>
        <p>Bullet Rating: ${data.chess_bullet.last.rating}</p>
        `
    };

    function displayMoves(movesWhite, movesBlack, totalGames, accuracies) {
        const movesDisplay = document.getElementById('movesDisplay');
        const winRateWhite = calculateAverageWinRate(movesWhite).toFixed(2);
        const winRateBlack = calculateAverageWinRate(movesBlack).toFixed(2);
        const winRate = ((parseFloat(winRateBlack) + parseFloat(winRateWhite)) / 2).toFixed(2);
        let content = `<p class = "section-title"> Total Games: ${totalGames} (Win Rate: ${winRate}\%))</p>`;
        content += `<p class = "section-title"> Average Accuracy: ${viewAccuracy(accuracies)}\%</p>`;
        content += `<p class="section-title">Opening Moves as White (Win Rate: ${winRateWhite}%)</p>`;
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
        content += `<p class="section-title">Opening Moves as Black (Win Rate: ${winRateBlack}%)</p>`;
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

});
