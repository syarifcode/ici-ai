// --- KONFIGURASI ---
const SYSTEM_PROMPT = "Kamu adalah Icila AI, asisten AI cerdas dan ceria. Pemilik mu adalah SyarifCode. Gaya bicaramu ramah, santai, seru, tetap profesional dan sangat membantu layaknya teman dekat dan memberikan penjelasan yang mudah dipahami. dan jangan gunakan simbol * dalam mengirim teks agar teks respon kamu terlihat rapi.";

// --- STATE MANAGEMENT ---
let sessions = JSON.parse(localStorage.getItem('ici_sessions')) || [];
let currentSessionId = localStorage.getItem('ici_current_id') || null;
let currentImageFile = null;
let currentMode = 'pro'; 

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    resetState();
    if (sessions.length === 0) createNewSession();
    else if (!currentSessionId) {
        currentSessionId = sessions[0].id;
        localStorage.setItem('ici_current_id', currentSessionId);
    }
    renderSidebar();
    loadCurrentSession();
    
    // PWA Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').catch(console.error);
    }
});

// --- UI LISTENERS ---
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');

document.getElementById('btnOpenSidebar').addEventListener('click', () => { sidebar.classList.add('active'); overlay.classList.add('active'); });
document.getElementById('btnCloseSidebar').addEventListener('click', () => { sidebar.classList.remove('active'); overlay.classList.remove('active'); });
overlay.addEventListener('click', () => { 
    sidebar.classList.remove('active'); 
    document.getElementById('magicMenu').classList.remove('active');
    overlay.classList.remove('active'); 
});

document.getElementById('btnNewChatHeader').addEventListener('click', () => {
    createNewSession();
    if (window.innerWidth <= 768) sidebar.classList.remove('active'); 
    overlay.classList.remove('active');
});

document.getElementById('btnDeleteAll').addEventListener('click', () => {
    if(confirm("Hapus SEMUA riwayat?")) { localStorage.clear(); location.reload(); }
});

const btnMode = document.getElementById('btnModeSwitch');
btnMode.addEventListener('click', () => {
    if (confirm(`Ganti ke mode ${currentMode === 'pro' ? 'FAST' : 'PRO'}?`)) {
        currentMode = currentMode === 'pro' ? 'fast' : 'pro';
        btnMode.innerText = currentMode === 'pro' ? "Pro" : "Fast ⚡";
        btnMode.className = `mode-badge mode-${currentMode}`;
        createNewSession();
    }
});

// --- INPUT & GAMBAR LOGIC ---
document.getElementById('btnUpload').addEventListener('click', () => document.getElementById('fileInput').click());
document.getElementById('fileInput').addEventListener('change', handleFileSelect);
document.getElementById('btnRemoveImage').addEventListener('click', resetState);
document.getElementById('btnSend').addEventListener('click', sendMessage);

// FITUR BARU: AUTO RESIZE TEXTAREA (Maks 7 Baris)
const userInput = document.getElementById('userInput');
userInput.addEventListener('input', function() {
    this.style.height = 'auto'; // Reset dulu
    this.style.height = (this.scrollHeight) + 'px'; // Sesuaikan tinggi konten
    if(this.value === '') this.style.height = 'auto'; // Reset jika kosong
});

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        currentImageFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            const preview = document.getElementById('imagePreview');
            const container = document.getElementById('imagePreviewContainer');
            if(preview && container) {
                preview.src = e.target.result;
                container.classList.remove('hidden'); 
                container.style.display = 'block';
            }
        };
        reader.readAsDataURL(file);
    }
}

function resetState() {
    currentImageFile = null;
    const container = document.getElementById('imagePreviewContainer');
    const fileInput = document.getElementById('fileInput');
    const userInput = document.getElementById('userInput');
    
    if(container) {
        container.classList.add('hidden');
        container.style.display = 'none';
    }
    if(fileInput) fileInput.value = ''; 
    // Reset tinggi textarea
    if(userInput) {
        userInput.style.height = 'auto';
    }
}

