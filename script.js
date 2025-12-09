// Global vars

// Dynamically determine the API URL.
// If the hostname is localhost, a local IP, or a file path, it constructs a local API URL.
// Otherwise, it defaults to the production server.
const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.protocol === 'file:' || window.location.hostname.startsWith('192.168.') || window.location.hostname.startsWith('10.');
let API_URL = 'https://game-a5vt.onrender.com/api'; // Default to production
if (isLocal) {
    // If running from file://, hostname is empty, so default to localhost.
    API_URL = `http://localhost:3000/api`;
}

let soundEnabled = true;
let musicEnabled = true;
let voiceEnabled = true;
let globalAudioContext = null;
let currentStudent = null; // Will be fetched from the backend
let currentGame = 0;
let customArtPieces = JSON.parse(localStorage.getItem('primeCustomArt') || '[]'); // Keep this on client
let audioDebounce = null;

let showcaseTimeout = null;

// Helper to format time as MM:SS
function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Function to get the current timestamp
function now() {
    return Date.now();
}

function getTimeSpentKey(gameNum) {
    return `primeTimeSpent_${encodeURIComponent(currentStudent.name)}_Game${gameNum}`;
}

// Audio helpers
function initGlobalAudio() {
    if (!globalAudioContext) {
        globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (globalAudioContext.state === 'suspended') {
        globalAudioContext.resume();
    }
}
function playSound(type) {
    if (!soundEnabled || !globalAudioContext) return;
    initGlobalAudio();
    const o = globalAudioContext.createOscillator();
    const g = globalAudioContext.createGain();
    o.connect(g); g.connect(globalAudioContext.destination);
    if (type === 'hover') { o.frequency.value = 800; g.gain.value = 0.1; o.type = 'sine'; }
    else if (type === 'click') { o.frequency.value = 600; g.gain.value = 0.2; o.type = 'square'; }
    else if (type === 'win') { o.frequency.value = 523; o.frequency.setTargetAtTime(784, globalAudioContext.currentTime + 0.1, 0.1); g.gain.value = 0.15; o.type = 'sine'; }
    else if (type === 'level-up') { o.frequency.value = 440; o.frequency.setTargetAtTime(880, globalAudioContext.currentTime + 0.1, 0.05); g.gain.value = 0.1; o.type = 'sawtooth'; }
    g.gain.exponentialRampToValueAtTime(0.01, globalAudioContext.currentTime + 0.3);
    o.start(); o.stop(globalAudioContext.currentTime + 0.3);
}
function playTone(f, d, t = 'sine', v = 0.1) {
    if (!globalAudioContext) return;
    initGlobalAudio();
    const o = globalAudioContext.createOscillator();
    const g = globalAudioContext.createGain();
    o.connect(g); g.connect(globalAudioContext.destination);
    o.frequency.setValueAtTime(f, globalAudioContext.currentTime);
    o.type = t;
    g.gain.setValueAtTime(0, globalAudioContext.currentTime);
    g.gain.linearRampToValueAtTime(v, globalAudioContext.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.01, globalAudioContext.currentTime + d);
    o.start(globalAudioContext.currentTime);
    o.stop(globalAudioContext.currentTime + d);
}

// --- New Voice Synthesis Functions ---
function speak(text, interrupt = false) {
    if (!voiceEnabled || !('speechSynthesis' in window)) return;
    if (interrupt) {
        window.speechSynthesis.cancel();
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    window.speechSynthesis.speak(utterance);
}

function toggleVoice() {
    voiceEnabled = !voiceEnabled;
    const btn = document.getElementById('voice-toggle-btn');
    btn.innerHTML = voiceEnabled ? 'Mute Voice 🔇' : 'Unmute Voice 🔊';
    if (voiceEnabled) speak("Voice enabled."); else window.speechSynthesis.cancel();
}
// Confetti
function toggleMusic() {
    musicEnabled = !musicEnabled;
    const musicEl = document.getElementById('background-music');
    const btn = document.getElementById('music-toggle-btn');
    if (musicEnabled) {
        btn.innerHTML = 'Mute Music 🔇';
        if (currentGame && currentGame.active && !currentGame.paused) musicEl.play();
    } else {
        btn.innerHTML = 'Unmute Music 🎵';
        musicEl.pause();
    }
}
function showUnlockNotification() {
    // Create the notification element
    const notification = document.createElement('div');
    notification.id = 'unlock-notification';
    notification.innerHTML = `
        <h2>🎉 New Games Unlocked! 🎉</h2>
        <p>You've earned enough badges to unlock more challenging games. Keep up the great work!</p>
    `;
    
    // Append to the body
    document.body.appendChild(notification);

    // Play a sound and speak
    playSound('level-up');
    speak("Congratulations! You have unlocked new games!", true);

    // Make it disappear after a few seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 500); // Wait for fade out transition
    }, 5000); // Show for 5 seconds
}
function showConfetti() {
    // Confetti logic remains the same
}

// Function to load a student profile (or create a default one)
async function findAndPlay() {
    const studentId = document.getElementById('student-id-edit').value.trim();
    if (!studentId) {
        alert('Please enter your Student ID.');
        return;
    }

    // The backend will find the student or create a new one if the ID is new.
    try {
        const response = await fetch(`${API_URL}/students/${studentId}`);
        currentStudent = await response.json();
        if (!response.ok) throw new Error(currentStudent.message || 'Failed to load profile.');

        initDisplay();
        playSound('click');
        speak(`Welcome, ${currentStudent.name}! Please choose a game to play.`, true);
    } catch (error) {
        console.error('Error finding or creating student:', error);
        alert('Could not start the game. Please check the Student ID or make sure the server is running.');
    }
}

async function loadDefaultStudent() {
    try {
        // This function is now primarily for ensuring the UI is set up correctly on initial load.
        // It doesn't log anyone in.
        document.getElementById('games-section-wrapper').classList.remove('hidden');
        speak("Welcome to the Prime Excellence Daycare School Computer Game! Please enter your student ID to begin.", true);
    } catch (error) {
        console.error('Error starting session:', error);
        alert('Could not connect to the server. Please make sure the backend is running.');
    }
}

function showStudentForm() {
    // With no login form, this function now just ensures the game wrapper is visible
    document.getElementById('games-section-wrapper').classList.remove('hidden');
}

async function deleteStudentRecord() {
    if (!currentStudent || !confirm(`Are you sure you want to permanently delete all data for ${currentStudent.name}? This action cannot be undone.`)) return;

    try {
        const response = await fetch(`${API_URL}/students/${currentStudent.studentId}`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to delete student.');
        alert(`All records for ${currentStudent.name} have been deleted. Loading a new guest profile.`);
        alert(`All records for ${currentStudent.name} have been deleted. Returning to the main console.`);
        window.location.reload(); // Reload the page to go back to the login screen
        loadDefaultStudent(); // Load a new default student after deletion
    } catch (error) {
        console.error('Error deleting student record:', error);
        alert('Could not delete student record. Please try again later.');
    }
}

function getSafeKey(key) {
    return `prime${key}_${encodeURIComponent(currentStudent.name)}`;
}

function calculateOverallScore() {
    if (!currentStudent || currentStudent.badges.length === 0) {
        return 0;
    } else {
        const sumOfScores = currentStudent.badges.reduce((acc, badge) => acc + badge.score, 0);
        return Math.round(sumOfScores / currentStudent.badges.length);
    }
}

function checkArchivedGames() {
    const archivedContainer = document.getElementById('archived-games-container');
    if (!archivedContainer) return;

    const wasHidden = archivedContainer.style.display === 'none';

    // Unlock archived games after earning 3 badges (30 stars)
    // if (currentStudent.badges.length >= 3) {
    // Always show for development
        archivedContainer.style.display = 'block';
        archivedContainer.classList.add('unlocked');
        // if (wasHidden) { showUnlockNotification(); } // Optional: comment out to prevent notification
    // } else {
    //     archivedContainer.style.display = 'none';
    //     archivedContainer.classList.remove('unlocked');
    // }
}

function initDisplay() {
    if (!currentStudent) return;
    const overallScore = calculateOverallScore();

    // Hide the login form and show the student's info
    document.getElementById('student-profile-edit').classList.add('hidden');
    document.getElementById('student-profile-display').classList.remove('hidden');

    // Update profile display with Student ID
    document.getElementById('student-name-display').textContent = currentStudent.name;
    document.getElementById('student-class-display').textContent = currentStudent.class;
    document.getElementById('student-id-display').textContent = currentStudent.studentId;

    // Update stats display
    document.getElementById('session-count').textContent = currentStudent.sessions;
    document.getElementById('badge-count').textContent = currentStudent.badges.length;
    document.getElementById('high-score').textContent = currentStudent.highScore;
    document.getElementById('overall-score').textContent = overallScore;
    // The welcome message is now handled by loadDefaultStudent
    speak(`Welcome, ${currentStudent.name}! Please choose a game to play.`, true);
}
function hideMobilePrompt() {
    document.getElementById('mobile-prompt').style.display = 'none';
    initAllAudio();
}

// Audio init
function initAllAudio() {
    clearTimeout(audioDebounce);
    speak("Welcome to the Prime Excellence Daycare School Computer Game! Who is playing today?", true);
    audioDebounce = setTimeout(initGlobalAudio, 100);
}

const gameTitles = {
    1: 'Mouse Trainer',
    2: 'Banana Chase',
    3: 'Typewriter',
    4: 'Word Weaver',
    5: 'Rainbow Painter',
    7: 'Art Puzzle',
    8: 'Sentence Scribe',
    9: 'Story Self',
    10: 'PC Part Picker',
    11: 'Number Matching',
    12: 'Paragraph Pro',
    13: 'Candy Sorter',
    14: 'Memory Melody',
    15: 'Multiple Choice Challenge'
};

function showBadges() {
    playSound('hover');
    const list = document.getElementById('badge-list');
    if (!currentStudent) return;
    const badgeHTML = currentStudent.badges.length > 0 ? currentStudent.badges.map(b => `<div class="badge-item">${b.type} (Game ${b.game}, ${b.date}, Score: ${b.score})</div>`).join('') : "<p>No badges earned yet. Keep playing!</p>";
    const timeSpentHTML = Object.keys(gameRegistry).map(gameNum => {
        const timeMs = currentStudent.timeSpent[`game${gameNum}`] || 0;
        const timeFormatted = formatTime(Math.floor(timeMs / 1000));
        return `<div class="time-spent-item"><strong>${gameTitles[gameNum] || `Game ${gameNum}`}:</strong> ${timeFormatted}</div>`;
    }).join('');
    list.innerHTML = `<div>${badgeHTML}</div><hr><div id="time-spent-section"><h3>Total Play Time ⏱️</h3>${timeSpentHTML}</div>`;
    document.getElementById('badge-modal').style.display = 'flex';
}

function resetAllTimeSpent() {
    // This would require a new backend endpoint. For now, we can disable or remove this button.
    alert("This feature is managed by the server now.");
}

function hideBadges() {
    document.getElementById('badge-modal').style.display = 'none';
}

// --- Settings Modal Functions ---
function showSettingsModal() {
    playSound('hover');
    document.getElementById('settings-modal').style.display = 'flex';
}
function hideSettingsModal() {
    document.getElementById('settings-modal').style.display = 'none';
}

function showEditProfileForm() {
    document.getElementById('student-profile-display').classList.add('hidden');
    document.getElementById('student-profile-edit').classList.remove('hidden');

    document.getElementById('student-name-edit').value = currentStudent.name;
    document.getElementById('student-class-edit').value = currentStudent.class;
}

function hideEditProfileForm() {
    document.getElementById('student-profile-display').classList.remove('hidden');
    document.getElementById('student-profile-edit').classList.add('hidden');
}

async function saveProfileChanges() {
    const newName = document.getElementById('student-name-edit').value.trim();
    const newClass = document.getElementById('student-class-edit').value.trim();

    if (!newName || !newClass) {
        alert('Name and Class cannot be empty.');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/students/${currentStudent.studentId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: newName, class: newClass })
        });
        if (!response.ok) throw new Error('Failed to update profile.');

        currentStudent = await response.json(); // Update local data with server response
        initDisplay(); // Refresh the entire display
        hideEditProfileForm();
        speak("Profile updated successfully.", true);
    } catch (error) {
        console.error('Error saving profile:', error);
        alert('Could not save profile changes to the server.');
    }
}

// Custom Art Functions
function showArtCustomModal() {
    playSound('hover');
    updateCustomArtList();
    document.getElementById('art-custom-modal').style.display = 'flex';
}

function hideArtCustomModal() {
    document.getElementById('art-custom-modal').style.display = 'none';
}

function updateCustomArtList() {
    const listEl = document.getElementById('custom-art-list');
    listEl.innerHTML = customArtPieces.map((p, i) => `
        <div class="custom-art-item">
            <span>🎨 ${p.name} (${p.src})</span>
            <button class="btn btn-secondary btn-small" onclick="removeCustomArt(${i})">Remove</button>
        </div>
    `).join('');
}

function addCustomArt() {
    const url = document.getElementById('custom-art-url').value.trim();
    const name = document.getElementById('custom-art-name').value.trim();
    if (!url || !name) { alert('Please provide both an Image URL/Path and a Name.'); return; }
    
    customArtPieces.push({ id: `custom${Date.now()}`, src: url, name: name });
    localStorage.setItem('primeCustomArt', JSON.stringify(customArtPieces));
    updateCustomArtList();
    document.getElementById('custom-art-url').value = '';
    document.getElementById('custom-art-name').value = '';
    playSound('click');
}

function removeCustomArt(index) {
    customArtPieces.splice(index, 1);
    localStorage.setItem('primeCustomArt', JSON.stringify(customArtPieces));
    updateCustomArtList();
}
function resetCustomArt() {
    if (confirm('Are you sure you want to remove all custom art and restore the default images?')) { customArtPieces = []; localStorage.removeItem('primeCustomArt'); updateCustomArtList(); }
}

