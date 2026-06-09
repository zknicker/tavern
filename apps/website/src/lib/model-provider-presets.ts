import { Atom02Icon, ChatGptIcon, Globe02Icon } from '@hugeicons-pro/core-stroke-rounded';
import type { ModelProviderConfig } from './model-provider-config.ts';

export const configuredModelProviders = [
    {
        accessDisplayName: 'Codex',
        accessId: 'codex',
        color: '#3B82F6',
        configName: 'openai-codex',
        displayName: 'OpenAI Codex',
        icon: ChatGptIcon,
        logo: {
            dark: 'https://svgl.app/library/openai_dark.svg',
            light: 'https://svgl.app/library/openai.svg',
        },
    },
    {
        accessDisplayName: 'OpenAI API',
        accessId: 'openai',
        color: '#10A37F',
        configName: 'openai-api',
        displayName: 'OpenAI',
        icon: ChatGptIcon,
        logo: {
            dark: 'https://svgl.app/library/openai_dark.svg',
            light: 'https://svgl.app/library/openai.svg',
        },
    },
    {
        accessDisplayName: 'Anthropic',
        accessId: null,
        color: '#D97757',
        configName: 'anthropic',
        displayName: 'Anthropic',
        icon: Atom02Icon,
        logo: {
            dark: 'https://svgl.app/library/anthropic_white.svg',
            light: 'https://svgl.app/library/anthropic_black.svg',
        },
    },
    {
        accessDisplayName: 'OpenRouter',
        accessId: 'openrouter',
        color: '#8B5CF6',
        configName: 'openrouter',
        displayName: 'OpenRouter',
        icon: Globe02Icon,
        logo: {
            dark: 'https://svgl.app/library/openrouter_dark.svg',
            light: 'https://svgl.app/library/openrouter_light.svg',
        },
    },
] as const satisfies readonly ModelProviderConfig[];

export const logoModelProviderPresets = [
    ['azure-foundry', 'Azure Foundry', '#0078D4', { light: 'https://svgl.app/library/azure.svg' }],
    ['deepseek', 'DeepSeek', '#4D6BFE', { light: 'https://svgl.app/library/deepseek.svg' }],
    ['gemini', 'Gemini', '#8E75B2', { light: 'https://svgl.app/library/gemini.svg' }],
    [
        'github-copilot',
        'GitHub Copilot',
        '#2F81F7',
        {
            dark: 'https://svgl.app/library/copilot_dark.svg',
            light: 'https://svgl.app/library/copilot.svg',
        },
    ],
    ['google', 'Google', '#4285F4', { light: 'https://svgl.app/library/google.svg' }],
    [
        'google-cloud',
        'Google Cloud',
        '#4285F4',
        { light: 'https://svgl.app/library/google-cloud.svg' },
    ],
    ['groq', 'Groq', '#F55036', { light: 'https://svgl.app/library/groq.svg' }],
    ['mistral', 'Mistral AI', '#FF7000', { light: 'https://svgl.app/library/mistral-ai_logo.svg' }],
    [
        'ollama',
        'Ollama',
        '#111827',
        {
            dark: 'https://svgl.app/library/ollama_dark.svg',
            light: 'https://svgl.app/library/ollama_light.svg',
        },
    ],
    [
        'qwen',
        'Qwen',
        '#615CED',
        {
            dark: 'https://svgl.app/library/qwen_dark.svg',
            light: 'https://svgl.app/library/qwen_light.svg',
        },
    ],
    [
        'xai',
        'xAI',
        '#111827',
        {
            dark: 'https://svgl.app/library/xai_dark.svg',
            light: 'https://svgl.app/library/xai_light.svg',
        },
    ],
] as const satisfies readonly [
    configName: string,
    displayName: string,
    color: string,
    logo: NonNullable<ModelProviderConfig['logo']>,
][];

export const providerConfigAliasIds = [
    {
        aliases: ['github-copilot', 'github-copilot-acp', 'copilot'],
        providerId: 'github-copilot',
    },
    {
        aliases: ['openai', 'openai-api', 'openai-codex'],
        providerId: 'openai-api',
    },
    {
        aliases: ['qwen', 'qwen-oauth', 'qwen-oauth-portal'],
        providerId: 'qwen',
    },
    {
        aliases: ['xai', 'xai-grok', 'xai-grok-oauth', 'grok'],
        providerId: 'xai',
    },
] as const;
