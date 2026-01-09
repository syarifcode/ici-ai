// --- KONFIGURASI API ---
const API_URLS = {
    // Mode Pro: Lebih pintar, analisis mendalam (Agak lambat)
    pro: 'https://api.nekolabs.web.id/text.gen/gemini/2.5-pro',
    
    // Mode Fast: Update Baru (2.5 Flash Lite) - Cepat & Support Gambar
    fast: 'https://api.nekolabs.web.id/text.gen/gemini/2.5-flash-lite'
};

// Fungsi 1: Upload ke TmpFiles (Dipakai kedua mode)
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
            // Ubah ke direct link download agar bisa dibaca AI
            return data.data.url.replace('tmpfiles.org/', 'tmpfiles.org/dl/');
        } else {
            throw new Error('Gagal upload gambar ke server.');
        }
    } catch (error) {
        console.error("Upload Error:", error);
        throw error;
    }
}

// Fungsi 2: Kirim Chat ke API (Pro atau Fast)
async function sendChatService(mode, text, systemPrompt, sessionId, imageUrl) {
    // Pilih URL berdasarkan mode yang aktif ('pro' atau 'fast')
    let baseUrl = API_URLS[mode] || API_URLS.pro;
    
    // Encode parameter agar URL valid (menangani spasi dan simbol aneh)
    let apiUrl = `${baseUrl}?text=${encodeURIComponent(text)}&systemPrompt=${encodeURIComponent(systemPrompt)}&sessionId=${sessionId}`;
    
    // Tambahkan parameter gambar HANYA jika ada link gambar yang valid
    if (imageUrl && imageUrl.length > 5) {
        apiUrl += `&imageUrl=${encodeURIComponent(imageUrl)}`;
    }

    try {
        const response = await fetch(apiUrl);
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("API Chat Error:", error);
        return { success: false, message: "Gagal menghubungi otak AI. Cek koneksi." };
    }
}
