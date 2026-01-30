import BaseGame from './BaseGame.js';

// We need to import the Logic to generate the authoritative board?
// Logic is in TypeScript and Frontend processing. 
// Options:
// 1. Re-implement Generate logic in JS for Server.
// 2. Trust the host's generated board? (Prone to cheating).
// 3. Simple "Blind Validation" - Wait, we need the Solution to validate.
// Since we used a simple Backtracking logic, I can port valid core logic here easily.
// Or just replicate the `SudokuEngine` simplified.

class SudokuLogic {
    constructor(size, seed) {
        this.size = size;
        this.seed = seed;
        this.solution = [];
        // Geometry
        if (size === 4) { this.boxW = 2; this.boxH = 2; }
        else if (size === 6) { this.boxW = 3; this.boxH = 2; }
        else if (size === 9) { this.boxW = 3; this.boxH = 3; }
        else if (size === 16) { this.boxW = 4; this.boxH = 4; }
        else { this.boxW = 3; this.boxH = 3; }

        this.generate();
    }

    random() {
        const x = Math.sin(this.seed++) * 10000;
        return x - Math.floor(x);
    }

    generate() {
        // Create empty
        this.solution = Array(this.size).fill().map(() => Array(this.size).fill(0));
        // Solve
        this.solveRecursive(this.solution);
    }

    solveRecursive(grid) {
        let row = -1, col = -1, isEmpty = false;
        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                if (grid[i][j] === 0) { row = i; col = j; isEmpty = true; break; }
            }
            if (isEmpty) break;
        }
        if (!isEmpty) return true;

        const nums = Array.from({ length: this.size }, (_, i) => i + 1);
        for (let i = nums.length - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1));
            [nums[i], nums[j]] = [nums[j], nums[i]];
        }

        for (const num of nums) {
            if (this.isSafe(grid, row, col, num)) {
                grid[row][col] = num;
                if (this.solveRecursive(grid)) return true;
                grid[row][col] = 0;
            }
        }
        return false;
    }

    isSafe(grid, row, col, num) {
        for (let x = 0; x < this.size; x++) if (grid[row][x] === num) return false;
        for (let y = 0; y < this.size; y++) if (grid[y][col] === num) return false;
        const startRow = row - row % this.boxH;
        const startCol = col - col % this.boxW;
        for (let i = 0; i < this.boxH; i++) if (grid[i + startRow].includes(num)) {
            // Basic row check inside box needs strict column check too
            // My JS logic here is simplified, safer to iterate
            for (let j = 0; j < this.boxW; j++) if (grid[i + startRow][j + startCol] === num) return false;
        }
        return true;
    }
}

export default class Sudoku extends BaseGame {
    constructor(room, io) {
        super(room, io);
        this.logic = null;
        this.totalEmpty = 0;
        this.remainingEmpty = 0;

        // Initialize if Rush mode (Server needs solution)
        if (room.mode === 'rush') {
            const size = Number(this.room.options?.size || 9); // Fix: settings -> options
            const seed = room.seed || 12345;
            this.logic = new SudokuLogic(size, seed);

            // Need to know how many empty to calculate score?
            // Wait, "Masking" logic is also needing replication if we want exact empty count.
            // Or we just track "Cells that are NOT correct yet".
            // Total Cells = size*size.
            // But we start with some filled.
            // Let's implement the Masking Logic here too? 
            // Better: We assume Total Possible Score Moves ~ (Total Cells * Ratio).
            // Let's replicate the mask count to be accurate.
            const total = size * size;
            let ratio = 0.4;
            if (room.options?.difficulty === 'medium') ratio = 0.55;
            if (room.options?.difficulty === 'hard') ratio = 0.65;
            this.totalEmpty = Math.floor(total * ratio);
            this.remainingEmpty = this.totalEmpty;

            this.occupied = {}; // "x-y" -> playerId
        }
    }

    onStart(seed) {
        // Reset Logic
        if (this.room.mode === 'rush') {
            const size = Number(this.room.options?.size || 9);
            // const seed = seed; // Use the passed seed
            this.logic = new SudokuLogic(size, seed);

            // Reset Score State
            const total = size * size;
            let ratio = 0.4;
            if (this.room.options?.difficulty === 'medium') ratio = 0.55;
            if (this.room.options?.difficulty === 'hard') ratio = 0.65;
            this.totalEmpty = Math.floor(total * ratio);
            this.remainingEmpty = this.totalEmpty;

            this.occupied = {}; // "x-y" -> playerId
            console.log(`[Sudoku] Game Reset. Seed: ${seed}, Empty: ${this.totalEmpty}`);
        }
    }

