/*
    Element Combiner game script.
    - Uses Supabase to read element and combination data.
    - Uses user_progress to track discovered elements.
    - Implements drag/drop combination UI.
*/

// Debug logging: verify Supabase client is available and working
console.log("JS is running");
console.log("Supabase object:", typeof window.supabaseClient);
console.log("Supabase methods:", window.supabaseClient ? Object.keys(window.supabaseClient) : "supabaseClient not defined");

// --- Game state ---
// draggedElements tracks elements currently in the combination area
let draggedElements = [];

// allElements caches the full element list from Supabase.
let allElements = [];

// discoveredElements tracks which elements have already been found by the player.
let discoveredElements = new Set();

// Fixed user ID is used for every visitor so progress resets on reload.
const FIXED_USER_ID = 'default_user';

// Combination distance threshold (pixels)
const COMBINE_DISTANCE = 100;

let combinationLocked = false;
let combineAreaInitialized = false;

// --- Reset progress ---
// Remove any existing user_progress rows for this fixed user.
async function resetUserProgress() {
    console.log("Resetting user progress for user:", FIXED_USER_ID);
    try {
        const { error } = await window.supabaseClient
            .from('user_progress')
            .delete()
            .eq('user_id', FIXED_USER_ID);

        if (error) {
            console.error('Error resetting user progress:', error);
            return;
        }

        console.log('User progress reset successfully');
        discoveredElements.clear();
    } catch (err) {
        console.error('Failed to reset user progress:', err);
    }
}

// --- Load discovered elements ---
// Fetch the list of element IDs this user has discovered from Supabase.
async function loadDiscoveredElements() {
    console.log("Loading discovered elements for user:", FIXED_USER_ID);
    try {
        discoveredElements.clear();
        const { data, error } = await window.supabaseClient
            .from('user_progress')
            .select('element_id')
            .eq('user_id', FIXED_USER_ID);

        if (error) {
            console.error('Error loading discovered elements:', error);
            return;
        }

        console.log('Discovered elements:', data);
        data.forEach(record => {
            discoveredElements.add(record.element_id);
        });
    } catch (err) {
        console.error('Failed to load discovered elements:', err);
    }
}

// --- Load element list ---
// Render draggable element cards based on the element list and discovery state.
async function loadElements() {
    console.log("loadElements function called");
    try {
        await loadDiscoveredElements();

        console.log("Attempting to fetch from Supabase...");
        const { data, error } = await window.supabaseClient
            .from('elements')
            .select('*');

        console.log("Supabase response - data:", data, "error:", error);

        if (error) {
            console.error('Error loading elements:', error);
            return;
        }

        console.log('Loaded elements:', data);
        allElements = data;

        const elementsList = document.getElementById('elementsList');
        elementsList.innerHTML = '';

        data.forEach((element) => {
            // Show element if it is part of the starting set (IDs 1-17)
            // or if it has already been discovered by the user.
            const shouldDisplay = element.id <= 18 || discoveredElements.has(element.id);

            if (shouldDisplay) {
                console.log(`Adding element:`, element.element_name, element.id);
                const elementItem = document.createElement('div');
                elementItem.className = 'element-item';
                elementItem.draggable = true;
                elementItem.textContent = element.element_name;
                elementItem.dataset.id = element.id;
                elementItem.dataset.name = element.element_name;

                // Add fade-in animation for newly discovered elements
                if (discoveredElements.has(element.id) && element.id > 17) {
                    elementItem.classList.add('new');
                }

                elementItem.addEventListener('dragstart', (e) => {
                    e.dataTransfer.effectAllowed = 'copy';
                    e.dataTransfer.setData('source', 'sourceList');
                    e.dataTransfer.setData('elementId', element.id);
                    e.dataTransfer.setData('elementName', element.element_name);
                    elementItem.classList.add('dragging');
                });

                elementItem.addEventListener('dragend', () => {
                    elementItem.classList.remove('dragging');
                });

                elementsList.appendChild(elementItem);
            }
        });

        console.log('Elements loaded into list');
    } catch (err) {
        console.error('Failed to load elements:', err);
        console.error('Error details:', err.message, err.stack);
    }
}

