/**
 * Main Application
 * Coordinates Bluetooth connection, timer, and solve parsing
 */

class CubeCoachApp {
    constructor() {
        this.bluetooth = new GANBluetooth();
        this.timer = new Timer();
        this.solveParser = new SolveParser();
        
        this.currentSolveNumber = 1;
        this.isAutoTimer = true; // Auto start/stop timer based on cube data
        this.lastMoveTime = 0;
        this.solveStarted = false;
        
        this.initializeEventListeners();
        this.initializeUI();
    }

    /**
     * Initialize event listeners for all modules
     */
    initializeEventListeners() {
        // Bluetooth events
        this.bluetooth.on('connected', (data) => this.handleCubeConnected(data));
        this.bluetooth.on('disconnected', () => this.handleCubeDisconnected());
        this.bluetooth.on('error', (error) => this.handleBluetoothError(error));
        this.bluetooth.on('batteryLevel', (level) => this.updateBatteryLevel(level));
        this.bluetooth.on('cubeState', (state) => this.handleCubeState(state));
        this.bluetooth.on('moveData', (move) => this.handleMoveData(move));
        this.bluetooth.on('solveComplete', (data) => this.handleSolveComplete(data));

        // Timer events
        this.timer.on('tick', (data) => this.updateTimerDisplay(data.formatted));
        this.timer.on('start', () => this.handleTimerStart());
        this.timer.on('stop', (data) => this.handleTimerStop(data));
        this.timer.on('reset', () => this.handleTimerReset());
    }

    /**
     * Initialize UI event listeners
     */
    initializeUI() {
        // Connection controls
        document.getElementById('connect-btn').addEventListener('click', () => this.connectToCube());
        document.getElementById('disconnect-btn').addEventListener('click', () => this.disconnectFromCube());

        // Timer controls
        document.getElementById('start-timer-btn').addEventListener('click', () => this.startTimer());
        document.getElementById('stop-timer-btn').addEventListener('click', () => this.stopTimer());
        document.getElementById('reset-timer-btn').addEventListener('click', () => this.resetTimer());

        // Export controls
        document.getElementById('generate-summary-btn').addEventListener('click', () => this.generateSummary());
        document.getElementById('copy-summary-btn').addEventListener('click', () => this.copySummary());

        // Auto-calculate totals when inputs change
        this.setupAutoCalculation();

        // Initial UI state
        this.updateConnectionUI(false);
        this.updateTimerControls();
    }

    /**
     * Setup automatic calculation of totals
     */
    setupAutoCalculation() {
        const inputs = document.querySelectorAll('.time-input, .moves-input');
        inputs.forEach(input => {
            input.addEventListener('input', () => this.calculateTotals());
        });
    }

    /**
     * Connect to GAN cube
     */
    async connectToCube() {
        try {
            document.getElementById('connect-btn').disabled = true;
            document.getElementById('connect-btn').textContent = 'Connecting...';
            
            await this.bluetooth.connect();
        } catch (error) {
            console.error('Failed to connect:', error);
            alert(`Failed to connect to cube: ${error.message}`);
            this.updateConnectionUI(false);
        }
    }

    /**
     * Disconnect from cube
     */
    async disconnectFromCube() {
        try {
            await this.bluetooth.disconnect();
        } catch (error) {
            console.error('Failed to disconnect:', error);
        }
    }

    /**
     * Handle successful cube connection
     */
    handleCubeConnected(data) {
        console.log('Cube connected:', data);
        this.updateConnectionUI(true, data.name);
        
        // Show success message
        this.showNotification('Connected to ' + data.name, 'success');
    }

    /**
     * Handle cube disconnection
     */
    handleCubeDisconnected() {
        console.log('Cube disconnected');
        this.updateConnectionUI(false);
        this.showNotification('Cube disconnected', 'info');
        
        // Stop timer if running
        if (this.timer.getIsRunning()) {
            this.stopTimer();
        }
    }