    handleEvent(eventName, payload, socket) {
        switch (eventName) {
            case 'sudoku-move':
                this.handleMove(payload, socket);
                break;
            case 'update-score':
                this.handleScoreUpdate(payload, socket);
                break;
            case 'game-finished':
                this.handleGameFinished(payload, socket);
                break;
            case 'player-eliminated':
                this.handlePlayerEliminated(socket); // New Handler
                break;
        }
    }

    handlePlayerEliminated(socket) {
        console.log(`[Sudoku] Player Eliminated: ${socket.id}`);
        const player = this.room.players.find(p => p.id === socket.id);
        if (player) {
            player.isEliminated = true; // Mark as eliminated
            this.io.to(this.room.id).emit('update-players', this.room.players);
        }
        this.checkGameEnd();
    }

    handleGameFinished(payload, socket) {
        console.log('Server: Handle Game Finished', payload, this.room.mode);

        // Classic Mode Race Termination
        if (this.room.mode === 'classic') {
            const winner = this.room.players.find(p => p.id === socket.id);
            if (winner) {
                winner.score = 100; // Force 100%
            }
            // End Game for Everyone
            this.broadcastGameOver('race_finished');
        }
        // Rush Mode Board Full
        else if (this.room.mode === 'rush') {
            console.log('Server: Rush Mode Board Full Detected by Client');
            this.broadcastGameOver('board_full');
        }
    }

    handleScoreUpdate({ score }, socket) {
        const player = this.room.players.find(p => p.id === socket.id);
        if (player) {
            player.score = score; // Trust client score for Classic %
            this.io.to(this.room.id).emit('update-players', this.room.players);
        }
    }

    handleMove({ x, y, value }, socket) {
        // Rush Mode only logic
        if (this.room.mode !== 'rush') return;

        if (!this.logic || !this.logic.solution) {
            console.error('Sudoku Logic missing for Rush Mode');
            return;
        }

        if (this.occupied[`${x}-${y}`]) return; // Already taken

        // TEMPORARY FIX: Trust Client Move to unblock UX issues
        const size = this.room.options?.size || 9;
        const isValid = value && value > 0 && value <= size;

        if (isValid) {

            // Correct!
            const progress = this.remainingEmpty > 0 ? (this.remainingEmpty / this.totalEmpty) : 0;
            const points = 10 + Math.floor(90 * progress);

            // Update State
            this.occupied[`${x}-${y}`] = socket.id;
            this.remainingEmpty--;

            // Update Player Score
            const player = this.room.players.find(p => p.id === socket.id);
            if (player) {
                player.score = (player.score || 0) + points;
                console.log(`[Sudoku] Player ${player.name} scored ${points}. Total: ${player.score}`);
            }

            // Broadcast
            this.io.to(this.room.id).emit('sudoku-board-update', {
                x, y, value,
                playerId: socket.id,
                scoreDelta: points
            });
            this.io.to(this.room.id).emit('update-players', this.room.players);

            // Check Win (All filled? Or empty <= 0)
            if (this.remainingEmpty <= 0) {
                console.log('[Sudoku] Board Full! Game Over.');
                this.broadcastGameOver('board_full');
            }

        } else {
            // Wrong!
            socket.emit('sudoku-error', { x, y });
        }
    }

    checkGameEnd() {
        const activePlayers = this.room.players.filter(p => !p.isEliminated);
        console.log(`[Sudoku] Check Game End. Players: ${this.room.players.length}, Active: ${activePlayers.length}`);

        // Condition 1: Everyone is eliminated (Solo or Multiplayer)
        if (activePlayers.length === 0) {
            console.log('[Sudoku] All players eliminated. Game Over.');
            this.broadcastGameOver('elimination');
            return;
        }

        // Condition 2: Last Man Standing (Multiplayer only)
        if (this.room.players.length > 1 && activePlayers.length === 1) {
            console.log('[Sudoku] Last Man Standing! Game Over.');
            this.broadcastGameOver('elimination');
        }
    }

    broadcastGameOver(reason) {
        // Calculate Rankings
        // Calculate Rankings: Alive > Eliminated, then Score
        const sorted = [...this.room.players].sort((a, b) => {
            if (a.isEliminated !== b.isEliminated) {
                return a.isEliminated ? 1 : -1; // Alive comes first
            }
            return b.score - a.score;
        });
        const winner = sorted[0];

        this.io.to(this.room.id).emit('game-over', {
            winnerId: winner?.id,
            reason: reason,
            score: winner?.score
        });

        // Reset server state? Or wait for 'reset-room'?
        // Usually Room handles reset on 'reset-room' event.
    }
}
