// --- START: server.js (Final Combined Version) ---

const express = require("express");
const app = express();
const path = require("path");
const fs = require("fs"); // Corrected fs import
const cookieParser = require('cookie-parser');
const multer = require('multer');
require('dotenv').config(); 

// --- Imports ---
const ffmpeg = require('fluent-ffmpeg');
const child_process = require('child_process'); 

// --- This is the robust import ---
let Jimp = null;

async function loadJimp() {
    if (!Jimp) {
        const jimpModule = await import('jimp');
        Jimp = jimpModule.default || jimpModule.Jimp || jimpModule;
    }
    return Jimp;
}

// --- End Import Fix ---

// Import the Google AI SDK
const { GoogleGenerativeAI } = require('@google/generative-ai');

// --- Static Folders ---
app.use(express.static(path.join(__dirname, "frontend")));
app.use('/videos', express.static(path.join(__dirname, 'frontend', 'videos')));
app.use('/public', express.static(path.join(__dirname, 'frontend', 'public')));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Initialize Google AI Client
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

// --- Multer Setup ---
const memoryStorage = multer.memoryStorage();
const uploadMemory = multer({ storage: memoryStorage });
const diskStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './temp/'); 
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const uploadDisk = multer({ storage: diskStorage });

// --- Ensure required directories exist ---
const tempDir = path.join(__dirname, 'temp');
const resultsDir = path.join(__dirname, 'frontend', 'public', 'results');
const carrierImagesDir = path.join(__dirname, 'frontend', 'images');

if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
if (!fs.existsSync(resultsDir)) fs.mkdirSync(resultsDir, { recursive: true });

// --- Carrier Image List ---
const carrierImages = [
    { name: '144p.png', width: 256, height: 144 }, { name: '240p.png', width: 426, height: 240 },
    { name: '360p.png', width: 640, height: 360 }, { name: '480p.png', width: 854, height: 480 },
    { name: '720p.png', width: 1280, height: 720 }, { name: '1080p.png', width: 1920, height: 1080 },
    { name: '1440p.png', width: 2560, height: 1440 }, { name: '2160p.png', width: 3840, height: 2160 },
];
const carrierVideo = {
    path: 'frontend/videos/carrier.mp4',
    width: 1280, // Assuming 720p
    height: 720
};


// =================================================================
// --- Steganography Core Logic (Callback-based Jimp) ---
// =================================================================
const NULL_TERMINATOR = '1111111111111110'; // 0xFFFE (16 bits)

function textToBinary(text) {
    let binaryMessage = '';
    for (let i = 0; i < text.length; i++) {
        let binaryChar = text[i].charCodeAt(0).toString(2).padStart(8, '0');
        binaryMessage += binaryChar;
    }
    return binaryMessage + NULL_TERMINATOR;
}


function binaryToText(binary) {
    let text = '';
    for (let i = 0; i < binary.length; i += 8) {
        const byte = binary.substring(i, i + 8);
        if (byte.length < 8) break; // ignore incomplete bytes at the end
        text += String.fromCharCode(parseInt(byte, 2));
    }
    return text;
}

// --- NEW: Jimp callback-based helper functions ---
/**
 * Wraps Jimp's callback-based constructor in a Promise for async/await
 * @param {string} path - Path to the image file
 * @returns {Promise<Jimp>} A Promise that resolves with the Jimp image object
 */
async function readJimp(imagePath) {
    try {
        const Jimp = await loadJimp();
        if (typeof Jimp.read !== "function")
            throw new Error("Invalid Jimp import — .read() not found");
        const image = await Jimp.read(imagePath);
        return image;
    } catch (err) {
        throw new Error(`Jimp failed to read image: ${err.message}`);
    }
}



/**
 * Wraps Jimp's callback-based write method in a Promise for async/await
 * @param {Jimp} image - The Jimp image object
 * @param {string} outputPath - The path to save the image
 * @returns {Promise<void>}
 */
function writeJimp(image, outputPath) {
    return new Promise((resolve, reject) => {
        image.write(outputPath, (err) => {
            if (err) return reject(new Error(`Jimp failed to write image: ${err.message}`));
            resolve();
        });
    });
}
// --- END: NEW helper functions ---


/**
 * Encodes a binary string into an image using LSB (Buffer Version)
 */
