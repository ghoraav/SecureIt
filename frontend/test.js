<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - SecureIt</title>
    <link rel="stylesheet" href="dashboard.css">
    
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;700&display=swap" rel="stylesheet">
    
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body>
    <script>
        let [key, value] = document.cookie.split("=");
    </script>
    <div class="background-gradient"></div>

    <header>
        <h1 class="logo">SecureIt</h1>
        <nav>
            <span class="welcome-user">Welcome, <script>document.write(value)</script>!</span>
            <a href="/index.html" class="nav-btn">Logout</a>
        </nav>
    </header>
    
    <main class="container">
        <div class="mode-toggles">
            <button class="mode-btn active" data-mode="encode"><i class="fas fa-code"></i> Encode</button>
            <button class="mode-btn" data-mode="decode"><i class="fas fa-search"></i> Decode</button>
        </div>

        <div class="content-section active" id="encode-section">
            <div class="card">
                <h3 class="card-title"> Audio/Text --> Image</h3>
                <div class="form-group">
                    <label for="audioFile"><span class="step-number">1</span> Upload Audio File</label>
                    <input type="file" id="audioFile" class="file-input" accept="audio/*">
                    <label for="audioFile" class="file-label">
                        <span id="audio-file-name">Choose an audio file...</span>
                    </label>
                </div>
                <div class="card-title">(or)</div> <br>
                <div class="form-group">
                    <label for="secretMessage"><span class="step-number">2</span> Enter Secret Message</label>
                    <textarea id="secretMessage" rows="4" placeholder="Your secret message goes here..."></textarea>
                </div>
                <button class="btn primary full-width" id="encode-btn">Encode</button>
                
                <div id="encode-result-area" class="result-area hidden">
                    <h4>Resulting Image:</h4>
                    <img id="encoded-image-preview" src="#" alt="Encoded Image">
                    <a href="#" id="download-btn" class="btn primary full-width" download="encoded-image.png">
                        <i class="fas fa-download"></i> <span style="color: white;">Download</span>
                    </a>
                </div>
            </div>
        </div>

        <div class="content-section" id="decode-section">
            <div class="card">
                <h3 class="card-title">Decode Image to Text</h3>
                <div class="form-group">
                    <label for="imageFile"><span class="step-number">1</span> Upload Image File</label>
                    <input type="file" id="imageFile" class="file-input" accept="image/*">
                     <label for="imageFile" class="file-label">
                        <span id="image-file-name">Choose an image file...</span>
                    </label>
                </div>
                <div id="decode-preview-area" class="result-area hidden">
                     <img id="decoded-image-preview" src="#" alt="Uploaded Image Preview">
                </div>
                <button class="btn primary full-width" id="decode-btn">Decode</button>

                <div id="decode-result-area" class="result-area hidden">
                    <h4>Decoded Message:</h4>
                    <textarea id="decodedMessage" rows="4" readonly></textarea>
                </div>
            </div>
        </div>
    </main>
    
    <script src="dashboard.js"></script>
</body>
</html>