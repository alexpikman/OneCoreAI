import type {
  AgentMemoryDoc,
  AgentSkill,
  ExecutionEnvConfig,
  FreeProviderProfile,
  GatewayChannelConfig,
  SubagentConfig,
} from '../types/onecore';

export const INITIAL_FREE_PROVIDERS: FreeProviderProfile[] = [
  {
    id: 'prov-deepseek-api',
    kind: 'deepseek-api',
    name: 'DeepSeek API',
    badgeText: 'РћР±Р»Р°РєРѕ В· API-РєР»СЋС‡',
    baseUrl: 'https://api.deepseek.com/v1',
    apiKey: '',
    requiresKey: true,
    isLocal: false,
    selectedModel: 'deepseek-chat',
    availableModels: ['deepseek-chat', 'deepseek-reasoner'],
    description:
      'РћС„РёС†РёР°Р»СЊРЅС‹Р№ РѕР±Р»Р°С‡РЅС‹Р№ API DeepSeek. РўСЂРµР±СѓРµС‚СЃСЏ РєР»СЋС‡ РїСЂРѕРІР°Р№РґРµСЂР°; РјРѕРґРµР»СЊ СЂР°Р±РѕС‚Р°РµС‚ СѓРґР°Р»С‘РЅРЅРѕ Рё РЅРµ СЃРєР°С‡РёРІР°РµС‚СЃСЏ РЅР° РєРѕРјРїСЊСЋС‚РµСЂ.',
    status: 'idle',
  },
  {
    id: 'prov-qwen-api',
    kind: 'qwen-api',
    name: 'Qwen API (DashScope)',
    badgeText: 'РћР±Р»Р°РєРѕ В· API-РєР»СЋС‡',
    baseUrl: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
    apiKey: '',
    requiresKey: true,
    isLocal: false,
    selectedModel: 'qwen-plus',
    availableModels: ['qwen-plus', 'qwen-turbo', 'qwen-max'],
    description:
      'РћС„РёС†РёР°Р»СЊРЅС‹Р№ OpenAI-compatible API Qwen С‡РµСЂРµР· DashScope. РўСЂРµР±СѓРµС‚СЃСЏ РєР»СЋС‡ РїСЂРѕРІР°Р№РґРµСЂР°; РјРѕРґРµР»Рё РґРѕСЃС‚СѓРїРЅС‹ РІ РѕР±Р»Р°РєРµ Р±РµР· Р»РѕРєР°Р»СЊРЅРѕР№ Р·Р°РіСЂСѓР·РєРё.',
    status: 'idle',
  },
  {
    id: 'prov-openai-api',
    kind: 'openai-api',
    name: 'OpenAI API',
    badgeText: 'РћР±Р»Р°РєРѕ В· API-РєР»СЋС‡',
    baseUrl: 'https://api.openai.com/v1',
    apiKey: '',
    requiresKey: true,
    isLocal: false,
    selectedModel: 'gpt-4o-mini',
    availableModels: ['gpt-4o-mini', 'gpt-4o'],
    description:
      'РћС„РёС†РёР°Р»СЊРЅС‹Р№ РѕР±Р»Р°С‡РЅС‹Р№ API OpenAI. РўСЂРµР±СѓРµС‚СЃСЏ РєР»СЋС‡ РїСЂРѕРІР°Р№РґРµСЂР° Рё РјРѕР¶РµС‚ РІР·РёРјР°С‚СЊСЃСЏ РїР»Р°С‚Р° РїРѕ РµРіРѕ С‚Р°СЂРёС„Р°Рј.',
    status: 'idle',
  },
  {
    id: 'prov-llama-cpp',
    kind: 'llama-cpp',
    name: 'Р›РѕРєР°Р»СЊРЅС‹Р№ llama-server.exe',
    badgeText: '100% Р»РѕРєР°Р»СЊРЅРѕ В· Р‘РµР· Р»РёРјРёС‚РѕРІ',
    baseUrl: 'http://127.0.0.1:8080/v1',
    apiKey: '',
    requiresKey: false,
    isLocal: true,
    selectedModel: 'Qwen2.5-Coder-7B-Instruct-Q4_K_M',
    availableModels: [
      'Qwen2.5-Coder-7B-Instruct-Q4_K_M',
      'DeepSeek-R1-Distill-Qwen-7B-Q4_K_M',
      'Phi-4-mini-instruct-Q5_K_M',
    ],
    description:
      'Р’СЃС‚СЂРѕРµРЅРЅС‹Р№ sidecar llama.cpp РЅР° РІР°С€РµРј РџРљ. РџРѕР»РЅРѕСЃС‚СЊСЋ Р±РµСЃРїР»Р°С‚РЅС‹Р№ РѕС„Р»Р°Р№РЅ-РёРЅС„РµСЂРµРЅСЃ РЅР° CUDA, Vulkan РёР»Рё CPU Р±РµР· РѕС‚РїСЂР°РІРєРё РєРѕРґР°.',
    status: 'connected',
    lastCheckMessage: 'Sidecar РіРѕС‚РѕРІ Рє Р·Р°РїСѓСЃРєСѓ РЅР° 127.0.0.1:8080',
  },
  {
    id: 'prov-openrouter-free',
    kind: 'openrouter-free',
    name: 'OpenRouter (С‚РѕР»СЊРєРѕ :free РјРѕРґРµР»Рё)',
    badgeText: '$0.00 В· Р‘РµР· СЃРїРёСЃР°РЅРёР№',
    baseUrl: 'https://openrouter.ai/api/v1',
    apiKey: '',
    requiresKey: true,
    isLocal: false,
    selectedModel: 'qwen/qwen-2.5-coder-32b-instruct:free',
    availableModels: [
      'qwen/qwen-2.5-coder-32b-instruct:free',
      'deepseek/deepseek-chat-v3-0324:free',
      'meta-llama/llama-3.3-70b-instruct:free',
      'google/gemma-3-27b-it:free',
      'mistralai/mistral-small-3.1-24b-instruct:free',
    ],
    description:
      'РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРёР№ С„РёР»СЊС‚СЂ СЃС‚СЂРѕРіРѕ РїРѕ Р±РµСЃРїР»Р°С‚РЅС‹Рј РјРѕРґРµР»СЏРј (:free). РџРѕРґРґРµСЂР¶РёРІР°РµС‚ РєСЂСѓРїРЅС‹Рµ РѕР±Р»Р°С‡РЅС‹Рµ РјРѕРґРµР»Рё 32BвЂ“70B СЃ РЅСѓР»РµРІРѕР№ СЃС‚РѕРёРјРѕСЃС‚СЊСЋ С‚РѕРєРµРЅР°.',
    status: 'idle',
    lastCheckMessage: 'РќР°Р¶РјРёС‚Рµ В«Р—Р°РіСЂСѓР·РёС‚СЊ :free РјРѕРґРµР»РёВ» РґР»СЏ Р¶РёРІРѕРіРѕ СЃРїРёСЃРєР°',
  },
  {
    id: 'prov-ollama',
    kind: 'ollama',
    name: 'Ollama (Р»РѕРєР°Р»СЊРЅС‹Р№ СЃРµСЂРІРµСЂ)',
    badgeText: 'Р›РѕРєР°Р»СЊРЅРѕ В· OpenAI API',
    baseUrl: 'http://127.0.0.1:11434/v1',
    apiKey: '',
    requiresKey: false,
    isLocal: true,
    selectedModel: 'qwen2.5-coder:7b',
    availableModels: ['qwen2.5-coder:7b', 'deepseek-r1:8b', 'llama3.2:latest'],
    description:
      'РџСЂСЏРјРѕРµ РїРѕРґРєР»СЋС‡РµРЅРёРµ Рє Р»РѕРєР°Р»СЊРЅРѕРјСѓ РґРµРјРѕРЅСѓ Ollama Р±РµР· РѕРіСЂР°РЅРёС‡РµРЅРёР№ РєРѕРЅС‚РµРєСЃС‚Р° РёР»Рё С‚РѕРєРµРЅРѕРІ.',
    status: 'idle',
  },
  {
    id: 'prov-lmstudio',
    kind: 'lmstudio',
    name: 'LM Studio (Р»РѕРєР°Р»СЊРЅС‹Р№ СЃРµСЂРІРµСЂ)',
    badgeText: 'Р›РѕРєР°Р»СЊРЅРѕ В· Port 1234',
    baseUrl: 'http://127.0.0.1:1234/v1',
    apiKey: '',
    requiresKey: false,
    isLocal: true,
    selectedModel: 'qwen2.5-coder-7b-instruct',
    availableModels: ['qwen2.5-coder-7b-instruct', 'codestral-22b-v0.1'],
    description:
      'Р›РѕРєР°Р»СЊРЅС‹Р№ OpenAI-compatible СЃРµСЂРІРµСЂ LM Studio РЅР° РїРѕСЂС‚Сѓ 1234.',
    status: 'idle',
  },
  {
    id: 'prov-groq-free',
    kind: 'groq-free',
    name: 'Groq Free Tier',
    badgeText: 'Р‘РµСЃРїР»Р°С‚РЅС‹Р№ LPU-РєР»Р°СЃС‚РµСЂ',
    baseUrl: 'https://api.groq.com/openai/v1',
    apiKey: '',
    requiresKey: true,
    isLocal: false,
    selectedModel: 'llama-3.3-70b-versatile',
    availableModels: ['llama-3.3-70b-versatile', 'qwen-qwq-32b', 'gemma2-9b-it'],
    description:
      'Р’С‹СЃРѕРєРѕСЃРєРѕСЂРѕСЃС‚РЅРѕР№ Р±РµСЃРїР»Р°С‚РЅС‹Р№ С‚Р°СЂРёС„ Groq СЃ Р±РµСЃРїР»Р°С‚РЅС‹Рј API-РєР»СЋС‡РѕРј РёР· console.groq.com.',
    status: 'idle',
  },
  {
    id: 'prov-custom',
    kind: 'custom',
    name: 'РЎРІРѕР№ OpenAI-compatible СЃРµСЂРІРµСЂ',
    badgeText: 'Р›СЋР±РѕР№ URL / vLLM / LocalAI',
    baseUrl: 'http://127.0.0.1:8000/v1',
    apiKey: '',
    requiresKey: true,
    isLocal: true,
    selectedModel: 'custom-model',
    availableModels: ['custom-model'],
    description:
      'РџРѕРґРєР»СЋС‡РµРЅРёРµ Рє Р»СЋР±РѕРјСѓ OpenAI-compatible СЃРµСЂРІРµСЂСѓ (vLLM, TabbyAPI, LocalAI, VPS). API-РєР»СЋС‡ РјРѕР¶РЅРѕ СѓРєР°Р·Р°С‚СЊ, РµСЃР»Рё РѕРЅ С‚СЂРµР±СѓРµС‚СЃСЏ.',
    status: 'idle',
  },
];

