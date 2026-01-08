// --- KONFIGURASI ---
const CHAT_API_BASE = 'https://api.nekolabs.web.id/text.gen/gemini/2.5-pro';
const SYSTEM_PROMPT = "Kamu adalah Icila AI, asisten AI cerdas dan ceria. Gaya bicaramu ramah, santai, seru, tetap profesional dan sangat membantu layaknya teman dekat dan memberikan penjelasan yang mudah dipahami. dan jangan gunakan simbol * dalam mengirim teks agar teks respon kamu terlihat rapi";

// --- STATE MANAGEMENT ---
let sessions = JSON.parse(localStorage.getItem('ici_sessions')) || [];
let currentSessionId = localStorage.getItem('ici_current_id') || null;
let currentImageFile = null;

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // 1. FORCE HIDE SAAT LOADING
    forceHidePreview(); 

    if (sessions.length === 0) {
        createNewSession();
    } else {
        if (!currentSessionId || !getSessionById(currentSessionId)) {
            if (sessions.length > 0) {
                currentSessionId = sessions[0].id;
                localStorage.setItem('ici_current_id', currentSessionId);
            } else {
                createNewSession();
            }
        }
    }
    renderSidebar();
    loadCurrentSession();
});

// --- UI EVENT LISTENERS ---
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('overlay');

document.getElementById('btnOpenSidebar').addEventListener('click', () => {
    sidebar.classList.add('active');
    overlay.classList.add('active');
});

const closeSidebar = () => {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
};
document.getElementById('btnCloseSidebar').addEventListener('click', closeSidebar);
overlay.addEventListener('click', closeSidebar);

document.getElementById('btnNewChatHeader').addEventListener('click', () => {
    createNewSession();
    if (window.innerWidth <= 768) closeSidebar();
    document.getElementById('userInput').focus();
});

document.getElementById('btnDeleteAll').addEventListener('click', () => {
    if(confirm("Yakin hapus SEMUA riwayat chat?")) {
        localStorage.removeItem('ici_sessions');
        localStorage.removeItem('ici_current_id');
        sessions = [];
        currentSessionId = null;
        createNewSession();
    }
});

// --- CORE FUNCTIONS ---

function createNewSession() {
    const newId = 'ici-' + Date.now();
    const newSession = {
        id: newId,
        title: 'Percakapan Baru',
        messages: [],
        lastUpdated: Date.now()
    };
    sessions.unshift(newSession);
    currentSessionId = newId;
    saveSessions();
    renderSidebar();
    loadCurrentSession();
}

function loadCurrentSession() {
    const chatBox = document.getElementById('chatBox');
    chatBox.innerHTML = ''; 
    
    const welcomeHTML = `
        <div id="welcomeMessage" class="welcome-screen">
            <h1 class="glow-text">icila AI</h1>
            <p>Teman baikmu, Siap bantu tugas & informasi dan teman curhat kamu!</p>
        </div>
    `;
    chatBox.innerHTML = welcomeHTML;

    const session = getSessionById(currentSessionId);
    if (!session) return;

    if (session.messages.length > 0) {
        document.getElementById('welcomeMessage').style.display = 'none';
        session.messages.forEach(msg => {
            renderMessageBubble(msg.sender, msg.text, msg.image);
        });
    }
    scrollToBottom();
}

function renderSidebar() {
    const listContainer = document.getElementById('sessionList');
    listContainer.innerHTML = '';
    sessions.forEach(session => {
        const div = document.createElement('div');
        div.className = `session-item ${session.id === currentSessionId ? 'active' : ''}`;
        div.innerText = session.title;
        div.addEventListener('click', () => {
            currentSessionId = session.id;
            localStorage.setItem('ici_current_id', session.id);
            renderSidebar();
            loadCurrentSession();
            closeSidebar();
        });
        listContainer.appendChild(div);
    });
}

// --- MESSAGING LOGIC ---

document.getElementById('btnUpload').addEventListener('click', () => document.getElementById('fileInput').click());
document.getElementById('fileInput').addEventListener('change', handleFileSelect);
document.getElementById('btnRemoveImage').addEventListener('click', cancelImageSelection); 
document.getElementById('btnSend').addEventListener('click', sendMessage);
document.getElementById('userInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// FUNGSI BARU: FORCE SHOW PREVIEW
function handleFileSelect(e) {
    const file = e.target.files[0];
    if (file) {
        currentImageFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
            const previewImg = document.getElementById('imagePreview');
            const container = document.getElementById('imagePreviewContainer');
            
            previewImg.src = e.target.result;
            
            // Hapus paksa properti display:none
            container.classList.remove('hidden'); 
            container.style.display = 'block'; 
            
            scrollToBottom();
        };
        reader.readAsDataURL(file);
    }
}

