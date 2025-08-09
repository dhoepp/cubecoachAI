<!-- Use this file to provide workspace-specific custom instructions to Copilot. For more details, visit https://code.visualstudio.com/docs/copilot/copilot-customization#_use-a-githubcopilotinstructionsmd-file -->

This is a JavaScript web application for connecting to GAN 356i Carry smart cubes via Bluetooth Low Energy (BLE) using the Web Bluetooth API.

## Project Context

- Pure JavaScript/HTML/CSS application (no frameworks)
- Connects to GAN cube via Web Bluetooth API
- Parses cube move data and timing information
- Analyzes solve phases (Cross, F2L, OLL, PLL)
- Provides detailed solve summaries for ChatGPT analysis

## Key Components

- `gan-bluetooth.js`: Bluetooth connection and data parsing
- `solve-parser.js`: Cube solve analysis and phase detection
- `timer.js`: Precise timing functionality
- `app.js`: Main application coordination
- `index.html`: UI structure
- `styles.css`: Modern responsive styling

## Technical Notes

- Uses Web Bluetooth API (Chrome/Edge required)
- Implements GAN cube BLE protocol
- Real-time move tracking and phase analysis
- Export functionality for AI coaching feedback
- Responsive design for mobile/desktop use

## Code Style

- ES6+ JavaScript with classes
- Modular architecture with event-driven communication
- Clean, semantic HTML structure
- CSS Grid and Flexbox for layout
- Mobile-first responsive design
