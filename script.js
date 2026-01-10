// --- KONFIGURASI ---
const SYSTEM_PROMPT = "Kamu adalah Icila AI, asisten AI cerdas dan ceria. Pemilik mu adalah SyarifCode. Gaya bicaramu ramah, santai, seru, tetap profesional dan sangat membantu layaknya teman dekat dan memberikan penjelasan yang mudah dipahami. dan jangan gunakan simbol * dalam mengirim teks agar teks respon kamu terlihat rapi.";

// --- STATE MANAGEMENT ---
let sessions = JSON.parse(localStorage.getItem('ici_sessions')) || [];
let currentSessionId = localStorage.getItem('ici_current_id') || null;
let currentImageFile = null;
let currentMode = 'pro'; 

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    forceHidePreview(); 
    if (sessions.length === 0) createNewSession();
    else if (!currentSessionId) {
        currentSessionId = sessions[0].id;
        localStorage.setItem('ici_current_id', currentSessionId);
    }
    renderSidebar();
    loadCurrentSession();
});

// --- UI LISTENERS ---
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');
document.getElementById('btnOpenSidebar').addEventListener('click', () => { sidebar.classList.add('active'); overlay.classList.add('active'); });
document.getElementById('btnCloseSidebar').addEventListener('click', () => { sidebar.classList.remove('active'); overlay.classList.remove('active'); });
overlay.addEventListener('click', () => { sidebar.classList.remove('active'); overlay.classList.remove('active'); });

document.getElementById('btnNewChatHeader').addEventListener('click', () => {
    createNewSession();
    if (window.innerWidth <= 768) sidebar.classList.remove('active'); overlay.classList.remove('active');
    document.getElementById('userInput').focus();
});

document.getElementById('btnDeleteAll').addEventListener('click', () => {
    if(confirm("Hapus SEMUA riwayat?")) {
        localStorage.clear();
        location.reload();
    }
});

// --- MODE SWITCHER ---
const btnMode = document.getElementById('btnModeSwitch');
btnMode.addEventListener('click', () => {
    if (confirm(`Ganti ke mode ${currentMode === 'pro' ? 'FAST' : 'PRO'}? \nChat saat ini akan di-reset.`)) {
        toggleMode();
    }
});

function toggleMode() {
    if (currentMode === 'pro') {
        currentMode = 'fast';
        btnMode.innerText = "Fast ⚡";
        btnMode.className = "mode-badge mode-fast";
    } else {
        currentMode = 'pro';
        btnMode.innerText = "Pro";
        btnMode.className = "mode-badge mode-pro";
    }
    createNewSession();
}

// --- CHAT LOGIC ---
document.getElementById('btnUpload').addEventListener('click', () => document.getElementById('fileInput').click());
document.getElementById('fileInput').addEventListener('change', handleFileSelect);
document.getElementById('btnRemoveImage').addEventListener('click', cancelImageSelection); 
document.getElementById('btnSend').addEventListener('click', sendMessage);
document.getElementById('userInput').addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } });

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        currentImageFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            document.getElementById('imagePreview').src = e.target.result;
            document.getElementById('imagePreviewContainer').classList.remove('hidden'); 
            document.getElementById('imagePreviewContainer').style.display = 'block'; 
            scrollToBottom();
        };
        reader.readAsDataURL(file);
    }
}

function forceHidePreview() {
    const container = document.getElementById('imagePreviewContainer');
    container.classList.add('hidden');
    container.style.display = 'none'; 
    document.getElementById('fileInput').value = ''; 
}

function cancelImageSelection() {
    currentImageFile = null;
    forceHidePreview();
    document.getElementById('imagePreview').src = '';
}