export const INITIAL_SKILLS: AgentSkill[] = [
  {
    id: 'skill-http-range-gguf',
    slug: 'gguf-http-range-resume',
    title: 'Р”РѕРєР°С‡РєР° GGUF РїРѕ HTTP 206 + SHA256',
    category: 'Р Р°Р·СЂР°Р±РѕС‚РєР°',
    triggerHint: 'РџСЂРё СЂР°Р±РѕС‚Рµ СЃ Р·Р°РіСЂСѓР·РєРѕР№ РІРµСЃРѕРІ, .part С„Р°Р№Р»Р°РјРё РёР»Рё LFS-С…СЌС€Р°РјРё',
    contentMarkdown: `---
name: gguf-http-range-resume
description: РќР°РґС‘Р¶РЅР°СЏ РґРѕРєР°С‡РєР° Р±РѕР»СЊС€РёС… GGUF-С„Р°Р№Р»РѕРІ С‡РµСЂРµР· reqwest Р±РµР· РїР°РґРµРЅРёСЏ РЅР° СЂР°Р·СЂС‹РІРµ СЃРµС‚Рё
---
1. РџСЂРѕРІРµСЂСЏС‚СЊ СЂР°Р·РјРµСЂ СЃСѓС‰РµСЃС‚РІСѓСЋС‰РµРіРѕ \`.part\` С„Р°Р№Р»Р° Рё РѕС‚РїСЂР°РІР»СЏС‚СЊ Р·Р°РіРѕР»РѕРІРѕРє \`Range: bytes=<offset>-\`.
2. РћР±СЂР°Р±Р°С‚С‹РІР°С‚СЊ HTTP 206 Partial Content Рё HTTP 200 (РµСЃР»Рё СЃРµСЂРІРµСЂ СЃР±СЂРѕСЃРёР» СЃРјРµС‰РµРЅРёРµ вЂ” РїРµСЂРµР·Р°РїРёСЃР°С‚СЊ С„Р°Р№Р» СЃ РЅСѓР»СЏ).
3. РџРѕСЃР»Рµ Р·Р°РІРµСЂС€РµРЅРёСЏ РїРѕС‚РѕРєР° РІС‹С‡РёСЃР»СЏС‚СЊ SHA256 С‡РµСЂРµР· РїРѕС‚РѕРєРѕРІС‹Р№ С…РµС€РµСЂ РїРµСЂРµРґ РїРµСЂРµРёРјРµРЅРѕРІР°РЅРёРµРј \`.part\` -> \`.gguf\`.`,
    enabled: true,
    usageCount: 14,
    source: 'builtin',
    updatedAt: 'РЎРµРіРѕРґРЅСЏ',
  },
  {
    id: 'skill-windows-gpu-probe',
    slug: 'windows-gpu-probe-no-freeze',
    title: 'РќРµР±Р»РѕРєРёСЂСѓСЋС‰РёР№ Р°РІС‚Рѕ-РґРµС‚РµРєС‚ GPU (CUDA / Vulkan)',
    category: 'DevOps',
    triggerHint: 'РџСЂРё Р·Р°РїСѓСЃРєРµ llama-server.exe РёР»Рё РґРёР°РіРЅРѕСЃС‚РёРєРµ VRAM РЅР° Windows',
    contentMarkdown: `---
name: windows-gpu-probe-no-freeze
description: Р‘РµР·РѕРїР°СЃРЅС‹Р№ РІС‹Р±РѕСЂ Р±СЌРєРµРЅРґР° GPU Р±РµР· Р·Р°РІРёСЃР°РЅРёСЏ UI WebView2
---
1. Р—Р°РїСѓСЃРєР°С‚СЊ \`nvidia-smi\` С‚РѕР»СЊРєРѕ РІРЅСѓС‚СЂРё \`tokio::task::spawn_blocking\` СЃ С„Р»Р°РіРѕРј \`CREATE_NO_WINDOW\`.
2. РџСЂРё РѕС‚СЃСѓС‚СЃС‚РІРёРё NVIDIA Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РїРµСЂРµРєР»СЋС‡Р°С‚СЊСЃСЏ РЅР° \`--gpu-layers\` С‡РµСЂРµР· Vulkan 1.3 РёР»Рё CPU AVX2.`,
    enabled: true,
    usageCount: 9,
    source: 'learned',
    updatedAt: 'Р’С‡РµСЂР°',
  },
  {
    id: 'skill-tauri-cloud-ci',
    slug: 'tauri-windows-cloud-release',
    title: 'РћР±Р»Р°С‡РЅР°СЏ СЃР±РѕСЂРєР° Tauri 2.0 Р±РµР· Р»РѕРєР°Р»СЊРЅРѕРіРѕ MSVC',
    category: 'DevOps',
    triggerHint: 'РџСЂРё РѕС€РёР±РєРµ MSVC 8012 РёР»Рё РѕР±РЅРѕРІР»РµРЅРёРё GitHub Actions',
    contentMarkdown: `---
name: tauri-windows-cloud-release
description: РЎР±РѕСЂРєР° .exe Рё .msi РІ GitHub Actions Рё СѓСЃС‚Р°РЅРѕРІРєР° РЅР° Windows Р±РµР· Build Tools
---
1. РСЃРїРѕР»СЊР·РѕРІР°С‚СЊ \`npm install --legacy-peer-deps\` РЅР° \`windows-latest\` Р±РµР· РѕР±СЏР·Р°С‚РµР»СЊРЅРѕРіРѕ \`package-lock.json\`.
2. РЎРєР°С‡РёРІР°С‚СЊ sidecar \`llama-server.exe\` Рё РїСѓР±Р»РёРєРѕРІР°С‚СЊ Р°СЂС‚РµС„Р°РєС‚С‹ С‡РµСЂРµР· \`tauri-apps/tauri-action\`.`,
    enabled: true,
    usageCount: 6,
    source: 'learned',
    updatedAt: 'Р’С‡РµСЂР°',
  },
  {
    id: 'skill-sqlite-checkpoint',
    slug: 'atomic-sqlite-checkpoint',
    title: 'РђС‚РѕРјР°СЂРЅС‹Рµ Checkpoints РїРµСЂРµРґ РїСЂР°РІРєРѕР№ С„Р°Р№Р»РѕРІ',
    category: 'РђРІС‚РѕРјР°С‚РёР·Р°С†РёСЏ',
    triggerHint: 'РџРµСЂРµРґ Р»СЋР±С‹Рј replace_in_file РёР»Рё Р·Р°РїРёСЃСЊСЋ РІ СЂРµР¶РёРјРµ Act',
    contentMarkdown: `---
name: atomic-sqlite-checkpoint
description: РЎРЅР°РїС€РѕС‚ РёСЃС…РѕРґРЅРёРєРѕРІ РґРѕ РїСЂРёРјРµРЅРµРЅРёСЏ РґРёС„С„Р° СЃ РјРіРЅРѕРІРµРЅРЅС‹Рј РѕС‚РєР°С‚РѕРј
---
1. РЎРЅРёРјР°С‚СЊ РєРѕРїРёСЋ РІСЃРµС… РёР·РјРµРЅСЏРµРјС‹С… С„Р°Р№Р»РѕРІ РІ Р»РѕРєР°Р»СЊРЅС‹Р№ СЃРЅР°РїС€РѕС‚ РїРµСЂРµРґ РїСЂРёРјРµРЅРµРЅРёРµРј РїР°С‚С‡Р°.
2. РџРѕРјРµС‡Р°С‚СЊ СЃРѕРѕР±С‰РµРЅРёРµ РІ С‡Р°С‚Рµ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂРѕРј Checkpoint РґР»СЏ РѕС‚РєР°С‚Р° РІ 1 РєР»РёРє.`,
    enabled: true,
    usageCount: 21,
    source: 'builtin',
    updatedAt: 'РЎРµРіРѕРґРЅСЏ',
  },
];

