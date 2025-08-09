# GAN Cube Coach AI

A modern web application that connects to GAN 356i Carry smart cubes via Bluetooth to provide detailed solve analysis and coaching feedback.

## Features

### 🔗 Bluetooth Connectivity
- Connect to GAN 356i Carry cube via Web Bluetooth API
- Real-time move tracking and cube state monitoring
- Battery level monitoring
- Automatic connection status updates

### ⏱️ Precision Timing
- High-precision solve timer (60 FPS updates)
- Manual and automatic timer controls
- Automatic start/stop based on cube state
- Split timing for phase analysis

### 📊 Solve Analysis
- Automatic phase detection (Cross, F2L, OLL, PLL)
- Move counting and timing for each phase
- Algorithm recognition for OLL/PLL
- TPS (Turns Per Second) calculation

### 📱 Modern UI
- Clean, responsive design
- Editable fields for manual corrections
- Real-time data visualization
- Mobile-friendly interface

### 🚀 Export for AI Coaching
- Generate detailed solve summaries
- Optimized format for ChatGPT analysis
- One-click copy to clipboard
- Comprehensive performance breakdown

## Browser Requirements

This application requires a browser that supports the Web Bluetooth API:
- **Chrome 56+** (recommended)
- **Edge 79+**
- **Opera 43+**

**Note**: Firefox and Safari do not currently support Web Bluetooth API.

## Getting Started

1. **Clone or download** this repository
2. **Open `index.html`** in a supported browser
3. **Click "Connect Cube"** to pair with your GAN 356i Carry
4. **Start solving** - the timer can start automatically or manually
5. **Generate summary** for detailed analysis and coaching feedback

## How to Use

### Initial Setup
1. Ensure your GAN 356i Carry cube is charged and in pairing mode
2. Open the application in Chrome or Edge
3. Click "Connect Cube" and select your device from the browser dialog

### Recording Solves
1. **Automatic Mode**: Timer starts when you make the first move and stops when solved
2. **Manual Mode**: Use the timer controls to start/stop manually
3. **Edit Data**: Manually adjust any timing or move data as needed

### Getting AI Feedback
1. Complete a solve (automatically parsed or manually entered)
2. Click "Generate Summary" to create analysis text
3. Click "Copy to Clipboard" 
4. Paste into ChatGPT with a request like: "Please analyze this speedcube solve and provide improvement suggestions"

## Technical Architecture

### Core Modules

- **`gan-bluetooth.js`**: Handles Web Bluetooth API communication with GAN cube
- **`solve-parser.js`**: Analyzes move sequences to detect solve phases
- **`timer.js`**: Provides high-precision timing functionality
- **`app.js`**: Main application controller coordinating all modules

### Data Flow

1. **Cube Connection**: Establishes BLE connection and starts listening for data
2. **Move Detection**: Parses incoming move data and timestamps
3. **Phase Analysis**: Identifies Cross, F2L, OLL, and PLL phases
4. **Timer Coordination**: Syncs timing with cube state and moves
5. **Export Generation**: Creates formatted analysis for AI coaching

## Development

### File Structure
```
cubecoachAI/
├── index.html          # Main application page
├── styles.css          # Application styling
├── app.js             # Main application controller
├── gan-bluetooth.js   # Bluetooth communication
├── solve-parser.js    # Solve analysis engine
├── timer.js          # Precision timing
└── README.md         # This file
```

### Key Features Implemented

✅ **Bluetooth Connection**: Full Web Bluetooth API integration
✅ **Real-time Data**: Live move tracking and cube state monitoring  
✅ **Phase Detection**: Automatic Cross, F2L, OLL, PLL identification
✅ **Precision Timing**: 60 FPS timer updates with millisecond accuracy
✅ **Algorithm Recognition**: OLL/PLL pattern matching
✅ **Export Functionality**: ChatGPT-optimized analysis format
✅ **Responsive Design**: Mobile and desktop support
✅ **Manual Override**: Editable fields for data correction

### Cube Protocol

The application implements the standard GAN cube BLE protocol:
- **Service UUID**: `6e400001-b5a3-f393-e0a9-e50e24dcca9e`
- **TX Characteristic**: `6e400003-b5a3-f393-e0a9-e50e24dcca9e` (notifications from cube)
- **RX Characteristic**: `6e400002-b5a3-f393-e0a9-e50e24dcca9e` (commands to cube)

## Troubleshooting

### Common Issues

**"Web Bluetooth not supported"**
- Use Chrome 56+, Edge 79+, or Opera 43+
- Ensure HTTPS connection (required for Web Bluetooth)

**"Cube not found"**
- Make sure cube is charged and awake
- Try shaking the cube to activate it
- Check that cube is not connected to another app

**"Connection lost"**
- Cube may have gone to sleep
- Try reconnecting through the app
- Check cube battery level

**Timer not starting automatically**
- Ensure cube is properly connected
- Try manual timer controls
- Check browser console for error messages

## Future Enhancements

- **Session Statistics**: Track multiple solves and progression
- **Algorithm Trainer**: Practice specific OLL/PLL cases
- **Competition Mode**: Official WCA timing standards
- **Cloud Sync**: Save and share solve data
- **Video Integration**: Sync with solve recordings

## Contributing

This is an open-source project. Feel free to submit issues, suggestions, or pull requests to improve the application.

## License

MIT License - feel free to use and modify for your own projects.

---

**Happy Cubing! 🎲**