    /**
     * Handle Bluetooth errors
     */
    handleBluetoothError(error) {
        console.error('Bluetooth error:', error);
        this.showNotification('Bluetooth error: ' + error, 'error');
        this.updateConnectionUI(false);
    }

    /**
     * Update battery level display
     */
    updateBatteryLevel(level) {
        const batteryElement = document.getElementById('battery-level');
        if (batteryElement) {
            batteryElement.textContent = level;
        }
    }

    /**
     * Handle cube state changes
     */
    handleCubeState(state) {
        console.log('Cube state:', state);
        
        // Auto-start solve when cube becomes scrambled
        if (state.scrambled && !this.solveStarted && this.isAutoTimer) {
            this.prepareSolve();
        }
        
        // Auto-stop solve when cube becomes solved
        if (state.solved && this.solveStarted && this.timer.getIsRunning()) {
            this.stopTimer();
        }
    }

    /**
     * Handle move data from cube
     */
    handleMoveData(move) {
        console.log('Move:', move);
        
        // Auto-start timer on first move if not running
        if (!this.timer.getIsRunning() && !this.solveStarted && this.isAutoTimer) {
            this.startTimer();
            this.solveStarted = true;
        }
        
        // Add move to solve parser
        if (this.solveStarted) {
            this.solveParser.addMove(move);
        }
        
        this.lastMoveTime = move.timestamp;
    }

    /**
     * Handle solve completion data from cube
     */
    handleSolveComplete(data) {
        console.log('Solve complete:', data);
        
        if (this.timer.getIsRunning()) {
            this.stopTimer();
        }
        
        // Update UI with cube's timing data
        document.getElementById('total-time').textContent = this.timer.formatTime(data.totalTime);
        document.getElementById('total-moves').textContent = data.moveCount;
        document.getElementById('tps').textContent = data.tps.toFixed(2);
    }

    /**
     * Prepare for new solve
     */
    prepareSolve() {
        this.solveStarted = false;
        this.resetTimer();
        this.clearSolveData();
        this.solveParser.resetSolve();
    }

    /**
     * Start timer manually
     */
    startTimer() {
        if (this.timer.start()) {
            this.solveStarted = true;
            this.solveParser.startSolve(this.getScramble());
            this.updateTimerControls();
            document.body.classList.add('timer-running');
        }
    }

    /**
     * Stop timer manually
     */
    stopTimer() {
        const result = this.timer.stop();
        if (result) {
            this.solveStarted = false;
            this.updateTimerControls();
            document.body.classList.remove('timer-running');
            
            // Complete solve parsing
            const solveData = this.solveParser.stopSolve();
            if (solveData) {
                this.displaySolveData(solveData);
            }
            
            this.currentSolveNumber++;
            document.getElementById('solve-number').textContent = this.currentSolveNumber;
        }
    }

    /**
     * Reset timer manually
     */
    resetTimer() {
        this.timer.reset();
        this.solveStarted = false;
        this.updateTimerControls();
        this.updateTimerDisplay('00:00.000');
        document.body.classList.remove('timer-running');
        this.solveParser.resetSolve();
        this.clearSolveData();
    }

    /**
     * Handle timer start
     */
    handleTimerStart() {
        this.updateTimerControls();
    }

    /**
     * Handle timer stop
     */
    handleTimerStop(data) {
        this.updateTimerControls();
        document.getElementById('total-time').textContent = data.formatted;
    }

    /**
     * Handle timer reset
     */
    handleTimerReset() {
        this.updateTimerControls();
        this.clearSolveData();
    }

    /**
     * Update timer display
     */
    updateTimerDisplay(formattedTime) {
        document.getElementById('timer').textContent = formattedTime;
    }

    /**
     * Update timer control buttons
     */
    updateTimerControls() {
        const isRunning = this.timer.getIsRunning();
        const startBtn = document.getElementById('start-timer-btn');
        const stopBtn = document.getElementById('stop-timer-btn');
        const resetBtn = document.getElementById('reset-timer-btn');

        startBtn.disabled = isRunning;
        stopBtn.disabled = !isRunning;
        resetBtn.disabled = isRunning;
    }