export const INITIAL_MEMORY_DOCS: AgentMemoryDoc[] = [
  {
    key: 'soul',
    filename: 'SOUL.md',
    title: 'РҐР°СЂР°РєС‚РµСЂ Рё СЃС‚РёР»СЊ Р°РіРµРЅС‚Р°',
    description: 'Р’РґРѕС…РЅРѕРІР»РµРЅРѕ OneCore SOUL.md: РєСЂР°С‚РєРѕСЃС‚СЊ, С‚РѕС‡РЅРѕСЃС‚СЊ Рё С„РѕРєСѓСЃ РЅР° СЂР°Р±РѕС‡РµРј РєРѕРґРµ Р±РµР· РІРѕРґС‹.',
    content: `РўС‹ вЂ” Р°РІС‚РѕРЅРѕРјРЅС‹Р№ РёРЅР¶РµРЅРµСЂРЅС‹Р№ Р°РіРµРЅС‚ ONE CORE AI (Cline + OneCore).
РћС‚РІРµС‡Р°Р№ РїСЂСЏРјРѕ, РїРѕ СЃСѓС‰РµСЃС‚РІСѓ, Р±РµР· Р»РёС€РЅРёС… РІРІРѕРґРЅС‹С… С„СЂР°Р·.
РџРµСЂРµРґ РїСЂР°РІРєРѕР№ РєРѕРґР° РІ СЂРµР¶РёРјРµ Act РІСЃРµРіРґР° СЃРѕС…СЂР°РЅСЏР№ Checkpoint Рё РѕР±СЉСЏСЃРЅСЏР№ РїСЂРѕРІРµСЂСЏРµРјС‹Р№ СЂРµР·СѓР»СЊС‚Р°С‚.
РџСЂРµРґР»Р°РіР°Р№ СЃРѕС…СЂР°РЅСЏС‚СЊ СѓРґР°С‡РЅС‹Рµ СЂРµС€РµРЅРёСЏ РІ Р±РёР±Р»РёРѕС‚РµРєСѓ РЅР°РІС‹РєРѕРІ SKILL.md.`,
    updatedAt: 'РЎРµРіРѕРґРЅСЏ',
  },
  {
    key: 'memory',
    filename: 'MEMORY.md',
    title: 'РќР°РєРѕРїР»РµРЅРЅР°СЏ РїР°РјСЏС‚СЊ РїСЂРѕРµРєС‚Р°',
    description: 'РЈСЃС‚РѕР№С‡РёРІС‹Рµ С„Р°РєС‚С‹ Рѕ СЂРµРїРѕР·РёС‚РѕСЂРёРё, Р°СЂС…РёС‚РµРєС‚СѓСЂРµ Рё СЂРµС€РµРЅРёСЏС…, РґРѕСЃС‚СѓРїРЅС‹Рµ РІРѕ РІСЃРµС… СЃРµСЃСЃРёСЏС….',
    content: `- Р РµРїРѕР·РёС‚РѕСЂРёР№: alexpikman/OneCoreAI (Windows 10/11, Tauri 2.0, React 19, Vite, Express, llama.cpp).
- РќР° РџРљ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ РёР·Р±РµРіР°С‚СЊ Р»РѕРєР°Р»СЊРЅРѕР№ СѓСЃС‚Р°РЅРѕРІРєРё MSVC Build Tools (РѕС€РёР±РєР° 8012) вЂ” СЃР±РѕСЂРєР° .exe/.msi РёРґС‘С‚ С‡РµСЂРµР· GitHub Actions.
- РџСЂРµРґРїРѕС‡С‚РµРЅРёРµ: 100% Р±РµСЃРїР»Р°С‚РЅС‹Рµ РїСЂРѕРІР°Р№РґРµСЂС‹ (Р»РѕРєР°Р»СЊРЅС‹Р№ llama-server.exe, Ollama, OpenRouter :free).
- Р’ РёРЅС‚РµСЂС„РµР№СЃРµ РїРѕРґРґРµСЂР¶РёРІР°СЋС‚СЃСЏ 3 СЃС‚РёР»СЏ (Cline / VS Code, Windows 11 Mica, РўРµСЂРјРёРЅР°Р» Obsidian).`,
    updatedAt: 'РЎРµРіРѕРґРЅСЏ',
  },
  {
    key: 'user',
    filename: 'USER.md',
    title: 'РџСЂРѕС„РёР»СЊ Рё РїСЂРµРґРїРѕС‡С‚РµРЅРёСЏ РїРѕР»СЊР·РѕРІР°С‚РµР»СЏ',
    description: 'РЎС‚РµРє, СЏР·С‹Рє РѕР±С‰РµРЅРёСЏ, РїСЂРёРІС‹С‡РЅС‹Рµ РёРЅСЃС‚СЂСѓРјРµРЅС‚С‹ Рё РїСЂР°РІРёР»Р° Р±РµР·РѕРїР°СЃРЅРѕСЃС‚Рё.',
    content: `- РЇР·С‹Рє РёРЅС‚РµСЂС„РµР№СЃР° Рё РѕС‚РІРµС‚РѕРІ: СЂСѓСЃСЃРєРёР№.
- РћРЎ: Windows 10/11 (PowerShell 7 / Windows Terminal).
- РџСЂРёРЅС†РёРї СЂР°Р±РѕС‚С‹: Р±РµСЃРїР»Р°С‚РЅРѕ Рё Р±РµР· РёСЃРєСѓСЃСЃС‚РІРµРЅРЅС‹С… РѕРіСЂР°РЅРёС‡РµРЅРёР№, РїРѕР»РЅС‹Р№ РєРѕРЅС‚СЂРѕР»СЊ РЅР°Рґ РѕР±Р»Р°СЃС‚СЏРјРё С‡Р°С‚Р°.`,
    updatedAt: 'РЎРµРіРѕРґРЅСЏ',
  },
];

