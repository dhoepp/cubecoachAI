/**
 * Solve Parser Module
 * Analyzes cube moves and timing data to extract phase information
 */

class SolveParser {
    constructor() {
        this.moves = [];
        this.currentSolve = null;
        this.solveHistory = [];
        this.isRecording = false;
        this.startTime = null;
        
        // Phase detection patterns
        this.crossMoves = new Set(['D', 'D\'', 'D2', 'F', 'F\'', 'F2', 'R', 'R\'', 'R2', 'L', 'L\'', 'L2', 'B', 'B\'', 'B2']);
        this.f2lMoves = new Set(['U', 'U\'', 'U2', 'R', 'R\'', 'R2', 'F', 'F\'', 'F2', 'L', 'L\'', 'L2', 'B', 'B\'', 'B2']);
        
        // Common algorithm patterns for OLL/PLL detection
        this.ollPatterns = this.initializeOLLPatterns();
        this.pllPatterns = this.initializePLLPatterns();
    }

    /**
     * Initialize common OLL algorithm patterns
     */
    initializeOLLPatterns() {
        return {
            'OLL 21': ['R U R\' U R U2 R\''],
            'OLL 22': ['R U2 R2 U\' R2 U\' R2 U2 R'],
            'OLL 23': ['R2 D R\' U2 R D\' R\' U2 R\''],
            'OLL 24': ['R U R\' U\' R\' F R F\''],
            'OLL 25': ['F\' R U R\' U\' R\' F R'],
            'OLL 26': ['R U2 R\' U\' R U\' R\''],
            'OLL 27': ['R U R\' U R U2 R\''],
            // Add more patterns as needed
        };
    }

    /**
     * Initialize common PLL algorithm patterns
     */
    initializePLLPatterns() {
        return {
            'T Perm': ['R U R\' F\' R U R\' U\' R\' F R2 U\' R\''],
            'A Perm': ['R\' F R\' B2 R F\' R\' B2 R2'],
            'U Perm': ['R U\' R F\' R2 U\' R U\' R U R\' F R U R\' F'],
            'H Perm': ['M2 U M2 U2 M2 U M2'],
            'Z Perm': ['M\' U M2 U M2 U M\' U2 M2'],
            'Y Perm': ['R U\' R\' F R F\' R U R\' F\' R U R\' U\' F'],
            'V Perm': ['R\' U R\' U\' y R\' F\' R2 U\' R\' U R\' F R F'],
            'N Perm': ['R U R\' F\' R U R\' U\' R\' F R2 U\' R\' U2 R U\' R\''],
            // Add more patterns as needed
        };
    }

    /**
     * Start recording a new solve
     */
    startSolve(scramble = '') {
        this.moves = [];
        this.isRecording = true;
        this.startTime = Date.now();
        
        this.currentSolve = {
            id: Date.now(),
            scramble: scramble,
            startTime: this.startTime,
            endTime: null,
            totalTime: 0,
            moves: [],
            phases: {
                cross: { moves: [], time: 0, moveCount: 0 },
                f2l: { 
                    pair1: { moves: [], time: 0, moveCount: 0 },
                    pair2: { moves: [], time: 0, moveCount: 0 },
                    pair3: { moves: [], time: 0, moveCount: 0 },
                    pair4: { moves: [], time: 0, moveCount: 0 }
                },
                oll: { moves: [], time: 0, moveCount: 0, algorithm: '' },
                pll: { moves: [], time: 0, moveCount: 0, algorithm: '' }
            },
            totalMoves: 0,
            tps: 0
        };
        
        console.log('Started new solve recording');
    }

    /**
     * Add a move to the current solve
     */
    addMove(moveData) {
        if (!this.isRecording || !this.currentSolve) {
            return;
        }

        const move = {
            notation: moveData.move,
            timestamp: moveData.timestamp,
            duration: moveData.duration,
            relativeTime: moveData.timestamp - this.startTime
        };

        this.moves.push(move);
        this.currentSolve.moves.push(move);
        
        console.log(`Added move: ${move.notation} at ${move.relativeTime}ms`);
    }