function encodeLSB(image, binaryMessage) {
    const data = image.bitmap.data; // Get the raw pixel buffer
    let bitIndex = 0;
    let pixelIndex = 0; // Index for the buffer (R,G,B,A, R,G,B,A, ...)

    while (bitIndex < binaryMessage.length) {
        if (pixelIndex >= data.length) {
            // This should not happen if capacity is checked, but good to have
            throw new Error("Message too long for image (buffer overflow).");
        }

        // Get the bit to write
        const bit = parseInt(binaryMessage[bitIndex], 2);

        // Write the bit to the current channel (R, G, or B)
        data[pixelIndex] = (data[pixelIndex] & 0xFE) | bit;

        bitIndex++;
        pixelIndex++;

        // Skip the Alpha channel (every 4th byte)
        if ((pixelIndex + 1) % 4 === 0) {
            pixelIndex++;
        }
    }
    
    return image; // Return the modified image
}

/**
 * Decodes a binary string from an image using LSB (Buffer Version)
 */
/**
 * Decodes a binary string from an image using LSB (Buffer Version)
 */
function decodeLSB(image) {
    const data = image.bitmap.data;
    let bits = '';
    let pixelIndex = 0;

    while (pixelIndex < data.length) {
        bits += (data[pixelIndex] & 1).toString(); // 1. Read the bit

        pixelIndex++; // 2. Move to the next channel (G, B, A, etc.)

        // 3. Check if the *new* index is an Alpha channel.
        // This logic now *exactly* matches the encodeLSB function.
        if ((pixelIndex + 1) % 4 === 0) {
            pixelIndex++; // 4. If so, increment again to skip it
        }

        // Check for terminator
        if (bits.endsWith(NULL_TERMINATOR)) {
            bits = bits.substring(0, bits.length - NULL_TERMINATOR.length);
            break;
        }
    }

    return bits;
}


/**
 * Gets the frame rate of a video file using ffprobe (Unchanged)
 */
function getVideoFrameRate(videoPath) {
    return new Promise((resolve, reject) => {
        const command = `ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`;
        
        child_process.exec(command, (error, stdout, stderr) => {
            if (error) return reject(new Error(`ffprobe error: ${stderr || error.message}`));
            
            const frameRateString = stdout.trim(); 
            if (!frameRateString) return reject(new Error('Could not determine frame rate.'));

            if (frameRateString.includes('/')) {
                const parts = frameRateString.split('/');
                resolve(parseFloat(parts[0]) / parseFloat(parts[1]));
            } else {
                resolve(parseFloat(frameRateString));
            }
        });
    });
}


// =================================================================
// --- API Endpoints ---
// =================================================================

// --- Existing Auth Endpoints (Unchanged) ---
app.get("/", (req,res)=>{
    res.sendFile(path.join(__dirname,"frontend","index.html"));
})

app.post("/signin", (req,res)=>{
    console.log("entered sign-in function in server");
    const {email, pass} = req.body;
    var cname = null;
    console.log(email, pass);
    fs.readFile("./database.json", "utf-8", (err, data)=>{
        if(err) { console.log("error: ", err); }
        else{
            const users = JSON.parse(data);
            var {chpass, chemail} = false;
            users.forEach(i => {
                if(i.email === email) {
                    chemail = true;
                    console.log("email present", i.password);
                    if(i.password === pass) {
                        chpass = true;
                        cname = i.name;
                        console.log("pass present");
                    }
                }                
            });
            if(chemail) {
                if(chpass) {
                    res.cookie("name", cname).status(200).json({success:true,message: "successfully Signed in!"});
                    console.log("cookie also set");
                } else {
                    res.status(401).json({success:false, message:"Incorrect Password!"});
                }
            } else {
                res.status(401).json({success: false, message:"Incorrect Email!"});
            }
        }
    })
    console.log("exiting server");
})

app.post("/signup", (req,res)=>{
    console.log("entered sign-up function in node");
    const {name, email, pass} = req.body;
    const data = {name, email, pass};
    fs.readFile("./database.json", "utf-8", (err, fdata)=>{
        if(err) { console.log("error: ", err); }
        else{
            const users = JSON.parse(fdata);
            users.push(data);
            fs.writeFile("./database.json", JSON.stringify(users), (err)=>{
                if(err) { console.log("error: ", err); }
                else{
                    res.cookie("name", name).status(200).json({success:true, message:"Successfully Signed up!"});
                    console.log("cookie also set");
                }
            })
        }
    });
})