// FUNGSI BARU: FORCE HIDE PREVIEW
function forceHidePreview() {
    const container = document.getElementById('imagePreviewContainer');
    container.classList.add('hidden');
    container.style.display = 'none'; // Paksa lewat style inline
    
    // Reset input value biar bisa pilih file yg sama
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

    // --- LOGIKA FIX VISUAL ---
    // Sembunyikan UI secara visual LANGSUNG, jangan tunggu apa-apa
    forceHidePreview();
    // (Data file masih tersimpan aman di variabel currentImageFile)

    // 1. Render User Message
    let localBlobUrl = currentImageFile ? URL.createObjectURL(currentImageFile) : null;
    renderMessageBubble('user', userText, localBlobUrl);
    
    const msgIndex = addMessageToSession('user', userText, null); 
    updateSessionTitle(userText || "Gambar");

    inputField.value = '';

    try {
        let finalImageUrl = "";

        // 2. Upload Process
        if (currentImageFile) {
            renderMessageBubble('bot', 'Sedang upload gambar... 🚀', null, true);
            try {
                finalImageUrl = await uploadToTmpFiles(currentImageFile);
                updateMessageImage(msgIndex, finalImageUrl);
                removeTemporaryMessages();
            } catch (err) {
                console.error(err);
                removeTemporaryMessages();
                renderMessageBubble('bot', '❌ Gagal upload gambar.');
                throw new Error("Upload Fail");
            }
        }

        // 3. API Request
        if (finalImageUrl) renderMessageBubble('bot', 'Icila sedang melihat gambar...', null, true);
        else renderMessageBubble('bot', 'Icila sedang mengetik... ️', null, true);

        let apiUrl = `${CHAT_API_BASE}?text=${encodeURIComponent(userText)}&systemPrompt=${encodeURIComponent(SYSTEM_PROMPT)}&sessionId=${currentSessionId}`;
        
        if (finalImageUrl && finalImageUrl.length > 5) {
            apiUrl += `&imageUrl=${encodeURIComponent(finalImageUrl)}`;
        }

        const response = await fetch(apiUrl);
        const data = await response.json();
        removeTemporaryMessages();

        if (data.success) {
            const reply = data.result;
            addMessageToSession('bot', reply, null);
            renderMessageBubble('bot', reply);
        } else {
            renderMessageBubble('bot', `⚠️ Error API: ${data.message || "Unknown"}`);
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
        
        // Reset Variabel File (Data benar-benar dihapus sekarang)
        currentImageFile = null; 
        forceHidePreview(); // Panggil sekali lagi buat jaga-jaga
    }
}

// --- UTILITIES ---

function renderMessageBubble(sender, text, imageUrl = null, isTemp = false) {
    const chatBox = document.getElementById('chatBox');
    const div = document.createElement('div');
    div.className = `message ${sender === 'user' ? 'user-message' : 'bot-message'} ${isTemp ? 'temp-message' : ''}`;

    let formattedText = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/\n/g, '<br>');

    let imgHTML = '';
    if (imageUrl && imageUrl !== 'null' && imageUrl.trim() !== '') {
        imgHTML = `<img src="${imageUrl}" class="img-attachment" alt="Gambar" onerror="this.style.display='none'">`;
    }

    let htmlContent = `
        <div class="bubble">
            ${imgHTML}
            <span>${formattedText}</span>
        </div>
    `;

    if (sender === 'bot' && !isTemp) {
        htmlContent += `
            <div class="msg-actions">
                <button class="action-btn" onclick="copyToClipboard(this)">
                    <i class="far fa-copy"></i> Copy
                </button>
                <button class="action-btn" onclick="shareText(this)">
                    <i class="fas fa-share-alt"></i> Share
                </button>
                <div style="display:none" class="raw-text">${text}</div>
            </div>
        `;
    }

    div.innerHTML = htmlContent;
    chatBox.appendChild(div);
    scrollToBottom();
}

window.copyToClipboard = function(btn) {
    const rawText = btn.parentElement.querySelector('.raw-text').innerText;
    navigator.clipboard.writeText(rawText).then(() => {
        const originalText = btn.innerHTML;
        btn.innerHTML = `<i class="fas fa-check"></i> Disalin`;
        setTimeout(() => { btn.innerHTML = originalText; }, 2000);
    });
};

window.shareText = function(btn) {
    const rawText = btn.parentElement.querySelector('.raw-text').innerText;
    if (navigator.share) {
        navigator.share({ title: 'Ici AI', text: rawText }).catch(console.error);
    } else {
        copyToClipboard(btn);
        alert("Teks disalin!");
    }
};

function removeTemporaryMessages() {
    document.querySelectorAll('.temp-message').forEach(el => el.remove());
}

function scrollToBottom() {
    const chatBox = document.getElementById('chatBox');
    chatBox.scrollTop = chatBox.scrollHeight;
}

async function uploadToTmpFiles(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('https://tmpfiles.org/api/v1/upload', { method: 'POST', body: formData });
    const data = await res.json();
    if (data.status === 'success') {
        return data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
    }
    throw new Error('Upload Failed');
}

// --- DATA HELPERS ---

function getSessionById(id) {
    return sessions.find(s => s.id === id);
}

function addMessageToSession(sender, text, image) {
    const session = getSessionById(currentSessionId);
    if (session) {
        session.messages.push({ sender, text, image: image || null });
        session.lastUpdated = Date.now();
        sessions = sessions.filter(s => s.id !== currentSessionId);
        sessions.unshift(session);
        saveSessions();
        renderSidebar();
        return session.messages.length - 1;
    }
    return -1;
}

function updateMessageImage(msgIndex, newImageUrl) {
    const session = getSessionById(currentSessionId);
    if (session && session.messages[msgIndex]) {
        session.messages[msgIndex].image = newImageUrl;
        saveSessions();
    }
}

function updateSessionTitle(text) {
    const session = getSessionById(currentSessionId);
    if (session && session.messages.length === 1 && session.title === 'Percakapan Baru') {
        let newTitle = text.substring(0, 30);
        if (text.length > 30) newTitle += '...';
        session.title = newTitle;
        saveSessions();
        renderSidebar();
    }
}

function saveSessions() {
    localStorage.setItem('ici_sessions', JSON.stringify(sessions));
}