    /**
     * Stop recording and analyze the solve
     */
    stopSolve() {
        if (!this.isRecording || !this.currentSolve) {
            return null;
        }

        this.isRecording = false;
        this.currentSolve.endTime = Date.now();
        this.currentSolve.totalTime = this.currentSolve.endTime - this.currentSolve.startTime;
        this.currentSolve.totalMoves = this.moves.length;
        this.currentSolve.tps = this.currentSolve.totalMoves / (this.currentSolve.totalTime / 1000);

        // Analyze phases
        this.analyzePhases();
        
        // Add to history
        this.solveHistory.push(this.currentSolve);
        
        console.log('Solve completed:', this.currentSolve);
        return this.currentSolve;
    }

    /**
     * Analyze solve phases based on move patterns and timing
     */
    analyzePhases() {
        if (!this.currentSolve || this.moves.length === 0) {
            return;
        }

        const moves = this.moves;
        let phaseIndex = 0;
        
        // Phase 1: Cross (typically first 4-12 moves)
        const crossEndIndex = this.detectCrossEnd(moves);
        this.analyzePhase('cross', moves.slice(0, crossEndIndex + 1));
        phaseIndex = crossEndIndex + 1;

        // Phase 2: F2L (typically next 20-40 moves, split into 4 pairs)
        const f2lEndIndex = this.detectF2LEnd(moves, phaseIndex);
        const f2lMoves = moves.slice(phaseIndex, f2lEndIndex + 1);
        this.analyzeF2LPairs(f2lMoves);
        phaseIndex = f2lEndIndex + 1;

        // Phase 3: OLL (typically next 5-15 moves)
        const ollEndIndex = this.detectOLLEnd(moves, phaseIndex);
        const ollMoves = moves.slice(phaseIndex, ollEndIndex + 1);
        this.analyzePhase('oll', ollMoves);
        this.detectOLLAlgorithm(ollMoves);
        phaseIndex = ollEndIndex + 1;

        // Phase 4: PLL (remaining moves)
        const pllMoves = moves.slice(phaseIndex);
        this.analyzePhase('pll', pllMoves);
        this.detectPLLAlgorithm(pllMoves);
    }

    /**
     * Detect end of cross phase
     */
    detectCrossEnd(moves) {
        // Simple heuristic: cross typically ends when we see first U move
        // or after first 12 moves (whichever comes first)
        for (let i = 0; i < Math.min(moves.length, 12); i++) {
            if (moves[i].notation.startsWith('U')) {
                return Math.max(0, i - 1);
            }
        }
        return Math.min(7, moves.length - 1); // Default to 8 moves max for cross
    }

    /**
     * Detect end of F2L phase
     */
    detectF2LEnd(moves, startIndex) {
        // F2L typically ends when we see pattern changes indicating OLL
        // Look for sequences that don't include U moves (indicating last pair insertion)
        let consecutiveNonU = 0;
        let lastNonUIndex = startIndex;
        
        for (let i = startIndex; i < moves.length; i++) {
            if (!moves[i].notation.startsWith('U')) {
                consecutiveNonU++;
                lastNonUIndex = i;
            } else {
                if (consecutiveNonU >= 3) {
                    // Likely end of F2L
                    return lastNonUIndex;
                }
                consecutiveNonU = 0;
            }
        }
        
        // Fallback: assume F2L is about 60% of solve
        const estimatedF2LEnd = Math.floor(moves.length * 0.6);
        return Math.min(estimatedF2LEnd, moves.length - 8); // Leave room for OLL/PLL
    }

