import FruitBox from './games/FruitBox.js';
import Sudoku from './games/Sudoku.js';

const GAMES = {
    'fruitbox': FruitBox,
    'sudoku': Sudoku
};

export default class Room {
    constructor(id, name, isPrivate, maxPlayers, gameId, mode, io) {
        this.id = id;
        this.name = name;
        this.isPrivate = isPrivate;
        this.maxPlayers = maxPlayers;
        this.gameId = gameId;
        this.mode = mode; // 'classic', 'territory', 'attack'
        this.io = io;

        this.players = [];
        this.status = 'waiting'; // waiting, countdown, playing
        this.duration = 300;
        this.options = {}; // Generic options
        this.hostId = null;
        this.startTime = null; // Track when game started

        // Instantiate game logic
        const GameClass = GAMES[gameId] || GAMES['fruitbox'];
        this.gameInstance = new GameClass(this, io);
    }

    addPlayer(player) {
        if (this.players.length >= this.maxPlayers) return false;
        this.players.push(player);

        if (!this.hostId) {
            this.hostId = player.id;
        }

        this.gameInstance.onPlayerJoin(player);
        return true;
    }

    removePlayer(playerId) {
        const index = this.players.findIndex(p => p.id === playerId);
        if (index !== -1) {
            const player = this.players[index];
            this.players.splice(index, 1);

            this.gameInstance.onPlayerLeave(player);

            // Host Migration
            if (this.hostId === playerId) {
                if (this.players.length > 0) {
                    this.hostId = this.players[0].id;
                    this.io.to(this.id).emit('host-updated', this.hostId);
                } else {
                    this.hostId = null; // Room will likely be deleted
                }
            }
            return true;
        }
        return false;
    }

    isEmpty() {
        return this.players.length === 0;
    }

    startGame() {
        this.status = 'playing';
        this.players.forEach(p => {
            p.score = 0;
            p.isReady = false;
            p.isEliminated = false;
        });
        this.startTime = Date.now();
        const seed = Date.now();
        this.gameInstance.onStart(seed);

        // Emit game-started with seed AND startTime AND settings snapshot
        this.io.to(this.id).emit('game-started', {
            seed,
            startTime: this.startTime,
            // Sync Critical Game Settings
            duration: this.duration,
            mode: this.mode,
            options: this.options
        });
        this.io.to(this.id).emit('update-players', this.players);
    }
}