// --- Speech-to-Text Endpoint (Unchanged) ---
app.post('/speech-to-text', uploadMemory.single('audio'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No audio file uploaded.' });
    }
    try {
        const transcribedText = await internalSpeechToText(req.file);
        res.status(200).json({ success: true, text: transcribedText });
    } catch (error) {
        console.error('Error with Gemini API:', error);
        res.status(500).json({ success: false, message: 'Failed to transcribe audio.' });
    }
});

// Internal helper function for STT (Unchanged)
async function internalSpeechToText(audioFile) {
    console.log('Processing audio file in-memory...');
    const audioBuffer = audioFile.buffer;
    const audioBase64 = audioBuffer.toString('base64');
    const audioPart = {
        inlineData: { data: audioBase64, mimeType: audioFile.mimetype },
    };
    const prompt = "Transcribe the following audio:";
    console.log('Sending audio to Gemini API...');
    const result = await model.generateContent([prompt, audioPart]);
    const response = await result.response;
    const transcribedText = response.text();
    console.log('Transcription successful:', transcribedText);
    return transcribedText;
}


// --- NEW: Encode Endpoint ---
app.post('/encode', 
    uploadMemory.fields([{ name: 'audio', maxCount: 1 }]), 
    async (req, res) => {
    
    console.log("Received /encode request");
    const { secretMessage, carrierType } = req.body;
    const audioFile = req.files && req.files.audio ? req.files.audio[0] : null;
    let secretText = secretMessage;

    try {
        // 1. Determine Secret Text (Unchanged)
        if (!secretText && audioFile) {
            console.log("No text, processing audio...");
            secretText = await internalSpeechToText(audioFile);
        }
        if (!secretText) {
            return res.status(400).json({ success: false, message: 'No secret message provided.' });
        }

        const binaryMessage = textToBinary(secretText);
        const requiredBits = binaryMessage.length;
        const requiredCapacity = Math.ceil(requiredBits / 3); // R,G,B channels

        // 2. Process based on Carrier Type
        if (carrierType === 'image') {
            console.log("Processing as IMAGE");
            const selectedCarrier = carrierImages.find(img => (img.width * img.height) >= requiredCapacity);
            if (!selectedCarrier) {
                return res.status(400).json({ success: false, message: 'Message too long for available images.' });
            }

            const carrierPath = path.join(carrierImagesDir, selectedCarrier.name);
            const outputPath = path.join(resultsDir, `encoded-${Date.now()}.png`);
            
            // --- LOGIC CHANGE ---
            const image = await readJimp(carrierPath); // Use helper
            const encodedImage = encodeLSB(image, binaryMessage);
            await writeJimp(encodedImage, outputPath); // Use helper

            const downloadUrl = `/public/results/${path.basename(outputPath)}`;
            console.log("Image encoding successful:", downloadUrl);
            res.status(200).json({ success: true, downloadUrl: downloadUrl });

        } else if (carrierType === 'video') {
            console.log("Processing as VIDEO");
            const carrierPath = carrierVideo.path;
            
            const frameCapacity = (carrierVideo.width * carrierVideo.height);
            if (frameCapacity < requiredCapacity) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Message is too long. Max for video is approx ${Math.floor((frameCapacity*3)/8)} chars.`
                });
            }

            const runId = Date.now();
            const frameDir = path.join(tempDir, `run-${runId}`);
            if (!fs.existsSync(frameDir)) fs.mkdirSync(frameDir);

            const outputPath = path.join(resultsDir, `encoded-${runId}.mkv`);
            const downloadUrl = `/public/results/${path.basename(outputPath)}`;
            
            // --- NEW: Define paths for extracted files ---
            const audioPath = path.join(frameDir, 'audio.aac');
            const framePattern = path.join(frameDir, 'frame-%05d.png');
            const firstFramePath = path.join(frameDir, 'frame-00001.png');

            // Get original frame rate
            const frameRate = await getVideoFrameRate(carrierPath);

            console.log("Extracting audio track...");
            await new Promise((resolve, reject) => {
                ffmpeg(carrierPath)
                    .outputOptions([
                        '-vn',         // No video
                        '-c:a copy'    // Copy audio codec
                    ])
                    .output(audioPath)
                    .on('end', resolve)
                    .on('error', (err) => reject(new Error('FFmpeg audio extraction failed: ' + err.message)))
                    .run();
            });

            console.log("Extracting all frames (this may take a moment)...");
            await new Promise((resolve, reject) => {
                ffmpeg(carrierPath)
                    .outputOptions([
                        '-an',         // No audio
                        '-r ' + frameRate // Preserve frame rate
                    ])
                    .output(framePattern)
                    .on('end', resolve)
                    .on('error', (err) => reject(new Error('FFmpeg frame extraction failed: ' + err.message)))
                    .run();
            });

            console.log("Encoding message into first frame...");
            // Use your working readJimp helper
            const image = await readJimp(firstFramePath); 
            const encodedImage = encodeLSB(image, binaryMessage);
            // Use your working writeJimp helper (this overwrites frame-00001.png)
            await writeJimp(encodedImage, firstFramePath); 

            console.log("Re-assembling video (this will be slow and create a large file)...");
            await new Promise((resolve, reject) => {
                ffmpeg()
                    // Input 1: The sequence of ALL frames
                    .input(framePattern)
                    .inputOptions(['-r ' + frameRate])
                    // Input 2: The extracted audio
                    .input(audioPath)
                    // --- FIX: Use ffv1 (lossless) in an MKV container ---
                    .outputOptions([
                        '-map 0:v:0',
                        '-map 1:a:0?',
                        '-c:a copy',        // Copy the audio
                        '-c:v ffv1',        // Use the FFV1 lossless video codec
                        '-pix_fmt rgb24'    // Ensure RGB format is preserved
                    ])
                    .output(outputPath) // This now points to the .mkv file
                    .on('end', resolve)
                    .on('error', (err) => reject(new Error('FFmpeg re-assembly error: ' + err.message)))
                    .run();
            });

            // 7. Cleanup
            console.log("Cleaning up temp files...");
            const files = fs.readdirSync(frameDir);
            for (const file of files) {
                fs.unlinkSync(path.join(frameDir, file));
            }
            fs.rmdirSync(frameDir); 
            console.log("Video encoding successful:", downloadUrl);
            res.status(200).json({ success: true, downloadUrl: downloadUrl });
            
        }else {
            res.status(400).json({ success: false, message: 'Invalid carrier type.' });
        }
    } catch (error) {
        console.error('Error during /encode:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});


// --- NEW: Decode Endpoint ---
app.post('/decode', uploadDisk.single('file'), async (req, res) => {
    console.log("Received /decode request");
    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No file uploaded.' });
    }

    const filePath = req.file.path;
    const mimeType = req.file.mimetype;
    let decodedText = '';

    try {
        if (mimeType.startsWith('image/')) {
            console.log("Decoding as IMAGE");
            
            // --- LOGIC CHANGE ---
            const image = await readJimp(filePath); // Use helper
            const binary = decodeLSB(image);
            decodedText = binaryToText(binary);

        } else if (mimeType.startsWith('video/')) {
            console.log("Decoding as VIDEO");
            
            const framePath = path.join(tempDir, `decode-frame-${Date.now()}.png`);

            console.log("Extracting first frame for decoding...");
            await new Promise((resolve, reject) => {
                ffmpeg(filePath)
                    .outputOptions(['-vframes 1'])
                    .output(framePath)
                    .on('end', resolve)
                    .on('error', reject)
                    .run();
            });

            console.log("Decoding from frame...");
            
            // --- LOGIC CHANGE ---
            const image = await readJimp(framePath); // Use helper
            const binary = decodeLSB(image);
            decodedText = binaryToText(binary);

            // Cleanup frame
            fs.unlinkSync(framePath);

        } else {
            return res.status(400).json({ success: false, message: 'Unsupported file type.' });
        }

        // Cleanup uploaded file
        fs.unlinkSync(filePath);

        console.log("Decoding successful.");
        res.status(200).json({ success: true, text: decodedText });

    } catch (error) {
        // Ensure cleanup on error
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        console.error('Error during /decode:', error);
        res.status(500).json({ success: false, message: 'Server error: ' + error.message });
    }
});


// --- Server Start ---
app.listen(8080,(err)=>{
    if(err)
    {
        console.error(err);
    }
    else{
        console.log("Server started on http://localhost:8080");
    }
})

// --- END: server.js (Final Combined Version) ---