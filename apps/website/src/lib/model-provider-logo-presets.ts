import type { ModelProviderConfig } from './model-provider-config.ts';

const alibabaCloudLogo = { light: 'https://thesvg.org/icons/alibabacloud/default.svg' };
const anthropicLogo = {
    dark: 'https://svgl.app/library/anthropic_white.svg',
    light: 'https://svgl.app/library/anthropic_black.svg',
};
const geminiLogo = { light: 'https://svgl.app/library/gemini.svg' };
const githubCopilotLogo = {
    dark: 'https://svgl.app/library/copilot_dark.svg',
    light: 'https://svgl.app/library/copilot.svg',
};
const ollamaLogo = {
    dark: 'https://svgl.app/library/ollama_dark.svg',
    light: 'https://svgl.app/library/ollama_light.svg',
};
export const openAiLogo = {
    dark: 'https://svgl.app/library/openai_dark.svg',
    light: 'https://svgl.app/library/openai.svg',
};
export const openRouterLogo = {
    dark: 'https://svgl.app/library/openrouter_dark.svg',
    light: 'https://svgl.app/library/openrouter_light.svg',
};
const openCodeLogo = {
    dark: 'https://svgl.app/library/opencode-dark.svg',
    light: 'https://svgl.app/library/opencode.svg',
};
const qwenLogo = {
    dark: 'https://svgl.app/library/qwen_dark.svg',
    light: 'https://svgl.app/library/qwen_light.svg',
};
const xaiLogo = {
    dark: 'https://svgl.app/library/xai_dark.svg',
    light: 'https://svgl.app/library/xai_light.svg',
};

export const anthropicProviderLogo = anthropicLogo;

export const logoModelProviderPresets = [
    ['alibaba', 'Qwen Cloud', '#FF6A00', alibabaCloudLogo],
    ['alibaba-coding-plan', 'Alibaba Cloud (Coding Plan)', '#FF6A00', alibabaCloudLogo],
    ['anthropic-oauth', 'Anthropic OAuth', '#D97757', anthropicLogo],
    ['arcee', 'Arcee AI', '#008C8C', { light: 'https://thesvg.org/icons/arcee/default.svg' }],
    ['azure-foundry', 'Azure Foundry', '#0078D4', { light: 'https://svgl.app/library/azure.svg' }],
    [
        'bedrock',
        'AWS Bedrock',
        '#01A88D',
        { light: 'https://thesvg.org/icons/aws-amazon-bedrock/default.svg' },
    ],
    ['claude', 'Claude', '#D97757', anthropicLogo],
    ['claude-code', 'Claude Code', '#D97757', anthropicLogo],
    ['claude-code-oauth', 'Claude Code OAuth', '#D97757', anthropicLogo],
    ['deepseek', 'DeepSeek', '#4D6BFE', { light: 'https://svgl.app/library/deepseek.svg' }],
    ['gemini', 'Google AI Studio', '#8E75B2', geminiLogo],
    ['github-copilot', 'GitHub Copilot', '#2F81F7', githubCopilotLogo],
    ['google-gemini-cli', 'Google Gemini (OAuth)', '#8E75B2', geminiLogo],
    ['google', 'Google', '#4285F4', { light: 'https://svgl.app/library/google.svg' }],
    [
        'google-cloud',
        'Google Cloud',
        '#4285F4',
        { light: 'https://svgl.app/library/google-cloud.svg' },
    ],
    ['groq', 'Groq', '#F55036', { light: 'https://svgl.app/library/groq.svg' }],
    [
        'huggingface',
        'Hugging Face',
        '#FFD21E',
        { light: 'https://svgl.app/library/hugging_face.svg' },
    ],
    [
        'kilocode',
        'Kilo Code',
        '#000000',
        {
            dark: 'https://svgl.app/library/kilocode-dark.svg',
            light: 'https://svgl.app/library/kilocode-light.svg',
        },
    ],
    [
        'kimi-coding',
        'Kimi / Kimi Coding Plan',
        '#111827',
        { light: 'https://svgl.app/library/kimi-icon.svg' },
    ],
    [
        'kimi-coding-cn',
        'Kimi / Moonshot (China)',
        '#111827',
        { light: 'https://svgl.app/library/kimi-icon.svg' },
    ],
    [
        'lmstudio',
        'LM Studio',
        '#111827',
        { light: 'https://thesvg.org/icons/lm-studio/default.svg' },
    ],
    ['minimax', 'MiniMax', '#111827', { light: 'https://thesvg.org/icons/minimax/default.svg' }],
    [
        'minimax-cn',
        'MiniMax (China)',
        '#111827',
        { light: 'https://thesvg.org/icons/minimax/default.svg' },
    ],
    [
        'minimax-oauth',
        'MiniMax (OAuth)',
        '#111827',
        { light: 'https://thesvg.org/icons/minimax/default.svg' },
    ],
    ['mistral', 'Mistral AI', '#FF7000', { light: 'https://svgl.app/library/mistral-ai_logo.svg' }],
    ['novita', 'NovitaAI', '#7C3AED', { light: 'https://thesvg.org/icons/novita/default.svg' }],
    ['nvidia', 'NVIDIA NIM', '#76B900', { light: 'https://thesvg.org/icons/nvidia/default.svg' }],
    ['ollama', 'Ollama', '#111827', ollamaLogo],
    ['ollama-cloud', 'Ollama Cloud', '#111827', ollamaLogo],
    ['opencode-go', 'OpenCode Go', '#111827', openCodeLogo],
    ['opencode-zen', 'OpenCode Zen', '#111827', openCodeLogo],
    [
        'perplexity',
        'Perplexity AI',
        '#1FB8CD',
        { light: 'https://svgl.app/library/perplexity.svg' },
    ],
    ['qwen', 'Qwen', '#615CED', qwenLogo],
    ['qwen-oauth', 'Qwen OAuth (Portal)', '#615CED', qwenLogo],
    [
        'replicate',
        'Replicate',
        '#111827',
        { light: 'https://svgl.app/library/replicate_light.svg' },
    ],
    [
        'stepfun',
        'StepFun Step Plan',
        '#111827',
        { light: 'https://thesvg.org/icons/stepfun/default.svg' },
    ],
    [
        'tencent-tokenhub',
        'Tencent TokenHub',
        '#0052D9',
        { light: 'https://thesvg.org/icons/tencent/default.svg' },
    ],
    [
        'together-ai',
        'Together AI',
        '#111827',
        { light: 'https://svgl.app/library/togetherai_light.svg' },
    ],
    [
        'xiaomi',
        'Xiaomi MiMo',
        '#FF6900',
        { light: 'https://thesvg.org/icons/xiaomi-mimo/default.svg' },
    ],
    ['xai', 'xAI', '#111827', xaiLogo],
    ['xai-oauth', 'xAI Grok OAuth', '#111827', xaiLogo],
    ['zai', 'Z.AI / GLM', '#111827', { light: 'https://thesvg.org/icons/zdotai/default.svg' }],
] as const satisfies readonly [
    configName: string,
    displayName: string,
    color: string,
    logo: NonNullable<ModelProviderConfig['logo']>,
][];