export const INITIAL_SUBAGENT_CONFIG: SubagentConfig = {
  enabled: true,
  maxParallel: 4,
  maxIterations: 12,
  defaultRoleId: 'role-reviewer',
  defaultProviderId: 'prov-llama-cpp',
  autoSummarizeResult: true,
};

export const INITIAL_EXECUTION_ENV: ExecutionEnvConfig = {
  activeEnv: 'local',
  localShell: 'powershell',
  localWorkdir: 'C:\\Projects\\OneCoreAI',
  sshHostId: 'host-github',
  dockerImage: 'rust:1.83-slim',
  dockerWorkdir: '/workspace',
  dockerMountWorkspace: true,
  dockerNetworkMode: 'bridge',
  requireApprovalBeforeExec: true,
};

export const INITIAL_GATEWAYS: GatewayChannelConfig[] = [
  {
    id: 'telegram',
    name: 'Telegram Bot Gateway',
    enabled: false,
    botToken: '',
    allowedChatIds: '',
    prefixCommand: '/onecore',
    autoReplyVoiceNotes: true,
    requireApprovalForWrite: true,
    status: 'idle',
    statusMessage: 'РЈРєР°Р¶РёС‚Рµ С‚РѕРєРµРЅ РѕС‚ @BotFather РґР»СЏ РїСЂРѕРІРµСЂРєРё Рё Р·Р°РїСѓСЃРєР° С€Р»СЋР·Р°',
  },
  {
    id: 'discord',
    name: 'Discord Bot Gateway',
    enabled: false,
    botToken: '',
    allowedChatIds: '',
    prefixCommand: '!onecore',
    autoReplyVoiceNotes: false,
    requireApprovalForWrite: true,
    status: 'idle',
    statusMessage: 'РџРѕРґРєР»СЋС‡РµРЅРёРµ РїРѕ Bot Token РёР· Discord Developer Portal',
  },
  {
    id: 'slack',
    name: 'Slack Socket Mode',
    enabled: false,
    botToken: '',
    allowedChatIds: '',
    prefixCommand: '/onecore',
    autoReplyVoiceNotes: false,
    requireApprovalForWrite: true,
    status: 'idle',
    statusMessage: 'РџРѕРґРґРµСЂР¶РєР° Socket Mode App Token (xapp-...) Рё Bot Token (xoxb-...)',
  },
];

