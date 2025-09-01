// Subscription plans with OpenAI billing integration
export const SUBSCRIPTION_PLANS = {
    free: {
        name: 'Free Trial',
        minutes: 1,
        price: 0,
        features: ['1 minute transcription', 'Basic AI enhancement', 'Try before you buy']
    },
    yearly: {
        name: 'Yearly Pass',
        minutes: 9999, // Unlimited
        price: 99,
        period: 'year',
        popular: true,
        features: ['Unlimited transcription', 'AI-powered enhancement', 'All saved notes', '30-day money back guarantee']
    },
    two_year: {
        name: '2 Year Pass',
        minutes: 9999, // Unlimited
        price: 159,
        period: '2years',
        savings: 20, // Save $39 vs 2 yearly passes
        features: ['Unlimited transcription', 'AI-powered enhancement', 'All saved notes', '30-day money back guarantee', 'Best value']
    }
};

// OpenAI pricing calculations (as of 2024)
export const OPENAI_COSTS = {
    whisper: 0.006, // $0.006 per minute for Whisper API
    gpt4_input: 0.03 / 1000, // $0.03 per 1K input tokens
    gpt4_output: 0.06 / 1000, // $0.06 per 1K output tokens
    estimated_tokens_per_minute: 150 // Estimated tokens for 1 minute of speech
};

export function calculateOpenAICost(minutes) {
    const whisperCost = minutes * OPENAI_COSTS.whisper;
    const tokens = minutes * OPENAI_COSTS.estimated_tokens_per_minute;
    const gptCost = (tokens * OPENAI_COSTS.gpt4_input) + (tokens * OPENAI_COSTS.gpt4_output);
    
    return {
        whisper: whisperCost,
        gpt: gptCost,
        total: whisperCost + gptCost,
        tokens
    };
}

export function getPlanPricing() {
    return Object.entries(SUBSCRIPTION_PLANS).map(([key, plan]) => {
        const costs = calculateOpenAICost(plan.minutes);
        return {
            id: key,
            ...plan,
            openaiCost: costs.total,
            margin: plan.price - costs.total,
            marginPercent: plan.price > 0 ? ((plan.price - costs.total) / plan.price * 100).toFixed(1) : 0
        };
    });
}

export function getRecommendedPlan(estimatedMinutesPerMonth) {
    if (estimatedMinutesPerMonth <= 1) return 'free';
    if (estimatedMinutesPerMonth <= 60) return 'monthly_basic';
    if (estimatedMinutesPerMonth <= 300) return 'monthly_pro';
    return 'monthly_unlimited';
}