    /**
     * Update connection UI
     */
    updateConnectionUI(connected, deviceName = '') {
        const statusElement = document.getElementById('connection-status');
        const indicatorElement = document.getElementById('status-indicator');
        const connectBtn = document.getElementById('connect-btn');
        const disconnectBtn = document.getElementById('disconnect-btn');
        const cubeInfo = document.getElementById('cube-info');
        const deviceNameElement = document.getElementById('device-name');

        if (connected) {
            statusElement.textContent = 'Connected';
            indicatorElement.classList.add('connected');
            connectBtn.disabled = true;
            connectBtn.textContent = 'Connect Cube';
            disconnectBtn.disabled = false;
            cubeInfo.classList.remove('hidden');
            deviceNameElement.textContent = deviceName;
        } else {
            statusElement.textContent = 'Disconnected';
            indicatorElement.classList.remove('connected');
            connectBtn.disabled = false;
            connectBtn.textContent = 'Connect Cube';
            disconnectBtn.disabled = true;
            cubeInfo.classList.add('hidden');
            deviceNameElement.textContent = '';
        }
    }

    /**
     * Display solve data in UI
     */
    displaySolveData(solveData) {
        // Cross
        document.getElementById('cross-time').value = this.formatTimeForInput(solveData.phases.cross.time);
        document.getElementById('cross-moves').value = solveData.phases.cross.moveCount;

        // F2L pairs
        for (let i = 1; i <= 4; i++) {
            const pair = solveData.phases.f2l[`pair${i}`];
            document.getElementById(`f2l-${i}-time`).value = this.formatTimeForInput(pair.time);
            document.getElementById(`f2l-${i}-moves`).value = pair.moveCount;
        }

        // OLL
        document.getElementById('oll-algorithm').value = solveData.phases.oll.algorithm;
        document.getElementById('oll-time').value = this.formatTimeForInput(solveData.phases.oll.time);
        document.getElementById('oll-moves').value = solveData.phases.oll.moveCount;

        // PLL
        document.getElementById('pll-algorithm').value = solveData.phases.pll.algorithm;
        document.getElementById('pll-time').value = this.formatTimeForInput(solveData.phases.pll.time);
        document.getElementById('pll-moves').value = solveData.phases.pll.moveCount;

        // Calculate and display totals
        this.calculateTotals();
    }

    /**
     * Format time for input fields (seconds with decimals)
     */
    formatTimeForInput(milliseconds) {
        return (milliseconds / 1000).toFixed(3);
    }

    /**
     * Calculate total time and moves from input fields
     */
    calculateTotals() {
        let totalTime = 0;
        let totalMoves = 0;

        // Get all time and move inputs
        const timeInputs = document.querySelectorAll('.time-input');
        const moveInputs = document.querySelectorAll('.moves-input');

        timeInputs.forEach(input => {
            const value = parseFloat(input.value) || 0;
            totalTime += value * 1000; // Convert to milliseconds
        });

        moveInputs.forEach(input => {
            const value = parseInt(input.value) || 0;
            totalMoves += value;
        });

        // Update displays
        document.getElementById('total-time').textContent = this.timer.formatTime(totalTime);
        document.getElementById('total-moves').textContent = totalMoves;
        
        const tps = totalMoves / (totalTime / 1000);
        document.getElementById('tps').textContent = (isFinite(tps) ? tps : 0).toFixed(2);
    }

    /**
     * Clear solve data from UI
     */
    clearSolveData() {
        // Clear all input fields
        document.querySelectorAll('.time-input, .moves-input, .algorithm-input').forEach(input => {
            input.value = '';
        });
        
        // Reset totals
        document.getElementById('total-time').textContent = '00:00.000';
        document.getElementById('total-moves').textContent = '0';
        document.getElementById('tps').textContent = '0.00';
        
        // Clear export text
        document.getElementById('export-text').value = '';
    }

    /**
     * Get scramble from input
     */
    getScramble() {
        return document.getElementById('scramble').value.trim();
    }