    /**
     * Detect end of OLL phase
     */
    detectOLLEnd(moves, startIndex) {
        // OLL typically 5-15 moves, look for pattern completion
        const maxOLLMoves = 15;
        const endIndex = Math.min(startIndex + maxOLLMoves, moves.length - 4); // Leave room for PLL
        
        // Simple heuristic: OLL often ends with a setup move followed by trigger
        for (let i = startIndex + 3; i < endIndex; i++) {
            if (this.looksLikePhaseEnd(moves.slice(startIndex, i + 1))) {
                return i;
            }
        }
        
        return endIndex;
    }

    /**
     * Check if move sequence looks like end of a phase
     */
    looksLikePhaseEnd(moves) {
        if (moves.length < 3) return false;
        
        // Look for common ending patterns
        const lastThree = moves.slice(-3).map(m => m.notation).join(' ');
        const endingPatterns = [
            'R U R\'', 'R\' U\' R', 'F R F\'', 'F\' L F',
            'U R U\'', 'U\' R\' U'
        ];
        
        return endingPatterns.some(pattern => lastThree.includes(pattern));
    }

    /**
     * Analyze F2L pairs
     */
    analyzeF2LPairs(f2lMoves) {
        if (f2lMoves.length === 0) return;
        
        // Simple division into 4 pairs
        const movesPerPair = Math.ceil(f2lMoves.length / 4);
        
        for (let i = 0; i < 4; i++) {
            const startIdx = i * movesPerPair;
            const endIdx = Math.min((i + 1) * movesPerPair, f2lMoves.length);
            const pairMoves = f2lMoves.slice(startIdx, endIdx);
            
            this.analyzePhase(`f2l_pair${i + 1}`, pairMoves);
        }
    }

    /**
     * Analyze a specific phase
     */
    analyzePhase(phaseName, moves) {
        if (moves.length === 0) return;
        
        const startTime = moves[0].relativeTime;
        const endTime = moves[moves.length - 1].relativeTime;
        const phaseTime = endTime - startTime;
        
        if (phaseName === 'cross') {
            this.currentSolve.phases.cross = {
                moves: moves.map(m => m.notation),
                time: phaseTime,
                moveCount: moves.length
            };
        } else if (phaseName.startsWith('f2l_pair')) {
            const pairNum = parseInt(phaseName.slice(-1));
            this.currentSolve.phases.f2l[`pair${pairNum}`] = {
                moves: moves.map(m => m.notation),
                time: phaseTime,
                moveCount: moves.length
            };
        } else if (phaseName === 'oll') {
            this.currentSolve.phases.oll = {
                moves: moves.map(m => m.notation),
                time: phaseTime,
                moveCount: moves.length,
                algorithm: ''
            };
        } else if (phaseName === 'pll') {
            this.currentSolve.phases.pll = {
                moves: moves.map(m => m.notation),
                time: phaseTime,
                moveCount: moves.length,
                algorithm: ''
            };
        }
    }

    /**
     * Detect OLL algorithm
     */
    detectOLLAlgorithm(moves) {
        const moveSequence = moves.map(m => m.notation).join(' ');
        
        for (const [name, patterns] of Object.entries(this.ollPatterns)) {
            for (const pattern of patterns) {
                if (this.sequenceContainsPattern(moveSequence, pattern)) {
                    this.currentSolve.phases.oll.algorithm = name;
                    return;
                }
            }
        }
        
        this.currentSolve.phases.oll.algorithm = 'Unknown OLL';
    }

    /**
     * Detect PLL algorithm
     */
    detectPLLAlgorithm(moves) {
        const moveSequence = moves.map(m => m.notation).join(' ');
        
        for (const [name, patterns] of Object.entries(this.pllPatterns)) {
            for (const pattern of patterns) {
                if (this.sequenceContainsPattern(moveSequence, pattern)) {
                    this.currentSolve.phases.pll.algorithm = name;
                    return;
                }
            }
        }
        
        this.currentSolve.phases.pll.algorithm = 'Unknown PLL';
    }

