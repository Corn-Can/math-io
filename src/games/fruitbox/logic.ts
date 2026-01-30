export type CellStatus = 'normal' | 'cleared' | 'petrified' | 'opponent-cleared';

export interface Cell {
    id: string;
    x: number;
    y: number;
    value: number;
    status: CellStatus;
}

export type GameMode = 'classic' | 'territory' | 'attack' | 'occupy';

export class FruitBoxEngine {
    cols: number;
    rows: number;
    mode: GameMode;
    seed: number;
    state: {
        grid: Cell[][];
    };

    constructor(cols: number, rows: number, mode: GameMode, seed: number = 0) {
        this.cols = cols;
        this.rows = rows;
        this.mode = mode;
        this.seed = seed || Math.floor(Math.random() * 100000);
        this.state = {
            grid: this.initGrid()
        };
    }

    // Simple pseudo-random number generator for deterministic seeds
    private random() {
        const x = Math.sin(this.seed++) * 10000;
        return x - Math.floor(x);
    }

    private initGrid(): Cell[][] {
        const grid: Cell[][] = [];
        for (let y = 0; y < this.rows; y++) {
            const row: Cell[] = [];
            for (let x = 0; x < this.cols; x++) {
                // Values 1-9
                const val = Math.floor(this.random() * 9) + 1;
                row.push({
                    id: `${x}-${y}`,
                    x,
                    y,
                    value: val,
                    status: 'normal'
                });
            }
            grid.push(row);
        }
        return grid;
    }

    // Validate if selection sums to 10
    validateSelection(cells: Cell[]): boolean {
        if (cells.length === 0) return false;

        // Check if any cell is not normal
        if (cells.some(c => c.status !== 'normal')) return false;

        // Check if rectangular/continuous selection?
        // The UI enforces rectangular selection via start/end coordinates.
        // We assume the input `cells` are what the user selected.

        const sum = cells.reduce((acc, c) => acc + c.value, 0);
        return sum === 10;
    }

    processSelection(cells: Cell[], who: 'me' | 'opponent'): { score: number, events: string[], refillData?: { id: string, value: number }[] } {
        const events: string[] = [];
        let score = 0;

        // Mark cells as cleared
        cells.forEach(cell => {
            // Find the actual cell instance in our grid
            const actualCell = this.state.grid[cell.y][cell.x];
            if (actualCell.status === 'normal') {
                actualCell.status = 'cleared';
                score += 10; // 10 points per block
            }
        });

        // Depetrify Logic (Attack Mode)
        // Check neighbors of cleared cells. If petrified, set to normal.
        if (this.mode === 'attack') {
            cells.forEach(cell => {
                const neighbors = [
                    { x: cell.x, y: cell.y - 1 },
                    { x: cell.x, y: cell.y + 1 },
                    { x: cell.x - 1, y: cell.y },
                    { x: cell.x + 1, y: cell.y }
                ];
                neighbors.forEach(n => {
                    if (n.x >= 0 && n.x < this.cols && n.y >= 0 && n.y < this.rows) {
                        const neighbor = this.state.grid[n.y][n.x];
                        if (neighbor.status === 'petrified') {
                            neighbor.status = 'normal';
                        }
                    }
                });
            });
        }

        if (this.mode === 'attack') {
            // Attack mode: clearing 3+ blocks triggers an attack
            if (cells.length >= 3) {
                for (let i = 0; i < cells.length - 2; i++) {
                    events.push('petrify_trigger');
                }
            }
        }

        // Refill Logic (Classic / Occupy)
        // Territory / Attack do NOT refill.
        let refillData: { id: string, value: number }[] = [];
        if (this.mode == 'occupy') {
            refillData = this.refill();
        }

        return { score, events, refillData };
    }

    petrifyRandomCell() {
        // Find all normal cells
        const normalCells: Cell[] = [];
        this.state.grid.forEach(row => {
            row.forEach(cell => {
                if (cell.status === 'normal') {
                    normalCells.push(cell);
                }
            });
        });

        if (normalCells.length > 0) {
            const idx = Math.floor(Math.random() * normalCells.length);
            normalCells[idx].status = 'petrified';
        }
    }

    private refill(): { id: string, value: number }[] {
        const updates: { id: string, value: number }[] = [];
        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                const cell = this.state.grid[y][x];
                if (cell.status === 'cleared' || cell.status === 'opponent-cleared') {
                    // Regenerate
                    cell.value = Math.floor(this.random() * 9) + 1;
                    cell.status = 'normal';
                    updates.push({ id: cell.id, value: cell.value });
                }
            }
        }
        return updates;
    }
}