export interface SlashCommandDef {
  command: string;
  syntax: string;
  description: string;
}

export const ONECORE_SLASH_COMMANDS: SlashCommandDef[] = [
  {
    command: '/web',
    syntax: '/web <РїРѕРёСЃРєРѕРІС‹Р№ Р·Р°РїСЂРѕСЃ>',
    description: 'РќР°Р№С‚Рё Рё РїСЂРѕС‡РёС‚Р°С‚СЊ РїСѓР±Р»РёС‡РЅС‹Рµ РІРµР±-СЃС‚СЂР°РЅРёС†С‹ Р±РµР· РІС‹РїРѕР»РЅРµРЅРёСЏ РґРµР№СЃС‚РІРёР№ РЅР° СЃР°Р№С‚Р°С…',
  },
  {
    command: '/browse',
    syntax: '/browse <HTTPS-Р°РґСЂРµСЃ>',
    description: 'РџСЂРѕС‡РёС‚Р°С‚СЊ С‚РµРєСЃС‚ РїСѓР±Р»РёС‡РЅРѕР№ HTTPS-СЃС‚СЂР°РЅРёС†С‹',
  },
  {
    command: '/run',
    syntax: '/run <РєРѕРјР°РЅРґР° С‚РµСЂРјРёРЅР°Р»Р°>',
    description: 'Р РµР°Р»СЊРЅРѕ РІС‹РїРѕР»РЅРёС‚СЊ РєРѕРјР°РЅРґСѓ РІ РїР°РїРєРµ Р°РєС‚РёРІРЅРѕРіРѕ РїСЂРѕРµРєС‚Р°',
  },
  {
    command: '/git',
    syntax: '/git status | diff | log | fetch',
    description: 'Р’С‹РїРѕР»РЅРёС‚СЊ СЂРµР°Р»СЊРЅСѓСЋ РєРѕРјР°РЅРґСѓ git РІ РїР°РїРєРµ РїСЂРѕРµРєС‚Р°',
  },
  {
    command: '/search',
    syntax: '/search <СЃС‚СЂРѕРєР°>',
    description: 'РџРѕРёСЃРє РїРѕ РёСЃС…РѕРґРЅРѕРјСѓ РєРѕРґСѓ РІ РїР°РїРєРµ Р°РєС‚РёРІРЅРѕРіРѕ РїСЂРѕРµРєС‚Р°',
  },
  {
    command: '/undo',
    syntax: '/undo',
    description: 'РћС‚РєР°С‚РёС‚СЊ РїРѕСЃР»РµРґРЅРµРµ РёР·РјРµРЅРµРЅРёРµ С„Р°Р№Р»Р° Р°РіРµРЅС‚РѕРј РЅР° РґРёСЃРєРµ',
  },
  {
    command: '/skill',
    syntax: '/skill <РЅР°Р·РІР°РЅРёРµ РёР»Рё Р·Р°РґР°С‡Р°>',
    description: 'РќР°Р№С‚Рё, РїРѕРґРєР»СЋС‡РёС‚СЊ РёР»Рё СЃРѕР·РґР°С‚СЊ РЅР°РІС‹Рє SKILL.md',
  },
  {
    command: '/memory',
    syntax: '/memory <С„Р°РєС‚ РґР»СЏ Р·Р°РїРѕРјРёРЅР°РЅРёСЏ>',
    description: 'РЎРѕС…СЂР°РЅРёС‚СЊ С„Р°РєС‚ РІ РґРѕР»РіРѕРІСЂРµРјРµРЅРЅСѓСЋ РїР°РјСЏС‚СЊ MEMORY.md',
  },
  {
    command: '/subagent',
    syntax: '/subagent <Р·Р°РґР°С‡Р° РІРѕСЂРєРµСЂСѓ>',
    description: 'Р—Р°РїСѓСЃС‚РёС‚СЊ РїР°СЂР°Р»Р»РµР»СЊРЅРѕРіРѕ СЃСѓР±Р°РіРµРЅС‚Р° С‡РµСЂРµР· СЂРµР°Р»СЊРЅС‹Р№ API РїСЂРѕРІР°Р№РґРµСЂР°',
  },
  {
    command: '/env',
    syntax: '/env local | ssh | docker',
    description: 'РџРµСЂРµРєР»СЋС‡РёС‚СЊ СЃСЂРµРґСѓ РІС‹РїРѕР»РЅРµРЅРёСЏ РєРѕРјР°РЅРґ С‚РµСЂРјРёРЅР°Р»Р°',
  },
  {
    command: '/provider',
    syntax: '/provider llama | openrouter | ollama',
    description: 'РџРµСЂРµРєР»СЋС‡РёС‚СЊ Р±РµСЃРїР»Р°С‚РЅС‹Р№ РїСЂРѕРІР°Р№РґРµСЂ РјРѕРґРµР»Рё Р±РµР· РѕРіСЂР°РЅРёС‡РµРЅРёР№',
  },
];

