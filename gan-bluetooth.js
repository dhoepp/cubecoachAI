/**
 * GAN Bluetooth Module
 * Handles Bluetooth Low Energy connection to GAN 356i Carry cube
 */

class GANBluetooth {
    constructor() {
        // GAN cube service and characteristic UUIDs
        this.SERVICE_UUID = '6e400001-b5a3-f393-e0a9-e50e24dcca9e';
        this.CHARACTERISTIC_UUID_RX = '6e400002-b5a3-f393-e0a9-e50e24dcca9e'; // Write to cube
        this.CHARACTERISTIC_UUID_TX = '6e400003-b5a3-f393-e0a9-e50e24dcca9e'; // Read from cube
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
        
        // Data buffers for parsing multi-packet messages
        this.dataBuffer = new Uint8Array(0);
        this.expectedPackets = 0;
        this.receivedPackets = 0;
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
     * Connect to GAN cube
     */
    async connect() {
        try {
            if (!this.isBluetoothSupported()) {
                throw new Error('Web Bluetooth is not supported in this browser');
            }

            console.log('Requesting Bluetooth device...');
            this.device = await navigator.bluetooth.requestDevice({
                filters: [
                    { namePrefix: 'GAN' },
                    { namePrefix: 'Gan' },
                    { services: [this.SERVICE_UUID] }
                ],
                optionalServices: [this.SERVICE_UUID, this.BATTERY_SERVICE_UUID]
            });

            console.log('Connecting to GATT server...');
            this.server = await this.device.gatt.connect();

            console.log('Getting primary service...');
            this.service = await this.server.getPrimaryService(this.SERVICE_UUID);

            console.log('Getting characteristics...');
            this.rxCharacteristic = await this.service.getCharacteristic(this.CHARACTERISTIC_UUID_RX);
            this.txCharacteristic = await this.service.getCharacteristic(this.CHARACTERISTIC_UUID_TX);

            // Setup notifications for data from cube
            await this.txCharacteristic.startNotifications();
            this.txCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
                this.handleDataReceived(event.target.value);
            });

            // Try to get battery service (optional)
            try {
                this.batteryService = await this.server.getPrimaryService(this.BATTERY_SERVICE_UUID);
                this.batteryCharacteristic = await this.batteryService.getCharacteristic(this.BATTERY_CHARACTERISTIC_UUID);
            } catch (error) {
                console.warn('Battery service not available:', error);
            }

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
            if (this.batteryCharacteristic) {
                try {
                    const batteryValue = await this.batteryCharacteristic.readValue();
                    const batteryLevel = batteryValue.getUint8(0);
                    this.emit('batteryLevel', batteryLevel);
                } catch (error) {
                    console.warn('Could not read battery level:', error);
                }
            }

            return true;
        } catch (error) {
            console.error('Connection failed:', error);
            this.emit('error', `Connection failed: ${error.message}`);
            throw error;
        }
    }

    /**
     * Initialize cube communication
     */
    async initializeCube() {
        try {
            // Send initialization commands to enable solve data transmission
            // These are typical GAN cube initialization commands
            await this.sendCommand([0x01, 0x02]); // Enable notifications
            await this.sleep(100);
            await this.sendCommand([0x02, 0x01]); // Request cube state
            await this.sleep(100);
            await this.sendCommand([0x03, 0x01]); // Enable solve data
        } catch (error) {
            console.warn('Cube initialization warning:', error);
        }
    }

    /**
     * Send command to cube
     */
    async sendCommand(data) {
        if (!this.isConnected || !this.rxCharacteristic) {
            throw new Error('Not connected to cube');
        }

        const buffer = new Uint8Array(data);
        await this.rxCharacteristic.writeValue(buffer);
    }

    /**
     * Handle incoming data from cube
     */
    handleDataReceived(dataValue) {
        const data = new Uint8Array(dataValue.buffer);
        console.log('Received data:', Array.from(data).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));

        // Append data to buffer
        const newBuffer = new Uint8Array(this.dataBuffer.length + data.length);
        newBuffer.set(this.dataBuffer);
        newBuffer.set(data, this.dataBuffer.length);
        this.dataBuffer = newBuffer;

        // Try to parse complete messages
        this.parseDataBuffer();
    }

    /**
     * Parse accumulated data buffer for complete messages
     */
    parseDataBuffer() {
        // Look for message headers and parse complete messages
        let offset = 0;
        
        while (offset < this.dataBuffer.length) {
            // Check for different message types based on GAN protocol
            if (this.dataBuffer[offset] === 0x01) {
                // Cube state message
                if (this.dataBuffer.length >= offset + 6) {
                    const cubeState = this.parseCubeState(this.dataBuffer.slice(offset, offset + 6));
                    this.emit('cubeState', cubeState);
                    offset += 6;
                } else {
                    break; // Wait for more data
                }
            } else if (this.dataBuffer[offset] === 0x02) {
                // Move data message
                if (this.dataBuffer.length >= offset + 4) {
                    const moveData = this.parseMoveData(this.dataBuffer.slice(offset, offset + 4));
                    this.emit('moveData', moveData);
                    offset += 4;
                } else {
                    break; // Wait for more data
                }
            } else if (this.dataBuffer[offset] === 0x03) {
                // Solve completion message
                if (this.dataBuffer.length >= offset + 8) {
                    const solveData = this.parseSolveCompletion(this.dataBuffer.slice(offset, offset + 8));
                    this.emit('solveComplete', solveData);
                    offset += 8;
                } else {
                    break; // Wait for more data
                }
            } else if (this.dataBuffer[offset] === 0x04) {
                // Gyroscope/orientation data
                if (this.dataBuffer.length >= offset + 12) {
                    const gyroData = this.parseGyroData(this.dataBuffer.slice(offset, offset + 12));
                    this.emit('gyroData', gyroData);
                    offset += 12;
                } else {
                    break; // Wait for more data
                }
            } else {
                // Unknown message type, skip byte
                offset++;
            }
        }

        // Keep remaining data in buffer
        if (offset > 0) {
            this.dataBuffer = this.dataBuffer.slice(offset);
        }
    }

    /**
     * Parse cube state data
     */
    parseCubeState(data) {
        return {
            type: 'cubeState',
            timestamp: Date.now(),
            scrambled: data[1] === 0x01,
            solved: data[2] === 0x01,
            battery: data[3],
            temperature: data[4]
        };
    }

    /**
     * Parse move data
     */
    parseMoveData(data) {
        // GAN cube move encoding
        const moveMap = {
            0x01: "U", 0x02: "U'", 0x03: "U2",
            0x04: "D", 0x05: "D'", 0x06: "D2",
            0x07: "R", 0x08: "R'", 0x09: "R2",
            0x0A: "L", 0x0B: "L'", 0x0C: "L2",
            0x0D: "F", 0x0E: "F'", 0x0F: "F2",
            0x10: "B", 0x11: "B'", 0x12: "B2"
        };

        return {
            type: 'move',
            timestamp: Date.now(),
            move: moveMap[data[1]] || 'Unknown',
            duration: (data[2] << 8) | data[3], // Duration in milliseconds
            raw: Array.from(data)
        };
    }

    /**
     * Parse solve completion data
     */
    parseSolveCompletion(data) {
        const totalTime = (data[1] << 24) | (data[2] << 16) | (data[3] << 8) | data[4];
        const moveCount = (data[5] << 8) | data[6];
        
        return {
            type: 'solveComplete',
            timestamp: Date.now(),
            totalTime: totalTime, // in milliseconds
            moveCount: moveCount,
            tps: moveCount / (totalTime / 1000),
            raw: Array.from(data)
        };
    }

    /**
     * Parse gyroscope/orientation data
     */
    parseGyroData(data) {
        const x = (data[1] << 8) | data[2];
        const y = (data[3] << 8) | data[4];
        const z = (data[5] << 8) | data[6];
        
        return {
            type: 'gyro',
            timestamp: Date.now(),
            x: x - 32768, // Convert from unsigned to signed
            y: y - 32768,
            z: z - 32768,
            raw: Array.from(data)
        };
    }

    /**
     * Get battery level
     */
    async getBatteryLevel() {
        if (!this.batteryCharacteristic) {
            return null;
        }

        try {
            const value = await this.batteryCharacteristic.readValue();
            return value.getUint8(0);
        } catch (error) {
            console.error('Failed to read battery level:', error);
            return null;
        }
    }

    /**
     * Disconnect from cube
     */
    async disconnect() {
        try {
            if (this.device && this.device.gatt.connected) {
                await this.device.gatt.disconnect();
            }
        } catch (error) {
            console.error('Disconnect error:', error);
        }
        
        this.handleDisconnection();
    }

    /**
     * Handle disconnection cleanup
     */
    handleDisconnection() {
        this.isConnected = false;
        this.device = null;
        this.server = null;
        this.service = null;
        this.rxCharacteristic = null;
        this.txCharacteristic = null;
        this.batteryService = null;
        this.batteryCharacteristic = null;
        this.dataBuffer = new Uint8Array(0);
        
        this.emit('disconnected');
    }

    /**
     * Utility function for delays
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Get connection status
     */
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            deviceName: this.device ? this.device.name : null,
            deviceId: this.device ? this.device.id : null
        };
    }
}

// Export for use in other modules
window.GANBluetooth = GANBluetooth;
