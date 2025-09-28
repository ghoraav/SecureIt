/* dashboard.js (modified for Canvas-based LSB steganography)
   - Replaces p5-based pixel manipulation with direct Canvas ImageData reads/writes
   - Keeps UI structure from your original file
   - NOTE: audio -> text conversion is left as a TODO/stub (server-side or client-side solution required)
*/

// --- Utility: convert text -> 8-bit binary (ASCII/Latin-1 style, same as original) ---
function textToBinary(text) {
    let binaryMessage = '';
    for (let i = 0; i < text.length; i++) {
        let binaryChar = text[i].charCodeAt(0).toString(2);
        binaryMessage += '0'.repeat(8 - binaryChar.length) + binaryChar;
    }
    return binaryMessage;
}

// --- Load an HTMLImageElement from a src (returns Promise) ---
function loadImageElement(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error('Image load failed: ' + src));
        img.src = src;
    });
}

// --- Encode message into an offscreen canvas using ImageData (robust) ---
function encodeToCanvasImage(imgEl, message) {
    const binaryMessage = textToBinary(message) + '00000000'; // null terminator
    const canvas = document.createElement('canvas');
    canvas.width = imgEl.naturalWidth || imgEl.width;
    canvas.height = imgEl.naturalHeight || imgEl.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data; // Uint8ClampedArray
    let pixelIndex = 0; // index in RGBA array

    const capacity = (canvas.width * canvas.height * 3); // R,G,B per pixel
    if (binaryMessage.length > capacity) {
        throw new Error('Message too long for this carrier image.');
    }

    for (let i = 0; i < binaryMessage.length; i++) {
        const bit = binaryMessage[i] === '1' ? 1 : 0;
        // skip alpha channels (every 4th)
        while (pixelIndex % 4 === 3) pixelIndex++;
        data[pixelIndex] = (data[pixelIndex] & 0xFE) | bit;
        pixelIndex++;
    }

    // Put modified pixels back and return the canvas
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

// --- Decode message from an HTMLImageElement via canvas ImageData ---
function decodeFromImageElement(imgEl) {
    const canvas = document.createElement('canvas');
    canvas.width = imgEl.naturalWidth || imgEl.width;
    canvas.height = imgEl.naturalHeight || imgEl.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(imgEl, 0, 0, canvas.width, canvas.height);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;

    let pixelIndex = 0;
    let decodedText = '';

    while (pixelIndex < data.length) {
        let byte = '';
        for (let i = 0; i < 8; i++) {
            while (pixelIndex % 4 === 3) pixelIndex++; // skip alpha channel
            if (pixelIndex >= data.length) break;
            byte += (data[pixelIndex] & 1).toString();
            pixelIndex++;
        }
        if (byte.length < 8 || byte === '00000000') break;
        decodedText += String.fromCharCode(parseInt(byte, 2));
    }

    return decodedText;
}

async function convertAudioToText(audioFile) {
    const form = new FormData();
    // The server expects the field name 'audio' (upload.single('audio'))
    form.append('audio', audioFile, audioFile.name || 'recording');

    const resp = await fetch('/speech-to-text', {
        method: 'POST',
        body: form
        // If your server requires auth headers, add them here (e.g. headers: { Authorization: 'Bearer ...' })
    });

    if (!resp.ok) {
        // try to parse JSON error message if any
        let errBody = {};
        try { errBody = await resp.json(); } catch (e) { /* ignore parse error */ }
        throw new Error(errBody.message || `Speech-to-text request failed (status ${resp.status})`);
    }

    const json = await resp.json().catch(() => { throw new Error('Invalid JSON from speech-to-text server'); });
    if (!json.success) throw new Error(json.message || 'Speech-to-text failed');
    return json.text; // returned transcribed text string
}


// --- Main Application Logic ---
document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const modeButtons = document.querySelectorAll('.mode-btn');
    const contentSections = document.querySelectorAll('.content-section');
    const secretMessageTextarea = document.getElementById('secretMessage');
    const audioFileInput = document.getElementById('audioFile');
    const audioFileNameSpan = document.getElementById('audio-file-name');
    const encodeBtn = document.getElementById('encode-btn');
    const encodeResultArea = document.getElementById('encode-result-area');
    const canvasBoxEncode = document.getElementById('canvas-box-encode');
    const downloadBtn = document.getElementById('download-btn');
    const imageFileInput = document.getElementById('imageFile');
    const imageFileNameSpan = document.getElementById('image-file-name');
    const decodeBtn = document.getElementById('decode-btn');
    const decodePreviewArea = document.getElementById('decode-preview-area');
    const canvasBoxDecode = document.getElementById('canvas-box-decode');
    const decodeResultArea = document.getElementById('decode-result-area');
    const decodedMessageTextarea = document.getElementById('decodedMessage');

    // Carrier Image Configuration
    const carrierImages = [
        { name: '144p.png', width: 256, height: 144 }, { name: '240p.png', width: 426, height: 240 },
        { name: '360p.png', width: 640, height: 360 }, { name: '480p.png', width: 854, height: 480 },
        { name: '720p.png', width: 1280, height: 720 }, { name: '1080p.png', width: 1920, height: 1080 },
        { name: '1440p.png', width: 2560, height: 1440 }, { name: '2160p.png', width: 3840, height: 2160 },
    ];

    // Mode Switching
    modeButtons.forEach(button => {
        button.addEventListener('click', () => {
            modeButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            const mode = button.getAttribute('data-mode');
            contentSections.forEach(section => {
                section.id === `${mode}-section` ? section.classList.add('active') : section.classList.remove('active');
            });
        });
    });

    // --- ENCODE LOGIC ---
    audioFileInput.addEventListener('change', () => {
        if (audioFileInput.files.length > 0) audioFileNameSpan.textContent = audioFileInput.files[0].name;
        else audioFileNameSpan.textContent = '';
    });

    secretMessageTextarea.addEventListener('input', () => { /* no changes here */ });

    encodeBtn.addEventListener('click', async () => {
        // Clear previous canvas/result
        canvasBoxEncode.innerHTML = '';
        downloadBtn.classList.add('hidden');
        encodeResultArea.classList.add('hidden');

        let secretText = secretMessageTextarea.value || '';
        const audioFile = audioFileInput.files[0];
        if (!secretText && !audioFile) return alert('Please type a message or upload an audio file.');

        encodeBtn.textContent = 'Processing...';
        encodeBtn.disabled = true;

        if (audioFile && !secretText) {
            // try to convert audio to text (will currently reject because stub)
            try {
                secretText = await convertAudioToText(audioFile);
            } catch (err) {
                console.error(err);
                alert('Audio-to-text conversion not available. Please type the message manually or implement STT.');
                encodeBtn.textContent = 'Encode';
                encodeBtn.disabled = false;
                return;
            }
        }

        // compute required bits and choose a carrier (3 channels per pixel)
        const requiredBits = (secretText.length * 8) + 8; // +8 for null terminator
        const selectedCarrier = carrierImages.find(img => (img.width * img.height * 3) >= requiredBits);

        if (!selectedCarrier) {
             alert('Message is too long for the available images.');
             encodeBtn.textContent = 'Encode';
             encodeBtn.disabled = false;
             return;
        }

        try {
            const imgEl = await loadImageElement(`/images/${selectedCarrier.name}`);
            const resultCanvas = encodeToCanvasImage(imgEl, secretText);

            // append canvas to UI
            // scale down in UI if extremely large to avoid layout issues (but keep actual canvas pixel data unchanged)
            const wrapper = document.createElement('div');
            wrapper.appendChild(resultCanvas);
            canvasBoxEncode.appendChild(wrapper);

            // prepare download link
            downloadBtn.href = resultCanvas.toDataURL('image/png');
            downloadBtn.download = 'secureit_encoded.png';
            downloadBtn.classList.remove('hidden');
            encodeResultArea.classList.remove('hidden');
        } catch (err) {
            console.error(err);
            alert('Encoding failed: ' + err.message);
        }

        encodeBtn.textContent = 'Encode';
        encodeBtn.disabled = false;
    });

    // --- DECODE LOGIC ---
    imageFileInput.addEventListener('change', () => {
        if (imageFileInput.files.length > 0) imageFileNameSpan.textContent = imageFileInput.files[0].name;
        else imageFileNameSpan.textContent = '';
    });

    decodeBtn.addEventListener('click', () => {
        // Clear previous
        canvasBoxDecode.innerHTML = '';
        decodePreviewArea.classList.add('hidden');
        decodeResultArea.classList.add('hidden');
        decodedMessageTextarea.value = '';

        const imageFile = imageFileInput.files[0];
        if (!imageFile) return alert('Please upload an image to decode.');

        decodeBtn.textContent = 'Decoding...';
        decodeBtn.disabled = true;

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const imgEl = await loadImageElement(e.target.result);

                // show preview canvas (draw at natural size)
                const previewCanvas = document.createElement('canvas');
                previewCanvas.width = imgEl.naturalWidth;
                previewCanvas.height = imgEl.naturalHeight;
                previewCanvas.getContext('2d').drawImage(imgEl, 0, 0);
                canvasBoxDecode.appendChild(previewCanvas);
                decodePreviewArea.classList.remove('hidden');

                // decode
                const decodedText = decodeFromImageElement(imgEl);
                decodedMessageTextarea.value = decodedText || '';

                decodeResultArea.classList.remove('hidden');
            } catch (err) {
                console.error(err);
                alert('Decoding failed: ' + err.message);
            } finally {
                decodeBtn.textContent = 'Decode';
                decodeBtn.disabled = false;
            }
        };
        reader.onerror = () => {
            alert('Failed to read the selected file.');
            decodeBtn.textContent = 'Decode';
            decodeBtn.disabled = false;
        };
        reader.readAsDataURL(imageFile);
    });
});
