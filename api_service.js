// --- KONFIGURASI API ---
const API_URLS = {
    // Mode Pro: Lebih pintar (Gemini 2.5 Pro)
    pro: 'https://api.nekolabs.web.id/text.gen/gemini/2.5-pro',
    
    // Mode Fast: Update Baru (Gemini 2.5 Flash Lite)
    fast: 'https://api.nekolabs.web.id/text.gen/gemini/2.5-flash-lite'
};

// Fungsi 1: Upload ke TmpFiles
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

// Fungsi 2: Kirim Chat (DENGAN INJEKSI MEMORI)
async function sendChatService(mode, text, systemPrompt, sessionId, imageUrl, history = []) {
    let baseUrl = API_URLS[mode] || API_URLS.pro;

    // --- LOGIKA MEMORI ---
    // Kita ambil 6 pasang pesan terakhir agar AI tau konteks sebelumnya.
    // Kita slice(0, -1) karena pesan terakhir di array 'history' adalah pesan yang baru saja user ketik (jangan diduplikasi).
    const recentHistory = history.length > 1 ? history.slice(-7, -1) : [];
    
    const contextString = recentHistory.map(msg => 
        `${msg.sender === 'user' ? 'User' : 'Ici AI'}: ${msg.text}`
    ).join('\n');

    // Gabungkan History + Pesan Baru
    const finalPrompt = contextString 
        ? `[Riwayat Percakapan]\n${contextString}\n\n[Pesan Baru]\nUser: ${text}` 
        : text;

    // Kita pakai POST dengan JSON Body (Lebih aman untuk teks panjang)
    const body = {
        text: finalPrompt,
        systemPrompt: systemPrompt,
        sessionId: sessionId,
        model: 'gemini' // Kadang diperlukan oleh beberapa wrapper
    };

    if (imageUrl && imageUrl.length > 5) {
        body.imageUrl = imageUrl;
    }

    try {
        const response = await fetch(baseUrl, {
            method: 'POST', // GANTI KE POST
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error("API Error:", error);
        return { success: false, message: "Gagal menghubungi otak AI." };
    }
}
