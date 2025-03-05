// main.js - Modified for mobile and touch support

document.addEventListener('DOMContentLoaded', function() {
    // Create canvas with proper size for responsive design
    const canvas = document.getElementById('hexCanvas');
    const grid = new HexGrid(canvas);

    // Add zoom controls to the canvas container
    addZoomControls();

    // Movement mode
    document.getElementById('move-mode').addEventListener('click', function() {
        grid.mode = 'move';
        grid.selectedStone = null;
        grid.breakMode = false; // Exit break mode
        document.getElementById('stone-selector').style.display = 'none';
        document.getElementById('move-mode').classList.add('active');
        document.getElementById('place-mode').classList.remove('active');
        document.getElementById('break-mode').classList.remove('active');
        document.querySelectorAll('.stone-button').forEach(b => {
            b.classList.remove('selected');
        });
        grid.movementSystem.calculateMovableHexes();
        grid.updateStatus('Movement mode active. Click or tap a highlighted hex to move.');
        grid.renderSystem.render();
    });

    // Placement mode
    document.getElementById('place-mode').addEventListener('click', function() {
        grid.mode = 'place';
        grid.breakMode = false; // Exit break mode
        document.getElementById('stone-selector').style.display = 'flex';
        document.getElementById('move-mode').classList.remove('active');
        document.getElementById('place-mode').classList.add('active');
        document.getElementById('break-mode').classList.remove('active');
        grid.updateStatus('Stone placement mode active. Select a stone and tap an adjacent hex.');
        grid.renderSystem.render();
    });

    // Break mode
    document.getElementById('break-mode').addEventListener('click', function() {
        // Toggle break mode
        if (grid.breakMode) {
            grid.breakMode = false;
            this.classList.remove('active');
            grid.updateStatus('Break mode deactivated.');
        } else {
            // Exit other modes first
            grid.mode = 'move'; // Set to move mode as a base
            grid.selectedStone = null;
            document.getElementById('stone-selector').style.display = 'none';
            document.getElementById('move-mode').classList.remove('active');
            document.getElementById('place-mode').classList.remove('active');
            
            // Enter break mode
            grid.breakMode = true;
            this.classList.add('active');
            
            // Show the player which stones can be broken
            const apInfo = grid.movementSystem.getTotalAvailableAP();
            const totalAP = apInfo.totalAP;
            
            // Find adjacent stones
            const adjacentHexes = grid.getNeighbors(grid.player.q, grid.player.r);
            let breakableCount = 0;
            
            for (const nb of adjacentHexes) {
                const hex = grid.getHex(nb.q, nb.r);
                if (hex && hex.revealed && hex.stone) {
                    const cost = grid.movementSystem.getBreakStoneCost(hex.stone);
                    if (cost <= totalAP) {
                        breakableCount++;
                        grid.markHexDirty(nb.q, nb.r);
                    }
                }
            }
            
            if (breakableCount > 0) {
                grid.updateStatus(`Break mode activated. Tap an adjacent stone to break it (${breakableCount} breakable stones).`);
            } else {
                grid.updateStatus('Break mode activated. No breakable stones in range or not enough AP.');
            }
        }
        
        // Render changes
        grid.renderSystem.render();
    });

    // Stone selection
    document.querySelectorAll('.stone-button').forEach(button => {
        button.addEventListener('click', function() {
            // Clear selections
            document.querySelectorAll('.stone-button').forEach(b => {
                b.classList.remove('selected');
            });
            const stoneType = this.id.split('-')[1];
            if (stoneCounts[stoneType] > 0) {
                grid.selectedStone = STONE_TYPES[stoneType.toUpperCase()];
                grid.updateStatus(`Selected ${stoneType} stone for placement.`);
                this.classList.add('selected');
            } else {
                grid.selectedStone = null;
                grid.updateStatus(`No ${stoneType} stones left in your pool.`);
            }
        });
        
        // Add touch feedback
        button.addEventListener('touchstart', function() {
            this.style.transform = 'scale(0.95)';
        });
        
        button.addEventListener('touchend', function() {
            this.style.transform = '';
        });
    });

    // End turn
    document.getElementById('end-turn').addEventListener('click', function() {
        document.getElementById('ap-count').textContent = '5';
        grid.movementSystem.resetVoidAPUsed(); // Reset void AP usage
        grid.movementSystem.calculateMovableHexes();
        grid.renderSystem.render();
        grid.updateStatus('Turn ended. Action Points restored.');
    });
    
    // Debug button
    const debugBtn = document.createElement('button');
    debugBtn.id = 'debug-button';
    debugBtn.textContent = 'Debug Mode';
    debugBtn.style.marginLeft = '10px';
    
    // Add debug button to the controls
    document.querySelector('.action-buttons').appendChild(debugBtn);
    
    // Debug mode toggle
    debugBtn.addEventListener('click', function() {
        grid.debugger.toggleDebugMode();
    });

    // Initialize stone counts
    Object.keys(stoneCounts).forEach(updateStoneCount);
    
    // Add testing function to global scope for debugging
    const originalRunTests = function() {
        grid.testSystem.runInteractionTests();
    };
    
    window.runInteractionTests = function() {
        document.getElementById('test-panel').style.display = 'block';
        document.getElementById('test-status').textContent = 'Running tests (1/14)...';
        document.querySelector('.test-bar').style.width = '0%';
        originalRunTests();
    };
    
    // Add keyboard shortcuts
    document.addEventListener('keydown', function(event) {
        // Press 'T' to run tests
        if (event.key === 't' || event.key === 'T') {
            window.runInteractionTests();
        }
        
        // Press 'R' to reset stone counts
        if (event.key === 'r' || event.key === 'R') {
            Object.keys(stoneCounts).forEach(type => {
                stoneCounts[type] = stoneCapacity[type];
                updateStoneCount(type);
            });
            grid.updateStatus('Stone counts reset.');
            grid.movementSystem.updateAPDisplay(); // Update Void AP display
        }
        
        // Press 'D' to toggle debug mode
        if (event.key === 'd' || event.key === 'D') {
            grid.debugger.toggleDebugMode();
        }
        
        // Press 'B' to toggle break mode
        if (event.key === 'b' || event.key === 'B') {
            document.getElementById('break-mode').click();
        }
        
        // Press 'V' to reset view
        if (event.key === 'v' || event.key === 'V') {
            grid.interactionController.resetView();
        }
    });
    
    // Add keyboard shortcut info to the UI
    const shortcutsDiv = document.createElement('div');
    shortcutsDiv.className = 'shortcuts-info';
    shortcutsDiv.innerHTML = `
        <h4>Keyboard Shortcuts</h4>
        <ul>
            <li><strong>T</strong> - Run interaction tests (14 test cases)</li>
            <li><strong>R</strong> - Reset stone counts</li>
            <li><strong>D</strong> - Toggle debug mode</li>
            <li><strong>W</strong> - Debug water mimicry chains</li>
            <li><strong>B</strong> - Toggle break mode</li>
            <li><strong>V</strong> - Reset view to default</li>
            <li><strong>+/-</strong> - Zoom in/out</li>
        </ul>
    `;
    document.querySelector('.legend').appendChild(shortcutsDiv);
    
    // Add touch gesture info to the UI for mobile devices
    if ('ontouchstart' in window) {
        const touchInfoDiv = document.createElement('div');
        touchInfoDiv.className = 'shortcuts-info mobile-gestures';
        touchInfoDiv.innerHTML = `
            <h4>Touch Gestures</h4>
            <ul>
                <li><strong>Tap</strong> - Select or move</li>
                <li><strong>Drag</strong> - Pan the view</li>
                <li><strong>Pinch</strong> - Zoom in/out</li>
                <li><strong>Double tap</strong> - Toggle zoom level</li>
            </ul>
        `;
        document.querySelector('.legend').appendChild(touchInfoDiv);
        
        // Show a temporary hint on first load
        showMobileGestureHint();
    }
    
    // Add break stone info to the legend
    const breakStoneInfo = document.createElement('div');
    breakStoneInfo.style.marginTop = '15px';
    breakStoneInfo.style.paddingTop = '10px';
    breakStoneInfo.style.borderTop = '1px solid #444';
    breakStoneInfo.innerHTML = `
        <h4>Breaking Stones</h4>
        <p>You can spend AP to break adjacent stones:</p>
        <ul style="padding-left: 20px; margin: 5px 0;">
            <li>Void: 1 AP</li>
            <li>Wind: 2 AP</li>
            <li>Fire: 3 AP</li>
            <li>Water: 4 AP</li>
            <li>Earth: 5 AP</li>
        </ul>
    `;
    document.querySelector('.legend').appendChild(breakStoneInfo);
    
    // Add a testing panel to show test progress
    const testPanel = document.createElement('div');
    testPanel.id = 'test-panel';
    testPanel.className = 'test-panel';
    testPanel.style.display = 'none';
    testPanel.innerHTML = `
        <h3>Stone Interaction Tests</h3>
        <div id="test-status">No tests running</div>
        <div id="test-progress">
            <div class="test-bar"></div>
        </div>
        <button id="stop-tests">Stop Tests</button>
    `;
    document.querySelector('.game-container').appendChild(testPanel);
    
    // Add stop button functionality
    document.getElementById('stop-tests').addEventListener('click', function() {
        grid.updateStatus('Tests stopped by user.');
        document.getElementById('test-panel').style.display = 'none';
    });
    
    // Enhance the grid's updateStatus method to update test panel
    const originalUpdateStatus = grid.updateStatus;
    grid.updateStatus = function(message) {
        originalUpdateStatus.call(this, message);
        
        // If message contains "Test" and "passed/failed", update test panel
        if (message.includes('Test ') && (message.includes('passed') || message.includes('failed'))) {
            const testNumber = message.match(/Test (\d+)/);
            if (testNumber) {
                const num = parseInt(testNumber[1]);
                document.getElementById('test-status').textContent = `Running tests (${num}/14)...`;
                document.querySelector('.test-bar').style.width = `${(num / 14) * 100}%`;
                
                if (num === 14 && message.includes('passed')) {
                    document.getElementById('test-status').textContent = 'All tests completed!';
                    setTimeout(() => {
                        document.getElementById('test-panel').style.display = 'none';
                    }, 3000);
                }
            }
        }
    };
    
    // Add a void stone info to the legend
    const voidInfoDiv = document.createElement('div');
    voidInfoDiv.className = 'void-info';
    voidInfoDiv.innerHTML = `
        <div style="margin-top: 15px; padding-top: 10px; border-top: 1px solid #444;">
            <h4>Void Stone Special Ability</h4>
            <p>Void stones in your pool act as additional Action Points. Each void stone provides +1 AP that can be used for movement.</p>
        </div>
    `;
    document.querySelector('.legend').appendChild(voidInfoDiv);
    
    // Initialize void AP display
    grid.movementSystem.updateAPDisplay();
    
    // Add a loading spinner to the page for slow operations
    const spinner = document.createElement('div');
    spinner.className = 'loading-spinner';
    document.body.appendChild(spinner);
    
    // Handle window resize for responsive canvas
    window.addEventListener('resize', debounce(function() {
        grid.interactionController.resizeCanvas();
    }, 250));
    
    // Initialize the canvas size on first load
    grid.interactionController.resizeCanvas();
    
    // Show mobile gesture hint initially
    if ('ontouchstart' in window) {
        setTimeout(showMobileGestureHint, 1000);
    }
});