export function buildGatewayStartScript(
  gateways: GatewayChannelConfig[],
  activeProvider: FreeProviderProfile | undefined,
  envConfig: ExecutionEnvConfig,
): string {
  const tg = gateways.find((g) => g.id === 'telegram');
  const dc = gateways.find((g) => g.id === 'discord');
  const sl = gateways.find((g) => g.id === 'slack');

  return `# ONE CORE AI вЂ” Р—Р°РїСѓСЃРє Р±РµСЃРїР»Р°С‚РЅРѕРіРѕ С€Р»СЋР·Р° РјРµСЃСЃРµРЅРґР¶РµСЂРѕРІ (OneCore Gateway Bridge)
$ErrorActionPreference = "Stop"

$env:ONECORE_PROVIDER_URL = "${activeProvider?.baseUrl ?? 'http://127.0.0.1:8080/v1'}"
$env:ONECORE_PROVIDER_MODEL = "${activeProvider?.selectedModel ?? 'Qwen2.5-Coder-7B-Instruct-Q4_K_M'}"
$env:ONECORE_EXEC_ENV = "${envConfig.activeEnv}"
${tg?.botToken ? `$env:TELEGRAM_BOT_TOKEN = "${tg.botToken}"` : '# $env:TELEGRAM_BOT_TOKEN = "123456:ABC..."'}
${tg?.allowedChatIds ? `$env:TELEGRAM_ALLOWED_USERS = "${tg.allowedChatIds}"` : '# $env:TELEGRAM_ALLOWED_USERS = "123456789"'}
${dc?.botToken ? `$env:DISCORD_BOT_TOKEN = "${dc.botToken}"` : '# $env:DISCORD_BOT_TOKEN = "..."'}
${sl?.botToken ? `$env:SLACK_BOT_TOKEN = "${sl.botToken}"` : '# $env:SLACK_BOT_TOKEN = "xoxb-..."'}

Write-Host "РЁР»СЋР· ONE CORE AI РЅР°СЃС‚СЂРѕРµРЅ РЅР° РїСЂРѕРІР°Р№РґРµСЂ: $env:ONECORE_PROVIDER_MODEL ($env:ONECORE_EXEC_ENV)" -ForegroundColor Cyan
Write-Host "Р”Р»СЏ РЅРµРїСЂРµСЂС‹РІРЅРѕР№ СЂР°Р±РѕС‚С‹ РґРµСЂР¶РёС‚Рµ РѕРєРЅРѕ PowerShell РѕС‚РєСЂС‹С‚С‹Рј РёР»Рё Р·Р°РїСѓСЃС‚РёС‚Рµ С‡РµСЂРµР· Task Scheduler." -ForegroundColor Gray`;
}
