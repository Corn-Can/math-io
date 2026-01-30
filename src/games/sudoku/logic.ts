export type Difficulty = 'easy' | 'medium' | 'hard';

export interface SudokuCell {
    x: number;
    y: number;
    value: number | null; // null = empty
    isLocked: boolean; // true = initial puzzle digit
    notes: Set<number>;
    isError?: boolean;
}

export class SudokuEngine {
    size: number;
    boxW: number;
    boxH: number;
    grid: SudokuCell[][] = [];
    solution: number[][] = [];
    seed: number;

    constructor(size: number, seed: number = 0) {
        this.size = size;
        this.seed = seed || Math.floor(Math.random() * 1000000);

        // Determine Box Geometry
        if (size === 4) { this.boxW = 2; this.boxH = 2; }
        else if (size === 6) { this.boxW = 3; this.boxH = 2; }
        else if (size === 9) { this.boxW = 3; this.boxH = 3; }
        else if (size === 16) { this.boxW = 4; this.boxH = 4; }
        else { this.boxW = 3; this.boxH = 3; } // Default 9x9 fallback
    }

    // Pseudo-random number generator
    private random() {
        const x = Math.sin(this.seed++) * 10000;
        return x - Math.floor(x);
    }

    generate(difficulty: Difficulty) {
        // 1. Generate Full Solution
        this.solution = this.createEmptyGrid<number>(0);
        this.fillDiagonal();
        this.solveRecursive(this.solution);

        // 2. Create Puzzle by Removing Cells
        this.grid = this.createEmptyGrid<SudokuCell>(null as any); // Temp filler

        // Deep copy solution to grid
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) {
                if (!this.grid[y]) this.grid[y] = [];
                this.grid[y]![x] = {
                    x, y,
                    value: this.solution[y]?.[x] ?? null,
                    isLocked: true,
                    notes: new Set()
                };
            }
        }

        // Determine number of cells to remove
        const totalCells = this.size * this.size;
        let removeRatio = 0.4;
        if (difficulty === 'medium') removeRatio = 0.55;
        if (difficulty === 'hard') removeRatio = 0.65;

        const cellsToRemove = Math.floor(totalCells * removeRatio);

        const coords = [];
        for (let y = 0; y < this.size; y++) {
            for (let x = 0; x < this.size; x++) coords.push({ x, y });
        }

        // Shuffle
        for (let i = coords.length - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1));
            const temp: { x: number, y: number } | undefined = coords[i];
            coords[i] = coords[j]!;
            coords[j] = temp!;
        }

        for (let i = 0; i < cellsToRemove; i++) {
            const coord = coords[i];
            if (!coord) continue;
            const { x, y } = coord;
            const cell = this.grid[y]?.[x];
            if (cell) {
                cell.value = null;
                cell.isLocked = false;
            }
        }
    }

    private createEmptyGrid<T>(initial: any): T[][] {
        const arr: T[][] = [];
        for (let y = 0; y < this.size; y++) {
            const row: T[] = [];
            for (let x = 0; x < this.size; x++) {
                row.push(initial === null ? null : (typeof initial === 'object' ? { ...initial } : initial));
            }
            arr.push(row);
        }
        return arr;
    }

    // --- Generator Helpers ---

    private fillDiagonal() {
        // Fill diagonal boxes (they are independent)
        for (let i = 0; i < this.size; i = i + this.boxH) {
            // Wait, for 9x9 box is 3x3. i=0, 3, 6.
            // Diagonal boxes: (0,0), (3,3), (6,6)
            // But logic differs for non-square ratio (6x6 -> 3x2).
            // Let's stick to simple diagonal fill: 
            // Actually diagonal box check is strict only if Matrix is Square of Boxes?
            // 6x6 (2x3 boxes). Boxes are at (0,0), (2,0), (4,0)?? No.
            // 6x6:
            // Box W=3, H=2.
            // 2 rows of boxes. 3 cols of boxes? No: Area = 6.
            // Rows of boxes = 6 / 2 = 3.
            // Cols of boxes = 6 / 3 = 2.
            // Boxes: (0,0), (3,0); (0,2), (3,2); (0,4), (3,4).
            // Diagonal boxes: (0,0) and (3,2) and ... they don't fully overlap.

            // To simplify generic generator: ONLY fill (0,0) if valid, then solve the rest.
            // Or skip diagonal optimization for generic sizes to avoid bugs.
            // Efficiency of backtracking empty board of 9x9 is okay-ish in JS (~5-10ms).
            // Let's optimize slightly by putting random numbers in the first ROW?
            // No, first row isn't constraint-free.

            // Just fill diagonal cells? No.
            // Let's just run generic solver. To ensure randomness, we shuffle checking order.
        }
    }

    private solveRecursive(grid: number[][]): boolean {
        let row = -1;
        let col = -1;
        let isEmpty = false;

        for (let i = 0; i < this.size; i++) {
            for (let j = 0; j < this.size; j++) {
                if (grid[i]?.[j] === 0) {
                    row = i;
                    col = j;
                    isEmpty = true;
                    break;
                }
            }
            if (isEmpty) break;
        }

        if (!isEmpty) return true; // Full

        // Try random numbers 1..N
        const nums = Array.from({ length: this.size }, (_, i) => i + 1);
        // Shuffle nums for randomness
        for (let i = nums.length - 1; i > 0; i--) {
            const j = Math.floor(this.random() * (i + 1));
            const temp = nums[i];
            nums[i] = nums[j]!;
            nums[j] = temp!;
        }

        for (const num of nums) {
            if (this.isSafe(grid, row, col, num)) {
                if (grid[row]) {
                    grid[row]![col] = num;
                    if (this.solveRecursive(grid)) return true;
                    grid[row]![col] = 0; // Backtrack
                }
            }
        }
        return false;
    }

    private isSafe(grid: number[][], row: number, col: number, num: number): boolean {
        // Check Row
        for (let x = 0; x < this.size; x++) if (grid[row]?.[x] === num) return false;

        // Check Col
        for (let y = 0; y < this.size; y++) if (grid[y]?.[col] === num) return false;

        // Check Box
        // Box start coords
        const startRow = row - row % this.boxH;
        const startCol = col - col % this.boxW;

        for (let i = 0; i < this.boxH; i++) {
            for (let j = 0; j < this.boxW; j++) {
                if (grid[i + startRow]?.[j + startCol] === num) return false;
            }
        }

        return true;
    }

    // --- Validation Helpers ---

    checkMove(x: number, y: number, value: number): boolean {
        // For Client Side validation (Classic Mode)
        // We can just check against solution?
        // Or re-run logic check?
        // Classic mode usually implies: "Is this number correct according to the solution?"
        // Rush mode definitely uses solution.

        if (this.solution.length === 0) return false; // Not generated
        // Compare with solution
        return this.solution[y]?.[x] === value;
    }
}
