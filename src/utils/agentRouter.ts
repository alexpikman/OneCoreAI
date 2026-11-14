export type AgentRouteKind = 'chat' | 'browser' | 'project' | 'terminal';

export interface AgentRoute {
  kind: AgentRouteKind;
  query?: string;
  browserAction?: 'search' | 'read';
}

export function inferAgentMode(prompt: string, fallback: 'plan' | 'act' = 'act'): 'plan' | 'act' {
  const text = prompt.trim();
  if (
    /^(?:\/run(?:\s|$)|\/undo(?:\s|$)|\/git\s+(?:commit|fetch|push|init)(?=$|[\s,]))/i.test(text) ||
    /(?:^|[\s,])(?:исправь|почини|создай|добавь|реализуй|измени|обнови|удали|запусти|выполни|напиши|сохрани|сделай|рефакторируй|перепиши|fix|create|add|implement|edit|modify|update|delete|run|execute|write|save|refactor|rewrite)(?=$|[\s,])/i.test(
      text,
    )
  ) {
    return 'act';
  }
  if (
    /^(?:\/search(?:\s|$)|\/git(?:\s|$)|(?:пожалуйста\s+)?(?:объясни|расскажи|покажи|прочитай|открой|найди|проанализируй|проверь|сравни|перечисли|объяснить|рассказать|посмотреть|прочитать|explain|describe|show|read|open|find|analyze|review|inspect|compare|list|what|why|how)(?=$|[\s,]))/i.test(
      text,
    ) ||
    /\?$/.test(text)
  ) {
    return 'plan';
  }
  return fallback;
}

const WEB_ACTION =
  /(?:^|[\s,])(?:найди|поищи|посмотри|проверь|узнай|прочитай|открой|search|look up|browse|open|read)(?=$|[\s,])/i;
const WEB_CONTEXT =
  /(?:в интернете|по интернету|в сети|онлайн|search (?:the )?web|look up online|browse the web)/i;
const PROJECT_ACTION =
  /^(?:пожалуйста\s+)?(?:исправь|почини|создай|добавь|реализуй|измени|сделай|выполни|выполнить|заверши|продолжи|обнови|рефактор(?:ируй|инг)?|напиши|удали|проверь|проанализируй|прочитай|открой|посмотри|найди|покажи|перечисли|какие|какой|что|сколько|статус|объясни|fix|create|add|implement|execute|complete|finish|edit|modify|change|update|refactor|write|review|inspect|read|open|find|list|show|explain)(?=$|[\s,])/i;
const PROJECT_CONTEXT =
  /(?:^|[\s,])(?:код|файл(?:ы)?|проект|репозитор(?:ий|ия)|приложение|задач(?:у|а|и|ам|ами)?|план|репорт|баг|ошибка в коде|функци(?:ю|я)|модул[ья]|тест(?:ы|а)?|code|file|project|repo|application|task|tasks|plan|bug|feature|module|tests?)(?=$|[\s,.:;!?])|(?:^|\s)src[\\/]/i;
const TERMINAL_INTENT =
  /(?:^\/run(?:\s|$)|(?:запусти|выполни|выполнить)\s+(?:команду|тест(?:ы)?|сборку|в\s+терминале)|(?:в терминале).*(?:запусти|выполни)|(?:run|execute)\s+(?:this\s+)?(?:command|tests?)\b|\b(?:npm|pnpm|yarn|bun|cargo|pytest)\s+(?:test|run|build|lint)\b)/i;

function cleanQuery(query: string): string {
  return query
    .replace(/^(?:пожалуйста\s+)?(?:найди|поищи|посмотри|проверь|узнай|прочитай|открой)\s+/i, '')
    .replace(/^(?:в интернете|в сети|онлайн)\s*/i, '')
    .replace(/\s+\b(?:в интернете|в сети|онлайн)\b/gi, '')
    .replace(/^(?:search|look up|browse)\s+(?:the\s+)?web(?:\s+for)?\s*/i, '')
    .trim();
}

export function routeAgentPrompt(prompt: string): AgentRoute {
  const trimmed = prompt.trim();
  if (!trimmed) return { kind: 'chat' };

  if (/^\/(?:web|browse)\b/i.test(trimmed)) {
    const isRead = /^\/browse\b/i.test(trimmed);
    return {
      kind: 'browser',
      browserAction: isRead ? 'read' : 'search',
      query: trimmed.replace(/^\/(?:web|browse)\s*/i, '').trim(),
    };
  }

  if (TERMINAL_INTENT.test(trimmed)) return { kind: 'terminal' };
  if (/^\/(?:git|search|undo)\b/i.test(trimmed)) return { kind: 'project' };

  const url = trimmed.match(/https?:\/\/\S+/i)?.[0]?.replace(/[),.!?]+$/, '');
  if (
    (url &&
      /(?:^|[\s,])(?:проверь|прочитай|открой|посмотри|check|read|open|browse)(?=$|[\s,])/i.test(
        trimmed,
      )) ||
    (WEB_ACTION.test(trimmed) && WEB_CONTEXT.test(trimmed))
  ) {
    return {
      kind: 'browser',
      browserAction: url ? 'read' : 'search',
      query: url || cleanQuery(trimmed),
    };
  }

  if (PROJECT_ACTION.test(trimmed) && PROJECT_CONTEXT.test(trimmed)) {
    return { kind: 'project' };
  }

  return { kind: 'chat' };
}
