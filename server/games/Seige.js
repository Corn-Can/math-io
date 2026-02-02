import BaseGame from './BaseGame.js';

export default class Seige extends BaseGame {
    constructor(room, io) {
        super(room, io);
        this.gridSize = 20; // Default, will override from options
        this.grid = [];
        this.turnIndex = 0;
        this.currentRoll = null; // { dice: [1,2,3], sum: 6 }
        this.castles = {}; // { playerId: [{x, y}] }
        this.roundCount = 1;
        this.maxRounds = 20;
    }

    onStart(seed) {
        // 1. Setup Config
        this.gridSize = Number(this.room.options.size) || 20;
        this.maxRounds = Number(this.room.options.roundLimit) || 20;

        // 2. Init Grid (0 = empty, string = playerId)
        this.grid = Array(this.gridSize).fill(null).map(() => Array(this.gridSize).fill(null));

        // 3. Shuffle Players & Set Order
        this.room.players.sort(() => Math.random() - 0.5);

        // 4. Assign Initial Castles (Corners)
        const corners = [
            { x: 0, y: 0 },
            { x: this.gridSize - 1, y: this.gridSize - 1 },
            { x: 0, y: this.gridSize - 1 },
            { x: this.gridSize - 1, y: 0 }
        ];

        this.room.players.forEach((p, i) => {
            if (i < corners.length) {
                const c = corners[i];
                this.grid[c.y][c.x] = { owner: p.id, type: 'castle', hp: 2 }; // Castle HP = 2
                this.castles[p.id] = [c];
            }
        });

        this.turnIndex = 0;

        // Broadcast Start
        this.broadcast('seige-gamestate', {
            grid: this.grid,
            players: this.room.players.map(p => ({ id: p.id, color: p.color, name: p.name })),
            turnPlayerId: this.room.players[0].id,
            round: this.roundCount
        });
    }

    onPlayerJoin(player) {
        this.io.to(player.id).emit('seige-gamestate', {
            grid: this.grid,
            players: this.room.players.map(p => ({ id: p.id, color: p.color, name: p.name })),
            turnPlayerId: this.room.players[this.turnIndex]?.id,
            round: this.roundCount
        });

        if (this.currentRoll) {
            this.io.to(player.id).emit('seige-rolled', {
                playerId: this.room.players[this.turnIndex]?.id,
                dice: this.currentRoll.dice,
                sum: this.currentRoll.sum
            });
        }
    }

    onPlayerLeave(player) {
        if (this.room.players.length === 0) return;

        // Win Condition: Last Man Standing
        if (this.room.players.length === 1) {
            const winner = this.room.players[0];
            // Assign massive score to winner? Or just trigger win.
            winner.score += 100; // Bonus
            this.broadcast('game-over', {
                reason: 'last-man-standing',
                winnerId: winner.id
            });
            return;
        }

        // Logic to maintain turn flow
        // If turnIndex is out of bounds (because array shrank), wrap it.
        if (this.turnIndex >= this.room.players.length) {
            this.turnIndex = 0;
        }

        // Reset roll state so the next/current player can act
        this.currentRoll = null;

        // Broadcast turn update (effectively passing turn to whoever is now at turnIndex)
        this.broadcast('seige-turn-change', {
            turnPlayerId: this.room.players[this.turnIndex].id,
            round: this.roundCount
        });
    }

