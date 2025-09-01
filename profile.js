class ProfileManager {
    constructor() {
        this.user = null;
        this.sessionToken = null;
        this.initializeElements();
        this.bindEvents();
        this.loadUserData();
    }

    initializeElements() {
        // Tab elements
        this.accountTab = document.getElementById('accountTab');
        this.billingTab = document.getElementById('billingTab');
        this.transcriptsTab = document.getElementById('transcriptsTab');
        this.accountTabContent = document.getElementById('accountTabContent');
        this.billingTabContent = document.getElementById('billingTabContent');
        this.transcriptsTabContent = document.getElementById('transcriptsTabContent');
        
        // Profile info elements
        this.profileEmail = document.getElementById('profileEmail');
        this.profileSubscription = document.getElementById('profileSubscription');
        this.profileMinutes = document.getElementById('profileMinutes');
        this.profileCreated = document.getElementById('profileCreated');
        this.profileTotalTranscripts = document.getElementById('profileTotalTranscripts');
        this.billingHistory = document.getElementById('billingHistory');
        this.transcriptHistory = document.getElementById('transcriptHistory');
        this.upgradeSection = document.getElementById('upgradeSection');
    }

    bindEvents() {
        // Tab switching
        if (this.accountTab) {
            this.accountTab.addEventListener('click', () => this.switchTab('account'));
        }
        if (this.billingTab) {
            this.billingTab.addEventListener('click', () => this.switchTab('billing'));
        }
        if (this.transcriptsTab) {
            this.transcriptsTab.addEventListener('click', () => this.switchTab('transcripts'));
        }

        // Buy button event listeners
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('buy-btn')) {
                const plan = e.target.dataset.plan;
                const price = parseFloat(e.target.dataset.price);
                if (plan) {
                    this.purchasePlan(plan, price);
                }
            }
        });
    }

    async loadUserData() {
        // Get user data from localStorage or URL params
        this.sessionToken = localStorage.getItem('sessionToken');
        const userEmail = localStorage.getItem('userEmail');
        
        console.log('Loading user data:', { userEmail, hasSessionToken: !!this.sessionToken });
        
        if (!userEmail || !this.sessionToken) {
            console.log('Missing user credentials, redirecting to login');
            this.showError('Please sign in first');
            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
            return;
        }

        this.user = { email: userEmail };
        console.log('User data loaded, calling loadProfileData...');
        await this.loadProfileData();
    }

    async loadProfileData() {
        try {
            console.log('Fetching profile data for:', this.user.email);
            
            const response = await fetch('/api/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: this.user.email,
                    sessionToken: this.sessionToken
                })
            });

            console.log('Profile API response status:', response.status);
            
            const data = await response.json();
            console.log('Profile API response data:', data);
            
            if (response.ok && data.success) {
                this.user = data.user;
                this.updateProfileDisplay();
                
                // Also load billing and transcripts data
                this.billingData = data.billingHistory;
                this.transcriptData = data.recentTranscripts;
                
                console.log('Profile data loaded successfully');
            } else {
                console.error('Profile API error:', data);
                this.showError('Failed to load profile data: ' + (data.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Failed to load profile:', error);
            this.showError('Failed to load profile data: ' + error.message);
        }
    }

    updateProfileDisplay() {
        if (!this.user) return;

        // Update account info
        this.profileEmail.textContent = this.user.email;
        
        const subscriptionType = this.user.subscriptionType || 'free';
        if (subscriptionType === 'yearly') {
            this.profileSubscription.textContent = 'Yearly Pass';
            this.upgradeSection.style.display = 'none'; // Hide upgrade options
        } else if (subscriptionType === 'two_year') {
            this.profileSubscription.textContent = '2 Year Pass';
            this.upgradeSection.style.display = 'none'; // Hide upgrade options
        } else {
            this.profileSubscription.textContent = 'Free Trial';
        }
        
        // Show unlimited for paid plans, actual time for free
        if (subscriptionType === 'yearly' || subscriptionType === 'two_year') {
            this.profileMinutes.textContent = 'Unlimited';
        } else {
            this.profileMinutes.textContent = this.formatTime(this.user.remainingMinutes || 1);
        }
        
        if (this.user.createdAt) {
            const date = new Date(this.user.createdAt);
            this.profileCreated.textContent = date.toLocaleDateString();
        } else {
            this.profileCreated.textContent = 'Today';
        }

        this.profileTotalTranscripts.textContent = this.user.totalTranscripts || 0;
    }

    switchTab(tab) {
        // Update tab buttons
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

        // Show selected tab
        if (tab === 'account') {
            this.accountTab.classList.add('active');
            this.accountTabContent.classList.add('active');
        } else if (tab === 'billing') {
            this.billingTab.classList.add('active');
            this.billingTabContent.classList.add('active');
            this.loadBillingHistory();
        } else if (tab === 'transcripts') {
            this.transcriptsTab.classList.add('active');
            this.transcriptsTabContent.classList.add('active');
            this.loadTranscriptHistory();
        }
    }

    async loadBillingHistory() {
        if (this.billingData) {
            this.displayBillingHistory(this.billingData);
        } else {
            this.billingHistory.innerHTML = '<div class="empty-state"><p>No billing history available</p></div>';
        }
    }

    async loadTranscriptHistory() {
        if (this.transcriptData && this.transcriptData.length > 0) {
            this.displayTranscriptHistory(this.transcriptData);
        } else {
            this.transcriptHistory.innerHTML = '<div class="empty-state"><p>No transcripts yet. Go back to AudioNote to create your first transcript!</p></div>';
        }
    }

    displayBillingHistory(billingItems) {
        if (!billingItems || billingItems.length === 0) {
            this.billingHistory.innerHTML = '<div class="empty-state"><p>No billing history yet</p></div>';
            return;
        }

        const itemsHTML = billingItems.map(item => `
            <div class="billing-item">
                <div class="billing-item-header">
                    <span class="billing-date">${new Date(item.date).toLocaleDateString()}</span>
                    <span class="billing-amount">$${item.amount}</span>
                </div>
                <div class="billing-description">${item.description}</div>
                <div class="billing-status">Status: ${item.status}</div>
            </div>
        `).join('');

        this.billingHistory.innerHTML = itemsHTML;
    }

    displayTranscriptHistory(transcripts) {
        if (!transcripts || transcripts.length === 0) {
            this.transcriptHistory.innerHTML = '<div class="empty-state"><p>No transcripts yet. Go back to AudioNote to create your first transcript!</p></div>';
            return;
        }

        const itemsHTML = transcripts.map(transcript => `
            <div class="transcript-item">
                <div class="transcript-item-header">
                    <span class="transcript-date">${new Date(transcript.created_at).toLocaleDateString()}</span>
                    <span class="word-count">${transcript.word_count || 0} words</span>
                </div>
                <div class="transcript-preview">${(transcript.enhanced_text || transcript.original_text || 'No preview available').substring(0, 200)}${(transcript.enhanced_text || transcript.original_text || '').length > 200 ? '...' : ''}</div>
                <div class="transcript-actions">
                    <button class="copy-transcript-btn" data-text="${(transcript.enhanced_text || transcript.original_text || '').replace(/"/g, '&quot;')}">Copy</button>
                </div>
            </div>
        `).join('');

        this.transcriptHistory.innerHTML = itemsHTML;

        // Add copy functionality
        document.querySelectorAll('.copy-transcript-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const text = e.target.dataset.text;
                try {
                    await navigator.clipboard.writeText(text);
                    this.showMessage('Transcript copied to clipboard!');
                } catch (error) {
                    this.showMessage('Failed to copy transcript');
                }
            });
        });
    }

    async purchasePlan(planId, price) {
        if (!this.user) {
            this.showError('Please sign in first');
            return;
        }

        try {
            this.showMessage('Opening checkout...');
            
            const response = await fetch('/api/subscriptions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'create-checkout',
                    sessionToken: this.sessionToken,
                    email: this.user.email,
                    planId: planId
                })
            });

            const data = await response.json();
            
            if (response.ok) {
                if (data.demo) {
                    // Demo mode - simulate successful subscription
                    if (confirm(`Demo: Subscribe to ${planId} plan for $${price}?`)) {
                        await this.handleSubscriptionSuccess(planId, price);
                    }
                } else {
                    // Real Stripe checkout
                    window.location.href = data.url;
                }
            } else {
                this.showError(data.error || 'Failed to create checkout session');
            }
        } catch (error) {
            this.showError('Failed to process subscription: ' + error.message);
        }
    }

    async handleSubscriptionSuccess(planId, amount) {
        try {
            // Reload profile data
            await this.loadProfileData();
            this.showMessage(`Successfully subscribed to ${planId} plan!`);
        } catch (error) {
            console.error('Subscription success error:', error);
            this.showError('Failed to process subscription');
        }
    }

    formatTime(minutes) {
        const mins = Math.floor(minutes);
        const secs = Math.floor((minutes - mins) * 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    showMessage(message) {
        // Simple message display
        const messageDiv = document.createElement('div');
        messageDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #4CAF50;
            color: white;
            padding: 1rem;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        messageDiv.textContent = message;
        document.body.appendChild(messageDiv);
        setTimeout(() => {
            document.body.removeChild(messageDiv);
        }, 3000);
    }

    showError(message) {
        // Simple error display
        const errorDiv = document.createElement('div');
        errorDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #f44336;
            color: white;
            padding: 1rem;
            border-radius: 8px;
            z-index: 10000;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;
        errorDiv.textContent = message;
        document.body.appendChild(errorDiv);
        setTimeout(() => {
            document.body.removeChild(errorDiv);
        }, 5000);
    }
}

// Initialize the profile manager when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ProfileManager();
});