// --- SEND MESSAGE LOGIC ---
async function sendMessage() {
    const inputField = document.getElementById('userInput');
    const sendBtn = document.getElementById('btnSend');
    const userText = inputField.value.trim();

    if (window.currentMagicMode && window.currentMagicMode !== 'chat') {
        inputField.value = ''; 
        inputField.style.height = 'auto'; // Reset tinggi
        if(typeof handleMagicRequest === 'function') handleMagicRequest(userText, currentImageFile);
        resetState();
        return;
    }

    if (!userText && !currentImageFile) return;

    inputField.disabled = true; 
    sendBtn.disabled = true;
    const welcome = document.getElementById('welcomeMessage');
    if(welcome) welcome.style.display = 'none';

    const tempFile = currentImageFile; 
    let localBlobUrl = tempFile ? URL.createObjectURL(tempFile) : null;

    renderMessageBubble('user', userText, localBlobUrl);
    const msgIndex = addMessageToSession('user', userText, null); 
    updateSessionTitle(userText || "Gambar");

    inputField.value = '';
    inputField.style.height = 'auto'; // Reset tinggi
    resetState();

    try {
        let finalImageUrl = "";
        if (tempFile) {
            renderMessageBubble('bot', 'Sedang upload...', null, true);
            try {
                finalImageUrl = await uploadImageService(tempFile);
                updateMessageImage(msgIndex, finalImageUrl); 
                removeTemporaryMessages();
            } catch (err) {
                removeTemporaryMessages();
                renderMessageBubble('bot', '❌ Gagal upload gambar.');
                throw new Error("Upload Fail");
            }
        }

        const loadingText = currentMode === 'pro' ? 'Sedang berpikir...' : 'Berpikir Cepat... ⚡';
        renderMessageBubble('bot', `Icila (${currentMode}) ${loadingText}`, null, true);

        const currentSession = getSessionById(currentSessionId);
        const data = await sendChatService(currentMode, userText, SYSTEM_PROMPT, currentSessionId, finalImageUrl, currentSession.messages);
        
        removeTemporaryMessages();

        if (data.success) {
            addMessageToSession('bot', data.result, null);
            renderMessageBubble('bot', data.result);
        } else {
            renderMessageBubble('bot', `⚠️ Error API: ${data.message}`);
        }

    } catch (error) {
        if(error.message !== "Upload Fail") {
            removeTemporaryMessages();
            renderMessageBubble('bot', `⚠️ Gangguan: ${error.message}`);
        }
    } finally {
        inputField.disabled = false; 
        sendBtn.disabled = false; 
        inputField.focus();
        resetState();
    }
}

// --- DOWNLOAD IMAGE FUNCTION ---
async function downloadImage(url) {
    try {
        // Coba download via Fetch Blob (biar gak buka tab baru)
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = window.URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = `Icila-Img-${Date.now()}.png`; // Nama file otomatis
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
        // Fallback kalau gagal (misal CORS error), buka di tab baru
        window.open(url, '_blank');
    }
}

// --- RENDER BUBBLE (DENGAN TOMBOL UNDUH) ---
function renderMessageBubble(sender, text, imageUrl = null, isTemp = false) {
    const chatBox = document.getElementById('chatBox');
    const div = document.createElement('div');
    div.className = `message ${sender === 'user' ? 'user-message' : 'bot-message'} ${isTemp ? 'temp-message' : ''}`;
    
    let formattedText = text.replace(/\n/g, '<br>');
    formattedText = formattedText.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>').replace(/\*(.*?)\*/g, '<i>$1</i>');

    let imgHTML = '';
    // Jika ada gambar, tampilkan gambar
    if (imageUrl && imageUrl !== 'null') {
        imgHTML = `<img src="${imageUrl}" class="img-attachment" onclick="window.open('${imageUrl}')">`;
    }
    
    div.innerHTML = `<div class="bubble">${imgHTML}<span>${formattedText}</span></div>`;
    
    // Actions Bot (Copy, Share, AND DOWNLOAD)
    if (sender === 'bot' && !isTemp) {
        let actionHTML = `
            <div class="msg-actions">
                <button class="action-btn" onclick="copyToClipboard(this)"><i class="far fa-copy"></i> Salin</button>
                <button class="action-btn" onclick="shareText(this)"><i class="fas fa-share-alt"></i> Share</button>`;
        
        // Tambah tombol Download KHUSUS jika ada gambar
        if (imageUrl && imageUrl !== 'null') {
            actionHTML += `<button class="action-btn" onclick="downloadImage('${imageUrl}')"><i class="fas fa-download"></i> Unduh</button>`;
        }
        
        actionHTML += `<div style="display:none" class="raw-text">${text}</div></div>`;
        div.innerHTML += actionHTML;
    }
    chatBox.appendChild(div);
    scrollToBottom();
}

