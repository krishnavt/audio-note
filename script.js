class AudioNote {
    constructor() {
        this.isRecording = false;
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.recognition = null;
        this.recordingStartTime = null;
        this.recordingTimer = null;
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.dataArray = null;
        this.animationFrame = null;
        this.finalTranscript = '';
        this.lastInterimTranscript = '';
        this.recordedTranscript = '';
        
        // User management
        this.user = null;
        this.sessionToken = localStorage.getItem('audioNote_sessionToken');
        this.userMinutes = 1; // Default to 1 minute for display

        console.log('Initializing AudioNote...');
        this.checkBrowserSupport();
        this.initializeElements();
        this.initializeSpeechRecognition();
        this.initializeAI();
        this.bindEvents();
        this.updateTimeDisplay(); // Initialize time display
    }

    checkBrowserSupport() {
        console.log('Checking browser support...');
        
        // Check HTTPS
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            this.showError('HTTPS is required for microphone access. Please use HTTPS.');
            return false;
        }
        
        // Check getUserMedia
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            this.showError('Your browser does not support audio recording.');
            return false;
        }
        
        // Check Speech Recognition
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            this.showError('Your browser does not support speech recognition. Try Chrome or Edge.');
            return false;
        }
        
        console.log('Browser support check passed');
        return true;
    }

    initializeElements() {
        this.recordBtn = document.getElementById('recordBtn');
        this.recordingTime = document.getElementById('recordingTime');
        this.recordingStatus = document.querySelector('.recording-status');
        this.audioLevel = document.querySelector('.level-bar');
        this.transcript = document.getElementById('transcript');
        this.wordCount = document.getElementById('wordCount');
        this.charCount = document.getElementById('charCount');
        this.clearBtn = document.getElementById('clearBtn');
        this.copyBtn = document.getElementById('copyBtn');
        this.shareBtn = document.getElementById('shareBtn');
        this.spinner = document.getElementById('loadingSpinner');
        this.recordingInfo = document.getElementById('recordingInfo');
        this.permissionBtn = document.getElementById('permissionBtn');
        this.fallbackMode = document.getElementById('fallbackMode');
        this.manualModeBtn = document.getElementById('manualModeBtn');
        
        // AI Enhancement elements (removed - now automatic)
        this.aiStatus = document.getElementById('aiStatus');
        this.timeBtn = document.getElementById('timeBtn');
        this.timePanel = document.getElementById('timePanel');
        this.closeTimeBtn = document.getElementById('closeTimeBtn');
        this.timeDisplay = document.getElementById('timeDisplay');
        this.timeCount = document.getElementById('timeCount');

        // Authentication elements
        this.authButtons = document.getElementById('authButtons');
        this.userInfo = document.getElementById('userInfo');
        this.authBtn = document.getElementById('authBtn');
        this.logoutBtn = document.getElementById('logoutBtn');
        this.userEmail = document.getElementById('userEmail');
        this.userTime = document.getElementById('userTime');
        
        this.authModal = document.getElementById('authModal');
        this.closeAuthModal = document.getElementById('closeAuthModal');
        this.authModalTitle = document.getElementById('authModalTitle');
        this.emailStep = document.getElementById('emailStep');
        this.verificationStep = document.getElementById('verificationStep');
        this.emailInput = document.getElementById('emailInput');
        this.codeInput = document.getElementById('codeInput');
        this.sendCodeBtn = document.getElementById('sendCodeBtn');
        this.verifyCodeBtn = document.getElementById('verifyCodeBtn');
        this.resendCodeBtn = document.getElementById('resendCodeBtn');
        this.backToEmailBtn = document.getElementById('backToEmailBtn');
        this.authSwitchBtn = document.getElementById('authSwitchBtn');
        this.authSwitchText = document.getElementById('authSwitchText');
        this.sentToEmail = document.getElementById('sentToEmail');
        
        // User menu elements
        this.userIconBtn = document.getElementById('userIconBtn');
        this.userDropdown = document.getElementById('userDropdown');
    }

    initializeSpeechRecognition() {
        if ('webkitSpeechRecognition' in window) {
            this.recognition = new webkitSpeechRecognition();
        } else if ('SpeechRecognition' in window) {
            this.recognition = new SpeechRecognition();
        } else {
            console.warn('Speech recognition not supported');
            this.fallbackMode.classList.remove('hidden');
            this.recordingInfo.textContent = 'Speech recognition not available in your browser';
            return;
        }

        if (this.recognition) {
            this.recognition.continuous = true;
            this.recognition.interimResults = true;
            this.recognition.lang = 'en-US';

            this.recognition.onstart = () => {
                console.log('Speech recognition started');
                this.recordedTranscript = ''; // Reset for new recording
            };

            this.recognition.onresult = (event) => {
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        console.log('Final transcript:', transcript);
                        this.recordedTranscript += transcript + ' ';
                    }
                }
            };

            this.recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error);
                if (event.error === 'network') {
                    this.showError('Network error. Please check your connection.');
                } else if (event.error === 'not-allowed') {
                    this.showError('Microphone access denied. Please allow microphone access.');
                } else {
                    this.showError('Speech recognition error: ' + event.error);
                }
            };

            this.recognition.onend = () => {
                if (this.isRecording) {
                    // Restart recognition if we're still recording
                    setTimeout(() => {
                        if (this.isRecording) {
                            this.recognition.start();
                        }
                    }, 100);
                }
            };
        }
    }

    initializeAI() {
        // Check if user is authenticated
        this.checkAuthentication();
        this.updateAIButtonState();
    }

    async checkAuthentication() {
        if (this.sessionToken) {
            try {
                const response = await fetch('/api/auth', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        action: 'check-session',
                        sessionToken: this.sessionToken
                    })
                });

                if (response.ok) {
                    const data = await response.json();
                    this.user = data.user;
                    this.userMinutes = data.user.remainingMinutes;
                    this.updateUserDisplay();
                    return;
                }
            } catch (error) {
                console.error('Session check failed:', error);
            }
        }
        
        // Not authenticated - show auth buttons
        this.showAuthButtons();
    }

    updateUserDisplay() {
        if (this.user) {
            this.authButtons.classList.add('hidden');
            this.userInfo.classList.remove('hidden');
            this.userEmail.textContent = this.user.email;
            this.updateTimeDisplay();
        } else {
            this.showAuthButtons();
        }
    }

    showAuthButtons() {
        this.authButtons.classList.remove('hidden');
        this.userInfo.classList.add('hidden');
    }

    updateTimeDisplay() {
        const minutes = Math.floor(this.userMinutes);
        const seconds = Math.round((this.userMinutes - minutes) * 60);
        const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        if (this.timeDisplay) {
            this.timeDisplay.textContent = timeStr;
        }
        if (this.timeCount) {
            this.timeCount.textContent = `${this.userMinutes.toFixed(1)}`;
        }
        if (this.userTime) {
            this.userTime.textContent = `${timeStr} min`;
        }
    }

    bindEvents() {
        console.log('Binding events...');
        this.recordBtn.addEventListener('click', (e) => {
            console.log('Record button clicked');
            e.preventDefault();
            this.toggleRecording();
        });
        this.permissionBtn.addEventListener('click', (e) => {
            console.log('Permission button clicked');
            e.preventDefault();
            this.requestPermissions();
        });
        this.manualModeBtn.addEventListener('click', (e) => {
            console.log('Manual mode button clicked');
            e.preventDefault();
            this.enableManualMode();
        });
        
        // AI Enhancement events (removed - now automatic)
        this.timeBtn.addEventListener('click', () => this.showTimePanel());
        this.closeTimeBtn.addEventListener('click', () => this.hideTimePanel());

        // Authentication events
        this.authBtn.addEventListener('click', () => this.showAuth());
        this.logoutBtn.addEventListener('click', () => this.logout());
        this.closeAuthModal.addEventListener('click', () => this.hideAuthModal());
        this.sendCodeBtn.addEventListener('click', () => this.sendVerificationCode());
        this.verifyCodeBtn.addEventListener('click', () => this.verifyCode());
        this.resendCodeBtn.addEventListener('click', () => this.resendCode());
        this.backToEmailBtn.addEventListener('click', () => this.backToEmailStep());
        this.authSwitchBtn.addEventListener('click', () => this.toggleAuthMode());
        
        // User menu events
        this.userIconBtn.addEventListener('click', () => this.toggleUserDropdown());
        
        this.clearBtn.addEventListener('click', () => this.clearTranscript());
        this.copyBtn.addEventListener('click', () => this.copyTranscript());
        this.shareBtn.addEventListener('click', () => this.shareTranscript());
        this.transcript.addEventListener('input', () => this.updateStats());
        
        // Handle paste events
        this.transcript.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData('text');
            document.execCommand('insertText', false, text);
            this.updateStats();
        });
        
        // Close panels when clicking outside
        this.timePanel.addEventListener('click', (e) => {
            if (e.target === this.timePanel) {
                this.hideTimePanel();
            }
        });
        
        // Close user dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!this.userIconBtn.contains(e.target) && !this.userDropdown.contains(e.target)) {
                this.hideUserDropdown();
            }
        });

        this.authModal.addEventListener('click', (e) => {
            if (e.target === this.authModal) {
                this.hideAuthModal();
            }
        });

        // Add buy button event listeners
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('buy-btn')) {
                const minutes = parseInt(e.target.dataset.minutes);
                const price = parseFloat(e.target.dataset.price);
                this.purchaseTime(minutes, price);
            }
        });
    }

    async requestPermissions() {
        console.log('Requesting permissions...');
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            console.log('Permissions granted');
            this.showMessage('Microphone access granted! You can now record.');
            this.permissionBtn.classList.add('hidden');
            this.recordingInfo.textContent = 'Click the record button to start';
            // Close the stream
            stream.getTracks().forEach(track => track.stop());
        } catch (error) {
            console.error('Permission denied:', error);
            if (error.name === 'NotAllowedError') {
                this.showError('Please allow microphone access in your browser settings and try again.');
                this.recordingInfo.textContent = 'Microphone access is required for recording';
            }
        }
    }

    enableManualMode() {
        console.log('Enabling manual mode...');
        this.fallbackMode.classList.add('hidden');
        this.recordingInfo.textContent = 'Manual mode: Click in the transcript area below to start typing';
        this.transcript.textContent = '';
        this.transcript.classList.add('has-content');
        this.transcript.focus();
        this.showMessage('Manual mode enabled. You can now type directly in the transcript area.');
    }

    async toggleRecording() {
        console.log('Toggle recording called. Currently recording:', this.isRecording);
        try {
            if (!this.isRecording) {
                await this.startRecording();
            } else {
                this.stopRecording();
            }
        } catch (error) {
            console.error('Error in toggleRecording:', error);
            this.showError('Failed to toggle recording: ' + error.message);
        }
    }

    async startRecording() {
        console.log('Starting recording...');
        
        // Clear previous transcript and reset recorded transcript
        this.transcript.textContent = 'Recording... Speak now!';
        this.recordedTranscript = '';
        this.transcript.classList.add('recording-state');
        
        try {
            // Request microphone permission
            console.log('Requesting microphone access...');
            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                } 
            });
            console.log('Microphone access granted');

            this.setupAudioVisualization(stream);
            this.setupMediaRecorder(stream);

            this.isRecording = true;
            this.recordBtn.classList.add('recording');
            // No text to update - button is icon only
            this.recordingStatus.classList.add('active');

            this.startTimer();
            
            // Start speech recognition to capture transcript
            if (this.recognition) {
                console.log('Starting speech recognition...');
                try {
                    this.recognition.start();
                } catch (speechError) {
                    console.error('Speech recognition start error:', speechError);
                }
            }
            
            // Check if user is not signed in and limit to 30 seconds
            if (!this.user) {
                setTimeout(() => {
                    if (this.isRecording) {
                        this.showMessage('30-second free recording limit reached. Sign up for unlimited recording!');
                        this.stopRecording();
                    }
                }, 30000); // 30 seconds
            }

            console.log('Starting media recorder...');
            this.mediaRecorder.start();

        } catch (error) {
            console.error('Error starting recording:', error);
            if (error.name === 'NotAllowedError') {
                this.showError('Microphone access denied. Please click "Grant Microphone Permission" below and try again.');
                this.recordingInfo.textContent = 'Microphone access is required for recording';
                this.permissionBtn.classList.remove('hidden');
            } else if (error.name === 'NotFoundError') {
                this.showError('No microphone found. Please connect a microphone and try again.');
            } else {
                this.showError('Unable to start recording: ' + error.message);
            }
        }
    }

    setupAudioVisualization(stream) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.analyser = this.audioContext.createAnalyser();
        this.microphone = this.audioContext.createMediaStreamSource(stream);
        
        this.analyser.fftSize = 256;
        const bufferLength = this.analyser.frequencyBinCount;
        this.dataArray = new Uint8Array(bufferLength);
        
        this.microphone.connect(this.analyser);
        this.updateAudioLevel();
    }

    setupMediaRecorder(stream) {
        this.mediaRecorder = new MediaRecorder(stream);
        this.audioChunks = [];

        this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
                this.audioChunks.push(event.data);
            }
        };

        this.mediaRecorder.onstop = () => {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/wav' });
            console.log('Audio recorded:', audioBlob);
            
            // Process the recorded audio
            this.processRecording(audioBlob);
        };
    }

    updateAudioLevel() {
        if (!this.isRecording || !this.analyser) return;

        this.analyser.getByteFrequencyData(this.dataArray);
        
        let sum = 0;
        for (let i = 0; i < this.dataArray.length; i++) {
            sum += this.dataArray[i];
        }
        
        const average = sum / this.dataArray.length;
        const percentage = (average / 255) * 100;
        
        this.audioLevel.style.width = percentage + '%';

        this.animationFrame = requestAnimationFrame(() => this.updateAudioLevel());
    }

    stopRecording() {
        this.isRecording = false;
        
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
        }
        
        if (this.recognition) {
            this.recognition.stop();
        }

        if (this.animationFrame) {
            cancelAnimationFrame(this.animationFrame);
        }

        if (this.audioContext) {
            this.audioContext.close();
        }

        this.recordBtn.classList.remove('recording');
        this.recordingStatus.classList.remove('active');
        
        this.stopTimer();
        this.audioLevel.style.width = '0%';
        
        // Show processing message
        this.transcript.textContent = 'Processing your recording...';
        this.transcript.classList.remove('recording-state');
        this.transcript.classList.add('processing-state');
    }

    startTimer() {
        this.recordingStartTime = Date.now();
        this.recordingTimer = setInterval(() => {
            const elapsed = Date.now() - this.recordingStartTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            this.recordingTime.textContent = 
                `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    stopTimer() {
        if (this.recordingTimer) {
            clearInterval(this.recordingTimer);
            this.recordingTimer = null;
        }
        this.recordingTime.textContent = '00:00';
    }

    updateTranscript(interimText) {
        // Display final transcript + interim transcript
        const displayText = this.finalTranscript + interimText;
        
        if (displayText.trim()) {
            this.transcript.textContent = displayText;
            this.transcript.classList.add('has-content');
        } else if (!this.finalTranscript.trim()) {
            this.transcript.textContent = 'Your transcribed text will appear here...';
            this.transcript.classList.remove('has-content');
        }
        
        this.updateStats();
    }

    updateStats() {
        const text = this.transcript.textContent.replace('Your transcribed text will appear here...', '').trim();
        const words = text ? text.split(/\s+/).length : 0;
        const chars = text.length;
        
        this.wordCount.textContent = `${words} word${words !== 1 ? 's' : ''}`;
        this.charCount.textContent = `${chars} character${chars !== 1 ? 's' : ''}`;
        
        // Update AI button state when text changes
        this.updateAIButtonState();
    }
    
    async processRecording(audioBlob) {
        console.log('Processing recorded audio...');
        
        try {
            // Show processing state
            this.setProcessingState(true, 'Converting to structured text...');
            
            // Use the transcript captured during recording
            const transcript = this.recordedTranscript.trim();
            
            if (transcript) {
                // Automatically enhance with AI formatting
                await this.enhanceTranscriptAutomatically(transcript);
            } else {
                // No transcript was captured
                this.transcript.textContent = 'No speech detected. Please try recording again and speak clearly.';
                this.transcript.classList.remove('processing-state');
            }
            
        } catch (error) {
            console.error('Processing error:', error);
            this.transcript.textContent = 'Failed to process recording. Please try again.';
            this.transcript.classList.remove('processing-state');
            this.showError('Failed to process recording: ' + error.message);
        } finally {
            this.setProcessingState(false);
        }
    }
    
    async enhanceTranscriptAutomatically(transcript) {
        try {
            console.log('Enhancing transcript with AI...');
            
            const response = await fetch('/api/enhance', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: transcript,
                    mode: 'auto-format', // New mode for automatic formatting
                    sessionToken: this.sessionToken
                })
            });

            if (!response.ok) {
                // If AI enhancement fails, show original transcript
                console.log('AI enhancement failed, showing original transcript');
                this.displayTranscriptionResult(transcript);
                return;
            }

            const data = await response.json();
            
            if (data.enhancedText) {
                // Display the AI-enhanced result
                this.displayTranscriptionResult(data.enhancedText);
                
                // Update remaining time if user is authenticated
                if (data.remainingMinutes !== undefined) {
                    this.userMinutes = data.remainingMinutes;
                    this.updateTimeDisplay();
                }
                
                this.showMessage('✨ Voice note converted to structured text!');
            } else {
                // Fallback to original transcript
                this.displayTranscriptionResult(transcript);
            }
            
        } catch (error) {
            console.error('AI Enhancement error:', error);
            // Fallback to original transcript if AI fails
            this.displayTranscriptionResult(transcript);
        }
    }
    
    async blobToBase64(blob) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
    
    setProcessingState(isProcessing, message = '') {
        if (isProcessing) {
            this.recordBtn.disabled = true;
            this.transcript.textContent = message;
            this.transcript.classList.add('processing-state');
        } else {
            this.recordBtn.disabled = false;
            this.transcript.classList.remove('processing-state');
        }
    }
    
    displayTranscriptionResult(transcript) {
        // Simple text display - no email formatting
        this.transcript.textContent = transcript;
        this.transcript.classList.remove('processing-state', 'recording-state', 'email-format');
        this.transcript.classList.add('has-content');
        
        this.updateStats();
    }

    clearTranscript() {
        this.finalTranscript = '';
        this.lastInterimTranscript = '';
        this.transcript.textContent = 'Your transcribed text will appear here...';
        this.transcript.classList.remove('has-content');
        this.updateStats();
    }

    async copyTranscript() {
        const text = this.transcript.textContent.replace('Your transcribed text will appear here...', '').trim();
        
        if (!text) {
            this.showMessage('No text to copy');
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
            this.showMessage('Text copied to clipboard!');
        } catch (error) {
            console.error('Failed to copy text:', error);
            this.showMessage('Failed to copy text');
        }
    }

    shareTranscript() {
        const text = this.transcript.textContent.replace('Your transcribed text will appear here...', '').trim();
        
        if (!text) {
            this.showMessage('No text to share');
            return;
        }

        if (navigator.share) {
            navigator.share({
                title: 'AudioNote Transcript',
                text: text
            }).catch(error => {
                console.error('Error sharing:', error);
                this.fallbackShare(text);
            });
        } else {
            this.fallbackShare(text);
        }
    }

    fallbackShare(text) {
        const url = `mailto:?subject=AudioNote Transcript&body=${encodeURIComponent(text)}`;
        window.open(url);
    }

    showMessage(message) {
        // Create a temporary notification
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #333;
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            z-index: 1001;
            font-size: 0.9rem;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            max-width: 300px;
        `;
        notification.textContent = message;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 5000);
    }

    showError(message) {
        this.showMessage('Error: ' + message);
    }

    showSpinner() {
        this.spinner.classList.remove('hidden');
    }

    hideSpinner() {
        this.spinner.classList.add('hidden');
    }

    // Authentication Methods
    showAuth() {
        this.authModalTitle.textContent = 'Get Started';
        this.authSwitchText.textContent = 'Enter your email to continue';
        this.authSwitchBtn.textContent = '';
        this.showAuthModal();
        this.hideUserDropdown(); // Close dropdown after clicking
    }

    showAuthModal() {
        this.authModal.classList.remove('hidden');
        this.emailStep.classList.remove('hidden');
        this.verificationStep.classList.add('hidden');
        this.emailInput.value = '';
        this.codeInput.value = '';
    }

    hideAuthModal() {
        this.authModal.classList.add('hidden');
    }

    toggleAuthMode() {
        if (this.authModalTitle.textContent === 'Sign Up') {
            this.showLogin();
        } else {
            this.showSignup();
        }
    }

    async sendVerificationCode() {
        const email = this.emailInput.value.trim();
        if (!email) {
            this.showError('Please enter your email address');
            return;
        }

        this.sendCodeBtn.disabled = true;
        this.sendCodeBtn.textContent = 'Sending...';

        try {
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'send-code',
                    email: email
                })
            });

            const data = await response.json();
            
            if (response.ok) {
                this.sentToEmail.textContent = email;
                this.emailStep.classList.add('hidden');
                this.verificationStep.classList.remove('hidden');
                this.showMessage('Verification code sent! Check your email.');
                // For demo purposes, show the code
                if (data.demoCode) {
                    this.showMessage(`Demo code: ${data.demoCode}`);
                }
            } else {
                this.showError(data.error || 'Failed to send verification code');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        } finally {
            this.sendCodeBtn.disabled = false;
            this.sendCodeBtn.textContent = 'Send Verification Code';
        }
    }

    async verifyCode() {
        const email = this.sentToEmail.textContent;
        const code = this.codeInput.value.trim();

        if (!code) {
            this.showError('Please enter the verification code');
            return;
        }

        this.verifyCodeBtn.disabled = true;
        this.verifyCodeBtn.textContent = 'Verifying...';

        try {
            const response = await fetch('/api/auth', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'verify-code',
                    email: email,
                    code: code
                })
            });

            const data = await response.json();
            
            if (response.ok) {
                this.user = data.user;
                this.sessionToken = data.user.sessionToken;
                this.userMinutes = data.user.remainingMinutes;
                
                localStorage.setItem('audioNote_sessionToken', this.sessionToken);
                
                this.hideAuthModal();
                this.updateUserDisplay();
                this.updateAIButtonState();
                
                if (data.user.isNewUser) {
                    this.showMessage('Welcome! You have 1 minute of free conversion time.');
                } else {
                    this.showMessage('Welcome back!');
                }
            } else {
                this.showError(data.error || 'Invalid verification code');
            }
        } catch (error) {
            this.showError('Network error. Please try again.');
        } finally {
            this.verifyCodeBtn.disabled = false;
            this.verifyCodeBtn.textContent = 'Verify & Continue';
        }
    }

    logout() {
        this.user = null;
        this.sessionToken = null;
        this.userMinutes = 0;
        
        localStorage.removeItem('audioNote_sessionToken');
        
        this.showAuthButtons();
        this.updateAIButtonState();
        this.showMessage('Logged out successfully');
    }

    backToEmailStep() {
        this.emailStep.classList.remove('hidden');
        this.verificationStep.classList.add('hidden');
    }

    resendCode() {
        this.sendVerificationCode();
    }
    
    toggleUserDropdown() {
        this.userDropdown.classList.toggle('hidden');
    }
    
    hideUserDropdown() {
        this.userDropdown.classList.add('hidden');
    }

    // AI Enhancement is now automatic - no button needed
    updateAIButtonState() {
        // Method kept for compatibility but no longer needed
    }

    showTimePanel() {
        this.timePanel.classList.remove('hidden');
        this.updateTimeDisplay();
    }

    hideTimePanel() {
        this.timePanel.classList.add('hidden');
    }

    async purchaseTime(minutes, price) {
        if (!this.user) {
            this.showError('Please sign in first');
            return;
        }

        try {
            this.showMessage('Opening checkout...');
            
            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionToken: this.sessionToken,
                    minutes: minutes,
                    amount: price
                })
            });

            const data = await response.json();
            
            if (response.ok) {
                if (data.demo) {
                    // Demo mode - simulate successful payment
                    if (confirm(`Demo: Purchase ${minutes} minutes for $${price}?`)) {
                        this.userMinutes += minutes;
                        this.updateTimeDisplay();
                        this.updateAIButtonState();
                        this.hideTimePanel();
                        this.showMessage(`Successfully added ${minutes} minutes!`);
                    }
                } else {
                    // Real Stripe checkout
                    window.location.href = data.url;
                }
            } else {
                this.showError(data.error || 'Failed to create checkout session');
            }
        } catch (error) {
            this.showError('Failed to process purchase: ' + error.message);
        }
    }

    // enhanceText method removed - now handled automatically in enhanceTranscriptAutomatically

    setAIStatus(type, message) {
        this.aiStatus.className = `ai-status ${type}`;
        this.aiStatus.textContent = message;
        
        if (message) {
            this.aiStatus.classList.remove('hidden');
        } else {
            this.aiStatus.classList.add('hidden');
        }
    }
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AudioNote();
});