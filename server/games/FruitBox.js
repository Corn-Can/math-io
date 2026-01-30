import BaseGame from './BaseGame.js';

export default class FruitBox extends BaseGame {
    constructor(room, io) {
        super(room, io);
        this.occupiedCells = {}; // cellId -> playerId
    }

    handleEvent(eventName, payload, socket) {
        switch (eventName) {
            case 'update-score':
                this.handleUpdateScore(payload, socket);
                break;
            case 'game-attack':
                this.handleAttack(payload, socket);
                break;
            case 'game-board-sync':
                this.handleBoardSync(payload, socket);
                break;
            case 'game-occupy':
                this.handleOccupy(payload, socket);
                break;
        }
    }

    handleUpdateScore({ score }, socket) {
        // In Occupy mode, we trust the client's score update which should come from handleOccupy?
        // Actually for Occupy mode, the server should calculate the score based on Area.
        // But to keep it simple and consistent with other modes where client sends score...
        // Let's allow client to send score, OR server updates it.
        // Better: Server updates scores in Occupy mode.

        if (this.room.mode !== 'occupy') {
            const player = this.room.players.find(p => p.id === socket.id);
            if (player) {
                player.score = score;
                this.io.to(this.room.id).emit('update-players', this.room.players);
            }
        }
    }

    handleAttack({ type }, socket) {
        // Attack Mode Logic
        // Payload: { type: 'petrify' } etc.
        // Broadcast to everyone ELSE in the room
        socket.to(this.room.id).emit('game-attack-received', { type, from: socket.id });
    }

    handleBoardSync({ clearedIds }, socket) {
        // Territory Mode Logic
        // Broadcast cleared cells to everyone ELSE
        socket.to(this.room.id).emit('game-board-update', { clearedIds, from: socket.id });
    }

    handleOccupy(payload, socket) {
        const { clearedIds, refillData } = payload;
        const playerId = socket.id;

        // Update server state
        clearedIds.forEach(id => {
            this.occupiedCells[id] = playerId;
        });

        // Recalculate scores for ALL players based on calling occupiedCells
        const scores = {};
        Object.values(this.occupiedCells).forEach(pid => {
            scores[pid] = (scores[pid] || 0) + 1;
        });

        // Update player objects
        this.room.players.forEach(p => {
            p.score = scores[p.id] || 0;
        });

        // Broadcast updates
        // 1. Board update (who occupied what)
        this.io.to(this.room.id).emit('game-occupy-update', {
            clearedIds,
            occupierId: playerId,
            refillData // Broadcast new values
        });

        // 2. Score update
        this.io.to(this.room.id).emit('update-players', this.room.players);
    }
}
