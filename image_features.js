document.addEventListener('DOMContentLoaded', () => {
    console.log("Image Features Loaded!"); // Cek di console apakah muncul

    // --- STATE MODE GAMBAR ---
    let currentMagicMode = 'chat'; 

    // --- ELEMENT REFERENCES ---
    const magicMenu = document.getElementById('magicMenu');
    const btnMagic = document.getElementById('btnMagic');
    const btnCloseMagic = document.getElementById('btnCloseMagic');
    const overlay = document.getElementById('overlay');
    const btnCancelMode = document.getElementById('btnCancelMode');
    const modeIndicator = document.getElementById('modeIndicator');
    const modeText = document.getElementById('modeText');
    const userInput = document.getElementById('userInput');

    // Cek apakah elemen ada (biar gak error)
    if (!btnMagic || !magicMenu) {
        console.error("ERROR: Tombol Magic atau Menu tidak ditemukan di HTML!");
        return;
    }

    // 1. Buka Menu Magic
    btnMagic.addEventListener('click', () => {
        console.log("Tombol Magic Diklik!");
        magicMenu.classList.add('active');
        overlay.classList.add('active');
    });

    // 2. Tutup Menu Magic
    const closeMenu = () => {
        magicMenu.classList.remove('active');
        // Hanya tutup overlay jika sidebar juga tidak aktif
        if (!document.getElementById('sidebar').classList.contains('active')) {
            overlay.classList.remove('active');
        }
    };

    if(btnCloseMagic) btnCloseMagic.addEventListener('click', closeMenu);
    if(overlay) overlay.addEventListener('click', closeMenu);

    // 3. Fungsi Ganti Mode (Global Scope biar bisa dipanggil dari HTML onclick)
    window.selectMagicMode = function(mode) {
        console.log("Mode dipilih:", mode);
        window.currentMagicMode = mode; // Update Global Variable
        closeMenu();

        if (mode === 'chat') {
            modeIndicator.classList.add('hidden');
            userInput.placeholder = "Ketik pesan...";
            const btnUp = document.getElementById('btnUpload');
            if(btnUp) btnUp.style.display = 'flex';
        } 
        else if (mode === 'create') {
            modeIndicator.classList.remove('hidden');
            if(modeText) modeText.innerText = "Mode: Buat Gambar (Flux) 🎨";
            userInput.placeholder = "Deskripsikan gambar... (Contoh: Kucing cyberpunk)";
            const btnUp = document.getElementById('btnUpload');
            if(btnUp) btnUp.style.display = 'none'; // Sembunyikan upload
        }
        else if (mode === 'edit') {
            modeIndicator.classList.remove('hidden');
            if(modeText) modeText.innerText = "Mode: Edit Gambar ✏️";
            userInput.placeholder = "Upload foto & ketik perintah edit...";
            const btnUp = document.getElementById('btnUpload');
            if(btnUp) btnUp.style.display = 'flex';
            if(btnUp) btnUp.click();
        }
    };

    if(btnCancelMode) btnCancelMode.addEventListener('click', () => {
        window.selectMagicMode('chat');
    });
});

// FUNGSI EKSEKUSI (Dipanggil script.js)
async function handleMagicRequest(userText, imageFile) {
    // Pastikan variabel global terbaca
    const mode = window.currentMagicMode || 'chat';
    console.log("Eksekusi Magic Mode:", mode);

    if (mode === 'create') {
        if (!userText) return alert("Ketik deskripsi gambarnya dulu!");
        renderMessageBubble('user', userText);
        renderMessageBubble('bot', '🎨 Sedang melukis... (±10s)', null, true);
        
        const data = await generateImageService(userText);
        removeTemporaryMessages();
        
        if (data.success && data.result) {
            renderMessageBubble('bot', `Nih gambarnya: "${userText}"`, data.result);
            addMessageToSession('bot', `[Gambar: ${userText}]`, data.result);
        } else {
            renderMessageBubble('bot', '❌ Gagal membuat gambar.');
        }
    }
    
    else if (mode === 'edit') {
        if (!imageFile && !currentImageFile) return alert("Upload foto dulu!");
        if (!userText) return alert("Mau diedit jadi apa?");

        const fileToUpload = imageFile || currentImageFile;
        renderMessageBubble('user', userText, URL.createObjectURL(fileToUpload));
        renderMessageBubble('bot', '✏️ Sedang mengedit...', null, true);

        try {
            const urlToEdit = await uploadImageService(fileToUpload);
            const data = await editImageService(userText, urlToEdit);
            removeTemporaryMessages();

            if (data.success && data.result) {
                renderMessageBubble('bot', `✨ Selesai!`, data.result);
                addMessageToSession('bot', `[Edit: ${userText}]`, data.result);
            } else {
                renderMessageBubble('bot', '❌ Gagal edit.');
            }
        } catch (e) {
            removeTemporaryMessages();
            renderMessageBubble('bot', '❌ Error sistem.');
        }
    }
    
    window.selectMagicMode('chat'); // Reset ke chat setelah selesai
}
