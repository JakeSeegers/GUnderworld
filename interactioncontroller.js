// InteractionController.js - Handles all user interactions (mouse, touch, zoom, pan)

class InteractionController {
    constructor(grid) {
        this.grid = grid;
        this.canvas = grid.canvas;
        this.ctx = grid.ctx;
        
        // View transform properties
        this.zoomLevel = 1;
        this.panOffset = { x: 0, y: 0 };
        this.minZoom = 0.5;
        this.maxZoom = 2.5;
        
        // Interaction state
        this.isDragging = false;
        this.lastDragPos = { x: 0, y: 0 };
        this.touchStartDistance = 0;
        this.isTouchActive = false;
        
        // Debounce timer for rendering during interactions
        this.renderTimeout = null;
        
        // Bind event handlers
        this.bindEvents();
    }
    
    bindEvents() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        window.addEventListener('mousemove', this.handleMouseMove.bind(this));
        window.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this));
        
        // Touch events
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));
        
        // Window resize event
        window.addEventListener('resize', this.handleResize.bind(this));
        
        // Double click/tap for quick zoom
        this.canvas.addEventListener('dblclick', this.handleDoubleClick.bind(this));
        
        // Add reset view button
        this.createResetViewButton();
    }
    
    // Mouse event handlers
    handleMouseDown(e) {
        // Right-click or middle-click for panning
        if (e.button === 1 || e.button === 2) {
            this.startDrag(e.clientX, e.clientY);
            e.preventDefault(); // Prevent context menu
        } else if (e.button === 0) {
            // Left-click for normal interaction (handled by grid.handleClick)
            // Convert screen coordinates to canvas coordinates considering zoom and pan
            const rect = this.canvas.getBoundingClientRect();
            const x = (e.clientX - rect.left) / this.zoomLevel - this.panOffset.x;
            const y = (e.clientY - rect.top) / this.zoomLevel - this.panOffset.y;
            
            // Call the grid's click handler with transformed coordinates
            this.grid.handleTransformedClick(x, y);
        }
    }
    
    handleMouseMove(e) {
        if (this.isDragging) {
            this.drag(e.clientX, e.clientY);
            e.preventDefault();
        }
    }
    
    handleMouseUp(e) {
        if (this.isDragging) {
            this.endDrag();
            e.preventDefault();
        }
    }
    
    handleWheel(e) {
        e.preventDefault();
        
        // Calculate zoom center (mouse position)
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Determine zoom direction and amount
        const zoomFactor = e.deltaY < 0 ? 1.1 : 0.9;
        
        // Apply zoom
        this.zoomAtPoint(mouseX, mouseY, zoomFactor);
    }
    
    // Touch event handlers
    handleTouchStart(e) {
        e.preventDefault();
        this.isTouchActive = true;
        
        if (e.touches.length === 1) {
            // Single touch - prepare for potential drag or click
            const touch = e.touches[0];
            this.startDrag(touch.clientX, touch.clientY);
            
            // Also store the position for potential click
            this.touchStartPos = { x: touch.clientX, y: touch.clientY };
            this.touchStartTime = Date.now();
        } 
        else if (e.touches.length === 2) {
            // Two touches - prepare for pinch zoom
            this.touchStartDistance = this.getTouchDistance(e.touches);
            this.touchZoomCenter = this.getTouchCenter(e.touches);
            
            // End drag if it was happening
            if (this.isDragging) {
                this.endDrag();
            }
        }
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        
        if (e.touches.length === 1 && this.isDragging) {
            // Single touch - pan the view
            const touch = e.touches[0];
            this.drag(touch.clientX, touch.clientY);
        } 
        else if (e.touches.length === 2) {
            // Two touches - handle pinch zoom
            const currentDistance = this.getTouchDistance(e.touches);
            const currentCenter = this.getTouchCenter(e.touches);
            
            if (this.touchStartDistance > 0) {
                // Calculate zoom factor based on pinch movement
                const zoomFactor = currentDistance / this.touchStartDistance;
                
                // Apply zoom with center at the midpoint between touches
                const rect = this.canvas.getBoundingClientRect();
                const centerX = currentCenter.x - rect.left;
                const centerY = currentCenter.y - rect.top;
                
                // Calculate the change in position
                const dx = currentCenter.x - this.touchZoomCenter.x;
                const dy = currentCenter.y - this.touchZoomCenter.y;
                
                // Apply pan based on touch center movement
                this.panOffset.x += dx / this.zoomLevel;
                this.panOffset.y += dy / this.zoomLevel;
                
                // Apply zoom
                this.zoomLevel *= zoomFactor;
                this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel));
                
                // Update touch state
                this.touchStartDistance = currentDistance;
                this.touchZoomCenter = currentCenter;
                
                // Render changes
                this.scheduleRender();
            }
        }
    }
    
    handleTouchEnd(e) {
        // If no more touches, end all interactions
        if (e.touches.length === 0) {
            // Check if this was a tap (quick touch without much movement)
            if (this.touchStartPos && this.touchStartTime) {
                const timeDiff = Date.now() - this.touchStartTime;
                const distX = e.changedTouches[0].clientX - this.touchStartPos.x;
                const distY = e.changedTouches[0].clientY - this.touchStartPos.y;
                const moveDist = Math.sqrt(distX * distX + distY * distY);
                
                if (timeDiff < 300 && moveDist < 10) {
                    // This was a tap, convert to a click
                    const rect = this.canvas.getBoundingClientRect();
                    const x = (e.changedTouches[0].clientX - rect.left) / this.zoomLevel - this.panOffset.x;
                    const y = (e.changedTouches[0].clientY - rect.top) / this.zoomLevel - this.panOffset.y;
                    
                    // Call the grid's click handler
                    this.grid.handleTransformedClick(x, y);
                }
            }
            
            this.endDrag();
            this.isTouchActive = false;
            this.touchStartDistance = 0;
        } 
        else if (e.touches.length === 1) {
            // Switched from pinch to single touch
            this.touchStartDistance = 0;
            const touch = e.touches[0];
            this.startDrag(touch.clientX, touch.clientY);
        }
        
        e.preventDefault();
    }
    
    // Utility methods for touch interactions
    getTouchDistance(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }
    
    getTouchCenter(touches) {
        return {
            x: (touches[0].clientX + touches[1].clientX) / 2,
            y: (touches[0].clientY + touches[1].clientY) / 2
        };
    }
    
    // Handle double-click/tap for quick zoom
    handleDoubleClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Toggle between default zoom and zoomed in
        if (Math.abs(this.zoomLevel - 1) < 0.1) {
            this.zoomAtPoint(x, y, 1.75); // Zoom in
        } else {
            this.resetView(); // Reset to default
        }
    }
    
    // Window resize handler
    handleResize() {
        this.resizeCanvas();
        this.scheduleRender();
    }
    
    // Resize canvas to fit container
    resizeCanvas() {
        const container = this.canvas.parentElement;
        const containerWidth = container.clientWidth;
        const containerHeight = Math.min(window.innerHeight * 0.7, containerWidth * 0.75);
        
        // Update canvas size
        this.canvas.width = containerWidth;
        this.canvas.height = containerHeight;
        
        // Re-render
        this.grid.renderSystem.render();
    }
    
    // Create a button to reset the view
    createResetViewButton() {
        const container = document.querySelector('.controls');
        const resetBtn = document.createElement('button');
        resetBtn.id = 'reset-view-btn';
        resetBtn.textContent = 'Reset View';
        resetBtn.style.backgroundColor = '#2a3a4a';
        resetBtn.style.color = '#58a4f4';
        resetBtn.style.marginLeft = '10px';
        
        resetBtn.addEventListener('click', () => this.resetView());
        
        // Add to UI
        if (container) {
            const actionButtons = container.querySelector('.action-buttons');
            if (actionButtons) {
                actionButtons.appendChild(resetBtn);
            } else {
                container.appendChild(resetBtn);
            }
        }
    }
    
    // Zoom centered on a specific point
    zoomAtPoint(centerX, centerY, factor) {
        // Calculate point in world space
        const worldX = centerX / this.zoomLevel - this.panOffset.x;
        const worldY = centerY / this.zoomLevel - this.panOffset.y;
        
        // Apply zoom
        const oldZoom = this.zoomLevel;
        this.zoomLevel *= factor;
        this.zoomLevel = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel));
        
        // Adjust pan to keep the point under the mouse
        this.panOffset.x = -(worldX - centerX / this.zoomLevel);
        this.panOffset.y = -(worldY - centerY / this.zoomLevel);
        
        // Render changes
        this.scheduleRender();
    }
    
    // Reset view to default
    resetView() {
        this.zoomLevel = 1;
        this.panOffset = { x: 0, y: 0 };
        this.scheduleRender();
    }
    
    // Start a drag operation
    startDrag(x, y) {
        this.isDragging = true;
        this.lastDragPos = { x, y };
        
        // Add dragging class to canvas for cursor styling
        this.canvas.classList.add('dragging');
    }
    
    // Continue a drag operation
    drag(x, y) {
        if (!this.isDragging) return;
        
        const dx = (x - this.lastDragPos.x) / this.zoomLevel;
        const dy = (y - this.lastDragPos.y) / this.zoomLevel;
        
        this.panOffset.x += dx;
        this.panOffset.y += dy;
        
        this.lastDragPos = { x, y };
        
        this.scheduleRender();
    }
    
    // End a drag operation
    endDrag() {
        this.isDragging = false;
        this.canvas.classList.remove('dragging');
    }
    
    // Schedule a render to avoid too many renders during interactions
    scheduleRender() {
        if (this.renderTimeout) {
            clearTimeout(this.renderTimeout);
        }
        
        this.renderTimeout = setTimeout(() => {
            this.grid.renderSystem.render();
            this.renderTimeout = null;
        }, 20); // 50 fps max
    }
    
    // Apply the current transform to the rendering context
    applyTransform(ctx) {
        // Compute the center point of the canvas
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // Reset the transformation
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        
        // Apply the current transformation
        ctx.translate(centerX, centerY);
        ctx.scale(this.zoomLevel, this.zoomLevel);
        ctx.translate(this.panOffset.x, this.panOffset.y);
    }
    
    // Transform screen coordinates to world coordinates
    screenToWorld(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = screenX - rect.left;
        const canvasY = screenY - rect.top;
        
        // Compute the center point of the canvas
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // Apply inverse transformation
        const worldX = (canvasX - centerX) / this.zoomLevel - this.panOffset.x;
        const worldY = (canvasY - centerY) / this.zoomLevel - this.panOffset.y;
        
        return { x: worldX, y: worldY };
    }
}