// Function to add zoom controls to the canvas container
function addZoomControls() {
    const canvasContainer = document.getElementById('hexCanvas').parentElement;
    canvasContainer.style.position = 'relative';
    
    const zoomControls = document.createElement('div');
    zoomControls.className = 'zoom-controls';
    
    const zoomIn = document.createElement('div');
    zoomIn.className = 'zoom-btn';
    zoomIn.textContent = '+';
    zoomIn.addEventListener('click', function() {
        const grid = document.getElementById('hexCanvas')._hexGrid;
        const centerX = grid.canvas.width / 2;
        const centerY = grid.canvas.height / 2;
        grid.interactionController.zoomAtPoint(centerX, centerY, 1.2);
    });
    
    const zoomOut = document.createElement('div');
    zoomOut.className = 'zoom-btn';
    zoomOut.textContent = '−'; // Use minus sign, not hyphen
    zoomOut.addEventListener('click', function() {
        const grid = document.getElementById('hexCanvas')._hexGrid;
        const centerX = grid.canvas.width / 2;
        const centerY = grid.canvas.height / 2;
        grid.interactionController.zoomAtPoint(centerX, centerY, 0.8);
    });
    
    const resetView = document.createElement('div');
    resetView.className = 'zoom-btn';
    resetView.textContent = '⟲'; // Reset symbol
    resetView.addEventListener('click', function() {
        const grid = document.getElementById('hexCanvas')._hexGrid;
        grid.interactionController.resetView();
    });
    
    zoomControls.appendChild(zoomIn);
    zoomControls.appendChild(zoomOut);
    zoomControls.appendChild(resetView);
    
    canvasContainer.appendChild(zoomControls);
}

// Utility function for debouncing events
function debounce(func, wait) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        clearTimeout(timeout);
        timeout = setTimeout(function() {
            func.apply(context, args);
        }, wait);
    };
}

// Function to show mobile gesture hint
function showMobileGestureHint() {
    const existingHint = document.querySelector('.gesture-hint');
    if (existingHint) {
        existingHint.remove();
    }
    
    const hintElement = document.createElement('div');
    hintElement.className = 'gesture-hint';
    hintElement.textContent = 'Drag to pan • Pinch to zoom • Double-tap to reset view';
    
    const canvasContainer = document.getElementById('hexCanvas').parentElement;
    canvasContainer.appendChild(hintElement);
    
    // Fade out after a few seconds
    setTimeout(() => {
        hintElement.classList.add('fade');
        setTimeout(() => {
            hintElement.remove();
        }, 1000);
    }, 5000);
}

// Function to show loading spinner
function showLoading() {
    document.querySelector('.loading-spinner').style.display = 'block';
}

// Function to hide loading spinner
function hideLoading() {
    document.querySelector('.loading-spinner').style.display = 'none';
}