const express = require("express");
const app = express();
const path = require("path")
const fs = require("fs");
const cookieParser = require('cookie-parser');
const multer = require('multer');
require('dotenv').config(); // Loads environment variables from .env file

// Import the Google AI SDK
const { GoogleGenerativeAI } = require('@google/generative-ai');


app.use(express.static(path.join(__dirname,"frontend")))
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Initialize Google AI Client with your API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

// Multer setup for handling in-memory file storage
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

app.get("/", (req,res)=>{
    res.sendFile(path.join(__dirname,"frontend","index.html"));
})

app.post("/signin", (req,res)=>{
    console.log("entered sign-in function in server");
    const {email, pass} = req.body;
    var cname = null;
    console.log(email, pass);
    fs.readFile("./database.json", "utf-8", (err, data)=>{
        if(err)
        {
            console.log("error: ", err);
        }
        else{
            const users = JSON.parse(data);
            var {chpass, chemail} = false;
            users.forEach(i => {
                if(i.email === email)
                {
                    chemail = true;
                    console.log("email present", i.password);
                    if(i.password === pass)
                    {
                        chpass = true;
                        cname = i.name;
                        console.log("pass present");
                    }
                }                
            });
            if(chemail)
            {
                if(chpass)
                {
                    res.cookie("name", cname).status(200).json({success:true,message: "successfully Signed in!"});
                    console.log("cookie also set");
                }
                else
                {
                    res.status(401).json({success:false, message:"Incorrect Password!"});
                }
            }
            else
            {
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
        if(err)
        {
            console.log("error: ", err);
        }
        else{
            const users = JSON.parse(fdata);
            users.push(data);
            fs.writeFile("./database.json", JSON.stringify(users), (err)=>{
                if(err)
                {
                    console.log("error: ", err);
                }
                else{
                    res.cookie("name", name).status(200).json({success:true, message:"Successfully Signed up!"});
                    console.log("cookie also set");
                }
            })
        }
    });
    
})


// NEW: Speech-to-Text Endpoint
app.post('/speech-to-text', upload.single('audio'), async (req, res) => {
    console.log('Received audio file for processing...');

    if (!req.file) {
        return res.status(400).json({ success: false, message: 'No audio file uploaded.' });
    }

    try {
        // Convert the audio buffer to a Base64 string for the API
        const audioBuffer = req.file.buffer;
        const audioBase64 = audioBuffer.toString('base64');

        // Prepare the audio part for the API request
        const audioPart = {
            inlineData: {
                data: audioBase64,
                mimeType: req.file.mimetype, // e.g., 'audio/mpeg'
            },
        };

        // Prepare the prompt
        const prompt = "Transcribe the following audio:";

        // Send the request to the Gemini API
        console.log('Sending audio to Gemini API...');
        const result = await model.generateContent([prompt, audioPart]);
        const response = await result.response;
        const transcribedText = response.text();
        
        console.log('Transcription successful:', transcribedText);

        // Send the transcribed text back to the frontend
        res.status(200).json({
            success: true,
            text: transcribedText
        });

    } catch (error) {
        console.error('Error with Gemini API:', error);
        res.status(500).json({ success: false, message: 'Failed to transcribe audio.' });
    }
});



app.listen(8080,(err)=>{
    if(err)
    {
        console.error(err);
    }
    else{
        console.log("server started");
    }
})