// --- Setup free-form combination area ---
// Allow dragging elements into the area and detecting collisions
function setupCombineArea() {
    if (combineAreaInitialized) return;
    combineAreaInitialized = true;

    const combineArea = document.getElementById('combineArea');
    const clearBtn = document.getElementById('clearBtn');

    combineArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    });

    combineArea.addEventListener('drop', (e) => {
        e.preventDefault();

        const source = e.dataTransfer.getData('source');
        if (source !== 'sourceList') {
            return;
        }

        const elementId = e.dataTransfer.getData('elementId');
        const elementName = e.dataTransfer.getData('elementName');

        // Check if dropping directly onto an existing element
        const dropX = e.clientX;
        const dropY = e.clientY;

        let targetElement = null;
        for (const draggedElement of draggedElements) {
            const rect = draggedElement.el.getBoundingClientRect();
            if (dropX >= rect.left && dropX <= rect.right &&
                dropY >= rect.top && dropY <= rect.bottom) {
                targetElement = draggedElement;
                break;
            }
        }

        if (targetElement) {
            // Direct combination: combine the dropped element with the target element
            console.log('Direct combination: dropping', elementName, elementId, 'onto', targetElement.name, targetElement.id);
            combinationLocked = true;
            const centerX = (dropX + targetElement.el.getBoundingClientRect().left + targetElement.el.getBoundingClientRect().right) / 2;
            const centerY = (dropY + targetElement.el.getBoundingClientRect().top + targetElement.el.getBoundingClientRect().bottom) / 2;
            triggerCombination(elementId, targetElement.id, centerX, centerY);
        } else {
            // Normal drop: add element to combine area
            const element = allElements.find(el => el.id.toString() === elementId);
            if (element) {
                addElementToCombineArea(element, e.clientX, e.clientY);
            }
        }
    });

    clearBtn.addEventListener('click', clearCombineArea);
}

// Add an element to the combine area
function addElementToCombineArea(element, clientX, clientY) {
    const combineArea = document.getElementById('combineArea');
    const rect = combineArea.getBoundingClientRect();

    // Calculate position relative to combine area
    let x = clientX - rect.left - 40; // Center the element (40 = half width)
    let y = clientY - rect.top - 40;  // Center the element (40 = half height)

    // Keep within bounds
    x = Math.max(0, Math.min(x, rect.width - 80));
    y = Math.max(0, Math.min(y, rect.height - 80));

    const elementItem = document.createElement('div');
    elementItem.className = 'element-item';
    elementItem.textContent = element.element_name;
    elementItem.dataset.id = element.id;
    elementItem.dataset.name = element.element_name;
    elementItem.style.left = x + 'px';
    elementItem.style.top = y + 'px';
    elementItem.style.position = 'absolute';
    elementItem.draggable = false;
    elementItem.style.touchAction = 'none';

    // Store position and id
    const elementData = {
        el: elementItem,
        id: element.id,
        name: element.element_name,
        x: x,
        y: y
    };

    draggedElements.push(elementData);

    // Handle dragging within combine area using pointer events
    elementItem.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        elementItem.setPointerCapture(e.pointerId);
        elementItem.classList.add('dragging');

        const startX = e.clientX;
        const startY = e.clientY;
        const originX = elementData.x;
        const originY = elementData.y;

        const moveHandler = (moveEvent) => {
            let deltaX = moveEvent.clientX - startX;
            let deltaY = moveEvent.clientY - startY;
            const combineArea = document.getElementById('combineArea');
            const rect = combineArea.getBoundingClientRect();

            let newX = originX + deltaX;
            let newY = originY + deltaY;
            newX = Math.max(0, Math.min(newX, rect.width - 80));
            newY = Math.max(0, Math.min(newY, rect.height - 80));

            elementItem.style.left = newX + 'px';
            elementItem.style.top = newY + 'px';
            elementData.x = newX;
            elementData.y = newY;
        };

        const upHandler = () => {
            elementItem.classList.remove('dragging');
            elementItem.releasePointerCapture(e.pointerId);
            document.removeEventListener('pointermove', moveHandler);
            document.removeEventListener('pointerup', upHandler);
            document.removeEventListener('pointercancel', upHandler);
            checkForCollisions();
        };

        document.addEventListener('pointermove', moveHandler);
        document.addEventListener('pointerup', upHandler);
        document.addEventListener('pointercancel', upHandler);
    });

    combineArea.appendChild(elementItem);
}

