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
        
        // Move detection filtering
        this.lastDataTime = null;
        this.lastDataBytes = null;
        this.lastMovePacket = null;
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
            console.log('Initializing cube communication...');
            
            // Your cube model doesn't respond well to standard initialization commands
            // The cube is already sending data, so we'll skip initialization
            console.log('Skipping initialization commands for this cube model');
            
            // Just log that we're ready to receive data
            console.log('Cube ready to receive move data');
            
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
        const hexString = Array.from(data).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
        console.log('Received data:', hexString);
        console.log('Data length:', data.length, 'bytes');
        console.log('Raw bytes:', Array.from(data));

        // Emit raw data for debugging
        this.emit('rawData', {
            hex: hexString,
            bytes: Array.from(data),
            timestamp: Date.now()
        });

        // ANALYSIS MODE: Log all packets for scientific analysis
        // This helps us understand your cube's specific protocol
        if (window.CUBE_ANALYSIS_MODE) {
            console.log(`=== ANALYSIS PACKET ${Date.now()} ===`);
            console.log('Length:', data.length);
            console.log('Hex:', hexString);
            console.log('Decimal:', Array.from(data));
            console.log('Possible moves:', Array.from(data).map((byte, idx) => {
                const moveMap = {
                    0x01: "U", 0x02: "U'", 0x03: "U2",
                    0x04: "D", 0x05: "D'", 0x06: "D2",
                    0x07: "R", 0x08: "R'", 0x09: "R2",
                    0x0A: "L", 0x0B: "L'", 0x0C: "L2",
                    0x0D: "F", 0x0E: "F'", 0x0F: "F2",
                    0x10: "B", 0x11: "B'", 0x12: "B2"
                };
                return moveMap[byte] ? `pos${idx}:${moveMap[byte]}` : null;
            }).filter(Boolean));
            console.log('=== END PACKET ===');
        }

        // MOVE TEST MODE: Collect packets during specific move testing
        if (window.MOVE_TEST_MODE) {
            const timeSinceStart = Date.now() - window.MOVE_TEST_START;
            window.MOVE_TEST_PACKETS.push({
                timestamp: Date.now(),
                timeSinceStart: timeSinceStart,
                data: Array.from(data),
                hex: hexString
            });
            
            console.log(`🎯 TEST PACKET ${timeSinceStart}ms: ${hexString}`);
        }

        // Only try to parse moves if the data looks like it could be a move
        // Moves typically have specific patterns and are not sent continuously
        if (this.couldBeMove(data)) {
            const moveData = this.parseRawMoveData(data);
            if (moveData) {
                this.emit('moveData', moveData);
            }
        } else {
            console.log('Data appears to be status/heartbeat, not a move');
        }

        // Also keep the original buffer parsing for other message types
        const newBuffer = new Uint8Array(this.dataBuffer.length + data.length);
        newBuffer.set(this.dataBuffer);
        newBuffer.set(data, this.dataBuffer.length);
        this.dataBuffer = newBuffer;

        // Try to parse complete messages
        this.parseDataBuffer();
    }

    /**
     * Check if data could potentially be a move
     */
    couldBeMove(data) {
        // Filter out obvious non-move patterns
        
        // 1. Too frequent data (moves don't happen every second)
        const now = Date.now();
        if (this.lastDataTime && (now - this.lastDataTime) < 200) {
            // Data coming too frequently (less than 200ms apart) is likely status
            console.log('Data too frequent, likely status data');
            this.lastDataTime = now;
            return false;
        }
        this.lastDataTime = now;
        
        // 2. Check for repetitive patterns (status data often repeats)
        if (this.lastDataBytes && this.arraysEqual(data, this.lastDataBytes)) {
            console.log('Identical to last data, likely status');
            return false;
        }
        
        // 3. Very small data packets are often status
        if (data.length < 3) {
            console.log('Data too small for move');
            return false;
        }
        
        // 4. Check for known status patterns (these are common in GAN cubes)
        const statusPatterns = [
            [0x00, 0x00], // Common heartbeat
            [0xFF, 0xFF], // Another status pattern
            [0x01, 0x00], // Status update
            [0x02, 0x00], // Battery status
        ];
        
        for (const pattern of statusPatterns) {
            if (data.length >= pattern.length) {
                let matches = true;
                for (let i = 0; i < pattern.length; i++) {
                    if (data[i] !== pattern[i]) {
                        matches = false;
                        break;
                    }
                }
                if (matches) {
                    console.log('Matches known status pattern');
                    return false;
                }
            }
        }
        
        // 5. Save this data for comparison
        this.lastDataBytes = new Uint8Array(data);
        
        // If it passes all filters, it might be a move
        console.log('Data passed move filters, analyzing...');
        return true;
    }

    /**
     * Helper function to compare arrays
     */
    arraysEqual(a, b) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (a[i] !== b[i]) return false;
        }
        return true;
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
                // Solve completion message - DISABLED for your cube
                // Your cube seems to send different solve completion data that's invalid
                console.log('Skipping solve completion parsing for this cube model');
                offset++;
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
     * Parse raw move data with pattern change analysis
     */
    parseRawMoveData(data) {
        console.log('Attempting to parse move from data:', Array.from(data));
        
        if (data.length === 20) {
            console.log('Analyzing 20-byte packet for move encoding...');
            
            // Calculate packet signature for pattern analysis
            const packetSignature = this.calculatePacketSignature(data);
            const hexString = Array.from(data).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' ');
            
            // Store this packet for pattern analysis
            if (!this.lastMovePacket) {
                console.log('Storing first packet as baseline for comparison');
                this.lastMovePacket = {
                    data: new Uint8Array(data),
                    signature: packetSignature,
                    timestamp: Date.now()
                };
                return null;
            }
            
            // Compare with last packet to detect changes
            const timeSinceLastPacket = Date.now() - this.lastMovePacket.timestamp;
            const isDifferentPacket = !this.arraysEqual(data, this.lastMovePacket.data);
            
            if (isDifferentPacket && timeSinceLastPacket > 300) {
                console.log('🎯 PACKET CHANGE DETECTED - Possible move!');
                console.log('Previous packet:', Array.from(this.lastMovePacket.data).map(b => '0x' + b.toString(16).padStart(2, '0')).join(' '));
                console.log('Current packet: ', hexString);
                console.log('Time since last:', timeSinceLastPacket + 'ms');
                
                // Analyze the differences
                const differences = this.analyzePacketDifferences(this.lastMovePacket.data, data);
                console.log('Packet differences:', differences);
                
                // Try to decode the move from packet structure changes
                const possibleMove = this.decodeMoveFromPacketChange(this.lastMovePacket, {
                    data: new Uint8Array(data),
                    signature: packetSignature,
                    timestamp: Date.now()
                });
                
                // Update last packet
                this.lastMovePacket = {
                    data: new Uint8Array(data),
                    signature: packetSignature,
                    timestamp: Date.now()
                };
                
                if (possibleMove) {
                    console.log('✅ MOVE DECODED:', possibleMove);
                    return {
                        type: 'move',
                        move: possibleMove.move,
                        confidence: possibleMove.confidence,
                        timestamp: Date.now(),
                        packetChange: differences,
                        raw: Array.from(data)
                    };
                }
            } else if (isDifferentPacket) {
                console.log('Packet changed but too soon after last change, likely noise');
            }
            
            return null;
        }
        
        console.log('Non-standard packet length, skipping analysis');
        return null;
    }

    /**
     * Calculate a signature for the packet to detect patterns
     */
    calculatePacketSignature(data) {
        // Calculate various signatures that might indicate move encoding
        const sum = data.reduce((a, b) => a + b, 0);
        const xor = data.reduce((a, b) => a ^ b, 0);
        const first4 = Array.from(data.slice(0, 4));
        const last4 = Array.from(data.slice(-4));
        
        return {
            sum: sum,
            xor: xor,
            checksum: sum % 256,
            first4: first4,
            last4: last4,
            length: data.length
        };
    }

    /**
     * Analyze differences between two packets
     */
    analyzePacketDifferences(packet1, packet2) {
        const differences = [];
        const significantChanges = [];
        
        for (let i = 0; i < Math.min(packet1.length, packet2.length); i++) {
            if (packet1[i] !== packet2[i]) {
                const change = {
                    position: i,
                    from: packet1[i],
                    to: packet2[i],
                    fromHex: '0x' + packet1[i].toString(16).padStart(2, '0'),
                    toHex: '0x' + packet2[i].toString(16).padStart(2, '0'),
                    delta: packet2[i] - packet1[i]
                };
                differences.push(change);
                
                // Mark significant changes (large deltas might indicate move encoding)
                if (Math.abs(change.delta) > 16) {
                    significantChanges.push(change);
                }
            }
        }
        
        return {
            totalChanges: differences.length,
            changes: differences,
            significantChanges: significantChanges,
            changePositions: differences.map(d => d.position)
        };
    }

    /**
     * Attempt to decode move from packet structure change
     */
    decodeMoveFromPacketChange(previousPacket, currentPacket) {
        // Analyze the pattern of changes between packets
        const differences = this.analyzePacketDifferences(previousPacket.data, currentPacket.data);
        
        // Based on your move test data, I can see patterns:
        // The cube changes multiple bytes when a move is made
        // Let's start with basic pattern recognition
        
        if (differences.totalChanges === 0) {
            return null; // No change, no move
        }
        
        console.log('Analyzing packet change pattern for move detection...');
        console.log('Changes detected:', differences.totalChanges, 'positions:', differences.changePositions);
        
        // For now, let's use a simple heuristic based on the test data:
        // Moves seem to cause significant changes in multiple positions
        
        if (differences.totalChanges >= 3 && differences.significantChanges.length >= 1) {
            // This looks like a real move
            // Try to determine which move based on the pattern
            
            // Analyze the checksum/signature changes
            const checksumDelta = currentPacket.signature.checksum - previousPacket.signature.checksum;
            const xorDelta = currentPacket.signature.xor - previousPacket.signature.xor;
            
            console.log('Signature analysis:', {
                checksumDelta: checksumDelta,
                xorDelta: xorDelta,
                sumDelta: currentPacket.signature.sum - previousPacket.signature.sum
            });
            
            // For testing, let's try to map patterns to moves
            // This is where we'd implement the actual decoding logic
            // based on more data collection
            
            const move = this.guessMoveFromPattern(differences, previousPacket.signature, currentPacket.signature);
            
            return {
                move: move || 'Unknown',
                confidence: move ? 0.7 : 0.3,
                pattern: differences,
                signatureChange: {
                    checksumDelta: checksumDelta,
                    xorDelta: xorDelta
                }
            };
        }
        
        console.log('Pattern does not match move criteria');
        return null;
    }

    /**
     * Attempt to guess move from change pattern
     * This is where the machine learning/pattern recognition would go
     */
    guessMoveFromPattern(differences, previousSig, currentSig) {
        // This is a placeholder for move pattern recognition
        // In a full implementation, this would use machine learning
        // or lookup tables built from extensive data collection
        
        const checksumDelta = currentSig.checksum - previousSig.checksum;
        const changeCount = differences.totalChanges;
        const firstChangePos = differences.changes[0]?.position || -1;
        
        console.log('Move pattern analysis:', {
            changeCount: changeCount,
            checksumDelta: checksumDelta,
            firstChangePos: firstChangePos
        });
        
        // Placeholder logic - this would be replaced with real decoding
        // based on pattern analysis from your move test data
        
        // For demonstration, let's return a basic move detection
        if (changeCount >= 5) {
            return 'U'; // Face moves might cause more changes
        } else if (changeCount >= 3) {
            return 'U\''; // Different move types might have different patterns
        }
        
        return null; // Unable to determine move
    }

    /**
     * Calculate entropy (randomness) of data
     */
    calculateDataEntropy(data) {
        const frequency = new Array(256).fill(0);
        const len = data.length;
        
        // Count byte frequencies
        for (let i = 0; i < len; i++) {
            frequency[data[i]]++;
        }
        
        // Calculate entropy
        let entropy = 0;
        for (let i = 0; i < 256; i++) {
            if (frequency[i] > 0) {
                const p = frequency[i] / len;
                entropy -= p * Math.log2(p);
            }
        }
        
        return entropy / 8; // Normalize to 0-1 range
    }

    /**
     * Check if data has recognizable structure
     */
    hasDataStructure(data) {
        // Look for patterns that suggest structured data
        const hasRepeatedBytes = data.some((byte, i) => 
            i > 0 && byte === data[i-1] && byte === data[i+1]
        );
        
        const hasZeroBytes = data.some(byte => byte === 0x00);
        const hasLowBytes = data.filter(byte => byte < 0x10).length > 2;
        
        return hasRepeatedBytes || hasZeroBytes || hasLowBytes;
    }

    /**
     * Analyze context around a potential move
     */
    analyzeMoveContext(data, position) {
        const before = position > 0 ? data[position - 1] : null;
        const after = position < data.length - 1 ? data[position + 1] : null;
        
        return {
            before: before ? '0x' + before.toString(16).padStart(2, '0') : null,
            after: after ? '0x' + after.toString(16).padStart(2, '0') : null,
            surroundingPattern: data.slice(Math.max(0, position - 2), Math.min(data.length, position + 3))
        };
    }

    /**
     * Validate that a move found in a packet is legitimate
     */
    validateMoveInPacket(data, movePosition) {
        // For your cube's 20-byte packets, we need to determine which positions
        // are likely to contain actual moves vs coincidental data
        
        // Based on the console output, moves appear at positions like 3, 6, 12, 14, 16, 18
        // This suggests the move might be at different positions depending on some encoding
        
        const moveByte = data[movePosition];
        
        // Basic validation: ensure it's in the valid move range
        if (moveByte < 0x01 || moveByte > 0x12) {
            return false;
        }
        
        // For now, let's accept moves at any position but add some heuristics
        // We could add more validation here once we understand the pattern better
        
        // Check if surrounding bytes make sense for a move packet
        // (This is where we'd add cube-specific validation)
        
        console.log(`Validating move 0x${moveByte.toString(16)} at position ${movePosition}`);
        return true; // For now, accept all moves in valid range
    }

    /**
     * Validate that a detected move has reasonable context
     */
    validateMoveContext(data, movePosition) {
        // Move should not be at the very start of a status message
        if (movePosition === 0 && data.length > 1) {
            // Check if the rest looks like status data
            const remaining = data.slice(1);
            const allZeros = remaining.every(b => b === 0x00);
            const allSame = remaining.every(b => b === remaining[0]);
            
            if (allZeros || allSame) {
                console.log('Move appears to be part of status data');
                return false;
            }
        }
        
        // Additional context checks can be added here
        return true;
    }

    /**
     * Validate face-based move context
     */
    validateFaceMoveContext(data) {
        // Face moves should have specific patterns
        // This is where we can add cube-specific validation
        
        // For now, be more restrictive
        if (data.length === 2) {
            // Simple 2-byte face moves are more likely to be real
            return true;
        }
        
        // Longer packets might be status with coincidental face patterns
        console.log('Face move in longer packet, might be status');
        return false;
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
        
        // Reset move detection filtering
        this.lastDataTime = null;
        this.lastDataBytes = null;
        this.lastMovePacket = null;
        
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
