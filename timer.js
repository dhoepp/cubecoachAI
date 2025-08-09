/**
 * Timer Module
 * Handles solve timing functionality
 */

class Timer {
    constructor() {
        this.startTime = null;
        this.endTime = null;
        this.isRunning = false;
        this.isPaused = false;
        this.currentTime = 0;
        this.intervalId = null;
        this.eventListeners = new Map();
        
        // Display update frequency (60 FPS for smooth display)
        this.updateInterval = 16; // ~60 FPS
    }

    /**
     * Register event listener
     */
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, []);
        }
        this.eventListeners.get(event).push(callback);
    }

    /**
     * Emit event to all listeners
     */
    emit(event, data) {
        if (this.eventListeners.has(event)) {
            this.eventListeners.get(event).forEach(callback => callback(data));
        }
    }

    /**
     * Start the timer
     */
    start() {
        if (this.isRunning) {
            return false;
        }

        this.startTime = performance.now();
        this.endTime = null;
        this.isRunning = true;
        this.isPaused = false;
        this.currentTime = 0;

        // Start the display update interval
        this.intervalId = setInterval(() => {
            this.updateCurrentTime();
            this.emit('tick', {
                time: this.currentTime,
                formatted: this.formatTime(this.currentTime)
            });
        }, this.updateInterval);

        this.emit('start', {
            startTime: this.startTime
        });

        console.log('Timer started');
        return true;
    }

    /**
     * Stop the timer
     */
    stop() {
        if (!this.isRunning) {
            return false;
        }

        this.endTime = performance.now();
        this.isRunning = false;
        this.isPaused = false;
        
        // Clear the interval
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        // Final time calculation
        this.updateCurrentTime();
        
        const result = {
            startTime: this.startTime,
            endTime: this.endTime,
            totalTime: this.currentTime,
            formatted: this.formatTime(this.currentTime)
        };

        this.emit('stop', result);

        console.log(`Timer stopped: ${result.formatted}`);
        return result;
    }

    /**
     * Pause the timer
     */
    pause() {
        if (!this.isRunning || this.isPaused) {
            return false;
        }

        this.isPaused = true;
        this.endTime = performance.now();
        
        // Clear the interval but keep timer state
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.emit('pause', {
            time: this.currentTime,
            formatted: this.formatTime(this.currentTime)
        });

        console.log('Timer paused');
        return true;
    }

    /**
     * Resume the timer
     */
    resume() {
        if (!this.isRunning || !this.isPaused) {
            return false;
        }

        // Adjust start time to account for pause duration
        const pauseDuration = performance.now() - this.endTime;
        this.startTime += pauseDuration;
        this.endTime = null;
        this.isPaused = false;

        // Restart the interval
        this.intervalId = setInterval(() => {
            this.updateCurrentTime();
            this.emit('tick', {
                time: this.currentTime,
                formatted: this.formatTime(this.currentTime)
            });
        }, this.updateInterval);

        this.emit('resume', {
            time: this.currentTime,
            formatted: this.formatTime(this.currentTime)
        });

        console.log('Timer resumed');
        return true;
    }

    /**
     * Reset the timer
     */
    reset() {
        const wasRunning = this.isRunning;
        
        this.startTime = null;
        this.endTime = null;
        this.isRunning = false;
        this.isPaused = false;
        this.currentTime = 0;

        // Clear the interval
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        this.emit('reset', {
            wasRunning: wasRunning
        });

        console.log('Timer reset');
        return true;
    }

    /**
     * Update current time
     */
    updateCurrentTime() {
        if (this.startTime) {
            const endTime = this.endTime || performance.now();
            this.currentTime = endTime - this.startTime;
        }
    }

    /**
     * Get current time
     */
    getCurrentTime() {
        this.updateCurrentTime();
        return this.currentTime;
    }

    /**
     * Get formatted current time
     */
    getFormattedTime() {
        return this.formatTime(this.getCurrentTime());
    }

    /**
     * Format time in milliseconds to readable string
     */
    formatTime(milliseconds) {
        if (milliseconds < 0) {
            return '00:00.000';
        }

        const totalSeconds = milliseconds / 1000;
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        const ms = Math.floor(milliseconds % 1000);

        const formattedMinutes = minutes.toString().padStart(2, '0');
        const formattedSeconds = seconds.toString().padStart(2, '0');
        const formattedMs = ms.toString().padStart(3, '0');

        return `${formattedMinutes}:${formattedSeconds}.${formattedMs}`;
    }

    /**
     * Parse formatted time string to milliseconds
     */
    parseTime(timeString) {
        const regex = /^(\d{2}):(\d{2})\.(\d{3})$/;
        const match = timeString.match(regex);
        
        if (!match) {
            return 0;
        }

        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const milliseconds = parseInt(match[3], 10);

        return (minutes * 60 + seconds) * 1000 + milliseconds;
    }

    /**
     * Get timer state
     */
    getState() {
        return {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            currentTime: this.getCurrentTime(),
            formatted: this.getFormattedTime(),
            startTime: this.startTime,
            endTime: this.endTime
        };
    }

    /**
     * Check if timer is running
     */
    getIsRunning() {
        return this.isRunning;
    }

    /**
     * Check if timer is paused
     */
    getIsPaused() {
        return this.isPaused;
    }

    /**
     * Get elapsed time without stopping timer
     */
    getElapsedTime() {
        if (!this.startTime) {
            return 0;
        }
        
        const endTime = this.endTime || performance.now();
        return endTime - this.startTime;
    }

    /**
     * Split time functionality for lap timing
     */
    split() {
        if (!this.isRunning) {
            return null;
        }

        const splitTime = this.getCurrentTime();
        const split = {
            time: splitTime,
            formatted: this.formatTime(splitTime),
            timestamp: performance.now()
        };

        this.emit('split', split);
        return split;
    }
}

// Export for use in other modules
window.Timer = Timer;
