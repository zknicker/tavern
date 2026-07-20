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

// Kimi's K + sparkle mark, recolored per scheme with the square canvas
// dropped so the glyph fills the tile like sibling logos. Derived from
// svgl.app/library/kimi-icon.svg; the sparkle carries Kimi's #027aff.
export const kimiLogo = {
    dark: 'data:image/svg+xml,%3Csvg%20viewBox=%2290%2090%20332%20332%22%20xmlns=%22http://www.w3.org/2000/svg%22%20fill-rule=%22evenodd%22%20clip-rule=%22evenodd%22%3E%3Cpath%20d=%22M342.065%20189.759c1.886-2.42%203.541-4.63%205.289-6.77.81-1.007.74-1.771-.046-2.824-7.58-9.965-8.298-21.028-3.935-32.254%203.275-8.448%2010.52-12.406%2019.373-13.25%205.52-.521%2010.936.046%2015.959%202.73%206.596%203.53%2010.438%208.912%2011.688%2016.341.995%205.926.81%2011.712-.868%2017.452-2.974%2010.161-10.277%2015.427-20.287%2016.758-8.31%201.11-16.734%201.25-25.113%201.817-.648.046-1.308%200-2.06%200z%22%20fill=%22%23027aff%22/%3E%3Cpath%20d=%22M321.512%20144.254h-50.064l-39.637%2090.384h-56.036v-89.99H131v232.868h44.787v-98.103h78.973c13.598%200%2026.015-7.927%2031.744-20.252v118.355h44.787v-98.103c0-23.342-18.239-42.97-41.523-44.671v-.116h-24.593a45.577%2045.577%200%200026.884-24.534l29.453-65.838z%22%20fill=%22%23FFFFFF%22/%3E%3C/svg%3E',
    light: 'data:image/svg+xml,%3Csvg%20viewBox=%2290%2090%20332%20332%22%20xmlns=%22http://www.w3.org/2000/svg%22%20fill-rule=%22evenodd%22%20clip-rule=%22evenodd%22%3E%3Cpath%20d=%22M342.065%20189.759c1.886-2.42%203.541-4.63%205.289-6.77.81-1.007.74-1.771-.046-2.824-7.58-9.965-8.298-21.028-3.935-32.254%203.275-8.448%2010.52-12.406%2019.373-13.25%205.52-.521%2010.936.046%2015.959%202.73%206.596%203.53%2010.438%208.912%2011.688%2016.341.995%205.926.81%2011.712-.868%2017.452-2.974%2010.161-10.277%2015.427-20.287%2016.758-8.31%201.11-16.734%201.25-25.113%201.817-.648.046-1.308%200-2.06%200z%22%20fill=%22%23027aff%22/%3E%3Cpath%20d=%22M321.512%20144.254h-50.064l-39.637%2090.384h-56.036v-89.99H131v232.868h44.787v-98.103h78.973c13.598%200%2026.015-7.927%2031.744-20.252v118.355h44.787v-98.103c0-23.342-18.239-42.97-41.523-44.671v-.116h-24.593a45.577%2045.577%200%200026.884-24.534l29.453-65.838z%22%20fill=%22%2316191E%22/%3E%3C/svg%3E',
};

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
    ['kimi-coding', 'Kimi / Kimi Coding Plan', '#027AFF', kimiLogo],
    ['kimi-coding-cn', 'Kimi / Moonshot (China)', '#027AFF', kimiLogo],
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