    /**
     * Generate solve summary for export
     */
    generateSummary() {
        const currentSolve = this.solveParser.getCurrentSolve();
        let summary = '';

        if (currentSolve) {
            // Use actual solve data
            summary = this.solveParser.generateSolveSummary(currentSolve);
        } else {
            // Use manual input data
            summary = this.generateManualSummary();
        }

        document.getElementById('export-text').value = summary;
        this.showNotification('Summary generated successfully', 'success');
    }

    /**
     * Generate summary from manual input data
     */
    generateManualSummary() {
        const scramble = document.getElementById('scramble').value || 'Not recorded';
        const totalTime = document.getElementById('total-time').textContent;
        const totalMoves = document.getElementById('total-moves').textContent;
        const tps = document.getElementById('tps').textContent;

        let summary = `=== Rubik's Cube Solve Analysis ===\n\n`;
        summary += `Scramble: ${scramble}\n`;
        summary += `Total Time: ${totalTime}\n`;
        summary += `Total Moves: ${totalMoves}\n`;
        summary += `TPS (Turns Per Second): ${tps}\n\n`;

        summary += `=== Phase Breakdown ===\n\n`;

        // Cross
        const crossTime = document.getElementById('cross-time').value || '0';
        const crossMoves = document.getElementById('cross-moves').value || '0';
        summary += `Cross:\n`;
        summary += `  Time: ${crossTime}s\n`;
        summary += `  Moves: ${crossMoves}\n\n`;

        // F2L
        summary += `F2L:\n`;
        for (let i = 1; i <= 4; i++) {
            const time = document.getElementById(`f2l-${i}-time`).value || '0';
            const moves = document.getElementById(`f2l-${i}-moves`).value || '0';
            summary += `  Pair ${i}: ${time}s, ${moves} moves\n`;
        }
        summary += `\n`;

        // OLL
        const ollAlgorithm = document.getElementById('oll-algorithm').value || 'Not recorded';
        const ollTime = document.getElementById('oll-time').value || '0';
        const ollMoves = document.getElementById('oll-moves').value || '0';
        summary += `OLL:\n`;
        summary += `  Algorithm: ${ollAlgorithm}\n`;
        summary += `  Time: ${ollTime}s\n`;
        summary += `  Moves: ${ollMoves}\n\n`;

        // PLL
        const pllAlgorithm = document.getElementById('pll-algorithm').value || 'Not recorded';
        const pllTime = document.getElementById('pll-time').value || '0';
        const pllMoves = document.getElementById('pll-moves').value || '0';
        summary += `PLL:\n`;
        summary += `  Algorithm: ${pllAlgorithm}\n`;
        summary += `  Time: ${pllTime}s\n`;
        summary += `  Moves: ${pllMoves}\n\n`;

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

    /**
     * Copy summary to clipboard
     */
    async copySummary() {
        const summaryText = document.getElementById('export-text').value;
        
        if (!summaryText.trim()) {
            this.showNotification('No summary to copy. Generate summary first.', 'warning');
            return;
        }

        try {
            await navigator.clipboard.writeText(summaryText);
            this.showNotification('Summary copied to clipboard!', 'success');
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            this.showNotification('Failed to copy to clipboard', 'error');
            
            // Fallback: select the text
            document.getElementById('export-text').select();
        }
    }

    /**
     * Show notification to user
     */
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.textContent = message;
        
        // Style the notification
        Object.assign(notification.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '15px 20px',
            borderRadius: '8px',
            color: 'white',
            fontSize: '14px',
            fontWeight: '500',
            zIndex: '10000',
            transform: 'translateX(100%)',
            transition: 'transform 0.3s ease',
            maxWidth: '300px',
            wordWrap: 'break-word'
        });

        // Set background color based on type
        const colors = {
            success: '#28a745',
            error: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        notification.style.backgroundColor = colors[type] || colors.info;

        // Add to page
        document.body.appendChild(notification);

        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);

        // Remove after delay
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new CubeCoachApp();
    console.log('GAN Cube Coach AI initialized');
});
