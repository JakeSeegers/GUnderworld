// HexGrid.js - Core grid functionality with mobile support

class HexGrid {
    constructor(canvas, radius = 12) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.radius = radius;
        this.hexSize = 18;
        this.hexes = new Map();
        this.player = { q: 0, r: 0 };
        this.selectedStone = null;
        this.challengeMode = new ChallengeMode(this);
        this.mode = 'move';
        this.breakMode = false; // Track if we're in break mode
        this.movableHexes = [];
        
        // Animation state properties (linked from renderSystem)
        this.fireWaterAnimation = null;
        this.fireAnimation = null;
        
        // Initialize subsystems in the correct order (dependencies first)
        this.hexMath = new HexMath(this);
        this.animationManager = new AnimationManager();
        this.debugger = new InteractionDebugger(this);
        this.renderSystem = new RenderSystem(this);
        this.waterMimicry = new WaterMimicry(this);
        this.movementSystem = new MovementSystem(this);
        this.testSystem = new TestSystem(this);
        this.interactionSystem = new StoneInteractionSystem(this);
        
        // Initialize the interaction controller for touch/mobile support
        this.interactionController = new InteractionController(this);
        
        // Initialize the grid
        this.createGrid();
        
        // Set up event listeners - these are now handled by the InteractionController
        // The canvas.addEventListener('click') is removed since we now use transformed coordinates
        document.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // Initial setup
        this.movementSystem.calculateMovableHexes();
        this.renderSystem.render();
        
        // Store grid reference on canvas for debugging
        canvas._hexGrid = this;
        
        // Resize canvas to fit container on startup
        this.interactionController.resizeCanvas();
    }
    
    // Create the hexagonal grid with the specified radius
    createGrid() {
        for (let q = -this.radius; q <= this.radius; q++) {
            const r1 = Math.max(-this.radius, -q - this.radius);
            const r2 = Math.min(this.radius, -q + this.radius);
            for (let r = r1; r <= r2; r++) {
                const key = `${q},${r}`;
                this.hexes.set(key, {
                    q, r,
                    stone: null,
                    revealed: (Math.abs(q) < 7 && Math.abs(r) < 7) // Increased initial revealed area
                });
            }
        }
    }
    
    // Get a hex at the specified coordinates
    getHex(q, r) {
        return this.hexes.get(`${q},${r}`);
    }
    
    // Check if a hex is valid and revealed
    isValidHex(q, r) {
        const hex = this.hexes.get(`${q},${r}`);
        return hex && hex.revealed;
    }
    
    // Get neighboring hex coordinates
    getNeighbors(q, r) {
        const dirs = [
            { q: 1, r: 0 },
            { q: 1, r: -1 },
            { q: 0, r: -1 },
            { q: -1, r: 0 },
            { q: -1, r: 1 },
            { q: 0, r: 1 }
        ];
        return dirs.map(dir => ({ q: q + dir.q, r: r + dir.r }));
    }
    
    // Place a stone on the grid
    setStone(q, r, stoneType) {
        const hex = this.getHex(q, r);
        if (hex) {
            const oldStone = hex.stone;
            hex.stone = stoneType;
            
            // Mark this hex and its extended neighborhood as dirty
            this.markHexDirty(q, r);
            
            // Mark potential chain reaction area as dirty for water stones
            if (stoneType === STONE_TYPES.WATER.name || oldStone === STONE_TYPES.WATER.name) {
                this.waterMimicry.markWaterChainAreaDirty(q, r);
            }
            
            this.processStoneInteractions(q, r);
            this.renderSystem.renderOptimized();
            return true;
        }
        return false;
    }
    
    // Process interactions for a stone placement
    processStoneInteractions(q, r) {
        this.interactionSystem.processInteraction(q, r);
    }
    
    // Mark a hex and its neighbors as needing redraw
    markHexDirty(q, r) {
        const key = `${q},${r}`;
        this.renderSystem.dirtyHexes.add(key);
        
        // Also mark neighbors as dirty (for effects that spill over)
        const neighbors = this.getNeighbors(q, r);
        for (const nb of neighbors) {
            const nbKey = `${nb.q},${nb.r}`;
            this.renderSystem.dirtyHexes.add(nbKey);
        }
    }
    
    // New method: Handle click with transformed coordinates (from InteractionController)
    handleTransformedClick(x, y) {
        const axial = this.hexMath.pixelToAxial(x, y);
        const q = Math.round(axial.q);
        const r = Math.round(axial.r);
        
        if (!this.isValidHex(q, r)) return;
        
        if (this.breakMode) {
            this.handleBreakStone(q, r);
        } else if (this.mode === 'place' && this.selectedStone) {
            this.movementSystem.handleStonePlacement(q, r);
        } else if (this.mode === 'move') {
            this.movementSystem.handlePlayerMovement(q, r);
        }
    }
    
    // Handle breaking a stone
    handleBreakStone(q, r) {
        const hex = this.getHex(q, r);
        if (!hex || !hex.stone) {
            this.updateStatus("No stone to break at this location.");
            return;
        }
        
        // Check if the stone is revealed and in range
        if (!hex.revealed) {
            this.updateStatus("Cannot break unrevealed stones.");
            return;
        }
        
        // Check if the stone is adjacent to the player
        const isAdjacent = this.getNeighbors(this.player.q, this.player.r)
            .some(nb => nb.q === q && nb.r === r);
        if (!isAdjacent) {
            this.updateStatus("You can only break adjacent stones.");
            return;
        }
        
        // Get AP cost based on stone type
        const stoneType = hex.stone;
        const apCost = this.movementSystem.getBreakStoneCost(stoneType);
        
        // Check if player has enough AP
        const apInfo = this.movementSystem.getTotalAvailableAP();
        if (apInfo.totalAP < apCost) {
            this.updateStatus(`Not enough AP to break this ${stoneType} stone. Need ${apCost}, have ${apInfo.totalAP}.`);
            return;
        }
        
        // Show confirmation dialog
        this.movementSystem.showBreakConfirmDialog(q, r, stoneType, apCost);
    }
    
    // Handle keyboard input
    handleKeyDown(e) {
        if (e.key === 'D' || e.key === 'd') {
            this.debugger.toggleDebugMode();
        }
        
        // Add water mimicry debug shortcut
        if (e.key === 'W') { // Capital W for water debug
            console.clear();
            const result = this.waterMimicry.debugWaterMimicry();
            console.log(result);
        }
        
        // Add test shortcut
        if (e.key === 'T' || e.key === 't') {
            this.testSystem.runInteractionTests();
        }
        
        // Add reset view shortcut
        if (e.key === 'V' || e.key === 'v') {
            this.interactionController.resetView();
        }
        
        // Add zoom shortcuts
        if (e.key === '+' || e.key === '=') {
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;
            this.interactionController.zoomAtPoint(centerX, centerY, 1.1);
        }
        if (e.key === '-' || e.key === '_') {
            const centerX = this.canvas.width / 2;
            const centerY = this.canvas.height / 2;
            this.interactionController.zoomAtPoint(centerX, centerY, 0.9);
        }
    }
    
    // Update the status message
    updateStatus(message) {
        document.getElementById('status').textContent = message;
    }
    
    // Trigger water-fire chain reaction from the core interface
    triggerWaterFireChainReaction(startQ, startR) {
        this.interactionSystem.triggerWaterFireChainReaction(startQ, startR);
    }
}