// Check if any two elements are touching
function checkForCollisions() {
    if (combinationLocked || draggedElements.length < 2) return;

    for (let i = 0; i < draggedElements.length; i++) {
        for (let j = i + 1; j < draggedElements.length; j++) {
            const el1 = draggedElements[i];
            const el2 = draggedElements[j];

            const rect1 = el1.el.getBoundingClientRect();
            const rect2 = el2.el.getBoundingClientRect();

            const overlap = rect1.left <= rect2.right && rect1.right >= rect2.left && rect1.top <= rect2.bottom && rect1.bottom >= rect2.top;

            if (overlap) {
                combinationLocked = true;
                const centerX = (rect1.left + rect1.right + rect2.left + rect2.right) / 4;
                const centerY = (rect1.top + rect1.bottom + rect2.top + rect2.bottom) / 4;
                console.log('Collision detected between', el1.name, el1.id, 'and', el2.name, el2.id, 'at', centerX, centerY);
                triggerCombination(el1.id, el2.id, centerX, centerY);
                return;
            }
        }
    }
}

// Trigger element combination
async function triggerCombination(id1, id2, centerX = null, centerY = null) {
    try {
        const { data, error } = await window.supabaseClient
            .from('combinations')
            .select('result_id')
            .or(`and(element1_id.eq.${id1},element2_id.eq.${id2}),and(element1_id.eq.${id2},element2_id.eq.${id1})`);

        if (error) {
            console.error('Error finding combination:', error);
            document.getElementById('result').innerText = "Result: Error occurred";
            combinationLocked = false;
            return;
        }

        if (data.length === 0) {
            document.getElementById('result').innerText = "Result: Nothing found";
            console.log('Combination not found for', id1, id2);
            playFailSound();
            combinationLocked = false;
            return;
        }

        const resultId = data[0].result_id;

        const { data: resultData, error: resultError } = await window.supabaseClient
            .from('elements')
            .select('element_name')
            .eq('id', resultId)
            .single();

        console.log('Combination result for', id1, id2, '=>', resultData ? resultData.element_name : 'unknown');

        if (resultError) {
            console.error('Error getting result name:', resultError);
            document.getElementById('result').innerText = "Result: Error getting result";
            return;
        }

        // Trigger explosion animation from the combination center if available
        triggerExplosion(centerX, centerY);
        playSuccessSound();

        const resultElement = document.getElementById('result');
        resultElement.innerText = "Result: " + resultData.element_name;

        if (!discoveredElements.has(resultId)) {
            await addDiscoveredElement(resultId);
        }

        // Clear the combine area after a short delay
        setTimeout(() => {
            clearCombineArea();
        }, 1400);

    } catch (err) {
        console.error('Failed to combine elements:', err);
        document.getElementById('result').innerText = "Result: Error occurred";
    }
}

// Clear combine area
function clearCombineArea() {
    const combineArea = document.getElementById('combineArea');
    combineArea.innerHTML = '';
    draggedElements = [];
    combinationLocked = false;
}

// --- Persist discovered elements ---
// Save the newly discovered element to user_progress and refresh the list.
async function addDiscoveredElement(elementId) {
    try {
        console.log('Adding discovered element:', elementId);
        const { data, error } = await window.supabaseClient
            .from('user_progress')
            .insert([
                {
                    user_id: FIXED_USER_ID,
                    element_id: elementId,
                    discovered_at: new Date().toISOString()
                }
            ]);

        if (error) {
            console.error('Error adding discovered element:', error);
            return;
        }

        console.log('Successfully added discovered element:', elementId);
        discoveredElements.add(elementId);

        await loadElements();
    } catch (err) {
        console.error('Failed to add discovered element:', err);
    }
}

