// --- START: dashboard.js ---
document.addEventListener('DOMContentLoaded', () => {
    // --- UI Elements ---
    const modeButtons = document.querySelectorAll('.mode-btn[data-mode]');
    const contentSections = document.querySelectorAll('.content-section');
    
    // Encode section
    const carrierToggleButtons = document.querySelectorAll('#carrier-type-toggle .mode-btn');
    const secretMessageTextarea = document.getElementById('secretMessage');
    const audioFileInput = document.getElementById('audioFile');
    const audioFileNameSpan = document.getElementById('audio-file-name');
    const encodeBtn = document.getElementById('encode-btn');
    const encodeResultArea = document.getElementById('encode-result-area');
    //const resultPreviewBox = document.getElementById('result-preview-box');
    const downloadBtn = document.getElementById('download-btn');

    // Decode section
    const uploadFileInput = document.getElementById('uploadFile');
    const uploadFileNameSpan = document.getElementById('upload-file-name');
    const decodeBtn = document.getElementById('decode-btn');
    //const decodePreviewArea = document.getElementById('decode-preview-area');
    //const uploadPreviewBox = document.getElementById('upload-preview-box');
    const decodeResultArea = document.getElementById('decode-result-area');
    const decodedMessageTextarea = document.getElementById('decodedMessage');

    // --- State ---
    let activeCarrierType = 'image'; // 'image' or 'video'

    // --- Main Mode Switching (Encode/Decode) ---
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

    // --- Carrier Type Switching (Image/Video) ---
    carrierToggleButtons.forEach(button => {
        button.addEventListener('click', () => {
            carrierToggleButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            activeCarrierType = button.getAttribute('data-carrier');
            console.log("Carrier type set to:", activeCarrierType);
        });
    });

    // --- File Input Name Updates ---
    audioFileInput.addEventListener('change', () => {
        if (audioFileInput.files.length > 0) audioFileNameSpan.textContent = audioFileInput.files[0].name;
        else audioFileNameSpan.textContent = 'Upload an audio file...';
    });

    uploadFileInput.addEventListener('change', () => {
        if (uploadFileInput.files.length > 0) {
            const file = uploadFileInput.files[0];
            uploadFileNameSpan.textContent = file.name;
            // Show preview
            //showUploadPreview(file);
        } else {
            uploadFileNameSpan.textContent = 'Choose an image or video...';
            //uploadPreviewBox.innerHTML = '';
            //decodePreviewArea.classList.add('hidden');
        }
    });

    // // --- Helper: Show Upload Preview ---
    // function showUploadPreview(file) {
    //     uploadPreviewBox.innerHTML = ''; // Clear previous preview
    //     decodePreviewArea.classList.remove('hidden');
    //     const reader = new FileReader();
    //     reader.onload = (e) => {
    //         let previewElement;
    //         if (file.type.startsWith('image/')) {
    //             previewElement = document.createElement('img');
    //         } else if (file.type.startsWith('video/')) {
    //             previewElement = document.createElement('video');
    //             previewElement.controls = true;
    //         }
    //         if (previewElement) {
    //             previewElement.src = e.target.result;
    //             previewElement.style.maxWidth = '100%';
    //             previewElement.style.borderRadius = '8px';
    //             uploadPreviewBox.appendChild(previewElement);
    //         }
    //     };
    //     reader.readAsDataURL(file);
    // }

    // // --- Helper: Show Result Preview ---
    // function showResultPreview(url, type) {
    //     resultPreviewBox.innerHTML = ''; // Clear previous
    //     let previewElement;
    //     if (type === 'image') {
    //         previewElement = document.createElement('img');
    //     } else if (type === 'video') {
    //         previewElement = document.createElement('video');
    //         previewElement.controls = true;
    //     }
    //     if (previewElement) {
    //         previewElement.src = url;
    //         previewElement.style.maxWidth = '100%';
    //         previewElement.style.borderRadius = '8px';
    //         resultPreviewBox.appendChild(previewElement);
    //     }
    // }


    // --- ENCODE LOGIC ---
    encodeBtn.addEventListener('click', async () => {
        // Clear previous result
        //resultPreviewBox.innerHTML = '';
        downloadBtn.classList.add('hidden');
        encodeResultArea.classList.add('hidden');

        let secretText = secretMessageTextarea.value || '';
        const audioFile = audioFileInput.files[0];
        if (!secretText && !audioFile) {
            return alert('Please type a message or upload an audio file.');
        }

        encodeBtn.textContent = 'Processing...';
        encodeBtn.disabled = true;

        const formData = new FormData();
        formData.append('secretMessage', secretText);
        formData.append('carrierType', activeCarrierType);
        if (audioFile) {
            formData.append('audio', audioFile, audioFile.name);
        }

        try {
            const response = await fetch('/encode', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Encoding failed.');
            }

            // Success!
            console.log('Download URL:', result.downloadUrl);
            //showResultPreview(result.downloadUrl, activeCarrierType);
            downloadBtn.href = result.downloadUrl;
            downloadBtn.download = result.downloadUrl.split('/').pop();
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
    decodeBtn.addEventListener('click', async () => {
        // Clear previous
        decodeResultArea.classList.add('hidden');
        decodedMessageTextarea.value = '';

        const file = uploadFileInput.files[0];
        if (!file) {
            return alert('Please upload an image or video file to decode.');
        }

        decodeBtn.textContent = 'Decoding...';
        decodeBtn.disabled = true;

        const formData = new FormData();
        formData.append('file', file, file.name);

        try {
            const response = await fetch('/decode', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (!result.success) {
                throw new Error(result.message || 'Decoding failed.');
            }

            // Success!
            decodedMessageTextarea.value = result.text || '';
            decodeResultArea.classList.remove('hidden');

        } catch (err) {
            console.error(err);
            alert('Decoding failed: ' + err.message);
        }

        decodeBtn.textContent = 'Decode';
        decodeBtn.disabled = false;
    });
});
// --- END: dashboard.js ---