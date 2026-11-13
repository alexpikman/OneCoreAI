import type { ChatSession } from '../types/onecore';

export const INITIAL_SESSIONS: ChatSession[] = [
  {
    id: 'session-default',
    title: 'Новый чат',
    updatedAt: 'Сейчас',
    mode: 'act',
    messages: [],
  },
];