async function endSession(gameNum, score, misses, timeSpent) {
    try {
        const response = await fetch(`${API_URL}/sessions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId: currentStudent.studentId, gameNum, score, misses, timeSpent })
        });
        if (!response.ok) throw new Error('Failed to save session.');

        const { student, newBadge } = await response.json();
        currentStudent = student; // Update local student data with the latest from the server

        if (newBadge) {
            alert(`🎉 New Badge Earned: ${newBadge.type} in Game ${gameNum}! Score: ${newBadge.score}`);
            showConfetti();
            playSound('win');
        }
        initDisplay(); // Refresh the display with new stats
    } catch (error) {
        console.error('Error ending session:', error);
    }
}

// Global keydown handler for Games 3 & 4
function globalKeyHandler(e) {
    // The new game objects attach their own listeners, but we'll keep this
    // as a potential hook for future global key events.
    // For now, game-specific key handling is inside each game object.
    // Example: if (e.key === 'Escape') backToLauncher();
}

// Load game
function loadGame(gameNum) {
    playSound('click');
    if (window.matchMedia('(pointer: coarse)').matches && !globalAudioContext) {
        alert('Tap the screen first to enable sounds! 👆');
        return;
    }
    // Prevent starting a game if no student is logged in
    if (!currentStudent) {
        speak("Please enter your student ID and press Play Game before starting.", true);
        alert("Please enter your student ID and press 'Play Game' first! 🚀");
        return;
    }
    document.getElementById('launcher').style.transition = 'opacity 0.5s';
    document.getElementById('launcher').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('launcher').style.display = 'none';
        document.getElementById('game-area').style.display = 'block';
        // Instead of a number, currentGame will hold the game object. Get selected level from radio buttons.
        const level = document.querySelector('input[name="game-level"]:checked').value;
        const game = gameFactory(gameNum, level);
        if (game) {
            currentGame = game;
            speak(game.instruction, true);
            game.start(document.getElementById('game-area'));
        }
    }, 500);
}

// --- New Progress Bar Helper ---
const progressBarStates = {}; // Keep track of which bars have been filled

function updateProgressBar(barId, label, currentValue, maxValue, isMisses = false) {
    const hudEl = document.getElementById(barId);
    if (!hudEl) return;

    const percentage = Math.min((currentValue / maxValue) * 100, 100);
    const colorStyle = isMisses ? 'style="background: #ff4757;"' : '';
    hudEl.innerHTML = `${label}: ${currentValue} (${Math.round(percentage)}%) <div class="progress-bar"><div class="progress-fill" ${colorStyle} style="width: ${percentage}%"></div></div>`;

    if (percentage >= 100 && !progressBarStates[barId]) {
        playSound(isMisses ? 'click' : 'level-up'); // Play a different sound for misses
        progressBarStates[barId] = true; // Mark as filled
    } else if (percentage < 100) {
        progressBarStates[barId] = false; // Reset if the value drops (e.g., new round)
    }
}

// --- Certificate Generation ---
function generateCertificateHTML(gameTitle, studentName, studentClass, score, misses, accuracy) {
    if (!studentName || !studentClass) return '<div>Error: Student not loaded. Cannot generate certificate.</div>';
    return `
        <div style="font-family: 'Fredoka One', 'Comic Sans MS', cursive, sans-serif; text-align: center; padding: 20px; border: 5px solid #4ecdc4; border-radius: 20px; width: 80%; margin: 20px auto;">
            <h2 style="color: #ff6b35; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">Prime Excellence Daycare School</h2>
            <p style="font-size: 18px;">Certificate of Completion</p>
            <div style="margin-top: 20px;">
                <p style="font-size: 24px;">This certificate is awarded to</p>
                <p style="font-size: 32px; color: #4ecdc4;">${studentName}</p>
                <p style="font-size: 20px;">From class ${studentClass}</p>
            </div>
            <div style="margin-top: 20px;">
                <p style="font-size: 20px;">For successfully completing the game:</p>
                <p style="font-size: 24px; color: #ff6b35;">${gameTitle}</p>
            </div>
            <div style="margin-top: 20px; border-top: 2px solid #ddd; padding-top: 10px;">
                <p style="font-size: 18px;">Performance Report:</p>
                <p>Score: ${score} | Misses: ${misses} | Accuracy: ${accuracy}%</p>
            </div>
        </div>`;
}



// Back to launcher
function backToLauncher() {
    playSound('click');
    if (window.clearTimeouts) window.clearTimeouts();
    document.getElementById('game-area').style.transition = 'opacity 0.5s';
    document.getElementById('game-area').style.opacity = '0';
    setTimeout(() => {
        document.getElementById('game-area').innerHTML = '';
        document.getElementById('game-area').style.display = 'none';
        document.getElementById('launcher').style.display = 'block';
        document.getElementById('launcher').style.opacity = '1';
        if (currentGame && typeof currentGame.stop === 'function') {
            currentGame.stop();
        }
        currentGame = null;
        // Remove game-specific event listeners
        window.removeEventListener('keydown', window.gameKeyHandler);
    }, 500);
}

class BaseGame {
    constructor(gameNum, level, instruction) {
        const levelSettings = {
            easy:   { time: 600, speed: 1.0, complexity: 1.0, choices: 3 },
            medium: { time: 480, speed: 1.5, complexity: 1.5, choices: 4 },
            hard:   { time: 360, speed: 2.5, complexity: 2.5, choices: 5 }
        };
        this.settings = levelSettings[level];
        this.gameNum = gameNum;
        this.instruction = instruction;
        this.active = false;
        this.score = 0;
        this.misses = 0;
        this.timeLeft = this.settings.time;
        this.timerId = null;
        this.paused = false;
        this.container = null;
        this.startTime = 0;
    }

    start(container) {
        this.container = container;
        this.clearGameArea();
        this.stop();
        this.active = true;
        this.score = 0;
        this.misses = 0;
        this.timeLeft = this.settings.time;
        this.paused = false;
        this.startTime = now();
        if (musicEnabled) {
            const musicEl = document.getElementById('background-music');
            if (musicEl) musicEl.play().catch(e => console.error("Music playback failed:", e));
        }
    }

    stop() {
        this.active = false;
        this.paused = false;
        clearTimeout(this.timerId);
        const overlay = document.getElementById('pause-overlay');
        if (overlay) overlay.remove();
        // The time spent is now calculated and sent in the endSession function,
        // so the local saveTimeSpent function is no longer needed here.
        const musicEl = document.getElementById('background-music');
        if (musicEl) {
            musicEl.pause();
            musicEl.currentTime = 0;
        }
    }
    printCertificate(gameTitle, score, misses, accuracy) {
        const certificateHTML = generateCertificateHTML(gameTitle, currentStudent.name, currentStudent.class, score, misses, accuracy);
        const printWindow = window.open('', '_blank');
        printWindow.document.write(certificateHTML); printWindow.document.close(); printWindow.print();
    }

    pause() {
        if (!this.active || this.paused) return;
        this.paused = true;
        clearTimeout(this.timerId);
        speak("Game paused.", true);
        const musicEl = document.getElementById('background-music');
        if (musicEl) musicEl.pause();

        const overlay = document.createElement('div');
        overlay.id = 'pause-overlay';
        overlay.innerHTML = `
            <h2>Paused ⏸️</h2>
            <button class="btn btn-primary" id="resume-btn">Resume</button>
        `;
        this.container.appendChild(overlay);
        document.getElementById('resume-btn').onclick = () => this.resume();
    }


    resume() {
        if (!this.active || !this.paused) return;
        this.paused = false;
        speak("Resuming.", true);
        document.getElementById('pause-overlay')?.remove();
        const musicEl = document.getElementById('background-music');
        if (musicEl && musicEnabled) musicEl.play();
        this.updateTimer(); // Restart the timer loop
    }

    togglePause() {
        playSound('click');
        this.paused ? this.resume() : this.pause();
    }

    clearGameArea() {
        if (this.container) this.container.innerHTML = '';
    }

    _createHud(scoreLabel, missLabel = null) {
        const missHtml = missLabel ? `<div class="hud-timer" id="hud-misses${this.gameNum}" style="color: #ff4757;">${missLabel}: 0 <div class="progress-bar"><div class="progress-fill" id="miss-fill${this.gameNum}" style="background: #ff4757;"></div></div></div>` : '';
        return `
            <div id="game-hud" data-game-num="${this.gameNum}">
                <div class="hud-left">
                    <button class="back-btn" onclick="backToLauncher()" aria-label="Go back home">Swing Home! 🏠</button>
                    <button class="btn btn-secondary btn-small" onclick="currentGame.togglePause()">Pause ⏸️</button>
                </div>
                <div class="hud-center">
                    <div class="hud-score" id="hud-score${this.gameNum}">${scoreLabel}: 0 <div class="progress-bar"><div class="progress-fill" id="score-fill${this.gameNum}"></div></div></div>
                    ${missHtml}
                </div>
                <div class="hud-right"><div class="hud-timer" id="hud-timer${this.gameNum}">Time: ${formatTime(this.timeLeft)} <div class="progress-bar"><div class="progress-fill" id="timer-fill${this.gameNum}"></div></div></div></div>
            </div>`;
    }

    _updateTimerDisplay() {
        const timerEl = document.getElementById(`hud-timer${this.gameNum}`);
        if (timerEl) {
            timerEl.innerHTML = `Time: ${formatTime(this.timeLeft)} <div class="progress-bar"><div class="progress-fill" id="timer-fill${this.gameNum}" style="width: ${((this.settings.time - this.timeLeft) / this.settings.time) * 100}%"></div></div>`;
        }
    }
}

class MouseTrainerGame extends BaseGame {
    constructor(level) {
        super(1, level, "Click the red targets as fast as you can!");
        this.currentTarget = null;
    }

    start(container) {
        super.start(container);
        const html = `
            ${this._createHud('Score')}
            <div id="mouse-trainer-canvas" class="game-canvas"></div>
            <div id="game-over1" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; background: rgba(0,0,0,0.8); padding: 40px; border-radius: 10px; color: white; display: none;">
                <h2>Performance Report</h2>
                <p>Final Score: <span id="final-score1">0</span></p>
                <p>Accuracy: <span id="final-accuracy1">0%</span></p>
                <button class="btn btn-primary btn-small" onclick="currentGame.printCertificate('Mouse Trainer', currentGame.score, 0, currentGame.score > 0 ? 100 : 0)">Print Certificate</button>
                <button onclick="currentGame.start(document.getElementById('game-area'))">Play Again</button>
            </div>`;
        const css = `
            .target { position: absolute; width: ${80 / this.settings.speed}px; height: ${80 / this.settings.speed}px; background: radial-gradient(circle, #ff6b6b, #ee5a24); border-radius: 50%; cursor: pointer; transition: transform 0.1s ease; z-index: 5; }
            .target:hover { transform: scale(1.1); }
            .target.clicked { background: radial-gradient(circle, #4ecdc4, #44a08d); transform: scale(0.8); }
        `;
        
        this.container.innerHTML = html;
        const styleEl = document.createElement('style');
        styleEl.textContent = css;
        this.container.appendChild(styleEl);

        this.updateTimer();
        this.createTarget();
    }

    createTarget() {
        if (!this.active || this.paused) return;
        if (this.currentTarget) this.currentTarget.remove();
        const canvas = document.getElementById('mouse-trainer-canvas');
        if (!canvas) return; // Don't create a target if the canvas isn't there
        const canvasRect = canvas.getBoundingClientRect();
        const target = document.createElement('div');
        target.className = 'target';
        target.style.left = Math.random() * (canvasRect.width - (80 / this.settings.speed)) + 'px';
        target.style.top = Math.random() * (canvasRect.height - (80 / this.settings.speed)) + 'px';
        
        const handleClick = (e) => {
            if (this.paused) return;
            if (e.type === 'touchstart') e.preventDefault();
            target.classList.add('clicked');
            this.score++;
            updateProgressBar('hud-score1', 'Score', this.score, 30);
            setTimeout(() => target.remove(), 150);
            this.createTarget();
        };
        target.onclick = target.ontouchstart = handleClick;
        
        setTimeout(() => { if (target.parentNode && this.active) { target.remove(); this.createTarget(); } }, 4000 / this.settings.speed);
        canvas.appendChild(target);
        this.currentTarget = target;
    }

    updateTimer() {
        if (!this.active || this.paused) return;
        this.timerId = setTimeout(() => this.updateTimer(), 1000);
        this._updateTimerDisplay();
        this.timeLeft--;
        if (this.timeLeft < 0) {
            this.stop();
            const accuracy = this.score > 0 ? 100 : 0; // No misses in this game
            document.getElementById('final-score1').textContent = this.score;
            document.getElementById('final-accuracy1').textContent = `${accuracy.toFixed(0)}%`;
            document.getElementById('game-over1').style.display = 'block';
            const timeSpent = now() - this.startTime;
            speak(`Game over! Your final score is ${this.score}. Your accuracy was ${accuracy.toFixed(0)} percent.`, true); endSession(1, this.score, 0, timeSpent);
        }
    }

    stop() {
        super.stop();
        if (this.currentTarget) this.currentTarget.remove();
    }
}

class BananaChaseGame extends BaseGame {
    constructor(level) {
        super(2, level, "Let's chase some bananas! Click on them to grab them.");
        this.currentTarget = null;
    }

    start(container) {
        super.start(container);
        const html = `
            ${this._createHud('🍌 Grabbed')}
            <div id="banana-chase-canvas" class="game-canvas" style="border-color: #feca57; background: rgba(255, 235, 153, 0.2);"></div>
            <div id="game-over2" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; background: rgba(255, 215, 0, 0.9); padding: 40px; border-radius: 20px; color: #4a4a4a; box-shadow: 0 0 20px rgba(0,0,0,0.3); display: none;">
                <h2>🍌 Performance Report 🍌</h2>
                <p>Final Bananas: <span id="final-score2">0</span></p>
                <p>Accuracy: <span id="final-accuracy2">0%</span></p>
                <button onclick="currentGame.start(document.getElementById('game-area'))">Swing Again!</button>
                <button class="btn btn-primary btn-small" onclick="currentGame.printCertificate('Banana Chase', currentGame.score, 0, currentGame.score > 0 ? 100 : 0)">Print Certificate</button>
            </div>`;
        const css = `
            .banana { position: absolute; width: 40px; height: 80px; background: linear-gradient(45deg, #ffd700, #ffed4e); border-radius: 20px 20px 10px 10px; cursor: pointer; transition: transform 0.2s ease; z-index: 5; animation: bob 1.5s ease-in-out infinite; } 
            .banana:hover { transform: scale(1.1) rotate(5deg); } 
            .banana.grabbed { background: linear-gradient(45deg, #4ecdc4, #44a08d); transform: scale(0.9) rotate(-10deg); animation: none; }
        `;
        this.container.innerHTML = html;
        const styleEl = document.createElement('style'); styleEl.textContent = css; this.container.appendChild(styleEl);
        this.updateTimer(); this.createTarget();
    }

    createTarget() {
        if (!this.active || this.paused) return;
        if (this.currentTarget) this.currentTarget.remove();
        const canvas = document.getElementById('banana-chase-canvas');
        if (!canvas) return;
        const canvasRect = canvas.getBoundingClientRect();
        const target = document.createElement('div'); target.className = 'banana';
        const bananaWidth = 40;
        const bananaHeight = 80;
        target.style.left = Math.random() * (canvasRect.width - bananaWidth) + 'px';
        target.style.top = Math.random() * (canvasRect.height - bananaHeight) + 'px';
        const handleClick = (e) => {
            if (this.paused) return;
            if (e.type === 'touchstart') e.preventDefault();
            target.classList.add('grabbed'); this.score++;
            updateProgressBar('hud-score2', '🍌 Grabbed', this.score, 30);
            setTimeout(() => { target.remove(); this.createTarget(); }, 200);
        };
        target.onclick = target.ontouchstart = handleClick;
        setTimeout(() => { if (target.parentNode && this.active) { target.remove(); this.createTarget(); } }, 5000 / this.settings.speed);
        canvas.appendChild(target); this.currentTarget = target;
    }

    updateTimer() {
        if (!this.active || this.paused) return;
        this.timerId = setTimeout(() => this.updateTimer(), 1000);
        this._updateTimerDisplay();
        this.timeLeft--;
        if (this.timeLeft < 0) {
            this.stop();
            const accuracy = this.score > 0 ? 100 : 0; // No misses in this game
            document.getElementById('final-score2').textContent = this.score;
            document.getElementById('final-accuracy2').textContent = `${accuracy.toFixed(0)}%`;
            document.getElementById('game-over2').style.display = 'block';
            const timeSpent = now() - this.startTime;
            speak(`Great job! You grabbed ${this.score} bananas with ${accuracy.toFixed(0)} percent accuracy.`, true); endSession(2, this.score, 0, timeSpent);
        }
    }

    stop() {
        super.stop();
        if (this.currentTarget) this.currentTarget.remove();
    }
}

class TypewriterGame extends BaseGame {
    constructor(level) {
        super(3, level, "Let's practice typing! Press the key for the letter you see on the screen.");
        this.letterTimeout = null;
        this.currentLetter = 'A';
    }

    handleKey(e) {
        initGlobalAudio(); if (!this.active || this.paused) return;
        const k = e.key.toUpperCase();
        const letterEl = document.getElementById('current-letter');
        if (k === this.currentLetter) {
            clearTimeout(this.letterTimeout); this.score++;
            updateProgressBar('hud-score3', '🍌 Typed', this.score, 50);
            letterEl.classList.add('correct'); playTone(440, 0.3, 'sine', 0.1); playTone(880, 0.3, 'sine', 0.1);
            setTimeout(() => { letterEl.classList.remove('correct'); this.updateLetter(); }, 300);
        } else if (/^[A-Z]$/.test(k)) {
            clearTimeout(this.letterTimeout); this.misses++;
            updateProgressBar('hud-misses3', '❌ Missed', this.misses, 5, true);
            letterEl.classList.add('wrong'); playTone(200, 0.2, 'square', 0.05);
            speak("Oops, try again!", true);
            setTimeout(() => { letterEl.classList.remove('wrong'); this.startLetterTimer(); }, 500);
        }
    }

    start(container) {
        super.start(container);
        const html = `
            ${this._createHud('🍌 Typed', '❌ Missed')}
            <div id="typewriter-canvas" class="game-canvas" style="border-color: #ffc107; background: rgba(255, 245, 200, 0.2); display: flex; align-items: center; justify-content: center;">
                <div id="current-letter" style="font-size: 200px; font-weight: bold; color: #ff6b35; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); transition: all 0.3s ease; user-select: none;">A</div>
            </div>
            <div id="game-over3" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; background: rgba(255, 215, 0, 0.9); padding: 40px; border-radius: 20px; color: #4a4a4a; display: none;">
                <h2>🍌 Performance Report 🍌</h2>
                <p>Final Score: <span id="final-score3">0</span></p>
                <p>Misses: <span id="final-misses3">0</span></p>
                <p>Accuracy: <span id="final-accuracy3">0%</span></p>
                <button class="btn btn-primary btn-small" onclick="currentGame.printCertificate('Typewriter Tango', currentGame.score, currentGame.misses, totalAttempts > 0 ? (currentGame.score / totalAttempts) * 100 : 0)">Print Certificate</button>
                <button onclick="currentGame.start(document.getElementById('game-area'))">Type Again!</button>
            </div>`;
        const css = `#current-letter.correct { color: #4ecdc4; transform: scale(1.2); } #current-letter.wrong { color: #ff4757; animation: shake 0.5s ease; }`;
        this.container.innerHTML = html;
        const styleEl = document.createElement('style'); styleEl.textContent = css; this.container.appendChild(styleEl);
        window.gameKeyHandler = this.handleKey.bind(this);
        window.addEventListener('keydown', window.gameKeyHandler);
        this.updateLetter(); this.updateTimer();
    }

    updateLetter() {
        this.currentLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
        document.getElementById('current-letter').textContent = this.currentLetter;
        this.startLetterTimer();
    }

    startLetterTimer() {
        clearTimeout(this.letterTimeout);
        this.letterTimeout = setTimeout(() => {
            if (!this.active || this.paused) return;
            this.misses++;
            updateProgressBar('hud-misses3', '❌ Missed', this.misses, 5, true);
            const letterEl = document.getElementById('current-letter');
            letterEl.classList.add('wrong'); playTone(200, 0.2, 'square', 0.05);
            setTimeout(() => { letterEl.classList.remove('wrong'); this.updateLetter(); }, 500);
        }, 8000 / this.settings.speed);
    }

    updateTimer() {
        if (!this.active || this.paused) return;
        this.timerId = setTimeout(() => this.updateTimer(), 1000);
        this._updateTimerDisplay();
        this.timeLeft--;
        if (this.timeLeft < 0) {
            this.stop();
            const totalAttempts = this.score + this.misses;
            const accuracy = totalAttempts > 0 ? (this.score / totalAttempts) * 100 : 0;
            document.getElementById('final-score3').textContent = this.score;
            document.getElementById('final-misses3').textContent = this.misses;
            document.getElementById('final-accuracy3').textContent = `${accuracy.toFixed(0)}%`;
            document.getElementById('game-over3').style.display = 'block';
            const timeSpent = now() - this.startTime;
            speak(`Time's up! You typed ${this.score} letters with ${accuracy.toFixed(0)} percent accuracy.`, true); endSession(3, this.score, this.misses, timeSpent);
        }
    }

    stop() {
        super.stop();
        clearTimeout(this.letterTimeout);
        window.removeEventListener('keydown', window.gameKeyHandler);
    }
}

class WordWeaverGame extends BaseGame {
    constructor(level) {
        super(4, level, "Let's type some words! Spell the word you see on the screen.");
        this.wordTimeout = null;
        this.currentWord = '';
        this.typedSoFar = '';
        this.wordList = {
            easy: ['CAT', 'DOG', 'SUN', 'RUN', 'FUN', 'SKY', 'EAT', 'PIG'],
            medium: ['PLAY', 'JUMP', 'BALL', 'STAR', 'TREE', 'BOOK', 'HAPPY'],
            hard: ['MONKEY', 'BANANA', 'SCHOOL', 'SWING', 'JUNGLE', 'PENCIL', 'FRIEND']
        };
        this.currentWordList = this.wordList[level];
    }

    handleKey(e) {
        initGlobalAudio(); if (!this.active || this.paused) return;
        const k = e.key.toUpperCase();
        const wordEl = document.getElementById('current-word');
        if (/^[A-Z]$/.test(k)) {
            if (this.typedSoFar + k === this.currentWord) {
                clearTimeout(this.wordTimeout); this.score++;
                updateProgressBar('hud-score4', '🍌 Words', this.score, 25);
                wordEl.classList.add('correct'); playTone(440, 0.4, 'sine', 0.1); playTone(880, 0.4, 'sine', 0.1);
                setTimeout(() => { wordEl.classList.remove('correct'); this.updateWord(); }, 400);
            } else if (this.currentWord.startsWith(this.typedSoFar + k)) {
                this.typedSoFar += k;
                document.getElementById('typed-so-far').textContent = this.typedSoFar;
            } else {
                clearTimeout(this.wordTimeout); this.misses++;
                updateProgressBar('hud-misses4', '❌ Missed', this.misses, 5, true);
                wordEl.classList.add('wrong'); playTone(200, 0.3, 'square', 0.05);
                this.typedSoFar = ''; document.getElementById('typed-so-far').textContent = '';
                setTimeout(() => { wordEl.classList.remove('wrong'); this.startWordTimer(); }, 500);
            }
        }
    }

    start(container) {
        super.start(container);
        const html = `
            ${this._createHud('🍌 Words', '❌ Missed')}
            <div id="word-weaver-canvas" class="game-canvas" style="border-color: #4ecdc4; background: rgba(200, 240, 235, 0.2); display: flex; align-items: center; justify-content: center;">
                <div style="position: relative; text-align: center;">
                    <div id="typed-so-far" style="position: absolute; top: -50px; left: 50%; transform: translateX(-50%); font-size: 40px; color: #4ecdc4; z-index: 10; width: 100%;"></div>
                    <div id="current-word" style="font-size: 120px; font-weight: bold; color: #ff6b35; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); user-select: none;"></div>
                </div>
            </div>
            <div id="game-over4" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; background: rgba(255, 215, 0, 0.9); padding: 40px; border-radius: 20px; color: #4a4a4a; display: none;">
                <h2>🍌 Performance Report 🍌</h2>
                <p>Final Words: <span id="final-score4">0</span></p>
                <p>Misses: <span id="final-misses4">0</span></p>
                <p>Accuracy: <span id="final-accuracy4">0%</span></p>
                <button class="btn btn-primary btn-small" onclick="currentGame.printCertificate('Word Weaver Womp', currentGame.score, currentGame.misses, totalAttempts > 0 ? (currentGame.score / totalAttempts) * 100 : 0)">Print Certificate</button>
                <button onclick="currentGame.start(document.getElementById('game-area'))">Weave Again!</button>
            </div>`;
        const css = `#current-word.correct { color: #4ecdc4; transform: scale(1.1); } #current-word.wrong { color: #ff4757; animation: shake 0.5s ease; }`;
        this.container.innerHTML = html;
        const styleEl = document.createElement('style'); styleEl.textContent = css; this.container.appendChild(styleEl);
        window.gameKeyHandler = this.handleKey.bind(this);
        window.addEventListener('keydown', window.gameKeyHandler);
        this.updateWord(); this.updateTimer();
    }

    updateWord() {
        this.currentWord = this.currentWordList[Math.floor(Math.random() * this.currentWordList.length)];
        this.typedSoFar = '';
        document.getElementById('current-word').textContent = this.currentWord;
        document.getElementById('typed-so-far').textContent = '';
        this.startWordTimer();
    }

    startWordTimer() {
        clearTimeout(this.wordTimeout);
        this.wordTimeout = setTimeout(() => {
            if (!this.active || this.paused) return; this.misses++;
            updateProgressBar('hud-misses4', '❌ Missed', this.misses, 5, true);
            const wordEl = document.getElementById('current-word');
            wordEl.classList.add('wrong'); playTone(200, 0.3, 'square', 0.05);
            this.typedSoFar = ''; document.getElementById('typed-so-far').textContent = '';
            setTimeout(() => { wordEl.classList.remove('wrong'); this.updateWord(); }, 500);
        }, 12000 / this.settings.complexity);
    }

    updateTimer() {
        if (!this.active || this.paused) return;
        this.timerId = setTimeout(() => this.updateTimer(), 1000);
        this._updateTimerDisplay();
        this.timeLeft--;
        if (this.timeLeft < 0) {
            this.stop();
            const totalAttempts = this.score + this.misses;
            const accuracy = totalAttempts > 0 ? (this.score / totalAttempts) * 100 : 0;
            document.getElementById('final-score4').textContent = this.score;
            document.getElementById('final-misses4').textContent = this.misses;
            document.getElementById('final-accuracy4').textContent = `${accuracy.toFixed(0)}%`;
            document.getElementById('game-over4').style.display = 'block';
            const timeSpent = now() - this.startTime;
            speak(`Finished! You spelled ${this.score} words with ${accuracy.toFixed(0)} percent accuracy.`, true); endSession(4, this.score, this.misses, timeSpent);
        }
    }

    stop() {
        super.stop();
        clearTimeout(this.wordTimeout);
        window.removeEventListener('keydown', window.gameKeyHandler);
    }
}

class RainbowPainterGame extends BaseGame {
    constructor(level) {
        super(5, level, "Let's paint a picture! Follow the instructions to learn how to play.");
        this.canvas = null;
        this.ctx = null;
        this.selectedColor = null;
        this.isColoring = false;
        this.shapes = [];
        this.pictures = [];
        this.currentPictureIndex = 0;
        this.tutorialActive = false;
        this.tutorialStep = 0;
        this.colors = [];
        this.boundResize = null;
        this.boundStart = null;
        this.boundMove = null;
        this.boundEnd = null;
    }

    start(container) {
        super.start(container);
        this.currentPictureIndex = 0;
        this.selectedColor = null;
        const html = `
                    ${this._createHud('🎨 Shapes', '❌ Misses')}
                    <div id="paint-game-wrapper" class="game-canvas" style="border-color: #ff9ff3; background: transparent; border-style: none;">
                        <div id="color-palette-5"></div>
                        <canvas id="paintCanvas" style="background: #fff; cursor: not-allowed; touch-action: none; border: 3px dashed #ff9ff3; border-radius: 15px;"></canvas>
                    </div>
                    <div id="game-over5" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; background: rgba(255, 192, 203, 0.9); padding: 40px; border-radius: 20px; color: #4a4a4a; display: none;">
                        <h2>🎨 Performance Report 🎨</h2>
                        <p>Shapes Colored: <span id="final-score5">0</span></p>
                        <p>Total Shapes: <span id="final-total5">0</span></p>
                        <p>Completion: <span id="final-accuracy5">0%</span></p>
                        <button class="btn btn-primary btn-small" onclick="currentGame.printCertificate('Rainbow Painter', currentGame.score, currentGame.misses, totalShapes > 0 ? (currentGame.score / totalShapes) * 100 : 0)">Print Certificate</button>
                        <button onclick="currentGame.start(document.getElementById('game-area'))">Paint Again!</button>
                    </div>`;
                const css = `
                    #paint-game-wrapper { display: flex; align-items: center; justify-content: center; gap: 20px; }
                    #paintCanvas { width: 70%; height: 90%; }
                    #color-palette-5 { background: rgba(255,255,255,0.8); padding: 10px; border-radius: 15px; display: flex; flex-direction: column; gap: 10px; z-index: 10; }
                    .color-choice { width: 50px; height: 50px; border-radius: 50%; cursor: pointer; border: 3px solid white; transition: all 0.2s; }
                    .color-choice:hover { transform: scale(1.1); }
                    .color-choice.selected { border-color: #ff6b35; transform: scale(1.2); box-shadow: 0 0 10px rgba(0,0,0,0.3); }
                `;
                container.innerHTML = html + `<style>${css}</style>`;
                this.canvas = document.getElementById('paintCanvas'); this.ctx = this.canvas.getContext('2d');
                this.resizeCanvas();
                this.setupPictures(); // Define all pictures
                this.setupPalette();
                this.setupShapes();
                this.drawAllShapes();
                this.boundResize = this.resizeCanvas.bind(this); window.addEventListener('resize', this.boundResize);
                this.boundStart = this.handleColoringStart.bind(this); this.canvas.addEventListener('mousedown', this.boundStart); this.canvas.addEventListener('touchstart', this.boundStart);
                this.boundMove = this.handleColoringMove.bind(this); this.canvas.addEventListener('mousemove', this.boundMove); this.canvas.addEventListener('touchmove', this.boundMove);
                this.boundEnd = this.handleColoringEnd.bind(this); this.canvas.addEventListener('mouseup', this.boundEnd); this.canvas.addEventListener('touchend', this.boundEnd);
                this.canvas.addEventListener('mouseleave', this.boundEnd);
                // Start the tutorial instead of the game directly
                this.startTutorial();
            }
            resizeCanvas() { 
                this.canvas.width = this.canvas.clientWidth; this.canvas.height = this.canvas.clientHeight;
                this.setupPictures(); // Recalculate all pictures on resize
                this.setupShapes(); // Recalculate shape positions on resize
                this.drawAllShapes();
            }
            setupPalette() {
                const palette = document.getElementById('color-palette-5'); palette.innerHTML = '';
                this.colors.forEach(color => {
                    const choice = document.createElement('div');
                    choice.className = 'color-choice';
                    choice.style.backgroundColor = color;
                    choice.dataset.color = color;
                    choice.onclick = () => {
                        if (this.tutorialActive) return; // Disable during tutorial
                        this.selectedColor = color;
                        document.querySelectorAll('.color-choice').forEach(c => c.classList.remove('selected'));
                        choice.classList.add('selected');
                        const safeColor = color.replace('#', '%23');
                        this.canvas.style.cursor = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 32 32'%3E%3Cpath d='M22,2l-3,3l7,7l3-3z M19,5L5,19l-3,8l8-3L24,10z' fill='${safeColor}' stroke='black' stroke-width='1'/%3E%3C/svg%3E") 4 28, auto`;
                        playTone(800, 0.1, 'sine', 0.05);
                    };
                    palette.appendChild(choice);
                });
            }
            setupPictures() {
                const w = this.canvas.width;
                const h = this.canvas.height;
                this.pictures = [
                    // Picture 1: Monkey Face
                    {
                        colors: ['#A0522D', '#DEB887', '#FFC0CB', '#FF69B4'],
                        shapes: [
                            { path: new Path2D(`M ${w*0.5} ${h*0.1} C ${w*0.2} ${h*0.1}, ${w*0.1} ${h*0.4}, ${w*0.2} ${h*0.7} C ${w*0.25} ${h*0.9}, ${w*0.75} ${h*0.9}, ${w*0.8} ${h*0.7} C ${w*0.9} ${h*0.4}, ${w*0.8} ${h*0.1}, ${w*0.5} ${h*0.1} Z`), color: '#A0522D', filled: false, name: 'Head' },
                            { path: new Path2D(`M ${w*0.15} ${h*0.4} C ${w*0.05} ${h*0.4}, ${w*0.1} ${h*0.2}, ${w*0.2} ${h*0.25} Z`), color: '#A0522D', filled: false, name: 'Left Ear' },
                            { path: new Path2D(`M ${w*0.85} ${h*0.4} C ${w*0.95} ${h*0.4}, ${w*0.9} ${h*0.2}, ${w*0.8} ${h*0.25} Z`), color: '#A0522D', filled: false, name: 'Right Ear' },
                            { path: new Path2D(`M ${w*0.5} ${h*0.25} C ${w*0.3} ${h*0.25}, ${w*0.25} ${h*0.5}, ${w*0.3} ${h*0.7} C ${w*0.35} ${h*0.8}, ${w*0.65} ${h*0.8}, ${w*0.7} ${h*0.7} C ${w*0.75} ${h*0.5}, ${w*0.7} ${h*0.25}, ${w*0.5} ${h*0.25} Z`), color: '#DEB887', filled: false, name: 'Face' },
                            { path: new Path2D(`M ${w*0.18} ${h*0.38} C ${w*0.12} ${h*0.38}, ${w*0.15} ${h*0.28}, ${w*0.2} ${h*0.29} Z`), color: '#FFC0CB', filled: false, name: 'Inner Ear' },
                            { path: new Path2D(`M ${w*0.82} ${h*0.38} C ${w*0.88} ${h*0.38}, ${w*0.85} ${h*0.28}, ${w*0.8} ${h*0.29} Z`), color: '#FFC0CB', filled: false, name: 'Inner Ear' },
                            { path: new Path2D(`M ${w*0.4} ${h*0.65} Q ${w*0.5} ${h*0.75} ${w*0.6} ${h*0.65}`), color: '#FF69B4', filled: false, name: 'Smile' }
                        ]
                    },
                    // Picture 2: Friendly Robot
                    {
                        colors: ['#C0C0C0', '#708090', '#FFD700', '#FF4500'],
                        shapes: [
                            { path: new Path2D(`M ${w*0.3} ${h*0.9} L ${w*0.3} ${h*0.5} L ${w*0.7} ${h*0.5} L ${w*0.7} ${h*0.9} Z`), color: '#C0C0C0', filled: false, name: 'Body' },
                            { path: new Path2D(`M ${w*0.4} ${h*0.5} L ${w*0.4} ${h*0.2} L ${w*0.6} ${h*0.2} L ${w*0.6} ${h*0.5} Z`), color: '#708090', filled: false, name: 'Neck' },
                            { path: new Path2D(`M ${w*0.35} ${h*0.2} a ${w*0.15} ${h*0.15} 0 1 0 ${w*0.3} 0 a ${w*0.15} ${h*0.15} 0 1 0 -${w*0.3} 0`), color: '#C0C0C0', filled: false, name: 'Head' },
                            { path: new Path2D(`M ${w*0.42} ${h*0.2} a ${w*0.03} ${h*0.03} 0 1 0 ${w*0.06} 0 a ${w*0.03} ${h*0.03} 0 1 0 -${w*0.06} 0`), color: '#FFD700', filled: false, name: 'Left Eye' },
                            { path: new Path2D(`M ${w*0.58} ${h*0.2} a ${w*0.03} ${h*0.03} 0 1 0 ${w*0.06} 0 a ${w*0.03} ${h*0.03} 0 1 0 -${w*0.06} 0`), color: '#FFD700', filled: false, name: 'Right Eye' },
                            { path: new Path2D(`M ${w*0.4} ${h*0.7} L ${w*0.6} ${h*0.7} L ${w*0.6} ${h*0.8} L ${w*0.4} ${h*0.8} Z`), color: '#FF4500', filled: false, name: 'Panel' }
                        ]
                    },
                    // Picture 3: Sailboat
                    {
                        colors: ['#87CEEB', '#A52A2A', '#FFFFFF', '#FFD700'],
                        shapes: [
                            { path: new Path2D(`M ${w*0.1} ${h*0.9} L ${w*0.9} ${h*0.9} L ${w*0.9} ${h*0.6} L ${w*0.1} ${h*0.6} Z`), color: '#87CEEB', filled: false, name: 'Water' },
                            { path: new Path2D(`M ${w*0.2} ${h*0.7} L ${w*0.8} ${h*0.7} L ${w*0.7} ${h*0.5} L ${w*0.3} ${h*0.5} Z`), color: '#A52A2A', filled: false, name: 'Boat' },
                            { path: new Path2D(`M ${w*0.5} ${h*0.5} L ${w*0.5} ${h*0.1} L ${w*0.8} ${h*0.4} Z`), color: '#FFFFFF', filled: false, name: 'Sail' },
                            { path: new Path2D(`M ${w*0.15} ${h*0.15} a ${w*0.05} ${h*0.05} 0 1 0 ${w*0.1} 0 a ${w*0.05} ${h*0.05} 0 1 0 -${w*0.1} 0`), color: '#FFD700', filled: false, name: 'Sun' }
                        ]
                    }
                ];
            }
            setupShapes() {
                const picture = this.pictures[this.currentPictureIndex];
                // The `setupPictures` function has already created fresh Path2D objects. We just need to copy them.
                this.shapes = picture.shapes.map(shape => ({ ...shape }));
                this.colors = picture.colors;
                this.setupPalette();
            }
            drawAllShapes() {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.shapes.forEach(shape => {
                    this.ctx.strokeStyle = '#333';
                    this.ctx.lineWidth = 3;
                    if (shape.filled) {
                        this.ctx.fillStyle = shape.color;
                        this.ctx.fill(shape.path);
                    }
                    this.ctx.stroke(shape.path);
                });
            }
            startTutorial() {
                this.tutorialActive = true;
                this.tutorialStep = 0;
                this.runTutorialStep();
            }
            runTutorialStep() {
                if (!this.tutorialActive) return;

                const pointer = document.getElementById('tutorial-pointer') || { style: {} };
                const palette = document.getElementById('color-palette-5') || { classList: { remove: () => {} } };
                const canvas = document.getElementById('paintCanvas') || { classList: { remove: () => {} } };
                
                // Cleanup previous step
                if(pointer.style) pointer.style.display = 'none';
                palette.classList.remove('tutorial-highlight');
                canvas.classList.remove('tutorial-highlight');

                switch (this.tutorialStep) {
                    case 0:
                        speak("First, pick a color from the palette on the left.", true);
                        pointer.style.display = 'block';
                        const paletteRect = palette.getBoundingClientRect ? palette.getBoundingClientRect() : { right: 100, top: 100, height: 100 };
                        pointer.style.transform = `translate(${paletteRect.right}px, ${paletteRect.top + paletteRect.height / 2}px)`;
                        palette.classList.add('tutorial-highlight');
                        setTimeout(() => this.runTutorialStep(), 4000);
                        break;
                    case 1:
                        speak("Then, click the matching shape on the canvas to color it in.", true);
                        const canvasRect = canvas.getBoundingClientRect();
                        pointer.style.transform = `translate(${canvasRect.left + canvasRect.width/2}px, ${canvasRect.top + canvasRect.height/2}px)`;
                        palette.classList.remove('tutorial-highlight');
                        canvas.classList.add('tutorial-highlight');
                        setTimeout(() => this.runTutorialStep(), 5000);
                        break;
                    case 2:
                        speak("Great! Now it's your turn. Good luck!", true);
                        canvas.classList.remove('tutorial-highlight');
                        this.endTutorial();
                        break;
                }
                this.tutorialStep++;
            }
            endTutorial() {
                this.tutorialActive = false;
                const pointer = document.getElementById('tutorial-pointer');
                if (pointer) pointer.style.display = 'none';
                // Now that the tutorial is over, start the game timer.
                this.updateTimer();
            }
            handleColoringStart(e) {
                if (!this.active || this.paused || this.tutorialActive || !this.selectedColor) { if (!this.selectedColor) { playTone(200, 0.2, 'square', 0.05); speak("First, pick a color from the palette on the left.", true); } return; }
                e.preventDefault();
                this.isColoring = true;
                this.handleColoringMove(e); // Immediately check for coloring
            }
            handleColoringMove(e) {
                if (!this.active || this.paused || !this.isColoring || !this.selectedColor) return;
                e.preventDefault();
                const rect = this.canvas.getBoundingClientRect();
                const x = (e.type.includes('touch') ? e.touches[0].clientX : e.clientX) - rect.left;
                const y = (e.type.includes('touch') ? e.touches[0].clientY : e.clientY) - rect.top;

                // Iterate backwards to click top-most shapes first
                for (let i = this.shapes.length - 1; i >= 0; i--) {
                    const shape = this.shapes[i];
                    if (!shape.filled && this.ctx.isPointInPath(shape.path, x, y)) {
                        if (this.selectedColor === shape.color) {
                            shape.filled = true;
                            this.score++;
                            const totalShapes = this.pictures.reduce((acc, p) => acc + p.shapes.length, 0);
                            updateProgressBar('hud-score5', '🎨 Shapes', this.score, totalShapes);
                            playTone(659, 0.2, 'sine', 0.1);
                            this.drawAllShapes();
                            // Check if all shapes are filled
                            if (this.shapes.every(s => s.filled)) {
                                setTimeout(() => {
                                    speak('Great job! You colored the whole picture! Here is a new one.', true);
                                    // this.score += 5; // Bonus for finishing - Removed to make progress bar more intuitive
                                    this.currentPictureIndex = (this.currentPictureIndex + 1) % this.pictures.length;
                                    this.setupShapes(); // Load the next picture
                                    this.drawAllShapes();
                                }, 500);
                            }
                        }
                        // We don't handle misses here, only successful coloring.
                        break; // Stop after finding the first shape
                    }
                }
            }
            handleColoringEnd(e) {
                if (!this.active || this.paused) return;
                e.preventDefault();
                this.isColoring = false;
            }
            updateTimer() {
                if (!this.active || this.paused) return; this.timerId = setTimeout(() => this.updateTimer(), 1000);
                document.getElementById('hud-timer5').innerHTML = `Time: ${formatTime(this.timeLeft)} <div class="progress-bar"><div class="progress-fill" id="timer-fill5" style="width: ${Math.min((300 - this.timeLeft) / 300 * 100, 100)}%"></div></div>`;
                this.timeLeft--;
                if (this.timeLeft < 0) {
                    this.stop();
                    const totalShapes = this.pictures.reduce((acc, p) => acc + p.shapes.length, 0);
                    const accuracy = totalShapes > 0 ? (this.score / totalShapes) * 100 : 0;
                    document.getElementById('final-score5').textContent = this.score;
                    document.getElementById('final-total5').textContent = totalShapes;
                    document.getElementById('final-accuracy5').textContent = `${accuracy.toFixed(0)}%`;
                    const timeSpent = now() - this.startTime;
                    document.getElementById('game-over5').style.display = 'block'; speak(`Time is up! You colored ${this.score} out of ${totalShapes} shapes. Well done!`, true); endSession(5, this.score, this.misses, timeSpent); }
            }
            stop() { super.stop(); window.removeEventListener('resize', this.boundResize); if(this.canvas) { this.canvas.removeEventListener('mousedown', this.boundStart); this.canvas.removeEventListener('touchstart', this.boundStart); this.canvas.removeEventListener('mousemove', this.boundMove); this.canvas.removeEventListener('touchmove', this.boundMove); this.canvas.removeEventListener('mouseup', this.boundEnd); this.canvas.removeEventListener('touchend', this.boundEnd); this.canvas.removeEventListener('mouseleave', this.boundEnd); } }
        }

class FruitDropGame extends BaseGame {
    constructor(level) {
        super(6, level, "The monkeys are hungry! Drag each fruit to the correct monkey.");
        this.currentFruit = null;
        this.isDragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.fruits = ['🍎', '🍌', '🍊', '🍇'];
        this.fruitTypes = ['apple', 'banana', 'orange', 'grape'];
        this.boundDragMove = this.handleDragMove.bind(this);
        this.boundDragEnd = this.handleDragEnd.bind(this);
    }

    start(container) {
        super.start(container);
        const html = `
            ${this._createHud('🍎 Dropped', '❌ Wrong')}
            <div id="fruit-drop-canvas" class="game-canvas" style="border-color: #ff6b35; background: rgba(255, 220, 210, 0.2); display: flex; justify-content: space-between; align-items: center; padding: 20px;">
                <div id="fruit-spawn-area" style="width: 50%; height: 100%; position: relative;"></div>
                <div id="monkeys6" style="display: flex; flex-direction: column; gap: 20px; z-index: 5;"></div>
            </div>
            <div id="game-over6" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; background: rgba(255, 215, 0, 0.9); padding: 40px; border-radius: 20px; color: #4a4a4a; display: none;">
                <h2>🍎 Performance Report 🍎</h2>
                <p>Correct Drops: <span id="final-score6">0</span></p>
                <p>Wrong Drops: <span id="final-misses6">0</span></p>
                <p>Accuracy: <span id="final-accuracy6">0%</span></p>
                <button class="btn btn-primary btn-small" onclick="currentGame.printCertificate('Fruit Drop Adventure', currentGame.score, currentGame.misses, totalAttempts > 0 ? (currentGame.score / totalAttempts) * 100 : 0)">Print Certificate</button>
                <button onclick="currentGame.start(document.getElementById('game-area'))">Feed Again!</button>
            </div>`;
        const css = `.fruit { position: absolute; font-size: 40px; cursor: grab; transition: transform 0.2s; z-index: 6; user-select: none; } .fruit.dragging { transform: rotate(10deg) scale(1.2); opacity: 0.8; cursor: grabbing; } .monkey-slot { width: 80px; height: 80px; border: 3px dashed #ff6b35; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 30px; margin: 10px 0; transition: all 0.3s; background: white; } .monkey-slot.drop-success { border-color: #4ecdc4; background: rgba(78, 205, 196, 0.2); transform: scale(1.1); } .monkey-slot.drop-fail { border-color: #ff4757; background: rgba(255, 71, 87, 0.2); animation: shake 0.5s ease; }`;
        this.container.innerHTML = html + `<style>${css}</style>`;
        
        const monkeysEl = document.getElementById('monkeys6');
        this.fruitTypes.forEach(type => {
            const slot = document.createElement('div');
            slot.className = 'monkey-slot';
            slot.textContent = '🐵';
            slot.dataset.fruit = type;
            monkeysEl.appendChild(slot);
        });
        
        this.createFruit();
        this.updateTimer();
    }

    createFruit() {
        if (!this.active || this.paused) return;
        if (this.currentFruit) this.currentFruit.remove();
        const spawnArea = document.getElementById('fruit-spawn-area');
        const idx = Math.floor(Math.random() * this.fruits.length);
        const fruit = document.createElement('div');
        fruit.className = 'fruit';
        fruit.textContent = this.fruits[idx];
        fruit.dataset.fruit = this.fruitTypes[idx];
        fruit.style.left = `${Math.random() * (spawnArea.offsetWidth - 60)}px`;
        fruit.style.top = `${Math.random() * (spawnArea.offsetHeight - 60)}px`;
        fruit.addEventListener('mousedown', this.handleDragStart.bind(this));
        fruit.addEventListener('touchstart', this.handleDragStart.bind(this), { passive: false });
        spawnArea.appendChild(fruit);
        this.currentFruit = fruit;
    }

    handleDragStart(e) {
        if (!this.active || this.paused || this.isDragging) return;
        e.preventDefault();
        this.isDragging = true;
        this.currentFruit.classList.add('dragging');
        const rect = this.currentFruit.getBoundingClientRect();
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        this.dragOffsetX = clientX - rect.left;
        this.dragOffsetY = clientY - rect.top;
        window.addEventListener('mousemove', this.boundDragMove);
        window.addEventListener('touchmove', this.boundDragMove, { passive: false });
        window.addEventListener('mouseup', this.boundDragEnd);
        window.addEventListener('touchend', this.boundDragEnd);
    }

    handleDragMove(e) {
        if (!this.isDragging || this.paused) return;
        e.preventDefault();
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        this.currentFruit.style.left = `${clientX - this.dragOffsetX}px`;
        this.currentFruit.style.top = `${clientY - this.dragOffsetY}px`;
    }

    handleDragEnd(e) {
        if (!this.isDragging || this.paused) return;
        e.preventDefault();
        this.isDragging = false;
        this.currentFruit.classList.remove('dragging');
        window.removeEventListener('mousemove', this.boundDragMove);
        window.removeEventListener('touchmove', this.boundDragMove);
        window.removeEventListener('mouseup', this.boundDragEnd);
        window.removeEventListener('touchend', this.boundDragEnd);

        const fruitRect = this.currentFruit.getBoundingClientRect();
        const droppedFruitType = this.currentFruit.dataset.fruit;
        let droppedOnSlot = false;

        document.querySelectorAll('.monkey-slot').forEach(slot => {
            const slotRect = slot.getBoundingClientRect();
            if (fruitRect.left < slotRect.right && fruitRect.right > slotRect.left && fruitRect.top < slotRect.bottom && fruitRect.bottom > slotRect.top) {
                droppedOnSlot = true;
                if (slot.dataset.fruit === droppedFruitType) {
                    this.score++;
                    updateProgressBar(`hud-score${this.gameNum}`, '🍎 Dropped', this.score, 25);
                    slot.classList.add('drop-success');
                    playTone(659, 0.2, 'sine', 0.1);
                    setTimeout(() => slot.classList.remove('drop-success'), 500);
                    this.currentFruit.remove();
                } else {
                    this.misses++;
                    updateProgressBar(`hud-misses${this.gameNum}`, '❌ Wrong', this.misses, 5, true);
                    slot.classList.add('drop-fail');
                    playTone(200, 0.3, 'square', 0.05);
                    speak("Oops, that's the wrong monkey!", true);
                    setTimeout(() => slot.classList.remove('drop-fail'), 500);
                    this.currentFruit.remove();
                }
            }
        });

        if (!droppedOnSlot) {
            this.currentFruit.remove();
        }
        this.createFruit();
    }

    updateTimer() {
        if (!this.active || this.paused) return;
        this.timerId = setTimeout(() => this.updateTimer(), 1000);
        this._updateTimerDisplay();
        this.timeLeft--;
        if (this.timeLeft < 0) {
            this.stop();
            const totalAttempts = this.score + this.misses;
            const accuracy = totalAttempts > 0 ? (this.score / totalAttempts) * 100 : 0;
            document.getElementById('final-score6').textContent = this.score;
            document.getElementById('final-misses6').textContent = this.misses;
            document.getElementById('final-accuracy6').textContent = `${accuracy.toFixed(0)}%`;
            document.getElementById('game-over6').style.display = 'block';
            const timeSpent = now() - this.startTime;
            speak(`Feeding time is over! You fed the monkeys correctly ${this.score} times with an accuracy of ${accuracy.toFixed(0)} percent.`, true); endSession(this.gameNum, this.score, this.misses, timeSpent);
        }
    }

    stop() {
        super.stop();
        if (this.currentFruit) this.currentFruit.remove();
        this.isDragging = false;
        window.removeEventListener('mousemove', this.boundDragMove);
        window.removeEventListener('touchmove', this.boundDragMove);
        window.removeEventListener('mouseup', this.boundDragEnd);
        window.removeEventListener('touchend', this.boundDragEnd);
    }
}

class ArtPuzzleGame extends BaseGame {
    constructor(level) {
        super(7, level, "Let's solve a puzzle! Drag the pictures from the left onto the matching words.");
        this.piecesPlacedThisRound = 0;
        this.defaultArtPieces = [
            { id: 'part1', src: 'Arts/Keyboard.png', name: 'Keyboard' },
            { id: 'part2', src: 'Arts/Mouse.png', name: 'Mouse' },
            { id: 'part3', src: 'Arts/Monitor.png', name: 'Monitor' },
            { id: 'part4', src: 'Arts/System Unit.png', name: 'System Unit' },
            { id: 'part5', src: 'Arts/Hand on mouse.png', name: 'Hand on Mouse' },
            { id: 'part6', src: 'Arts/Printer.png', name: 'Printer' },
            { id: 'part7', src: 'Arts/Speakers.png', name: 'Speakers' },
            { id: 'part8', src: 'Arts/Webcam.png', name: 'Webcam' }
        ];
        this.artPieces = [];
    }

    start(container) {
        super.start(container);
        this.piecesPlacedThisRound = 0;
        const html = `
            ${this._createHud('🎨 Pieces', '❌ Missed')}
            <div id="art-puzzle-canvas" class="game-canvas" style="border-color: #a8e6cf; background: rgba(220, 255, 240, 0.2); display: flex; align-items: center; gap: 20px; padding: 20px;">
                <div id="art-palette"></div>
                <div id="art-canvas" style="position: relative; width: 100%; height: 100%;"></div>
            </div>
            <div id="game-over7" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; background: rgba(135, 206, 235, 0.9); padding: 40px; border-radius: 20px; color: #4a4a4a; display: none;">
                <h2>🎨 Performance Report 🎨</h2>
                <p>Pieces Placed: <span id="final-score7">0</span></p>
                <p>Misses: <span id="final-misses7">0</span></p>
                <p>Accuracy: <span id="final-accuracy7">0%</span></p>
                <button class="btn btn-primary btn-small" onclick="currentGame.printCertificate('Art Puzzle', currentGame.score, currentGame.misses, totalAttempts > 0 ? (currentGame.score / totalAttempts) * 100 : 0)">Print Certificate</button>
                <button onclick="currentGame.start(document.getElementById('game-area'))">Create Again!</button>
            </div>`;
        const css = `
            @keyframes colorful-border { 0% { border-color: #ff6b6b; } 25% { border-color: #feca57; } 50% { border-color: #48dbfb; } 75% { border-color: #ff9ff3; } 100% { border-color: #ff6b6b; } }
            #art-palette { background: rgba(255,255,255,0.8); padding: 10px; border-radius: 15px; display: flex; flex-direction: column; gap: 15px; z-index: 10; }
            .art-piece { width: 80px; height: 80px; cursor: grab; transition: all 0.2s; user-select: none; object-fit: contain; }
            .art-piece:hover { transform: scale(1.1); }
            .art-piece.dragging { opacity: 0.5; transform: scale(1.2); cursor: grabbing; }
            .art-piece.placed { display: none; }
            .art-slot { position: absolute; width: 150px; height: 100px; border: 3px dashed #a8e6cf; border-radius: 10px; background-size: contain; background-repeat: no-repeat; background-position: center; transition: all 0.3s; animation: colorful-border 4s linear infinite; display: flex; align-items: center; justify-content: center; font-size: 24px; color: #4a4a4a; background-color: rgba(255,255,255,0.7); }
            .art-slot.drop-success { border-color: #4ecdc4; background-color: rgba(78, 205, 196, 0.3); transform: scale(1.05); }
            .art-slot.drop-fail { border-color: #ff4757; background-color: rgba(255, 71, 87, 0.3); animation: shake 0.5s ease; }`;
        this.container.innerHTML = html + `<style>${css}</style>`;
        this.artPieces = customArtPieces.length > 0 ? customArtPieces : this.defaultArtPieces;
        this.setupPuzzle();
        this.updateTimer();
    }

    setupPuzzle() {
        const palette = document.getElementById('art-palette');
        const canvas = document.getElementById('art-canvas');
        palette.innerHTML = '';
        canvas.innerHTML = '';
        this.piecesPlacedThisRound = 0;

        let piecesForLevel = [...this.artPieces];
        // Use settings.choices to determine how many pieces to use
        if (piecesForLevel.length > this.settings.choices) {
            piecesForLevel = piecesForLevel.sort(() => 0.5 - Math.random()).slice(0, this.settings.choices);
        }

        const shuffledPieces = [...piecesForLevel].sort(() => 0.5 - Math.random());
        const shuffledSlots = [...piecesForLevel].sort(() => 0.5 - Math.random());

        shuffledPieces.forEach(p => {
            const pieceEl = document.createElement('img');
            pieceEl.className = 'art-piece';
            pieceEl.src = p.src;
            pieceEl.alt = p.name;
            pieceEl.dataset.id = p.id;
            pieceEl.draggable = true;
            pieceEl.addEventListener('dragstart', e => {
                e.target.classList.add('dragging');
                e.dataTransfer.setData('text/plain', e.target.dataset.id);
            });
            pieceEl.addEventListener('dragend', e => e.target.classList.remove('dragging'));
            palette.appendChild(pieceEl);
        });

        shuffledSlots.forEach((p) => {
            const slotEl = document.createElement('div');
            slotEl.className = 'art-slot';
            slotEl.dataset.id = p.id;
            slotEl.textContent = p.name;
            slotEl.style.top = `${10 + Math.random() * 75}%`;
            slotEl.style.left = `${20 + Math.random() * 65}%`;
            slotEl.addEventListener('dragover', e => e.preventDefault());
            slotEl.addEventListener('drop', this.handleDrop.bind(this));
            canvas.appendChild(slotEl);
        });
    }

    handleDrop(e) {
        e.preventDefault();
        if (!this.active || this.paused) return;
        const droppedId = e.dataTransfer.getData('text/plain');
        const slot = e.target.closest('.art-slot');
        if (!slot) return;

        const correctPiece = this.artPieces.find(p => p.id === droppedId);

        if (droppedId === slot.dataset.id) {
            this.score++;
            this.piecesPlacedThisRound++;
            updateProgressBar(`hud-score${this.gameNum}`, '🎨 Pieces', this.score, 20);
            slot.classList.add('drop-success');
            playTone(659, 0.2, 'sine', 0.1);
            slot.textContent = '';
            slot.style.backgroundImage = `url(${correctPiece.src})`;
            document.querySelector(`.art-piece[data-id='${droppedId}']`).classList.add('placed');
            
            const totalPiecesInLevel = document.querySelectorAll('#art-canvas .art-slot').length;
            if (this.piecesPlacedThisRound === totalPiecesInLevel) {
                speak("Great job! Let's do another puzzle.", true);
                setTimeout(() => this.setupPuzzle(), 1000);
            }
        } else {
            this.misses++;
            updateProgressBar(`hud-misses${this.gameNum}`, '❌ Missed', this.misses, 10, true);
            slot.classList.add('drop-fail');
            playTone(200, 0.3, 'square', 0.05);
            speak("That piece doesn't fit here. Try another spot.", true);
            setTimeout(() => slot.classList.remove('drop-fail'), 500);
        }
    }

    updateTimer() {
        if (!this.active || this.paused) return;
        this.timerId = setTimeout(() => this.updateTimer(), 1000);
        this._updateTimerDisplay();
        this.timeLeft--;
        if (this.timeLeft < 0) {
            this.stop();
            const totalAttempts = this.score + this.misses;
            const accuracy = totalAttempts > 0 ? (this.score / totalAttempts) * 100 : 0;
            document.getElementById('final-score7').textContent = this.score;
            document.getElementById('final-misses7').textContent = this.misses;
            document.getElementById('final-accuracy7').textContent = `${accuracy.toFixed(0)}%`;
            document.getElementById('game-over7').style.display = 'block';
            const timeSpent = now() - this.startTime;
            speak(`Puzzle time is over! You placed ${this.score} pieces correctly with an accuracy of ${accuracy.toFixed(0)} percent.`, true); endSession(this.gameNum, this.score, this.misses, timeSpent);
        }
    }
}

class SentenceScribeGame extends BaseGame {
    constructor(level) {
        super(8, level, "Let's practice typing sentences! Type the sentence exactly as you see it.");
        this.sentenceTimeout = null;
        this.currentSentence = '';
        this.typedIndex = 0;
        this.sentenceList = {
            easy: ["the cat is on the mat", "a red bug ran", "the sun is hot", "i can see a pig", "we like to play", "my dog is big", "i like my mom", "the sky is blue", "we can run fast", "he has a new toy"],
            medium: ["The quick brown fox jumps over the lazy dog.", "Monkeys love to eat yellow bananas.", "School is a fun place to learn new things.", "Reading books is a great way to learn.", "What is your favorite game to play outside?", "Let's build a tall tower with these blocks."],
            hard: ["The jungle is a wonderful, exciting place to play with all my friends!", "Practice makes perfect, so let's keep on typing every day!", "Computers can help us learn and create amazing art.", "Technology helps us connect with people all over the world.", "The beautiful rainbow appeared after the rain stopped.", "Problem-solving is fun when we work together as a team."]
        };
        this.currentSentenceList = this.sentenceList[level];
    }

    handleKey(e) {
        initGlobalAudio();
        if (!this.active || this.paused) return;
        const sentenceEl = document.getElementById('current-sentence');
        if (!sentenceEl) return;

        if (e.key === 'Backspace' && this.typedIndex > 0) {
            this.typedIndex--;
            this.updateSentenceDisplay();
            return;
        }

        if (e.key.length > 1 && e.key !== 'Dead') return;

        const expectedChar = this.currentSentence[this.typedIndex];
        if (e.key === expectedChar) {
            this.typedIndex++;
            this.updateSentenceDisplay();
            playTone(440 + (this.typedIndex * 10), 0.1, 'sine', 0.05);

            if (this.typedIndex === this.currentSentence.length) {
                clearTimeout(this.sentenceTimeout);
                this.score++;
                updateProgressBar(`hud-score${this.gameNum}`, '📜 Sentences', this.score, 15);
                sentenceEl.classList.add('correct');
                playTone(880, 0.3, 'sine', 0.1);
                setTimeout(() => {
                    sentenceEl.classList.remove('correct');
                    this.updateSentence();
                }, 500);
            }
        } else {
            this.misses++;
            updateProgressBar(`hud-misses${this.gameNum}`, '❌ Missed', this.misses, 20, true);
            sentenceEl.classList.add('wrong');
            playTone(200, 0.2, 'square', 0.05);
            speak("Oops!", true);
            setTimeout(() => sentenceEl.classList.remove('wrong'), 500);
        }
    }

    start(container) {
        super.start(container);
        const html = `
            ${this._createHud('📜 Sentences', '❌ Missed')}
            <div id="sentence-scribe-canvas" class="game-canvas" style="border-color: #ffb8b8; background: rgba(255, 230, 230, 0.2); display: flex; align-items: center; justify-content: center;">
                <div id="current-sentence" style="font-size: 4vw; max-width: 80%; font-weight: bold; color: #ff6b35; text-shadow: 1px 1px 2px rgba(0,0,0,0.2); user-select: none; text-align: center; background: rgba(255,255,255,0.8); padding: 20px; border-radius: 15px;"></div>
            </div>
            <div id="game-over8" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; background: rgba(255, 215, 0, 0.9); padding: 40px; border-radius: 20px; color: #4a4a4a; display: none;">
                <h2>📜 Performance Report 📜</h2>
                <p>Sentences Typed: <span id="final-score8">0</span></p>
                <p>Mistakes: <span id="final-misses8">0</span></p>
                <p>Accuracy: <span id="final-accuracy8">0%</span></p>
                <button class="btn btn-primary btn-small" onclick="currentGame.printCertificate('Sentence Scribe', currentGame.score, currentGame.misses, totalCharsTyped > 0 ? ((totalCharsTyped - currentGame.misses) / totalCharsTyped) * 100 : 0)">Print Certificate</button>
                <button onclick="currentGame.start(document.getElementById('game-area'))">Scribe Again!</button>
            </div>`;
        const css = `#current-sentence.correct { color: #4ecdc4; } #current-sentence.wrong { animation: shake 0.5s ease; } .typed-char { color: #4ecdc4; } .untyped-char { color: #a0a0a0; }`;
        this.container.innerHTML = html + `<style>${css}</style>`;
        window.gameKeyHandler = this.handleKey.bind(this);
        window.addEventListener('keydown', window.gameKeyHandler);
        this.updateSentence();
        this.updateTimer();
    }

    updateSentence() {
        this.currentSentence = this.currentSentenceList[Math.floor(Math.random() * this.currentSentenceList.length)];
        this.typedIndex = 0;
        this.updateSentenceDisplay();
    }

    updateSentenceDisplay() {
        const typedPart = this.currentSentence.substring(0, this.typedIndex);
        const untypedPart = this.currentSentence.substring(this.typedIndex);
        document.getElementById('current-sentence').innerHTML = `<span class="typed-char">${typedPart}</span><span class="untyped-char">${untypedPart}</span>`;
    }

    updateTimer() {
        if (!this.active || this.paused) return;
        this.timerId = setTimeout(() => this.updateTimer(), 1000);
        this._updateTimerDisplay();
        this.timeLeft--;
        if (this.timeLeft < 0) {
            this.stop();
            const totalCharsTyped = this.score * (this.currentSentence?.length || 10) + this.misses; // Approximate
            const accuracy = totalCharsTyped > 0 ? ((totalCharsTyped - this.misses) / totalCharsTyped) * 100 : 0;
            document.getElementById('final-score8').textContent = this.score;
            document.getElementById('final-misses8').textContent = this.misses;
            document.getElementById('final-accuracy8').textContent = `${accuracy.toFixed(0)}%`;
            document.getElementById('game-over8').style.display = 'block';
            const timeSpent = now() - this.startTime;
            speak(`Time's up! You typed ${this.score} sentences with about ${accuracy.toFixed(0)} percent accuracy.`, true); endSession(this.gameNum, this.score, this.misses, timeSpent);
        }
    }

    stop() {
        super.stop();
        clearTimeout(this.sentenceTimeout);
        window.removeEventListener('keydown', window.gameKeyHandler);
    }
}

class StorySelfGame extends BaseGame {
    constructor(level) {
        super(9, level, "Let's write about you! Type your answer to the question and press the 'Done!' button.");
        this.prompts = ["My name is...", "My favorite color is...", "I like to play with...", "My favorite animal is a...", "For fun, I like to...", "Today I feel...", "My best friend is...", "I am good at...", "My favorite food is...", "When I grow up, I want to be...", "A place I want to visit is...", "Something that makes me laugh is...", "My favorite book or story is...", "If I had a superpower, it would be..."];
        this.currentPromptIndex = 0;
    }

    start(container) {
        super.start(container);
        this.currentPromptIndex = 0;
        const html = `
            ${this._createHud('✍️ Stories')}
            <div id="story-self-canvas" class="game-canvas" style="border-color: #feca57; background: rgba(255, 248, 225, 0.2); display: flex; align-items: center; justify-content: center;">
                <div id="story-self-area" style="text-align: center; width: 80%; max-width: 800px;">
                    <h2 id="story-prompt" style="font-size: 4vw; color: #ff6b35;"></h2>
                    <textarea id="story-input" placeholder="Type your sentence here..." style="width: 100%; height: 100px; font-size: 2vw; padding: 10px; border-radius: 15px; border: 3px solid #4ecdc4; margin-top: 20px; font-family: inherit;"></textarea>
                    <button id="story-submit" class="btn btn-primary" style="margin-top: 20px; font-size: 24px;">Done! 👍</button>
                </div>
            </div>
            <div id="game-over9" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; background: rgba(255, 215, 0, 0.9); padding: 40px; border-radius: 20px; color: #4a4a4a; display: none;">
                <h2>✍️ Performance Report ✍️</h2>
                <p>You wrote <span id="final-score9">0</span> sentences about yourself!</p>
                <p>Great job expressing yourself!</p>
                <button class="btn btn-primary btn-small" onclick="currentGame.printCertificate('Story Self', currentGame.score, 0, 100)">Print Certificate</button>
                <button onclick="currentGame.start(document.getElementById('game-area'))">Write More!</button>
            </div>`;
        this.container.innerHTML = html;
        document.getElementById('story-submit').onclick = this.submitAnswer.bind(this);
        this.updatePrompt();
        this.updateTimer();
    }

    updatePrompt() {
        if (this.currentPromptIndex >= this.prompts.length) {
            this.currentPromptIndex = 0; // Loop back
        }
        document.getElementById('story-prompt').textContent = this.prompts[this.currentPromptIndex];
        const storyInput = document.getElementById('story-input');
        storyInput.value = '';
        storyInput.focus();
    }

    submitAnswer() {
        if (this.paused) return;
        const answer = document.getElementById('story-input').value.trim();
        if (answer.length > 2) {
            this.score++;
            updateProgressBar(`hud-score${this.gameNum}`, '✍️ Stories', this.score, this.prompts.length);
            playTone(880, 0.3, 'sine', 0.1);
            this.currentPromptIndex++;
            this.updatePrompt();
        } else {
            playTone(200, 0.2, 'square', 0.05);
            speak("Try writing a little more!", true);
        }
    }

    updateTimer() {
        if (!this.active || this.paused) return;
        this.timerId = setTimeout(() => this.updateTimer(), 1000);
        this._updateTimerDisplay();
        this.timeLeft--;
        if (this.timeLeft < 0) {
            this.stop();
            document.getElementById('final-score9').textContent = this.score;
            const timeSpent = now() - this.startTime;
            document.getElementById('game-over9').style.display = 'block'; speak(`Time's up! You wrote ${this.score} sentences about yourself. Great job!`, true);
            endSession(this.gameNum, this.score, 0, timeSpent);
        }
    }
}

class PcPartPickerGame extends BaseGame {
    constructor(level) {
        super(10, level, "Let's learn computer parts! Click on the part I name.");
        this.parts = [{ name: 'Monitor' }, { name: 'Keyboard' }, { name: 'Mouse' }, { name: 'System Unit' }, { name: 'Hand on mouse' }, { name: 'Printer' }, { name: 'Speakers' }, { name: 'Webcam' }];
        this.partsToFind = [];
        this.currentPart = null;
    }

    start(container) {
        super.start(container);
        const html = `
            ${this._createHud('🖱️ Found', '❌ Missed')}
            <div id="pc-part-picker-canvas" class="game-canvas" style="border-color: #48dbfb; background: rgba(210, 245, 255, 0.2);">
                <div id="pc-picker-container" style="text-align: center; width: 100%; height: 100%; display: flex; flex-direction: column; justify-content: center; align-items: center;">
                    <h2 id="part-prompt" style="font-size: 4vw; color: #ff6b35; margin-bottom: 20px; text-shadow: 1px 1px 2px rgba(0,0,0,0.2);"></h2>
                    <div id="pc-picker-area" style="display: flex; justify-content: center; align-items: center; gap: 20px; flex-wrap: wrap; padding: 0 20px;"></div>
                </div>
            </div>
            <div id="game-over10" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; background: rgba(255, 215, 0, 0.9); padding: 40px; border-radius: 20px; color: #4a4a4a; display: none;">
                <h2>🖱️ Performance Report 🖱️</h2>
                <p>Parts Found: <span id="final-score10">0</span></p>
                <p>Misses: <span id="final-misses10">0</span></p>
                <p>Accuracy: <span id="final-accuracy10">0%</span></p>
                <button class="btn btn-primary btn-small" onclick="currentGame.printCertificate('PC Part Picker', currentGame.score, currentGame.misses, totalAttempts > 0 ? (currentGame.score / totalAttempts) * 100 : 0)">Print Certificate</button>
                <button onclick="currentGame.start(document.getElementById('game-area'))">Identify More!</button>
            </div>`;
        const css = `.pc-part-img { max-width: 150px; max-height: 150px; cursor: pointer; border: 5px solid transparent; border-radius: 15px; transition: all 0.2s ease; background: rgba(255,255,255,0.6); padding: 5px; } .pc-part-img:hover { transform: scale(1.1); border-color: #ffc107; }`;
        this.container.innerHTML = html + `<style>${css}</style>`;
        this.populateParts();
        this.nextRound();
        this.updateTimer();
    }

    nextRound() {
        this.partsToFind = [...this.parts].sort(() => 0.5 - Math.random());
        this.nextPart();
    }

    nextPart() {
        if (this.partsToFind.length === 0) {
            speak("Great job! You found all the parts. Let's start a new round.", true);
            this.populateParts();
            this.nextRound();
            return;
        }
        this.currentPart = this.partsToFind.pop();
        if (this.currentPart) {
            document.getElementById('part-prompt').textContent = `Click on the ${this.currentPart.name}`;
            speak(`Click on the ${this.currentPart.name}`, true);
        }
    }

    populateParts() {
        const area = document.getElementById('pc-picker-area');
        area.innerHTML = '';
        this.parts.forEach(part => {
            const img = document.createElement('img');
            img.src = `Arts/${part.name}.png`;
            img.alt = part.name;
            img.dataset.name = part.name;
            img.className = 'pc-part-img';
            img.onclick = this.handleClick.bind(this);
            img.onerror = function() { this.style.display = 'none'; };
            area.appendChild(img);
        });
    }

    handleClick(e) {
        if (!this.active || this.paused || !this.currentPart) return;
        const clickedPartName = e.target.dataset.name;

        if (clickedPartName === this.currentPart.name) {
            this.score++;
            updateProgressBar(`hud-score${this.gameNum}`, '🖱️ Found', this.score, this.parts.length);
            playTone(880, 0.2, 'sine', 0.1);
            e.target.style.transition = 'transform 0.3s, opacity 0.3s';
            e.target.style.transform = 'scale(0)';
            e.target.style.opacity = '0';
            setTimeout(() => this.nextPart(), 300);
        } else {
            this.misses++;
            updateProgressBar(`hud-misses${this.gameNum}`, '❌ Missed', this.misses, 5, true);
            playTone(200, 0.3, 'square', 0.05);
            speak("Oops, that's not it. Try again.", true);
            e.target.style.animation = 'shake 0.5s ease';
            setTimeout(() => { e.target.style.animation = ''; }, 500);
        }
    }

    updateTimer() {
        if (!this.active || this.paused) return;
        this.timerId = setTimeout(() => this.updateTimer(), 1000);
        this._updateTimerDisplay();
        this.timeLeft--;
        if (this.timeLeft < 0) {
            this.stop();
            const totalAttempts = this.score + this.misses;
            const accuracy = totalAttempts > 0 ? (this.score / totalAttempts) * 100 : 0;
            document.getElementById('final-score10').textContent = this.score;
            document.getElementById('final-misses10').textContent = this.misses;
            document.getElementById('final-accuracy10').textContent = `${accuracy.toFixed(0)}%`;
            document.getElementById('game-over10').style.display = 'block';
            const timeSpent = now() - this.startTime;
            speak(`Time's up! You identified ${this.score} computer parts with ${accuracy.toFixed(0)} percent accuracy. Great work!`, true); endSession(this.gameNum, this.score, this.misses, timeSpent);
        }
    }
}

class ParagraphProGame extends BaseGame {
    constructor(level) {
        super(12, level, "Write a short paragraph about the topic. Try to write at least two sentences!");
        this.prompts = [
            "My favorite day of the week is...",
            "If I could have any pet, I would choose...",
            "A fun day at the park would be...",
            "My dream vacation is to go to...",
            "Something that makes me happy is...",
            "If I was a superhero, my power would be...",
            "My favorite thing to do at school is...",
            "The best movie I ever saw was..."
        ];
        this.currentPromptIndex = 0;
    }

    start(container) {
        super.start(container);
        this.currentPromptIndex = 0;
        const html = `
            ${this._createHud('📝 Paragraphs')}
            <div id="paragraph-pro-canvas" class="game-canvas" style="border-color: #82ccdd; background: rgba(220, 240, 255, 0.2); display: flex; align-items: center; justify-content: center;">
                <div id="paragraph-pro-area" style="text-align: center; width: 80%; max-width: 900px;">
                    <h2 id="paragraph-prompt" style="font-size: clamp(24px, 4vw, 38px); color: #ff6b35;"></h2>
                    <textarea id="paragraph-input" placeholder="Start writing your paragraph here..." style="width: 100%; height: 150px; font-size: clamp(16px, 2vw, 22px); padding: 15px; border-radius: 15px; border: 3px solid #4ecdc4; margin-top: 20px; font-family: inherit; box-sizing: border-box;"></textarea>
                    <button id="paragraph-submit" class="btn btn-primary" style="margin-top: 20px; font-size: 24px;">I'm Done! 🚀</button>
                </div>
            </div>
            <div id="game-over12" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; background: rgba(255, 215, 0, 0.9); padding: 40px; border-radius: 20px; color: #4a4a4a; display: none;">
                <h2>📝 Performance Report 📝</h2>
                <p>You wrote <span id="final-score12">0</span> amazing paragraphs!</p>
                <p>Fantastic writing!</p>
                <button class="btn btn-primary btn-small" onclick="currentGame.printCertificate('Paragraph Pro', currentGame.score, 0, 100)">Print Certificate</button>
                <button onclick="currentGame.start(document.getElementById('game-area'))">Write Again!</button>
            </div>`;
        this.container.innerHTML = html;
        document.getElementById('paragraph-submit').onclick = this.submitParagraph.bind(this);
        this.updatePrompt();
        this.updateTimer();
    }

    updatePrompt() {
        this.currentPromptIndex = (this.currentPromptIndex) % this.prompts.length;
        document.getElementById('paragraph-prompt').textContent = this.prompts[this.currentPromptIndex];
        const inputArea = document.getElementById('paragraph-input');
        inputArea.value = '';
        inputArea.focus();
    }

    submitParagraph() {
        if (this.paused) return;
        const answer = document.getElementById('paragraph-input').value.trim();
        const sentenceCount = (answer.match(/[.!?]/g) || []).length;
        if (answer.length > 20 && sentenceCount >= 2) {
            this.score++;
            updateProgressBar(`hud-score${this.gameNum}`, '📝 Paragraphs', this.score, 10);
            playTone(880, 0.4, 'sine', 0.1);
            this.currentPromptIndex++;
            this.updatePrompt();
        } else {
            playTone(200, 0.3, 'square', 0.05);
            speak("That's a great start! Try to write at least two full sentences.", true);
        }
    }

    updateTimer() {
        if (!this.active || this.paused) return;
        this.timerId = setTimeout(() => this.updateTimer(), 1000);
        this._updateTimerDisplay();
        this.timeLeft--;
        if (this.timeLeft < 0) {
            this.stop();
            document.getElementById('final-score12').textContent = this.score;
            const timeSpent = now() - this.startTime;
            document.getElementById('game-over12').style.display = 'block'; speak(`Time is up! You wrote ${this.score} paragraphs. Excellent work!`, true);
            endSession(this.gameNum, this.score, 0, timeSpent);
        }
    }

    stop() {
        super.stop();
    }
}

class NumberMatchingGame extends BaseGame {
    constructor(level) {
        super(11, level, "Count the items! Drag the number to the box with the matching amount.");
        this.items = ['⭐', '🍌', '🍎', '❤️', '🚗', '🎈'];
        this.tutorialActive = false;
        this.tutorialStep = 0;
    }

    start(container) {
        super.start(container);
        const html = `
            ${this._createHud('🔢 Matched', '❌ Wrong')}
            <div id="number-matching-canvas" class="game-canvas" style="border-color: #4ecdc4; background: rgba(220, 250, 245, 0.2);">
                <div id="number-matching-area">
                    <div id="number-drag-container"></div>
                    <div id="item-groups-container"></div>
                </div>
            </div>
            <div id="game-over11" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; background: rgba(135, 206, 235, 0.9); padding: 40px; border-radius: 20px; color: #4a4a4a; display: none;">
                <h2>🔢 Performance Report 🔢</h2>
                <p>Correct Matches: <span id="final-score11">0</span></p>
                <p>Misses: <span id="final-misses11">0</span></p>
                <p>Accuracy: <span id="final-accuracy11">0%</span></p>
                <button class="btn btn-primary btn-small" onclick="currentGame.printCertificate('Number Matching', currentGame.score, currentGame.misses, totalAttempts > 0 ? (currentGame.score / totalAttempts) * 100 : 0)">Print Certificate</button>
                <button onclick="currentGame.start(document.getElementById('game-area'))">Count Again!</button>
            </div>`;
        const css = `
            #number-matching-area { display: flex; width: 100%; height: 100%; justify-content: space-between; align-items: center; padding: 20px; box-sizing: border-box; }
            #number-drag-container { flex-basis: 20%; text-align: center; }
            #item-groups-container { flex-basis: 75%; display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
            .number-to-drag { font-size: 150px; color: #ff6b35; cursor: grab; user-select: none; text-shadow: 3px 3px 5px rgba(0,0,0,0.2); transition: transform 0.2s; }
            .number-to-drag.dragging { transform: scale(1.2); opacity: 0.7; cursor: grabbing; }
            .item-group { border: 4px dashed #4ecdc4; border-radius: 20px; background: rgba(255,255,255,0.7); padding: 15px; display: flex; flex-wrap: wrap; justify-content: center; align-items: center; min-height: 150px; transition: all 0.3s; }
            .item-group.drop-success { border-color: #4caf50; background: rgba(76, 175, 80, 0.3); transform: scale(1.05); }
            .item-group.drop-fail { border-color: #f44336; background: rgba(244, 67, 54, 0.3); animation: shake 0.5s ease; }
            .item-group span { font-size: 40px; margin: 5px; }
        `;
        this.container.innerHTML = html + `<style>${css}</style>`;
        this.setupRound(true); // Pass true to indicate it's for a tutorial
        this.startTutorial();
    }

    setupRound() {
        const numberContainer = document.getElementById('number-drag-container');
        const groupsContainer = document.getElementById('item-groups-container');
        numberContainer.innerHTML = '';
        groupsContainer.innerHTML = '';

        const maxNum = this.level === 'easy' ? 5 : (this.level === 'medium' ? 10 : 15);
        const minNum = this.level === 'easy' ? 1 : 3;
        const numChoices = this.settings.choices; // This now works correctly

        const correctNum = Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum;
        const itemEmoji = this.items[Math.floor(Math.random() * this.items.length)];

        // Create number to drag
        const numberEl = document.createElement('div');
        numberEl.textContent = correctNum;
        numberEl.className = 'number-to-drag';
        numberEl.draggable = true;
        numberEl.addEventListener('dragstart', this.handleDragStart.bind(this));
        numberContainer.appendChild(numberEl);

        // Create item groups
        let choices = [correctNum];
        while (choices.length < numChoices) {
            const wrongNum = Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum;
            if (!choices.includes(wrongNum)) {
                choices.push(wrongNum);
            }
        }
        choices.sort(() => Math.random() - 0.5); // Shuffle choices

        choices.forEach(num => {
            const groupEl = document.createElement('div');
            groupEl.className = 'item-group';
            groupEl.dataset.count = num;
            groupEl.innerHTML = `<span>${itemEmoji}</span>`.repeat(num);
            groupEl.addEventListener('dragover', e => e.preventDefault());
            groupEl.addEventListener('drop', this.handleDrop.bind(this));
            groupsContainer.appendChild(groupEl);
        });
    }

    startTutorial() {
        this.tutorialActive = true;
        this.tutorialStep = 0;
        this.runTutorialStep();
    }

    runTutorialStep() {
        if (!this.tutorialActive) return;

        const pointer = document.getElementById('tutorial-pointer');
        const numberEl = document.querySelector('.number-to-drag');
        const groupsContainer = document.getElementById('item-groups-container');
        const correctGroup = document.querySelector(`.item-group[data-count="${numberEl.textContent}"]`);

        // Cleanup previous step
        pointer.style.display = 'none';
        pointer.style.transition = 'transform 0.5s ease-in-out';
        numberEl.classList.remove('tutorial-highlight');
        groupsContainer.classList.remove('tutorial-highlight');

        switch (this.tutorialStep) {
            case 0:
                speak("First, look at the number on the left. This is the number you need to match.", true);
                pointer.style.display = 'block';
                const numRect = numberEl.getBoundingClientRect();
                pointer.style.transform = `translate(${numRect.left + numRect.width / 2}px, ${numRect.top - 30}px)`;
                numberEl.classList.add('tutorial-highlight');
                setTimeout(() => this.runTutorialStep(), 4000);
                break;
            case 1:
                speak("Next, find the box on the right that has the same number of items.", true);
                pointer.style.display = 'block';
                const groupsRect = groupsContainer.getBoundingClientRect();
                pointer.style.transform = `translate(${groupsRect.left + groupsRect.width / 2}px, ${groupsRect.top - 30}px)`;
                numberEl.classList.remove('tutorial-highlight');
                groupsContainer.classList.add('tutorial-highlight');
                setTimeout(() => this.runTutorialStep(), 5000);
                break;
            case 2:
                speak("Then, drag the number and drop it onto the correct box, like this!", true);
                groupsContainer.classList.remove('tutorial-highlight');
                const startRect = numberEl.getBoundingClientRect();
                const endRect = correctGroup.getBoundingClientRect();
                pointer.style.display = 'block';
                pointer.style.transform = `translate(${startRect.left + startRect.width / 2}px, ${startRect.top + startRect.height / 2}px)`;
                setTimeout(() => {
                    pointer.style.transition = 'transform 1.5s ease-in-out';
                    pointer.style.transform = `translate(${endRect.left + endRect.width / 2}px, ${endRect.top + endRect.height / 2}px)`;
                }, 500);
                setTimeout(() => this.runTutorialStep(), 6000);
                break;
            case 3:
                speak("Great! Now it's your turn. Good luck!", true);
                this.endTutorial();
                break;
        }
        this.tutorialStep++;
    }

    handleDragStart(e) {
        if (this.tutorialActive || this.paused) { e.preventDefault(); return; }
        e.dataTransfer.setData('text/plain', e.target.textContent);
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
    }

    handleDrop(e) {
        e.preventDefault();
        if (this.tutorialActive || this.paused) return;
        const droppedNum = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const group = e.target.closest('.item-group');
        document.querySelector('.number-to-drag').classList.remove('dragging');

        if (group && parseInt(group.dataset.count, 10) === droppedNum) {
            this.score++;
            updateProgressBar(`hud-score${this.gameNum}`, '🔢 Matched', this.score, 20);
            group.classList.add('drop-success');
            playTone(880, 0.3, 'sine', 0.1);
            speak("That's it!", true);
            setTimeout(() => this.setupRound(), 1000);
        } else {
            this.misses++;
            updateProgressBar(`hud-misses${this.gameNum}`, '❌ Wrong', this.misses, 3, true);
            if (group) group.classList.add('drop-fail');
            playTone(200, 0.3, 'square', 0.05);
            speak("Not quite, try again!", true);
            setTimeout(() => group?.classList.remove('drop-fail'), 500);
        }
    }

    endTutorial() {
        this.tutorialActive = false;
        const pointer = document.getElementById('tutorial-pointer');
        if (pointer) pointer.style.display = 'none';
        document.querySelectorAll('.tutorial-highlight').forEach(el => el.classList.remove('tutorial-highlight'));
        this.updateTimer();
    }

    updateTimer() {
        if (!this.active || this.paused) return;
        this.timerId = setTimeout(() => this.updateTimer(), 1000);
        this._updateTimerDisplay();
        this.timeLeft--;
        if (this.timeLeft < 0) {
            this.stop();
            const totalAttempts = this.score + this.misses;
            const accuracy = totalAttempts > 0 ? (this.score / totalAttempts) * 100 : 0;
            document.getElementById('final-score11').textContent = this.score;
            document.getElementById('final-misses11').textContent = this.misses;
            document.getElementById('final-accuracy11').textContent = `${accuracy.toFixed(0)}%`;
            document.getElementById('game-over11').style.display = 'block';
            const timeSpent = now() - this.startTime;
            speak(`Time is up! You matched ${this.score} numbers with ${accuracy.toFixed(0)} percent accuracy.`, true); endSession(this.gameNum, this.score, this.misses, timeSpent);
        }
    }

    stop() {
        super.stop();
        this.tutorialActive = false; // Ensure tutorial stops if game is exited early
    }
}

class CandySorterGame extends BaseGame {
    constructor(level) {
        super(13, level, "Let's sort some candy! Drag each sweet treat to the matching jar.");
        this.candies = [
            { emoji: '🍭', type: 'lollipop' },
            { emoji: '🍬', type: 'candy' },
            { emoji: '🍫', type: 'chocolate' },
            { emoji: '🍩', type: 'donut' }
        ];
        this.candyTypes = this.candies.map(c => c.type);
        this.currentCandy = null;
        this.isDragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.boundDragMove = this.handleDragMove.bind(this);
        this.boundDragEnd = this.handleDragEnd.bind(this);
    }

    start(container) {
        super.start(container);
        const html = `
            ${this._createHud('🍬 Sorted', '❌ Wrong')}
            <div id="candy-sorter-canvas" class="game-canvas" style="border-color: #ffc0cb; background: rgba(255, 230, 235, 0.2);">
                <div id="candy-jars13" style="position: absolute; bottom: 20px; left: 0; right: 0; display: flex; justify-content: center; gap: 30px; z-index: 1;"></div>
            </div>
            <div id="game-over13" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; background: rgba(255, 182, 193, 0.9); padding: 40px; border-radius: 20px; color: #4a4a4a; display: none;">
                <h2>🍬 Sweet Sorting! 🍬</h2>
                <p>Correctly Sorted: <span id="final-score13">0</span></p>
                <p>Mistakes: <span id="final-misses13">0</span></p>
                <p>Accuracy: <span id="final-accuracy13">0%</span></p>
                <button class="btn btn-primary btn-small" onclick="currentGame.printCertificate('Candy Sorter', currentGame.score, currentGame.misses, (currentGame.score + currentGame.misses) > 0 ? (currentGame.score / (currentGame.score + currentGame.misses)) * 100 : 0)">Print Certificate</button>
                <button onclick="currentGame.start(document.getElementById('game-area'))">Sort Again!</button>
            </div>`;
        const css = `
            .candy-item { position: absolute; font-size: 50px; cursor: grab; transition: transform 0.2s; z-index: 10; user-select: none; filter: drop-shadow(3px 3px 5px rgba(0,0,0,0.3)); }
            .candy-item.dragging { transform: rotate(15deg) scale(1.2); opacity: 0.8; cursor: grabbing; }
            .candy-jar { width: 100px; height: 120px; border: 5px solid #ff6b35; border-radius: 10px 10px 30px 30px; background: rgba(255,255,255,0.6); display: flex; align-items: center; justify-content: center; font-size: 40px; transition: all 0.3s; position: relative; }
            .candy-jar::before { content: ''; position: absolute; top: -10px; left: 50%; transform: translateX(-50%); width: 80px; height: 15px; background: #ff6b35; border-radius: 10px; }
            .candy-jar.drop-success { border-color: #4ecdc4; background: rgba(78, 205, 196, 0.3); transform: scale(1.1); }
            .candy-jar.drop-fail { border-color: #ff4757; background: rgba(255, 71, 87, 0.3); animation: shake 0.5s ease; }
        `;
        this.container.innerHTML = html + `<style>${css}</style>`;

        const jarsEl = document.getElementById('candy-jars13');
        this.candies.slice(0, this.settings.choices).forEach(candyInfo => {
            const jar = document.createElement('div');
            jar.className = 'candy-jar';
            jar.textContent = candyInfo.emoji;
            jar.dataset.type = candyInfo.type;
            jarsEl.appendChild(jar);
        });

        this.createCandy();
        this.updateTimer(); // Start the game timer
    }

    createCandy() {
        if (!this.active || this.paused) return;
        const canvas = document.getElementById('candy-sorter-canvas');
        if (this.currentCandy) this.currentCandy.remove();
        
        const availableCandies = this.candies.slice(0, this.settings.choices);
        const candyInfo = availableCandies[Math.floor(Math.random() * availableCandies.length)];

        const candyEl = document.createElement('div');
        candyEl.className = 'candy-item';
        candyEl.textContent = candyInfo.emoji;
        candyEl.dataset.type = candyInfo.type;
        candyEl.style.left = `${Math.random() * (canvas.offsetWidth - 100) + 50}px`;
        candyEl.style.top = '20px';
        candyEl.addEventListener('mousedown', (e) => this.handleDragStart(e, candyEl));
        candyEl.addEventListener('touchstart', (e) => this.handleDragStart(e, candyEl), { passive: false });
        canvas.appendChild(candyEl);
        this.currentCandy = candyEl;
    }

    handleDragStart(e, element) {
        if (!this.active || this.paused || this.isDragging) return;
        e.preventDefault();
        this.isDragging = true;
        element.classList.add('dragging');
        const rect = element.getBoundingClientRect();
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        this.dragOffsetX = clientX - rect.left;
        this.dragOffsetY = clientY - rect.top;
        window.addEventListener('mousemove', this.boundDragMove);
        window.addEventListener('touchmove', this.boundDragMove, { passive: false });
        window.addEventListener('mouseup', this.boundDragEnd);
        window.addEventListener('touchend', this.boundDragEnd);
    }

    handleDragMove(e) {
        if (!this.isDragging || this.paused) return;
        e.preventDefault();
        const clientX = e.type.includes('touch') ? e.touches[0].clientX : e.clientX;
        const clientY = e.type.includes('touch') ? e.touches[0].clientY : e.clientY;
        this.currentCandy.style.left = `${clientX - this.dragOffsetX}px`;
        this.currentCandy.style.top = `${clientY - this.dragOffsetY}px`;
    }

    handleDragEnd(e) {
        if (!this.isDragging || this.paused) return;
        e.preventDefault();
        this.isDragging = false;
        this.currentCandy.classList.remove('dragging');
        window.removeEventListener('mousemove', this.boundDragMove);
        window.removeEventListener('touchmove', this.boundDragMove);
        window.removeEventListener('mouseup', this.boundDragEnd);
        window.removeEventListener('touchend', this.boundDragEnd);

        const candyRect = this.currentCandy.getBoundingClientRect();
        const droppedCandyType = this.currentCandy.dataset.type;
        let droppedOnJar = false;

        document.querySelectorAll('.candy-jar').forEach(jar => {
            const jarRect = jar.getBoundingClientRect();
            if (candyRect.left < jarRect.right && candyRect.right > jarRect.left && candyRect.top < jarRect.bottom && candyRect.bottom > jarRect.top) {
                droppedOnJar = true;
                if (jar.dataset.type === droppedCandyType) {
                    this.score++;
                    updateProgressBar(`hud-score${this.gameNum}`, '🍬 Sorted', this.score, 30);
                    jar.classList.add('drop-success');
                    playTone(659, 0.2, 'sine', 0.1);
                    setTimeout(() => jar.classList.remove('drop-success'), 500);
                } else {
                    this.misses++;
                    updateProgressBar(`hud-misses${this.gameNum}`, '❌ Wrong', this.misses, 5, true);
                    jar.classList.add('drop-fail');
                    playTone(200, 0.3, 'square', 0.05);
                    speak("Oops, wrong jar!", true);
                    setTimeout(() => jar.classList.remove('drop-fail'), 500);
                }
                this.currentCandy.remove();
                this.createCandy();
            }
        });

        if (!droppedOnJar) {
            // If not dropped on a jar, make it disappear and create a new one
            this.currentCandy.remove();
            this.createCandy();
        }
    }

    updateTimer() {
        if (!this.active || this.paused) return;
        this.timerId = setTimeout(() => this.updateTimer(), 1000);
        this._updateTimerDisplay();
        this.timeLeft--;
        if (this.timeLeft < 0) {
            this.stop();
            const totalAttempts = this.score + this.misses;
            const accuracy = totalAttempts > 0 ? (this.score / totalAttempts) * 100 : 0;
            document.getElementById('final-score13').textContent = this.score;
            document.getElementById('final-misses13').textContent = this.misses;
            document.getElementById('final-accuracy13').textContent = `${accuracy.toFixed(0)}%`;
            document.getElementById('game-over13').style.display = 'block';
            const timeSpent = now() - this.startTime;
            speak(`Time's up! You sorted ${this.score} candies with ${accuracy.toFixed(0)} percent accuracy.`, true); endSession(this.gameNum, this.score, this.misses, timeSpent);
        }
    }

    stop() { super.stop(); if (this.currentCandy) this.currentCandy.remove(); this.isDragging = false; window.removeEventListener('mousemove', this.boundDragMove); window.removeEventListener('touchmove', this.boundDragMove); window.removeEventListener('mouseup', this.boundDragEnd); window.removeEventListener('touchend', this.boundDragEnd); }
}

class MemoryMelodyGame extends BaseGame {
    constructor(level) {
        super(14, level, "Watch the pattern of lights and sounds, then right-click the pads to repeat it!");
        this.pads = [
            { color: '#ff4757', tone: 261.63 }, // C4
            { color: '#48dbfb', tone: 329.63 }, // E4
            { color: '#feca57', tone: 392.00 }, // G4
            { color: '#2ed573', tone: 440.00 }  // A4
        ];
        this.sequence = [];
        this.playerSequence = [];
        this.canClick = false;
    }

    start(container) {
        super.start(container);
        const html = `
            ${this._createHud('🧠 Round')}
            <div id="memory-melody-canvas" class="game-canvas" style="border-color: #7f8fa6; background: rgba(200, 200, 210, 0.2); display: flex; align-items: center; justify-content: center;">
                <div id="memory-pads-container"></div>
            </div>
            <div id="game-over14" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; background: rgba(127, 143, 166, 0.9); padding: 40px; border-radius: 20px; color: white; display: none;">
                <h2>🧠 Great Memory! 🧠</h2>
                <p>You reached Round: <span id="final-score14">0</span></p>
                <p>Your high score for this game is your final round number!</p>
                <button class="btn btn-primary btn-small" onclick="currentGame.printCertificate('Memory Melody', currentGame.score, 0, 100)">Print Certificate</button>
                <button onclick="currentGame.start(document.getElementById('game-area'))">Play Again!</button>
            </div>`;
        const css = `
            #memory-pads-container { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
            .memory-pad { width: 150px; height: 150px; border-radius: 20px; cursor: pointer; transition: all 0.1s ease-in-out; }
            .memory-pad.active { transform: scale(0.95); filter: brightness(1.5); box-shadow: 0 0 20px white; }
        `;
        this.container.innerHTML = html + `<style>${css}</style>`;

        const padsContainer = document.getElementById('memory-pads-container');
        this.pads.forEach((pad, index) => {
            const padEl = document.createElement('div');
            padEl.className = 'memory-pad';
            padEl.style.backgroundColor = pad.color;
            padEl.dataset.index = index;
            padEl.addEventListener('contextmenu', (e) => {
                e.preventDefault(); // Prevent the default right-click menu
                this.handlePadClick(index);
            });
            padsContainer.appendChild(padEl);
        });

        this.sequence = [];
        this.score = 0; // Score represents the current round
        setTimeout(() => this.nextRound(), 1000);
    }

    nextRound() {
        this.canClick = false;
        this.playerSequence = [];
        this.score++;
        updateProgressBar(`hud-score${this.gameNum}`, '🧠 Round', this.score, 20);

        const nextPadIndex = Math.floor(Math.random() * this.pads.length);
        this.sequence.push(nextPadIndex);

        this.playSequence();
    }

    playSequence() {
        let i = 0;
        const intervalId = setInterval(() => {
            if (i >= this.sequence.length) {
                clearInterval(intervalId);
                this.canClick = true;
                speak("Your turn.", true);
                return;
            }
            this.activatePad(this.sequence[i]);
            i++;
        }, 600 / this.settings.speed); // Delay between notes
    }

    activatePad(index) {
        const padEl = document.querySelector(`.memory-pad[data-index='${index}']`);
        if (!padEl) return;

        padEl.classList.add('active');
        playTone(this.pads[index].tone, 0.4, 'triangle', 0.2);
        setTimeout(() => padEl.classList.remove('active'), 300 / this.settings.speed);
    }

    handlePadClick(index) {
        if (!this.canClick || !this.active) return;

        this.activatePad(index);
        this.playerSequence.push(index);

        const currentStep = this.playerSequence.length - 1;
        if (this.playerSequence[currentStep] !== this.sequence[currentStep]) {
            // Game Over
            this.stop();
            speak(`Oops! The correct pattern is over. You reached round ${this.score}.`, true);
            document.getElementById('final-score14').textContent = this.score;
            document.getElementById('game-over14').style.display = 'block';
            endSession(this.gameNum, this.score, 1, now() - this.startTime);
        } else if (this.playerSequence.length === this.sequence.length) {
            // Round complete
            setTimeout(() => this.nextRound(), 1000);
        }
    }
}

class MultipleChoiceGame extends BaseGame {
    constructor(level) {
        super(15, level, "Test your knowledge! Choose the correct answer for each question.");
        this.questions = [];
        this.currentQuestionIndex = 0;
        this.correctAnswers = 0;
        this.incorrectAnswers = 0;
        this.questionStartTime = 0;
        this.allQuestions = [
            // Computer Questions
            {
                questionText: "A device you move to point, click, and select things on the screen is...", image: null,
                options: [
                    { image: "Arts/Monitor.png", text: "Monitor" },
                    { image: "Arts/Keyboard.png", text: "Keyboard" },
                    { image: "Arts/System Unit.png", text: "System Unit" },
                    { image: "Arts/Mouse.png", text: "Mouse" }
                ],
                correctAnswer: "Mouse"
            },
            {
                questionText: "The part that shows pictures, videos, and words, like a TV for the computer, is...", image: null,
                options: [
                    { image: "Arts/Printer.png", text: "Printer" },
                    { image: "Arts/Monitor.png", text: "Monitor" },
                    { image: "Arts/Webcam.png", text: "Webcam" },
                    { image: "Arts/Mouse.png", text: "Mouse" }
                ],
                correctAnswer: "Monitor"
            },
            // General Knowledge Questions
            { questionText: "What color is a ripe strawberry?", image: null, options: [{ text: "Blue" }, { text: "Yellow" }, { text: "Red" }, { text: "Green" }], correctAnswer: "Red" },
            { questionText: "How many legs does a spider have?", image: null, options: [{ text: "Six" }, { text: "Eight" }, { text: "Ten" }, { text: "Four" }], correctAnswer: "Eight" },
            { questionText: "What sound does a cow make?", image: null, options: [{ text: "Woof" }, { text: "Moo" }, { text: "Oink" }, { text: "Meow" }], correctAnswer: "Meow" },
            { questionText: "Which planet is known as the Red Planet?", image: null, options: [{ text: "Earth" }, { text: "Mars" }, { text: "Jupiter" }, { text: "Saturn" }], correctAnswer: "Mars" },
            { questionText: "What gas do plants need to make food?", image: null, options: [{ text: "Oxygen" }, { text: "Nitrogen" }, { text: "Carbon Dioxide" }, { text: "Helium" }], correctAnswer: "Carbon Dioxide" }
        ];
        // Shuffle and select 10 questions for the current round
        this.questions = this.allQuestions.sort(() => 0.5 - Math.random()).slice(0, 10);
    }

    start(container) {
        super.start(container);
        this.correctAnswers = 0;
        this.incorrectAnswers = 0;
        this.currentQuestionIndex = 0;

        const html = `
            ${this._createHud('✔️ Correct', '❌ Incorrect')}
            <div id="multiple-choice-canvas" class="game-canvas" style="border-color: #a29bfe; background: rgba(223, 220, 255, 0.2); display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 20px;">
                <img id="question-image" src="" alt="Question Image" style="max-height: 200px; max-width: 90%; border-radius: 15px; margin-bottom: 20px; display: none; object-fit: contain;">
                <h2 id="question-text" style="font-size: clamp(24px, 3vw, 32px); color: #6c5ce7; text-align: center; margin-bottom: 30px; max-width: 90%;">Loading Question...</h2>
                <div id="options-container" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; width: 100%; max-width: 800px;">
                    <!-- Options will be loaded here -->
                </div>
            </div>
            <div id="game-over15" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); text-align: center; background: rgba(162, 155, 254, 0.9); padding: 40px; border-radius: 20px; color: white; display: none;">
                <h2>🧠 Challenge Complete! 🧠</h2>
                <p>Correct Answers: <span id="final-correct15">0</span></p>
                <p>Incorrect Answers: <span id="final-incorrect15">0</span></p>
                <p>Accuracy: <span id="final-accuracy15">0%</span></p>
                <button class="btn btn-primary btn-small" onclick="currentGame.printCertificate('Multiple Choice Challenge', currentGame.correctAnswers, currentGame.incorrectAnswers, (currentGame.correctAnswers + currentGame.incorrectAnswers) > 0 ? (currentGame.correctAnswers / (currentGame.correctAnswers + currentGame.incorrectAnswers)) * 100 : 0)">Print Certificate</button>
                <button onclick="currentGame.start(document.getElementById('game-area'))">Play Again!</button>
            </div>`;
        const css = `
            .option-btn {
                background: #8e44ad;
                color: white;
                padding: 15px 20px;
                border-radius: 15px;
                font-size: clamp(16px, 2.5vw, 22px);
                cursor: pointer;
                transition: all 0.2s ease;
                box-shadow: 0 4px 10px rgba(0,0,0,0.2);
                border: none;
            }
            .option-btn:hover { transform: translateY(-3px) scale(1.02); box-shadow: 0 6px 15px rgba(0,0,0,0.3); }
            .option-btn img {
                max-height: 100px;
                max-width: 100%;
                object-fit: contain;
                pointer-events: none; /* Prevents image from capturing click */
            }
            .option-btn.correct { background: #27ae60; }
            .option-btn.incorrect { background: #c0392b; }
            .option-btn:disabled { opacity: 0.7; cursor: not-allowed; }
        `;
        this.container.innerHTML = html + `<style>${css}</style>`;
        // Now we just display the question since they are loaded in the constructor
        this.displayQuestion();
        this.updateTimer();
    }

    displayQuestion() {
        if (this.currentQuestionIndex >= this.questions.length) {
            this.endGame();
            return;
        }
        const question = this.questions[this.currentQuestionIndex];
        const imageEl = document.getElementById('question-image');

        if (question.image) {
            imageEl.src = question.image;
            imageEl.style.display = 'block';
        } else {
            imageEl.style.display = 'none';
        }

        document.getElementById('question-text').textContent = question.questionText;
        const optionsContainer = document.getElementById('options-container');
        optionsContainer.innerHTML = '';

        const shuffledOptions = [...question.options].sort(() => Math.random() - 0.5);

        shuffledOptions.forEach(option => {
            const button = document.createElement('button');
            button.className = 'option-btn';
            if (option.image) {
                button.innerHTML = `<img src="${option.image}" alt="${option.text}">`;
            } else {
                button.textContent = option.text;
            }
            button.dataset.answer = option.text; // Store the answer text in a data attribute
            button.onclick = () => this.handleAnswer(option.text, button);
            optionsContainer.appendChild(button);
        });
        speak(question.questionText, true);
        this.questionStartTime = now();
    }

    handleAnswer(selectedOption, button) {
        if (this.paused) return;
        const currentQuestion = this.questions[this.currentQuestionIndex];
        const allOptionButtons = document.querySelectorAll('.option-btn');
        allOptionButtons.forEach(btn => btn.disabled = true); // Disable all buttons after selection

        if (selectedOption === currentQuestion.correctAnswer) {
            this.correctAnswers++;
            updateProgressBar(`hud-score${this.gameNum}`, '✔️ Correct', this.correctAnswers, this.questions.length);
            button.classList.add('correct');
            playTone(659, 0.2, 'sine', 0.1); // Correct answer sound
            speak("Correct!", true);
        } else {
            this.incorrectAnswers++;
            updateProgressBar(`hud-misses${this.gameNum}`, '❌ Incorrect', this.incorrectAnswers, this.questions.length);
            button.classList.add('incorrect');
            playTone(200, 0.3, 'square', 0.05); // Incorrect answer sound
            speak(`Incorrect. The answer was ${currentQuestion.correctAnswer}.`, true);
            // Highlight the correct answer
            document.querySelectorAll('.option-btn').forEach(btn => {
                if (btn.dataset.answer === currentQuestion.correctAnswer) {
                    btn.classList.add('correct');
                }
            });
        }

        setTimeout(() => {
            this.currentQuestionIndex++;
            this.displayQuestion();
        }, 1500); // Wait a bit before moving to the next question
    }

    updateTimer() {
        if (!this.active || this.paused) return;
        this.timerId = setTimeout(() => this.updateTimer(), 1000);
        this._updateTimerDisplay();
        this.timeLeft--;
        if (this.timeLeft < 0) {
            this.endGame();
        }
    }

    endGame() {
        super.stop();
        const totalAttempts = this.correctAnswers + this.incorrectAnswers;
        const accuracy = totalAttempts > 0 ? (this.correctAnswers / totalAttempts) * 100 : 0;
        document.getElementById('final-correct15').textContent = this.correctAnswers;
        document.getElementById('final-incorrect15').textContent = this.incorrectAnswers;
        document.getElementById('final-accuracy15').textContent = `${accuracy.toFixed(0)}%`;
        document.getElementById('game-over15').style.display = 'block';
        const timeSpent = now() - this.startTime;
        speak(`Time's up! You answered ${this.correctAnswers} questions correctly with ${accuracy.toFixed(0)} percent accuracy.`, true);
        endSession(this.gameNum, this.correctAnswers, this.incorrectAnswers, timeSpent);
    }

    stop() {
        super.stop();
        clearTimeout(this.timerId);
    }
}

const gameRegistry = {
    1: MouseTrainerGame,
    2: BananaChaseGame,
    3: TypewriterGame,
    4: WordWeaverGame,
    5: RainbowPainterGame,
    7: ArtPuzzleGame,
    8: SentenceScribeGame,
    9: StorySelfGame,
    10: PcPartPickerGame,
    11: NumberMatchingGame,
    12: ParagraphProGame,
    13: CandySorterGame,
    14: MemoryMelodyGame,
    15: MultipleChoiceGame,
};

function gameFactory(gameNum, level = 'medium') {
    const GameClass = gameRegistry[gameNum];
    if (GameClass) {
        return new GameClass(level);
    }
    console.error(`Game with number ${gameNum} not found in registry.`);
    return null;
}

window.clearTimeouts = function() {
    // This becomes much simpler. The backToLauncher function handles this.
    // We can also be more robust by clearing all possible timeouts.
    let id = window.setTimeout(function() {}, 0);
    while (id--) {
        window.clearTimeout(id);
    }
};

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
    loadDefaultStudent(); // Automatically load a default student on page load

    // Mobile audio prompt
    if (window.matchMedia('(pointer: coarse)').matches) {
        document.getElementById('mobile-prompt').style.display = 'flex';
    }
    document.getElementById('badge-btn').addEventListener('click', showBadges);
    document.getElementById('play-btn').addEventListener('click', findAndPlay);
    document.getElementById('settings-btn').addEventListener('click', showSettingsModal);
    document.getElementById('close-settings-btn').addEventListener('click', hideSettingsModal);
    document.getElementById('voice-toggle-btn').addEventListener('click', toggleVoice);
    document.getElementById('custom-art-btn').addEventListener('click', () => { hideSettingsModal(); showArtCustomModal(); });
    document.getElementById('hide-badges-btn').addEventListener('click', hideBadges);
    document.getElementById('reset-art-btn').addEventListener('click', resetCustomArt);
    document.getElementById('close-art-btn').addEventListener('click', hideArtCustomModal);
    document.getElementById('mobile-start-btn').addEventListener('click', hideMobilePrompt);

    // Attach event listeners for actions that still make sense
    document.addEventListener('keydown', globalKeyHandler);
    document.getElementById('delete-student-btn').addEventListener('click', deleteStudentRecord); // This button is in the settings modal
    // document.getElementById('save-profile-btn').addEventListener('click', saveProfileChanges); // This button was removed

    // Use event delegation for the edit button which might be added dynamically
    document.getElementById('session-info').addEventListener('click', (e) => {
        if (e.target && e.target.id === 'edit-profile-btn') {
            showEditProfileForm();
        }
    });

    // Use event delegation for all game cards
    document.getElementById('games-section-wrapper').addEventListener('click', (e) => {
        const card = e.target.closest('.game-card');
        if (card) {
            const gameId = parseInt(card.dataset.gameId, 10);
            loadGame(gameId);
        }
    });
});