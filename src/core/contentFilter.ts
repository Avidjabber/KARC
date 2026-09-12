import { LinkifyIt } from 'linkify-it';

const linkify = new LinkifyIt();

// Invisible / directionality abuse characters
const INVISIBLE_REGEX = /[​-‏‪-‮⁦-⁩﻿]/;
const EMOJI_REGEX     = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/u;
const ZALGO_REGEX     = /[̀-ͯ]{5,}/;
const MENTION_REGEX   = /[@#]/;

const DISPLAY_NAME_ALLOWLIST = /^[\p{L}\p{N} \-'|/]+$/u;
const CODE_NAME_ALLOWLIST    = /^[a-z][a-z0-9_]*$/;

const SLURS = [
    'nigger', 'faggot', 'kike', 'chink', 'spic',
    'tranny', 'coon', 'gook', 'raghead',
];

const PROFANITY = [
    'ass', 'fuck', 'shit', 'bitch', 'cunt', 'cock', 'dick',
    'pussy', 'bastard', 'whore', 'slut', 'piss', 'arse',
    'wank', 'twat', 'bollocks', 'penis', 'vagina',
];

const LEET_MAP: Record<string, string> = {
    '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's',
    '6': 'g', '7': 't', '8': 'b', '$': 's', '!': 'i',
    '|': 'i', '+': 't',
};

function normalizeLeet(text: string): string {
    return text.split('').map(c => LEET_MAP[c.toLowerCase()] ?? c).join('');
}

function normalizeForDetection(text: string): string {
    let result = text.normalize('NFKC');
    result = normalizeLeet(result);
    result = result.replace(/[.\-_ ]+/g, '');
    return result.toLowerCase();
}

function containsWord(text: string, wordList: string[]): boolean {
    const normalized  = normalizeForDetection(text);
    const lettersOnly = normalized.replace(/[^a-z]/g, '');

    return wordList.some(word => {
        const boundary = new RegExp(`(?<![a-z])${word}(?![a-z])`, 'i');
        if (boundary.test(text) || boundary.test(normalized)) return true;
        if (word.length >= 5 && lettersOnly.includes(word)) return true;
        return false;
    });
}

function checkBase(value: string): 'invalid_characters' | 'link' | 'emoji' | 'mention' | 'slur' | null {
    if (INVISIBLE_REGEX.test(value) || ZALGO_REGEX.test(value)) return 'invalid_characters';
    if (linkify.match(value))                                    return 'link';
    if (EMOJI_REGEX.test(value))                                 return 'emoji';
    if (MENTION_REGEX.test(value))                               return 'mention';
    if (containsWord(value, SLURS))                              return 'slur';
    return null;
}

export type FilterReason = 'slur' | 'profanity' | 'link' | 'emoji' | 'mention' | 'invalid_characters';

export type FilterResult<T extends string = string> =
    | { valid: true;  value: T }
    | { valid: false; reason: FilterReason };

export const FILTER_MESSAGES: Record<FilterReason, string> = {
    invalid_characters: 'contains invalid characters.',
    link:               'cannot contain URLs or links.',
    emoji:              'cannot contain emojis.',
    mention:            'cannot contain @ or # symbols.',
    slur:               'contains a prohibited word.',
    profanity:          'contains profanity.',
};

/** Display names — Unicode letters, numbers, spaces, hyphens, apostrophes. No profanity. */
export function validateDisplayName(value: string): FilterResult {
    value = value.trim();

    const base = checkBase(value);
    if (base) return { valid: false, reason: base };

    if (!DISPLAY_NAME_ALLOWLIST.test(value)) return { valid: false, reason: 'invalid_characters' };
    if (containsWord(value, PROFANITY))      return { valid: false, reason: 'profanity' };

    return { valid: true, value };
}

/** Code names — normalised to lowercase. Must start with a letter, then letters, digits, underscores. No spaces. No profanity. */
export function validateCodeName(value: string): FilterResult {
    value = value.trim().toLowerCase();

    const base = checkBase(value);
    if (base) return { valid: false, reason: base };

    if (!CODE_NAME_ALLOWLIST.test(value)) return { valid: false, reason: 'invalid_characters' };
    if (containsWord(value, PROFANITY))   return { valid: false, reason: 'profanity' };

    return { valid: true, value };
}
