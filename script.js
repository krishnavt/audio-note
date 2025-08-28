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

        console.log('Initializing AudioNote...');
        this.checkBrowserSupport();
        this.initializeElements();
        this.initializeSpeechRecognition();
        this.bindEvents();
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
        this.recordText = this.recordBtn.querySelector('.record-text');
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
            };

            this.recognition.onresult = (event) => {
                let interimTranscript = '';
                
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const transcript = event.results[i][0].transcript;
                    if (event.results[i].isFinal) {
                        console.log('Final transcript:', transcript);
                        this.finalTranscript += transcript + ' ';
                    } else {
                        interimTranscript += transcript;
                    }
                }

                this.updateTranscript(interimTranscript);
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
        
        // Reset transcript state
        this.finalTranscript = '';
        this.lastInterimTranscript = '';
        
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
            this.recordText.textContent = 'Recording...';
            this.recordingStatus.classList.add('active');

            this.startTimer();
            
            // Start speech recognition
            if (this.recognition) {
                console.log('Starting speech recognition...');
                try {
                    this.recognition.start();
                } catch (speechError) {
                    console.error('Speech recognition start error:', speechError);
                    this.showError('Speech recognition failed to start: ' + speechError.message);
                }
            } else {
                console.warn('No speech recognition available');
                this.showError('Speech recognition not available in this browser');
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
            // You could save or process the audio blob here if needed
            console.log('Audio recorded:', audioBlob);
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
        this.recordText.textContent = 'Click to record';
        this.recordingStatus.classList.remove('active');
        
        this.stopTimer();
        this.audioLevel.style.width = '0%';
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
}

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new AudioNote();
});