// --- KONFIGURASI API ---
const API_URLS = {
    // Mode Chat
    pro: 'https://api.nekolabs.web.id/text.gen/gemini/2.5-pro',
    fast: 'https://api.nekolabs.web.id/text.gen/gemini/2.5-flash-lite',
    
    // Mode Gambar (Flux)
    createImg: 'https://api.nekolabs.web.id/image.gen/flux/dev',
    
    // Mode Edit Gambar (Nano Banana Pro)
    editImg: 'https://api.nekolabs.web.id/image.gen/nano-banana-pro'
};

// Fungsi 1: Upload ke TmpFiles (Wajib buat fitur Edit Gambar)
async function uploadImageService(file) {
    const formData = new FormData();
    formData.append('file', file);
    try {
        const res = await fetch('https://tmpfiles.org/api/v1/upload', { method: 'POST', body: formData });
        const data = await res.json();
        if (data.status === 'success') {
            return data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        } else {
            throw new Error('Gagal upload gambar.');
        }
    } catch (error) {
        throw error;
    }
}

// Fungsi 2: Kirim Chat (Gemini)
async function sendChatService(mode, text, systemPrompt, sessionId, imageUrl, history = []) {
    let baseUrl = API_URLS[mode] || API_URLS.pro;

    const recentHistory = history.length > 1 ? history.slice(-7, -1) : [];
    const contextString = recentHistory.map(msg => `${msg.sender === 'user' ? 'User' : 'Ici AI'}: ${msg.text}`).join('\n');
    const finalPrompt = contextString ? `[Riwayat Percakapan]\n${contextString}\n\n[Pesan Baru]\nUser: ${text}` : text;

    const body = {
        text: finalPrompt,
        systemPrompt: systemPrompt,
        sessionId: sessionId,
        model: 'gemini'
    };
    if (imageUrl && imageUrl.length > 5) body.imageUrl = imageUrl;

    try {
        const response = await fetch(baseUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return await response.json();
    } catch (error) {
        return { success: false, message: "Gagal menghubungi otak AI." };
    }
}

// Fungsi 3: BUAT GAMBAR (Create)
async function generateImageService(prompt) {
    // Default ratio 1:1 biar aman
    const apiUrl = `${API_URLS.createImg}?prompt=${encodeURIComponent(prompt)}&ratio=1:1`;
    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        return data; // Harusnya return { success: true, result: "url_gambar" }
    } catch (error) {
        return { success: false, message: "Gagal membuat gambar." };
    }
}

// Fungsi 4: EDIT GAMBAR
async function editImageService(prompt, imageUrl) {
    if (!imageUrl) return { success: false, message: "Butuh gambar untuk diedit!" };
    
    const apiUrl = `${API_URLS.editImg}?prompt=${encodeURIComponent(prompt)}&imageUrl=${encodeURIComponent(imageUrl)}`;
    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        return data; // Harusnya return { success: true, result: "url_gambar" }
    } catch (error) {
        return { success: false, message: "Gagal mengedit gambar." };
    }
}