    handleEvent(eventName, payload, socket) {
        const player = this.room.players.find(p => p.id === socket.id);
        if (!player) return;

        // Verify Turn
        // Double check bounds to prevent crash
        if (this.turnIndex >= this.room.players.length) return;

        const isMyTurn = this.room.players[this.turnIndex].id === player.id;
        if (!isMyTurn) return;

        if (eventName === 'seige-roll') {
            if (this.currentRoll) return; // Already rolled

            const dice = [
                Math.floor(Math.random() * 6) + 1,
                Math.floor(Math.random() * 6) + 1,
                Math.floor(Math.random() * 6) + 1
            ];
            const sum = dice.reduce((a, b) => a + b, 0);
            this.currentRoll = { dice, sum };

            this.broadcast('seige-rolled', { playerId: player.id, dice, sum });
        }
        else if (eventName === 'seige-place') {
            // Payload: { x, y, width, height }
            if (!this.currentRoll) return; // Must roll first

            const { x, y, w, h } = payload;

            // 1. Validate Area
            if (w * h !== this.currentRoll.sum) {
                socket.emit('error', 'Invalid area size');
                return;
            }

            // 2. Validate Bounds
            if (x < 0 || y < 0 || x + w > this.gridSize || y + h > this.gridSize) {
                socket.emit('error', 'Out of bounds');
                return;
            }

            // 3. Validate Connectivity (Must touch own existing territory)
            // Simplified: Check if any cell in the new rect is adjacent to ANY cell owned by player
            // Optimally: Just start simple, iterate rect border?
            let connected = false;

            // Check own castle existence (must start from somewhere)
            const hasTerritory = this.grid.some(row => row.some(c => c && c.owner === player.id));
            if (!hasTerritory) {
                // If wiped out, maybe can't play? Or respawn? Rules say elimination.
                socket.emit('error', 'You are eliminated');
                this.nextTurn();
                return;
            }

            // Check adjacency (or overlap)
            // Rules say: "Must include own color grid". Usually means overlap/extension.
            // Let's implement: At least one cell in the new rect MUST be adjacent to or overlapping current territory.
            for (let i = 0; i < h; i++) {
                for (let j = 0; j < w; j++) {
                    const cx = x + j;
                    const cy = y + i;

                    // Check if this cell is adjacent to existing own cell
                    // Neighbors: up, down, left, right
                    const neighbors = [
                        { nx: cx, ny: cy - 1 },
                        { nx: cx, ny: cy + 1 },
                        { nx: cx - 1, ny: cy },
                        { nx: cx + 1, ny: cy },
                        { nx: cx, ny: cy } // Self (Overlap)
                    ];

                    for (const n of neighbors) {
                        if (n.nx >= 0 && n.nx < this.gridSize && n.ny >= 0 && n.ny < this.gridSize) {
                            const cell = this.grid[n.ny][n.nx];
                            if (cell && cell.owner === player.id) {
                                connected = true;
                                break;
                            }
                        }
                    }
                    if (connected) break;
                }
                if (connected) break;
            }

            if (!connected) {
                socket.emit('error', 'Must connect to your territory');
                return;
            }

            // 4. Update Grid logic (Conquest)
            let conqueredCastles = 0;

            for (let i = 0; i < h; i++) {
                for (let j = 0; j < w; j++) {
                    const cx = x + j;
                    const cy = y + i;
                    const target = this.grid[cy][cx];

                    if (target) {
                        if (target.owner !== player.id) {
                            if (target.type === 'castle') {
                                // Castle Hit Logic
                                target.hp -= 1;
                                if (target.hp <= 0) {
                                    // Destroyed/Captured
                                    this.grid[cy][cx] = { owner: player.id, type: 'normal' };
                                    conqueredCastles++;
                                }
                                // Else: Resists update
                            } else {
                                // Normal Conquest
                                this.grid[cy][cx] = { owner: player.id, type: 'normal' };
                            }
                        }
                    } else {
                        // Empty cell claim
                        this.grid[cy][cx] = { owner: player.id, type: 'normal' };
                    }
                }
            }

            // 5. Check "Surrounded" Logic (Make Castles)
            // Iterate all my cells, check if 4-neighbors are mine
            // This is O(N^2), might be heavy. Do locally for changed cells?
            // Global scan for now
            this.updateCastles(player.id);

            // 6. Broadcast Update
            this.broadcast('seige-map-update', { grid: this.grid });

            // 7. End Turn
            this.nextTurn();
        }
        else if (eventName === 'seige-skip') {
            this.nextTurn();
        }
    }

    updateCastles(playerId) {
        // Simple algo: A cell is a castle if all 4 neighbors are OWNED BY ME (or out of bounds?)
        // Rules: "Boundaries count as wall". No, usually "Surrounded by cells".
        // Let's assume out of bounds counts as "surrounded" (safe).

        for (let y = 0; y < this.gridSize; y++) {
            for (let x = 0; x < this.gridSize; x++) {
                const cell = this.grid[y][x];
                if (cell && cell.owner === playerId && cell.type !== 'castle') {
                    const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
                    let surrounded = true;
                    for (const [dx, dy] of dirs) {
                        const nx = x + dx;
                        const ny = y + dy;
                        // If boundary, it is "safe" (surrounded by wall)
                        if (nx >= 0 && nx < this.gridSize && ny >= 0 && ny < this.gridSize) {
                            const neighbor = this.grid[ny][nx];
                            if (!neighbor || neighbor.owner !== playerId) {
                                surrounded = false;
                                break;
                            }
                        }
                    }
                    if (surrounded) {
                        cell.type = 'castle';
                        cell.hp = 2;
                    }
                }
            }
        }
    }

    nextTurn() {
        this.currentRoll = null;
        this.turnIndex = (this.turnIndex + 1) % this.room.players.length;

        // Skip eliminated players
        // TODO: Logic to detect if player has NO cells left

        if (this.turnIndex === 0) {
            this.roundCount++;
            if (this.roundCount > this.maxRounds) {
                // Game Over
                this.broadcast('game-over', { reason: 'round-limit' });
                return;
            }
        }

        this.broadcast('seige-turn-change', {
            turnPlayerId: this.room.players[this.turnIndex].id,
            round: this.roundCount
        });
    }
}
