/**
 * GAN Bluetooth Module
 * Handles Bluetooth Low Energy connection to GAN 356i Carry cube
 */
class GANBluetooth {
    constructor() {
        // GAN cube service and characteristic UUIDs (multiple variants for different models)
        this.SERVICE_UUIDS = [
            '00000010-0000-fff7-fff6-fff5fff4fff0', // YOUR CUBE'S PRIMARY SERVICE
            '0000fee0-0000-1000-8000-00805f9b34fb', // YOUR CUBE'S SECONDARY SERVICE
            '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Primary GAN service
            '0000ae30-0000-1000-8000-00805f9b34fb', // Alternative GAN service
            '0000ae42-0000-1000-8000-00805f9b34fb', // Another variant
            '0000fff0-0000-1000-8000-00805f9b34fb', // Generic cube service
            '0000fe59-0000-1000-8000-00805f9b34fb', // GAN 356i specific
            '28be4a4a-cd67-11e9-a32f-2a2ae2dbcce4', // Another GAN variant
            '28be4cb6-cd67-11e9-a32f-2a2ae2dbcce4'  // GAN 356i Carry
        ];
        
        this.CHARACTERISTIC_UUIDS_RX = [
            '6e400002-b5a3-f393-e0a9-e50e24dcca9e', // Primary RX
            '0000ae31-0000-1000-8000-00805f9b34fb', // Alternative RX
            '0000fff1-0000-1000-8000-00805f9b34fb', // Generic RX
            '28be4a4b-cd67-11e9-a32f-2a2ae2dbcce4', // GAN 356i RX
            '28be4cb7-cd67-11e9-a32f-2a2ae2dbcce4'  // GAN 356i Carry RX
        ];
        
        this.CHARACTERISTIC_UUIDS_TX = [
            '6e400003-b5a3-f393-e0a9-e50e24dcca9e', // Primary TX
            '0000ae32-0000-1000-8000-00805f9b34fb', // Alternative TX
            '0000fff2-0000-1000-8000-00805f9b34fb', // Generic TX
            '28be4a4c-cd67-11e9-a32f-2a2ae2dbcce4', // GAN 356i TX
            '28be4cb8-cd67-11e9-a32f-2a2ae2dbcce4'  // GAN 356i Carry TX
        ];
        
        this.BATTERY_SERVICE_UUID = '0000180f-0000-1000-8000-00805f9b34fb';
        this.BATTERY_CHARACTERISTIC_UUID = '00002a19-0000-1000-8000-00805f9b34fb';
        
        // Active UUIDs (will be set during connection)
        this.activeServiceUUID = null;
        this.activeRxUUID = null;
        this.activeTxUUID = null;
        
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
            
            // Try connecting by MAC address first (most direct approach)
            try {
                console.log('Trying to connect by MAC address: F8:95:4A:72:97:CC...');
                this.device = await navigator.bluetooth.requestDevice({
                    filters: [
                        { 
                            deviceId: 'F8:95:4A:72:97:CC'
                        }
                    ],
                    optionalServices: [
                        '00000010-0000-fff7-fff6-fff5fff4fff0', // YOUR CUBE'S PRIMARY SERVICE
                        '0000fee0-0000-1000-8000-00805f9b34fb', // YOUR CUBE'S SECONDARY SERVICE
                        ...this.SERVICE_UUIDS,
                        this.BATTERY_SERVICE_UUID,
                        '0000180a-0000-1000-8000-00805f9b34fb', // Device Information
                        '0000180f-0000-1000-8000-00805f9b34fb', // Battery Service
                        '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
                        '00001801-0000-1000-8000-00805f9b34fb'  // Generic Attribute
                    ]
                });
                console.log('Connected via MAC address successfully!');
            } catch (macError) {
                console.log('MAC address connection failed:', macError.message);
                
                // Try the most permissive approach
                try {
                    console.log('Trying permissive device request...');
                    this.device = await navigator.bluetooth.requestDevice({
                        acceptAllDevices: true,
                        optionalServices: [
                            ...this.SERVICE_UUIDS,
                            this.BATTERY_SERVICE_UUID,
                            '0000180a-0000-1000-8000-00805f9b34fb', // Device Information
                            '0000180f-0000-1000-8000-00805f9b34fb', // Battery Service
                            '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
                            '00001801-0000-1000-8000-00805f9b34fb'  // Generic Attribute
                        ]
                    });
                } catch (error) {
                    console.log('Permissive request failed, trying with specific services...');
                    // Try with specific services
                    try {
                        this.device = await navigator.bluetooth.requestDevice({
                            filters: [
                                { namePrefix: 'GAN' },
                                { namePrefix: 'Gan' },
                                { namePrefix: 'MG' }, // Some GAN cubes show as MG
                                { namePrefix: 'i' }   // Some show as just 'i'
                            ],
                            optionalServices: [
                                ...this.SERVICE_UUIDS,
                                this.BATTERY_SERVICE_UUID,
                                '0000180a-0000-1000-8000-00805f9b34fb', // Device Information
                                '0000180f-0000-1000-8000-00805f9b34fb', // Battery Service
                                '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
                                '00001801-0000-1000-8000-00805f9b34fb'  // Generic Attribute
                            ]
                        });
                    } catch (error2) {
                        console.log('Specific service request failed, trying broader approach...');
                        // Fallback: request device without specific services
                        this.device = await navigator.bluetooth.requestDevice({
                            filters: [
                                { namePrefix: 'GAN' },
                                { namePrefix: 'Gan' },
                                { namePrefix: 'MG' },
                                { namePrefix: 'i' }
                            ],
                            acceptAllDevices: false
                        });
                    }
                }
            }

            console.log('Device selected:', this.device.name, this.device.id);
            console.log('Device info:', {
                name: this.device.name,
                id: this.device.id,
                gatt: this.device.gatt ? 'available' : 'not available'
            });
            
            console.log('Connecting to GATT server...');
            this.server = await this.device.gatt.connect();
            console.log('GATT server connected:', this.server.connected);
            
            // Debug the GATT server properties
            console.log('GATT server debug info:', {
                connected: this.server.connected,
                device: this.server.device ? this.server.device.name : 'null'
            });
            
            // Give the device some time to initialize services
            console.log('Waiting for device initialization...');
            await this.sleep(3000); // Increased to 3 seconds
            
            console.log('Discovering services...');
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
     * Discover and connect to available services
     */
    async discoverServices() {
        console.log('Getting available services...');
        
        // Sometimes services aren't immediately available, so we'll retry
        let services = [];
        let retryCount = 0;
        const maxRetries = 5;
        
        while (services.length === 0 && retryCount < maxRetries) {
            try {
                if (retryCount > 0) {
                    console.log(`Retry ${retryCount}: Waiting before service discovery...`);
                    await this.sleep(1000); // Wait 1 second between retries
                }
                
                services = await this.server.getPrimaryServices();
                console.log(`Attempt ${retryCount + 1}: Found ${services.length} services`);
                
                if (services.length > 0) {
                    console.log('Available services:', services.map(s => s.uuid));
                    break;
                }
            } catch (error) {
                console.error(`Attempt ${retryCount + 1} - Error getting services:`, error);
                
                if (retryCount === maxRetries - 1) {
                    // On final retry, try individual service discovery
                    console.log('Final attempt: Trying individual service discovery...');
                    for (const serviceUUID of this.SERVICE_UUIDS) {
                        try {
                            const service = await this.server.getPrimaryService(serviceUUID);
                            services.push(service);
                            console.log('Found individual service:', serviceUUID);
                        } catch (e) {
                            console.log('Service not found:', serviceUUID);
                        }
                    }
                    
                    // Also try common services
                    const commonServices = [
                        '0000180f-0000-1000-8000-00805f9b34fb', // Battery
                        '0000180a-0000-1000-8000-00805f9b34fb', // Device Information
                        '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
                        '00001801-0000-1000-8000-00805f9b34fb', // Generic Attribute
                    ];
                    
                    for (const uuid of commonServices) {
                        try {
                            const service = await this.server.getPrimaryService(uuid);
                            services.push(service);
                            console.log('Found common service:', uuid);
                        } catch (e) {
                            // Service not available
                        }
                    }
                }
            }
            retryCount++;
        }
        
        console.log('Total services discovered:', services.length);
        
        // If we still have no services, try a completely different approach
        if (services.length === 0) {
            console.log('No services found with standard methods. Trying direct UUID access...');
            
            // Try to access services directly by UUID without enumeration
            const directServiceUUIDs = [
                // All our known UUIDs plus some additional ones
                ...this.SERVICE_UUIDS,
                '0000180f-0000-1000-8000-00805f9b34fb', // Battery
                '0000180a-0000-1000-8000-00805f9b34fb', // Device Information
                '00001800-0000-1000-8000-00805f9b34fb', // Generic Access
                '00001801-0000-1000-8000-00805f9b34fb', // Generic Attribute
                // Additional GAN-specific UUIDs found in research
                '0000ffe0-0000-1000-8000-00805f9b34fb',
                '0000ffe5-0000-1000-8000-00805f9b34fb',
                '49535343-fe7d-4ae5-8fa9-9fafd205e455', // Another common cube UUID
                '6e400001-b5a3-f393-e0a9-e50e24dcca9e'  // Nordic UART
            ];
            
            for (const uuid of directServiceUUIDs) {
                try {
                    console.log(`Trying direct access to service: ${uuid}`);
                    const service = await this.server.getPrimaryService(uuid);
                    if (service) {
                        services.push(service);
                        console.log(`✓ Direct access successful for: ${uuid}`);
                        
                        // Try to get characteristics immediately
                        try {
                            const chars = await service.getCharacteristics();
                            console.log(`Service ${uuid} has ${chars.length} characteristics:`, chars.map(c => c.uuid));
                        } catch (charError) {
                            console.log(`Could not get characteristics for ${uuid}:`, charError);
                        }
                    }
                } catch (e) {
                    // Service not available, continue
                }
            }
            
            console.log(`Direct access found ${services.length} services`);
        }
        
        // Try to find the main cube service
        let cubeService = null;
        for (const serviceUUID of this.SERVICE_UUIDS) {
            try {
                cubeService = await this.server.getPrimaryService(serviceUUID);
                this.activeServiceUUID = serviceUUID;
                console.log('Found cube service:', serviceUUID);
                break;
            } catch (error) {
                console.log('Service not found:', serviceUUID);
            }
        }

        if (!cubeService) {
            console.log('No known cube service found, analyzing available services...');
            // If no known service found, try to use any available service that might be the cube
            for (const service of services) {
                try {
                    console.log(`Checking service ${service.uuid} for characteristics...`);
                    const characteristics = await service.getCharacteristics();
                    console.log(`Service ${service.uuid} has ${characteristics.length} characteristics:`, 
                               characteristics.map(c => c.uuid));
                    
                    // Look for services with write and notify characteristics (typical for cubes)
                    let hasWrite = false;
                    let hasNotify = false;
                    
                    for (const char of characteristics) {
                        const props = char.properties;
                        if (props.write || props.writeWithoutResponse) hasWrite = true;
                        if (props.notify) hasNotify = true;
                    }
                    
                    if (hasWrite && hasNotify && characteristics.length >= 2) {
                        cubeService = service;
                        this.activeServiceUUID = service.uuid;
                        console.log('Using detected cube service:', service.uuid);
                        break;
                    }
                } catch (error) {
                    console.warn('Error checking service:', service.uuid, error);
                }
            }
        }

        if (!cubeService && services.length > 0) {
            // Last resort - use the first available service
            console.log('Using first available service as fallback...');
            cubeService = services[0];
            this.activeServiceUUID = cubeService.uuid;
            console.log('Using fallback service:', cubeService.uuid);
        }

        if (!cubeService) {
            throw new Error('No compatible cube service found. Device may not be a supported GAN cube or may need to be reset.');
        }

        this.service = cubeService;

        // Get characteristics
        console.log('Getting characteristics...');
        const characteristics = await cubeService.getCharacteristics();
        console.log('Available characteristics:', characteristics.map(c => c.uuid));

        // Try to find RX characteristic (write to cube)
        for (const rxUUID of this.CHARACTERISTIC_UUIDS_RX) {
            try {
                this.rxCharacteristic = await cubeService.getCharacteristic(rxUUID);
                this.activeRxUUID = rxUUID;
                console.log('Found RX characteristic:', rxUUID);
                break;
            } catch (error) {
                console.log('RX characteristic not found:', rxUUID);
            }
        }

        // Try to find TX characteristic (read from cube)
        for (const txUUID of this.CHARACTERISTIC_UUIDS_TX) {
            try {
                this.txCharacteristic = await cubeService.getCharacteristic(txUUID);
                this.activeTxUUID = txUUID;
                console.log('Found TX characteristic:', txUUID);
                break;
            } catch (error) {
                console.log('TX characteristic not found:', txUUID);
            }
        }

        // If we couldn't find specific characteristics, try to auto-detect them
        if (!this.rxCharacteristic || !this.txCharacteristic) {
            console.log('Auto-detecting characteristics...');
            for (const char of characteristics) {
                const properties = char.properties;
                console.log(`Characteristic ${char.uuid} properties:`, {
                    read: properties.read,
                    write: properties.write,
                    writeWithoutResponse: properties.writeWithoutResponse,
                    notify: properties.notify,
                    indicate: properties.indicate
                });
                
                // RX characteristic typically supports write
                if (!this.rxCharacteristic && (properties.write || properties.writeWithoutResponse)) {
                    this.rxCharacteristic = char;
                    this.activeRxUUID = char.uuid;
                    console.log('Auto-detected RX characteristic:', char.uuid);
                }
                
                // TX characteristic typically supports notify
                if (!this.txCharacteristic && properties.notify) {
                    this.txCharacteristic = char;
                    this.activeTxUUID = char.uuid;
                    console.log('Auto-detected TX characteristic:', char.uuid);
                }
            }
        }

        if (!this.rxCharacteristic && !this.txCharacteristic) {
            console.warn('Could not find ideal characteristics. Trying to use any available characteristics...');
            // Last resort - use any characteristics we can find
            if (characteristics.length > 0) {
                if (!this.rxCharacteristic) {
                    this.rxCharacteristic = characteristics[0];
                    this.activeRxUUID = characteristics[0].uuid;
                    console.log('Using first characteristic as RX:', characteristics[0].uuid);
                }
                if (!this.txCharacteristic && characteristics.length > 1) {
                    this.txCharacteristic = characteristics[1];
                    this.activeTxUUID = characteristics[1].uuid;
                    console.log('Using second characteristic as TX:', characteristics[1].uuid);
                }
            }
        }

        // Setup notifications for data from cube (if TX characteristic is available)
        if (this.txCharacteristic) {
            try {
                await this.txCharacteristic.startNotifications();
                this.txCharacteristic.addEventListener('characteristicvaluechanged', (event) => {
                    this.handleDataReceived(event.target.value);
                });
                console.log('Notifications enabled for TX characteristic');
            } catch (error) {
                console.warn('Could not enable notifications:', error);
            }
        }

        // Try to get battery service (optional)
        try {
            this.batteryService = await this.server.getPrimaryService(this.BATTERY_SERVICE_UUID);
            this.batteryCharacteristic = await this.batteryService.getCharacteristic(this.BATTERY_CHARACTERISTIC_UUID);
            console.log('Battery service connected');
        } catch (error) {
            console.warn('Battery service not available:', error);
        }
    }

    /**
     * Initialize cube communication
     */
    async initializeCube() {
        try {
            // Send initialization commands to enable solve data transmission
            // These are typical GAN cube initialization commands
            if (this.rxCharacteristic) {
                await this.sendCommand([0x01, 0x02]); // Enable notifications
                await this.sleep(100);
                await this.sendCommand([0x02, 0x01]); // Request cube state
                await this.sleep(100);
                await this.sendCommand([0x03, 0x01]); // Enable solve data
            }
        } catch (error) {
            console.warn('Cube initialization warning:', error);
        }
    }

    /**
     * Reset cube to factory settings (if connected)
     */
    async resetCube() {
        try {
            if (!this.isConnected || !this.rxCharacteristic) {
                console.warn('Cannot reset: not connected');
                return false;
            }

            console.log('Attempting to reset cube...');
            
            // Try various reset commands
            await this.sendCommand([0xFF, 0xFF]); // Generic reset
            await this.sleep(200);
            await this.sendCommand([0x00, 0x00]); // Clear state
            await this.sleep(200);
            await this.sendCommand([0x05, 0x00]); // Factory reset
            await this.sleep(200);
            
            console.log('Reset commands sent');
            return true;
        } catch (error) {
            console.error('Failed to reset cube:', error);
            return false;
        }
    }

    /**
     * Send command to cube
     */
    async sendCommand(data) {
        if (!this.isConnected || !this.rxCharacteristic) {
            console.warn('Cannot send command: not connected or no RX characteristic');
            return;
        }

        try {
            const buffer = new Uint8Array(data);
            await this.rxCharacteristic.writeValue(buffer);
            console.log('Sent command:', Array.from(data).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
        } catch (error) {
            console.warn('Failed to send command:', error);
        }
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
        this.activeServiceUUID = null;
        this.activeRxUUID = null;
        this.activeTxUUID = null;
        
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
            deviceId: this.device ? this.device.id : null,
            activeServiceUUID: this.activeServiceUUID,
            activeRxUUID: this.activeRxUUID,
            activeTxUUID: this.activeTxUUID
        };
    }
}

// Export for use in other modules
window.GANBluetooth = GANBluetooth;