// --- Animation helpers ---
// Trigger explosion animation on successful combination
function triggerExplosion(centerX = null, centerY = null) {
    const resultSection = document.querySelector('.result-section');
    resultSection.classList.remove('exploding');
    // Trigger reflow to restart animation
    void resultSection.offsetWidth;
    resultSection.classList.add('exploding');

    // Create particle burst effect from the collision center
    createParticleBurst(centerX, centerY);
}

// --- Sound effect helpers ---
// Create a shared audio context for all sounds
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

// Helper function to play a single tone
function playTone(frequency, duration = 0.15, startTime = audioContext.currentTime) {
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.connect(gain);
    gain.connect(audioContext.destination);

    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.12, startTime);
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    osc.start(startTime);
    osc.stop(startTime + duration);
}

// Play success sound for successful combinations
function playSuccessSound() {
    playTone(523.25, 0.18);  // C5 - longer
    playTone(659.25, 0.18, audioContext.currentTime + 0.15);  // E5 - longer
    playTone(783.99, 0.22, audioContext.currentTime + 0.30);  // G5 - longest
    playTone(1046.50, 0.15, audioContext.currentTime + 0.50); // C6 - high finish
}

// Play sad sound when no combination is found
function playFailSound() {
    playTone(440, 0.25);  // A4 - longer
    playTone(392, 0.25, audioContext.currentTime + 0.20);  // G4 - longer
    playTone(330, 0.30, audioContext.currentTime + 0.40);  // E4 - longest, most drawn out
}

// Create burst particles from the result area
function createParticleBurst(centerX = null, centerY = null) {
    if (centerX == null || centerY == null) {
        const resultSection = document.querySelector('.result-section');
        const rect = resultSection.getBoundingClientRect();
        centerX = rect.left + rect.width / 2;
        centerY = rect.top + rect.height / 2;
    }

    // Create screen flash overlay
    const flash = document.createElement('div');
    flash.style.position = 'fixed';
    flash.style.top = '0';
    flash.style.left = '0';
    flash.style.width = '100%';
    flash.style.height = '100%';
    flash.style.background = 'rgba(255, 255, 255, 0)';
    flash.style.pointerEvents = 'none';
    flash.style.zIndex = '9998';
    document.body.appendChild(flash);

    // Animate the flash
    flash.animate([
        { background: 'rgba(255, 255, 255, 0)' },
        { background: 'rgba(255, 255, 255, 0.7)' },
        { background: 'rgba(255, 255, 255, 0)' }
    ], {
        duration: 600,
        easing: 'ease-out'
    }).onfinish = () => flash.remove();

    // Create 20 particles radiating outward in a smoother burst
    const particleCount = 20;
    const emojis = ['✨', '💫', '⭐', '🌟', '💥', '🔥', '🌈'];

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.className = 'particle burst';
        particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
        particle.style.fontSize = `${1.8 + Math.random() * 1.2}rem`;
        particle.style.zIndex = '9999';
        particle.style.setProperty('--rot', `${Math.random() * 360}deg`);
        particle.style.setProperty('--delay', `${Math.random() * 150}ms`);

        // Calculate angle for radial burst
        const angle = (i / particleCount) * Math.PI * 2;
        const distance = 320 + Math.random() * 120;
        const tx = Math.cos(angle) * distance;
        const ty = Math.sin(angle) * distance;

        particle.style.left = centerX + 'px';
        particle.style.top = centerY + 'px';
        particle.style.setProperty('--tx', tx + 'px');
        particle.style.setProperty('--ty', ty + 'px');
        particle.style.animationDelay = `${Math.random() * 120}ms`;

        document.body.appendChild(particle);

        // Remove particle after animation completes
        setTimeout(() => {
            particle.remove();
        }, 1200);
    }
}

// --- Initialization ---
// Reset progress once at startup, then render the element list.
async function initializeGame() {
    await resetUserProgress();
    await loadElements();
    setupCombineArea();
}

initializeGame();