async function sendMessage() {
    const inputField = document.getElementById('userInput');
    const sendBtn = document.getElementById('btnSend');
    const userText = inputField.value.trim();

    if (!userText && !currentImageFile) return;

    inputField.disabled = true;
    sendBtn.disabled = true;
    document.getElementById('welcomeMessage').style.display = 'none';
    forceHidePreview();

    let localBlobUrl = currentImageFile ? URL.createObjectURL(currentImageFile) : null;
    renderMessageBubble('user', userText, localBlobUrl);
    const msgIndex = addMessageToSession('user', userText, null); 
    updateSessionTitle(userText || "Gambar");
    inputField.value = '';

    try {
        let finalImageUrl = "";
        if (currentImageFile) {
            renderMessageBubble('bot', 'Sedang upload...', null, true);
            try {
                finalImageUrl = await uploadImageService(currentImageFile);
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

        // --- UPDATE PENTING: KIRIM HISTORY KE SERVICE ---
        const currentSession = getSessionById(currentSessionId);
        const data = await sendChatService(
            currentMode, 
            userText, 
            SYSTEM_PROMPT, 
            currentSessionId, 
            finalImageUrl,
            currentSession.messages // Kirim seluruh riwayat chat sesi ini
        );
        
        removeTemporaryMessages();

        if (data.success) {
            const reply = data.result;
            addMessageToSession('bot', reply, null);
            renderMessageBubble('bot', reply);
        } else {
            renderMessageBubble('bot', `⚠️ Error API: ${data.message || "Gangguan"}`);
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
        currentImageFile = null; 
        forceHidePreview(); 
    }
}

// --- UTILITIES (Copy & Share Included) ---
function renderMessageBubble(sender, text, imageUrl = null, isTemp = false) {
    const chatBox = document.getElementById('chatBox');
    const div = document.createElement('div');
    div.className = `message ${sender === 'user' ? 'user-message' : 'bot-message'} ${isTemp ? 'temp-message' : ''}`;
    let formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/\*(.*?)\*/g, '<em>$1</em>').replace(/\n/g, '<br>');
    let imgHTML = (imageUrl && imageUrl !== 'null') ? `<img src="${imageUrl}" class="img-attachment" onerror="this.style.display='none'">` : '';
    let htmlContent = `<div class="bubble">${imgHTML}<span>${formattedText}</span></div>`;
    
    if (sender === 'bot' && !isTemp) {
        htmlContent += `
            <div class="msg-actions">
                <button class="action-btn" onclick="copyToClipboard(this)" title="Salin"><i class="far fa-copy"></i> <span class="action-label">Salin</span></button>
                <button class="action-btn" onclick="shareText(this)" title="Bagikan"><i class="fas fa-share-alt"></i> <span class="action-label">Share</span></button>
                <div style="display:none" class="raw-text">${text}</div>
            </div>`;
    }
    div.innerHTML = htmlContent;
    chatBox.appendChild(div);
    scrollToBottom();
}

window.copyToClipboard = function(btn) {
    const rawText = btn.parentElement.querySelector('.raw-text').innerText;
    navigator.clipboard.writeText(rawText);
    const originalHTML = btn.innerHTML;
    btn.innerHTML = `<i class="fas fa-check" style="color: #4ade80;"></i> <span class="action-label" style="color: #4ade80;">Disalin</span>`;
    setTimeout(() => { btn.innerHTML = originalHTML; }, 2000);
};

window.shareText = function(btn) {
    const rawText = btn.parentElement.querySelector('.raw-text').innerText;
    if (navigator.share) { navigator.share({ title: 'Jawaban Ici AI', text: rawText }); } 
    else { copyToClipboard(btn); alert("Browser tidak support Share. Teks disalin!"); }
};

function removeTemporaryMessages() { document.querySelectorAll('.temp-message').forEach(el => el.remove()); }
function scrollToBottom() { const chatBox = document.getElementById('chatBox'); chatBox.scrollTop = chatBox.scrollHeight; }
function createNewSession() {
    const newId = 'ici-' + Date.now();
    sessions.unshift({ id: newId, title: 'Percakapan Baru', messages: [], lastUpdated: Date.now() });
    currentSessionId = newId;
    saveSessions(); renderSidebar(); loadCurrentSession();
}
function loadCurrentSession() {
    const chatBox = document.getElementById('chatBox');
    chatBox.innerHTML = ''; 
    const welcomeHTML = `<div id="welcomeMessage" class="welcome-screen"><h1 class="glow-text">Icila AI</h1><p>Teman baikmu, Siap bantu tugas & informasi dan teman curhat kamu!</p><p>_<p><p>Mode: <strong>${currentMode.toUpperCase()}</strong></p></div>`;
    chatBox.innerHTML = welcomeHTML;
    const session = sessions.find(s => s.id === currentSessionId);
    if (!session) return;
    if (session.messages.length > 0) {
        document.getElementById('welcomeMessage').style.display = 'none';
        session.messages.forEach(msg => renderMessageBubble(msg.sender, msg.text, msg.image));
    }
    scrollToBottom();
}
function renderSidebar() {
    const list = document.getElementById('sessionList'); list.innerHTML = '';
    sessions.forEach(s => {
        const div = document.createElement('div');
        div.className = `session-item ${s.id === currentSessionId ? 'active' : ''}`;
        div.innerText = s.title;
        div.onclick = () => { currentSessionId = s.id; localStorage.setItem('ici_current_id', s.id); renderSidebar(); loadCurrentSession(); document.getElementById('sidebar').classList.remove('active'); document.getElementById('overlay').classList.remove('active'); };
        list.appendChild(div);
    });
}
function addMessageToSession(sender, text, image) {
    const s = sessions.find(s => s.id === currentSessionId);
    if (s) { s.messages.push({ sender, text, image: image || null }); saveSessions(); renderSidebar(); return s.messages.length - 1; }
}
function updateMessageImage(idx, url) { const s = sessions.find(s => s.id === currentSessionId); if(s && s.messages[idx]) { s.messages[idx].image = url; saveSessions(); } }
function updateSessionTitle(txt) { const s = sessions.find(s => s.id === currentSessionId); if(s && s.messages.length === 1 && s.title === 'Percakapan Baru') { s.title = txt.substring(0,30) + (txt.length>30?'...':''); saveSessions(); renderSidebar(); } }
function saveSessions() { localStorage.setItem('ici_sessions', JSON.stringify(sessions)); }
function getSessionById(id) { return sessions.find(s => s.id === id); }
// ==========================================
// --- FITUR INSTALL APLIKASI (PWA) ---
// ==========================================

// 1. Daftarkan Service Worker (Agar bisa jalan offline & dianggap App)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker terdaftar:', reg.scope))
            .catch(err => console.log('Gagal daftar SW:', err));
    });
}

// 2. Logika Tombol Install
let deferredPrompt;
const btnInstall = document.getElementById('btnInstallPWA');

window.addEventListener('beforeinstallprompt', (e) => {
    // Cegah Chrome langsung munculin banner install otomatis (biar kita kontrol pakai tombol)
    e.preventDefault();
    deferredPrompt = e;
    
    // Munculkan tombol Install di Sidebar (Hapus class hidden)
    btnInstall.classList.remove('hidden');
    btnInstall.style.display = 'flex'; // Paksa tampil
});

btnInstall.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    
    // Tampilkan prompt install bawaan HP
    deferredPrompt.prompt();
    
    // Tunggu user klik "Install" atau "Batal"
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User memilih: ${outcome}`);
    
    // Reset variabel
    deferredPrompt = null;
    
    // Sembunyikan tombol lagi kalau sudah diinstall
    if (outcome === 'accepted') {
        btnInstall.style.display = 'none';
    }
});

// Kalau aplikasi sudah berhasil diinstall, sembunyikan tombol
window.addEventListener('appinstalled', () => {
    console.log('Aplikasi berhasil diinstall!');
    btnInstall.style.display = 'none';
});
