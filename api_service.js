// --- KONFIGURASI API ---
const API_URLS = {
    pro: 'https://api.nekolabs.web.id/text.gen/gemini/2.5-pro',
    fast: 'https://api.nekolabs.web.id/text.gen/gemini/3-flash'
};

// Fungsi 1: Upload ke TmpFiles
async function uploadImageService(file) {
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const res = await fetch('https://tmpfiles.org/api/v1/upload', { 
            method: 'POST', 
            body: formData 
        });
        const data = await res.json();
        
        if (data.status === 'success') {
            // Ubah link biasa jadi link download langsung (/dl/)
            return data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        } else {
            throw new Error('Gagal upload gambar.');
        }
    } catch (error) {
        console.error("Upload Error:", error);
        throw error;
    }
}

// Fungsi 2: Kirim Chat ke API
async function sendChatService(mode, text, systemPrompt, sessionId, imageUrl) {
    let baseUrl = API_URLS[mode] || API_URLS.pro;
    
    // Encode parameter biar aman
    let apiUrl = `${baseUrl}?text=${encodeURIComponent(text)}&systemPrompt=${encodeURIComponent(systemPrompt)}&sessionId=${sessionId}`;
    
    if (imageUrl && imageUrl.length > 5) {
        apiUrl += `&imageUrl=${encodeURIComponent(imageUrl)}`;
    }

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("API Error:", error);
        return { success: false, message: "Gagal menghubungi otak AI." };
    }
}