    /**
     * Check if move sequence contains a pattern
     */
    sequenceContainsPattern(sequence, pattern) {
        // Normalize both sequences for comparison
        const normalizedSequence = this.normalizeMoveSequence(sequence);
        const normalizedPattern = this.normalizeMoveSequence(pattern);
        
        return normalizedSequence.includes(normalizedPattern);
    }

    /**
     * Normalize move sequence for pattern matching
     */
    normalizeMoveSequence(sequence) {
        return sequence
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    /**
     * Get current solve data
     */
    getCurrentSolve() {
        return this.currentSolve;
    }

    /**
     * Get solve history
     */
    getSolveHistory() {
        return this.solveHistory;
    }

    /**
     * Reset current solve
     */
    resetSolve() {
        this.moves = [];
        this.currentSolve = null;
        this.isRecording = false;
        this.startTime = null;
    }

    /**
     * Generate human-readable solve summary
     */
    generateSolveSummary(solve = null) {
        const solveData = solve || this.currentSolve;
        if (!solveData) return '';

        const formatTime = (ms) => {
            const seconds = (ms / 1000).toFixed(3);
            return `${seconds}s`;
        };

        let summary = `=== Rubik's Cube Solve Analysis ===\n\n`;
        summary += `Scramble: ${solveData.scramble || 'Not recorded'}\n`;
        summary += `Total Time: ${formatTime(solveData.totalTime)}\n`;
        summary += `Total Moves: ${solveData.totalMoves}\n`;
        summary += `TPS (Turns Per Second): ${solveData.tps.toFixed(2)}\n\n`;

        summary += `=== Phase Breakdown ===\n\n`;

        // Cross
        const cross = solveData.phases.cross;
        summary += `Cross:\n`;
        summary += `  Time: ${formatTime(cross.time)}\n`;
        summary += `  Moves: ${cross.moveCount}\n`;
        summary += `  Solution: ${cross.moves.join(' ')}\n\n`;

        // F2L
        summary += `F2L:\n`;
        let totalF2LTime = 0;
        let totalF2LMoves = 0;
        for (let i = 1; i <= 4; i++) {
            const pair = solveData.phases.f2l[`pair${i}`];
            totalF2LTime += pair.time;
            totalF2LMoves += pair.moveCount;
            summary += `  Pair ${i}: ${formatTime(pair.time)}, ${pair.moveCount} moves - ${pair.moves.join(' ')}\n`;
        }
        summary += `  Total F2L: ${formatTime(totalF2LTime)}, ${totalF2LMoves} moves\n\n`;

        // OLL
        const oll = solveData.phases.oll;
        summary += `OLL:\n`;
        summary += `  Algorithm: ${oll.algorithm}\n`;
        summary += `  Time: ${formatTime(oll.time)}\n`;
        summary += `  Moves: ${oll.moveCount}\n`;
        summary += `  Execution: ${oll.moves.join(' ')}\n\n`;

        // PLL
        const pll = solveData.phases.pll;
        summary += `PLL:\n`;
        summary += `  Algorithm: ${pll.algorithm}\n`;
        summary += `  Time: ${formatTime(pll.time)}\n`;
        summary += `  Moves: ${pll.moveCount}\n`;
        summary += `  Execution: ${pll.moves.join(' ')}\n\n`;

        summary += `=== Analysis Request ===\n`;
        summary += `Please analyze this solve and provide feedback on:\n`;
        summary += `1. Cross efficiency (optimal move count and execution)\n`;
        summary += `2. F2L pair recognition and solution efficiency\n`;
        summary += `3. Look-ahead opportunities during F2L\n`;
        summary += `4. OLL/PLL algorithm execution and alternatives\n`;
        summary += `5. Overall solve flow and areas for improvement\n`;
        summary += `6. Recommended practice drills based on weakest phases\n`;

        return summary;
    }
}

// Export for use in other modules
window.SolveParser = SolveParser;
