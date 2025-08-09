/**
 * GoCube Bluetooth Module
 * Handles Bluetooth Low Energy connection to GoCube with optimized high-frequency data handling
 */
class GoCubeBluetooth {
    constructor() {
        // GoCube service and characteristic UUIDs (documented protocol)
        this.SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e'; // Nordic UART Service
        this.RX_CHARACTERISTIC_UUID = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // Write to cube
        this.TX_CHARACTERISTIC_UUID = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // Read from cube
        
        this.BATTERY_SERVICE_UUID = '0000180f-0000-1000-8000-00805f9b34fb';
        this.BATTERY_CHARACTERISTIC_UUID = '00002a19-0000-1000-8000-00805f9b34fb';
        
        this.device = null;
        this.server = null;
        this.service = null;
        this.rxCharacteristic = null;
        this.txCharacteristic = null;
        this.batteryService = null;
        this.batteryCharacteristic = null;
        
        this.isConnected = false;
        this.eventListeners = new Map();
        
        // High-frequency data optimization
        this.dataBuffer = new Uint8Array(0);
        this.lastProcessTime = 0;
        this.packetCount = 0;
        this.droppedPackets = 0;
        
        // Accelerometer data filtering
        this.accelerometerEnabled = true;
        this.moveDetectionOnly = false; // Set to true to ignore accelerometer data
        
        // Move detection from acceleration
        this.lastAcceleration = null;
        this.accelerationHistory = [];
        this.lastMoveDetection = null;
        
        // Performance monitoring
        this.performanceStats = {
            packetsPerSecond: 0,
            averagePacketSize: 0,
            lastStatsUpdate: Date.now()
        };
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
     * Check if Web Bluetooth is supported
     */
    isBluetoothSupported() {
        return 'bluetooth' in navigator;
    }

    /**
     * Connect to GoCube
     */
    async connect() {
        try {
            if (!this.isBluetoothSupported()) {
                throw new Error('Web Bluetooth is not supported in this browser');
            }

            console.log('🎲 Requesting GoCube device...');
            
            // Request GoCube device with known service
            this.device = await navigator.bluetooth.requestDevice({
                filters: [
                    { namePrefix: 'GoCube' },
                    { namePrefix: 'Particula' }, // GoCube manufacturer
                    { services: [this.SERVICE_UUID] }
                ],
                optionalServices: [
                    this.SERVICE_UUID,
                    this.BATTERY_SERVICE_UUID,
                    '0000180a-0000-1000-8000-00805f9b34fb', // Device Information
                    '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
                    '00001801-0000-1000-8000-00805f9b34fb'  // Generic Attribute
                ]
            });

            console.log('📱 GoCube selected:', this.device.name, this.device.id);
            
            console.log('🔗 Connecting to GATT server...');
            this.server = await this.device.gatt.connect();
            console.log('✅ GATT server connected');
            
            console.log('🔍 Discovering services...');
            await this.discoverServices();

            // Listen for disconnection
            this.device.addEventListener('gattserverdisconnected', () => {
                this.handleDisconnection();
            });

            this.isConnected = true;
            
            // Initialize cube communication
            await this.initializeCube();
            
            this.emit('connected', {
                name: this.device.name,
                id: this.device.id
            });

            // Get initial battery level
            await this.updateBatteryLevel();

            // Start performance monitoring
            this.startPerformanceMonitoring();

            return true;
        } catch (error) {
            console.error('❌ GoCube connection failed:', error);
            this.emit('error', `Connection failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Discover and connect to GoCube services
     */
    async discoverServices() {
        try {
            // Get main GoCube service
            this.service = await this.server.getPrimaryService(this.SERVICE_UUID);
            console.log('📡 Found GoCube main service');

            // Get characteristics
            this.rxCharacteristic = await this.service.getCharacteristic(this.RX_CHARACTERISTIC_UUID);
            this.txCharacteristic = await this.service.getCharacteristic(this.TX_CHARACTERISTIC_UUID);
            console.log('📡 Found RX and TX characteristics');

            // Setup notifications for high-frequency data
            await this.txCharacteristic.startNotifications();
            this.txCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
                this.handleDataReceived(event.target.value);
            });
            console.log('🔔 Notifications enabled - ready for high-frequency data');

            // Try to get battery service (optional)
            try {
                this.batteryService = await this.server.getPrimaryService(this.BATTERY_SERVICE_UUID);
                this.batteryCharacteristic = await this.batteryService.getCharacteristic(this.BATTERY_CHARACTERISTIC_UUID);
                console.log('🔋 Battery service connected');
            } catch (error) {
                console.warn('⚠️ Battery service not available:', error.message);
            }

        } catch (error) {
            throw new Error(`Service discovery failed: ${error.message}`);
        }
    }

    /**
     * Initialize GoCube communication
     */
    async initializeCube() {
        try {
            console.log('🎲 Initializing GoCube...');
            
            // Send initialization commands to GoCube
            // GoCube has documented initialization sequence
            await this.sendCommand([0x01]); // Request cube state
            await this.sleep(100);
            
            if (this.moveDetectionOnly) {
                console.log('🔇 Move detection only mode - disabling accelerometer data');
                await this.sendCommand([0x02, 0x00]); // Disable accelerometer if needed
            } else {
                console.log('🏃‍♂️ Full mode - accelerometer data enabled');
                await this.sendCommand([0x02, 0x01]); // Enable accelerometer
            }
            
            console.log('✅ GoCube initialized');
            
        } catch (error) {
            console.warn('⚠️ GoCube initialization warning:', error);
        }
    }

    /**
     * Handle incoming high-frequency data from GoCube
     */
    handleDataReceived(dataValue) {
        const now = Date.now();
        const data = new Uint8Array(dataValue.buffer);
        
        // TEMPORARILY DISABLE THROTTLING FOR TESTING
        // Performance optimization: throttle processing for high-frequency data
        // if (now - this.lastProcessTime < 10) { // Max 100 Hz processing
        //     this.droppedPackets++;
        //     return;
        // }
        this.lastProcessTime = now;
        
        this.packetCount++;
        this.updatePerformanceStats(data.length);
        
        // EMIT RAW DATA FOR ALL PACKETS (like GAN module did)
        const hexString = Array.from(data).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
        console.log('📡 GoCube data received:', hexString, 'length:', data.length);
        
        this.emit('rawData', {
            hex: hexString,
            bytes: Array.from(data),
            timestamp: now
        });
        
        // Quick packet type identification to avoid unnecessary processing
        const packetType = this.identifyPacketType(data);
        
        switch (packetType) {
            case 'move':
                this.handleMoveData(data);
                break;
            case 'accelerometer':
            case 'sensor':
                if (this.accelerometerEnabled && !this.moveDetectionOnly) {
                    this.handleAccelerometerData(data);
                }
                break;
            case 'battery':
                this.handleBatteryData(data);
                break;
            case 'status':
                this.handleStatusData(data);
                break;
            default:
                // Unknown packet type - log for debugging
                console.log('🔍 Unknown packet type:', packetType, 'data:', hexString);
        }
    }

    /**
     * Quick packet type identification for performance
     */
    identifyPacketType(data) {
        if (data.length === 0) return 'unknown';
        
        // GoCube uses ASCII-based protocol starting with 0x2a ('*')
        if (data[0] === 0x2a) {
            if (data.length >= 6) {
                // Check the packet type identifier (second byte after length)
                const typeIndicator = data[2];
                switch (typeIndicator) {
                    case 0x01:
                        return 'move';
                    case 0x03:
                        return 'accelerometer'; // Most common - sensor data
                    case 0x04:
                        return 'battery';
                    default:
                        return 'sensor'; // Default to sensor data for unknown types
                }
            }
            return 'sensor'; // Default for GoCube packets
        }
        
        return 'unknown';
    }

    /**
     * Handle move data (high priority)
     */
    handleMoveData(data) {
        try {
            const moveData = this.parseMoveData(data);
            if (moveData) {
                console.log('🎯 Move detected:', moveData.move);
                this.emit('move', moveData);
            }
        } catch (error) {
            console.warn('⚠️ Error parsing move data:', error);
        }
    }

    /**
     * Handle accelerometer/sensor data (high frequency, low priority)
     */
    handleAccelerometerData(data) {
        try {
            const sensorData = this.parseGoCubeSensorData(data);
            if (sensorData) {
                // Emit as accelerometer event for test compatibility
                this.emit('accelerometer', sensorData);
                
                // Also check for moves based on acceleration changes
                this.detectMoveFromAcceleration(sensorData);
            }
        } catch (error) {
            console.warn('⚠️ Error parsing sensor data:', error);
        }
    }

    /**
     * Parse GoCube move data (documented format)
     */
    parseMoveData(data) {
        if (data.length < 3) return null;
        
        // GoCube move format: [0x01, face, direction]
        const moveMap = {
            0x01: "U", 0x02: "U'", 0x03: "U2",
            0x04: "D", 0x05: "D'", 0x06: "D2",
            0x07: "R", 0x08: "R'", 0x09: "R2",
            0x0A: "L", 0x0B: "L'", 0x0C: "L2",
            0x0D: "F", 0x0E: "F'", 0x0F: "F2",
            0x10: "B", 0x11: "B'", 0x12: "B2"
        };
        
        const moveCode = data[1];
        const move = moveMap[moveCode];
        
        if (move) {
            return {
                type: 'move',
                move: move,
                timestamp: Date.now(),
                confidence: 1.0, // GoCube provides reliable move data
                raw: Array.from(data)
            };
        }
        
        return null;
    }

    /**
     * Parse accelerometer data
     */
    parseAccelerometerData(data) {
        if (data.length < 7) return null;
        
        // GoCube accelerometer format: [0x02, x_high, x_low, y_high, y_low, z_high, z_low]
        const x = (data[1] << 8) | data[2];
        const y = (data[3] << 8) | data[4];
        const z = (data[5] << 8) | data[6];
        
        return {
            type: 'accelerometer',
            x: x - 32768, // Convert from unsigned to signed
            y: y - 32768,
            z: z - 32768,
            timestamp: Date.now(),
            raw: Array.from(data)
        };
    }

    /**
     * Parse GoCube sensor data (ASCII-based protocol)
     */
    parseGoCubeSensorData(data) {
        try {
            // Convert bytes to ASCII string
            const asciiString = String.fromCharCode(...data);
            
            // GoCube format: *[length][type][data]#[data]#...
            if (!asciiString.startsWith('*')) {
                return null;
            }

            // Extract numeric values from the ASCII data
            const numbers = [];
            let currentNumber = '';
            let isNegative = false;
            
            for (let i = 2; i < asciiString.length; i++) {
                const char = asciiString[i];
                
                if (char === '-') {
                    isNegative = true;
                } else if (char >= '0' && char <= '9') {
                    currentNumber += char;
                } else if (char === '#' || char === '\r' || char === '\n' || i === asciiString.length - 1) {
                    if (currentNumber) {
                        let value = parseInt(currentNumber, 10);
                        if (isNegative) value = -value;
                        numbers.push(value);
                        currentNumber = '';
                        isNegative = false;
                    }
                }
            }
            
            // If we have at least 3 values, treat as x, y, z accelerometer data
            if (numbers.length >= 3) {
                const sensorData = {
                    type: 'accelerometer',
                    x: numbers[0] / 1000.0, // Convert to g-force (assuming milli-g)
                    y: numbers[1] / 1000.0,
                    z: numbers[2] / 1000.0,
                    timestamp: Date.now(),
                    raw: Array.from(data),
                    rawNumbers: numbers
                };
                
                return sensorData;
            }
            
            return null;
        } catch (error) {
            console.warn('⚠️ Error parsing GoCube sensor data:', error);
            return null;
        }
    }

    /**
     * Detect moves from acceleration changes
     */
    detectMoveFromAcceleration(sensorData) {
        if (!this.lastAcceleration) {
            this.lastAcceleration = sensorData;
            this.accelerationHistory = [];
            return;
        }
        
        // Calculate acceleration magnitude
        const magnitude = Math.sqrt(
            sensorData.x * sensorData.x + 
            sensorData.y * sensorData.y + 
            sensorData.z * sensorData.z
        );
        
        const lastMagnitude = Math.sqrt(
            this.lastAcceleration.x * this.lastAcceleration.x + 
            this.lastAcceleration.y * this.lastAcceleration.y + 
            this.lastAcceleration.z * this.lastAcceleration.z
        );
        
        // Detect significant acceleration changes (indicating a move)
        const accelerationChange = Math.abs(magnitude - lastMagnitude);
        const timeGap = sensorData.timestamp - this.lastAcceleration.timestamp;
        
        // Store in history for pattern analysis
        if (!this.accelerationHistory) {
            this.accelerationHistory = [];
        }
        
        this.accelerationHistory.push({
            magnitude: magnitude,
            change: accelerationChange,
            timestamp: sensorData.timestamp,
            x: sensorData.x,
            y: sensorData.y,
            z: sensorData.z
        });
        
        // Keep only recent history (last 2 seconds)
        const cutoffTime = sensorData.timestamp - 2000;
        this.accelerationHistory = this.accelerationHistory.filter(h => h.timestamp > cutoffTime);
        
        // Detect move: significant acceleration change with reasonable timing
        if (accelerationChange > 2.0 && timeGap > 50 && timeGap < 500) {
            
            // Prevent duplicate detections
            if (!this.lastMoveDetection || (sensorData.timestamp - this.lastMoveDetection) > 800) {
                
                // Analyze the acceleration pattern to determine move type
                const moveData = this.analyzeMovePattern(sensorData, this.lastAcceleration);
                
                if (moveData) {
                    console.log('🎯 Move detected from acceleration!', moveData.move);
                    this.emit('move', moveData);
                    this.lastMoveDetection = sensorData.timestamp;
                }
            }
        }
        
        this.lastAcceleration = sensorData;
    }

    /**
     * Analyze acceleration pattern to determine move type
     */
    analyzeMovePattern(currentAccel, lastAccel) {
        // Calculate the primary axis of movement
        const deltaX = Math.abs(currentAccel.x - lastAccel.x);
        const deltaY = Math.abs(currentAccel.y - lastAccel.y);
        const deltaZ = Math.abs(currentAccel.z - lastAccel.z);
        
        // Determine which axis had the most change
        let primaryAxis = 'x';
        let maxDelta = deltaX;
        
        if (deltaY > maxDelta) {
            primaryAxis = 'y';
            maxDelta = deltaY;
        }
        if (deltaZ > maxDelta) {
            primaryAxis = 'z';
            maxDelta = deltaZ;
        }
        
        // Basic move mapping based on primary axis
        // This is a simplified approach - real detection would need calibration
        let move = 'Move';
        const direction = currentAccel[primaryAxis] > lastAccel[primaryAxis] ? '+' : '-';
        
        // Map axis to cube faces (this may need adjustment based on cube orientation)
        switch (primaryAxis) {
            case 'x':
                move = deltaX > deltaY && deltaX > deltaZ ? (direction === '+' ? 'R' : "R'") : 'Move';
                break;
            case 'y':
                move = deltaY > deltaX && deltaY > deltaZ ? (direction === '+' ? 'U' : "U'") : 'Move';
                break;
            case 'z':
                move = deltaZ > deltaX && deltaZ > deltaY ? (direction === '+' ? 'F' : "F'") : 'Move';
                break;
        }
        
        // If movement is ambiguous or small, just call it a generic move
        if (maxDelta < 1.5) {
            move = 'Move';
        }
        
        return {
            type: 'move',
            move: move,
            confidence: Math.min(maxDelta / 5.0, 1.0), // Confidence based on acceleration magnitude
            timestamp: currentAccel.timestamp,
            analysis: {
                primaryAxis: primaryAxis,
                delta: maxDelta,
                direction: direction,
                deltaX: deltaX,
                deltaY: deltaY,
                deltaZ: deltaZ
            }
        };
    }

    /**
     * Handle battery data
     */
    handleBatteryData(data) {
        if (data.length >= 2) {
            const batteryLevel = data[1];
            console.log('🔋 Battery level:', batteryLevel + '%');
            this.emit('batteryLevel', batteryLevel);
        }
    }

    /**
     * Handle status data
     */
    handleStatusData(data) {
        // Process cube status information
        const statusData = {
            type: 'status',
            timestamp: Date.now(),
            raw: Array.from(data)
        };
        this.emit('cubeState', statusData);
    }

    /**
     * Send command to GoCube
     */
    async sendCommand(data) {
        if (!this.isConnected || !this.rxCharacteristic) {
            console.warn('⚠️ Cannot send command: not connected');
            return;
        }

        try {
            const buffer = new Uint8Array(data);
            await this.rxCharacteristic.writeValue(buffer);
            console.log('📤 Sent command:', Array.from(data).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        } catch (error) {
            console.warn('⚠️ Failed to send command:', error);
        }
    }

    /**
     * Update performance statistics
     */
    updatePerformanceStats(packetSize) {
        const now = Date.now();
        if (now - this.performanceStats.lastStatsUpdate > 1000) { // Update every second
            this.performanceStats.packetsPerSecond = this.packetCount;
            this.performanceStats.averagePacketSize = packetSize;
            this.performanceStats.lastStatsUpdate = now;
            
            if (this.packetCount > 50) {
                console.log(`📊 Performance: ${this.packetCount} pps, dropped: ${this.droppedPackets}`);
            }
            
            this.packetCount = 0;
            this.droppedPackets = 0;
        }
    }

    /**
     * Start performance monitoring
     */
    startPerformanceMonitoring() {
        setInterval(() => {
            if (this.isConnected) {
                this.emit('performance', {
                    packetsPerSecond: this.performanceStats.packetsPerSecond,
                    droppedPackets: this.droppedPackets,
                    averagePacketSize: this.performanceStats.averagePacketSize
                });
            }
        }, 5000); // Report every 5 seconds
    }

    /**
     * Toggle accelerometer data
     */
    async toggleAccelerometer(enabled) {
        this.accelerometerEnabled = enabled;
        console.log(`🏃‍♂️ Accelerometer ${enabled ? 'enabled' : 'disabled'}`);
        
        if (this.isConnected) {
            await this.sendCommand([0x02, enabled ? 0x01 : 0x00]);
        }
    }

    /**
     * Set move detection only mode (disables accelerometer)
     */
    async setMoveDetectionOnly(enabled) {
        this.moveDetectionOnly = enabled;
        if (enabled) {
            await this.toggleAccelerometer(false);
            console.log('🎯 Move detection only mode enabled');
        } else {
            await this.toggleAccelerometer(true);
            console.log('🏃‍♂️ Full sensor mode enabled');
        }
    }

    /**
     * Update battery level
     */
    async updateBatteryLevel() {
        if (!this.batteryCharacteristic) return null;

        try {
            const value = await this.batteryCharacteristic.readValue();
            const batteryLevel = value.getUint8(0);
            this.emit('batteryLevel', batteryLevel);
            return batteryLevel;
        } catch (error) {
            console.warn('⚠️ Could not read battery level:', error);
            return null;
        }
    }

    /**
     * Disconnect from GoCube
     */
    async disconnect() {
        try {
            if (this.device && this.device.gatt.connected) {
                await this.device.gatt.disconnect();
            }
        } catch (error) {
            console.error('❌ Disconnect error:', error);
        }
        
        this.handleDisconnection();
    }

    /**
     * Handle disconnection cleanup
     */
    handleDisconnection() {
        console.log('📱 GoCube disconnected');
        
        this.isConnected = false;
        this.device = null;
        this.server = null;
        this.service = null;
        this.rxCharacteristic = null;
        this.txCharacteristic = null;
        this.batteryService = null;
        this.batteryCharacteristic = null;
        this.dataBuffer = new Uint8Array(0);
        
        // Reset performance stats
        this.packetCount = 0;
        this.droppedPackets = 0;
        this.lastProcessTime = 0;
        
        this.emit('disconnected');
    }

    /**
     * Utility function for delays
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get connection status and performance info
     */
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            deviceName: this.device ? this.device.name : null,
            deviceId: this.device ? this.device.id : null,
            accelerometerEnabled: this.accelerometerEnabled,
            moveDetectionOnly: this.moveDetectionOnly,
            performance: this.performanceStats
        };
    }
}

// Export for use in other modules
window.GoCubeBluetooth = GoCubeBluetooth;
