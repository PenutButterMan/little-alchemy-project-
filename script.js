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
// droppedElements holds the two items currently in the drag/drop slots.
let droppedElements = {
    zone1: null,
    zone2: null
};

// allElements caches the full element list from Supabase.
let allElements = [];

// discoveredElements tracks which elements have already been found by the player.
let discoveredElements = new Set();

// Fixed user ID is used for every visitor so progress resets on reload.
const FIXED_USER_ID = 'default_user';

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
            const shouldDisplay = element.id <= 17 || discoveredElements.has(element.id);

            if (shouldDisplay) {
                console.log(`Adding element:`, element.element_name, element.id);
                const elementItem = document.createElement('div');
                elementItem.className = 'element-item';
                elementItem.draggable = true;
                elementItem.textContent = element.element_name;
                elementItem.dataset.id = element.id;
                elementItem.dataset.name = element.element_name;

                elementItem.addEventListener('dragstart', (e) => {
                    e.dataTransfer.effectAllowed = 'copy';
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
        setupDropZones();
    } catch (err) {
        console.error('Failed to load elements:', err);
        console.error('Error details:', err.message, err.stack);
    }
}

// --- Setup drag/drop functionality ---
// Attach drag and drop event handlers to the two drop zones.
function setupDropZones() {
    const dropZone1 = document.getElementById('dropZone1');
    const dropZone2 = document.getElementById('dropZone2');
    const clearBtn = document.getElementById('clearBtn');

    [dropZone1, dropZone2].forEach((zone, index) => {
        zone.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            zone.classList.add('dragover');
        });

        zone.addEventListener('dragleave', () => {
            zone.classList.remove('dragover');
        });

        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('dragover');

            const elementId = e.dataTransfer.getData('elementId');
            const elementName = e.dataTransfer.getData('elementName');
            const zoneKey = index === 0 ? 'zone1' : 'zone2';

            droppedElements[zoneKey] = { id: elementId, name: elementName };

            zone.innerHTML = elementName;
            zone.classList.add('filled');

            if (droppedElements.zone1 && droppedElements.zone2) {
                combineElements();
            }
        });
    });

    clearBtn.addEventListener('click', clearDropZones);
}

// --- Clear drop zones ---
// Reset both drop zones and clear the result text.
function clearDropZones() {
    droppedElements = { zone1: null, zone2: null };

    const dropZone1 = document.getElementById('dropZone1');
    const dropZone2 = document.getElementById('dropZone2');

    dropZone1.innerHTML = 'Drag element here';
    dropZone1.classList.remove('filled');

    dropZone2.innerHTML = 'Drag element here';
    dropZone2.classList.remove('filled');

    document.getElementById('result').innerText = 'Result: ';
}

// --- Combine elements ---
// Query the combinations table and show the result element name.
async function combineElements() {
    try {
        if (!droppedElements.zone1 || !droppedElements.zone2) {
            document.getElementById('result').innerText = "Result: Please drag two elements";
            return;
        }

        const e1 = droppedElements.zone1.id;
        const e2 = droppedElements.zone2.id;

        console.log('Combining elements:', e1, e2);

        const { data, error } = await window.supabaseClient
            .from('combinations')
            .select('result_id')
            .or(`and(element1_id.eq.${e1},element2_id.eq.${e2}),and(element1_id.eq.${e2},element2_id.eq.${e1})`);

        if (error) {
            console.error('Error finding combination:', error);
            document.getElementById('result').innerText = "Result: Error occurred";
            return;
        }

        console.log('Combination data:', data);

        if (data.length === 0) {
            document.getElementById('result').innerText = "Result: Nothing found";
            return;
        }

        const resultId = data[0].result_id;

        const { data: resultData, error: resultError } = await window.supabaseClient
            .from('elements')
            .select('element_name')
            .eq('id', resultId)
            .single();

        if (resultError) {
            console.error('Error getting result name:', resultError);
            document.getElementById('result').innerText = "Result: Error getting result";
            return;
        }

        console.log('Result data:', resultData);
        document.getElementById('result').innerText = "Result: " + resultData.element_name;

        if (!discoveredElements.has(resultId)) {
            await addDiscoveredElement(resultId);
        }
    } catch (err) {
        console.error('Failed to combine elements:', err);
        document.getElementById('result').innerText = "Result: Error occurred";
    }
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

// --- Initialization ---
// Reset progress once at startup, then render the element list.
async function initializeGame() {
    await resetUserProgress();
    await loadElements();
}

initializeGame();