// Helper Functions
window.copyToClipboard = function(btn) {
    const txt = btn.parentElement.querySelector('.raw-text').innerText;
    navigator.clipboard.writeText(txt);
    btn.innerHTML = `<i class="fas fa-check"></i> Disalin`;
    setTimeout(() => btn.innerHTML = `<i class="far fa-copy"></i> Salin`, 2000);
};

window.shareText = function(btn) {
    const txt = btn.parentElement.querySelector('.raw-text').innerText;
    if(navigator.share) navigator.share({title:'Icila AI', text:txt});
    else copyToClipboard(btn);
};

function removeTemporaryMessages() { document.querySelectorAll('.temp-message').forEach(el => el.remove()); }
function scrollToBottom() { const b = document.getElementById('chatBox'); b.scrollTop = b.scrollHeight; }

function createNewSession() {
    resetState();
    const newId = 'ici-' + Date.now();
    sessions.unshift({ id: newId, title: 'Percakapan Baru', messages: [], lastUpdated: Date.now() });
    currentSessionId = newId;
    saveSessions(); renderSidebar(); loadCurrentSession();
}

function loadCurrentSession() {
    const chatBox = document.getElementById('chatBox');
    chatBox.innerHTML = ''; 
    const welcome = `<div id="welcomeMessage" class="welcome-screen"><h1 class="glow-text">Icila AI</h1><p>Teman baikmu, Siap bantu tugas & informasi, buat dan edit gambar serta teman curhat kamu!</p><p>_<p><p>Mode: <strong>${currentMode.toUpperCase()}</strong></p></div>`;
    chatBox.innerHTML = welcome;
    
    const s = sessions.find(s => s.id === currentSessionId);
    if (!s) return;
    
    if (s.messages.length > 0) {
        document.getElementById('welcomeMessage').style.display = 'none';
        s.messages.forEach(msg => renderMessageBubble(msg.sender, msg.text, msg.image));
    }
    scrollToBottom();
}

function renderSidebar() {
    const list = document.getElementById('sessionList');
    if(!list) return; list.innerHTML = '';
    sessions.forEach(s => {
        const div = document.createElement('div');
        div.className = `session-item ${s.id === currentSessionId ? 'active' : ''}`;
        div.innerText = s.title;
        div.onclick = () => { 
            currentSessionId = s.id; 
            localStorage.setItem('ici_current_id', s.id); 
            renderSidebar(); loadCurrentSession(); 
            sidebar.classList.remove('active'); overlay.classList.remove('active');
        };
        list.appendChild(div);
    });
}

function addMessageToSession(sender, text, image) {
    const s = sessions.find(s => s.id === currentSessionId);
    if (s) { s.messages.push({ sender, text, image }); saveSessions(); renderSidebar(); return s.messages.length - 1; }
}
function updateMessageImage(idx, url) { 
    const s = sessions.find(s => s.id === currentSessionId); 
    if(s && s.messages[idx]) { s.messages[idx].image = url; saveSessions(); } 
}
function updateSessionTitle(txt) { 
    const s = sessions.find(s => s.id === currentSessionId); 
    if(s && s.messages.length === 1 && s.title === 'Percakapan Baru') { 
        s.title = txt.substring(0,30) + (txt.length>30?'...':''); saveSessions(); renderSidebar(); 
    } 
}
function saveSessions() { localStorage.setItem('ici_sessions', JSON.stringify(sessions)); }
function getSessionById(id) { return sessions.find(s => s.id === id); }

// PWA Installer
let deferredPrompt;
const btnInstall = document.getElementById('btnInstallPWA');
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); deferredPrompt = e;
    if(btnInstall) { btnInstall.classList.remove('hidden'); btnInstall.style.display = 'flex'; }
});
if(btnInstall) {
    btnInstall.addEventListener('click', async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (outcome === 'accepted') btnInstall.style.display = 'none';
    });
}
