import { parseIntoSections } from '@/components/chat/narrative/parse-sections';
import { cleanupContent } from '@/components/chat/narrative/cleanup';
import { sanitizeMechanicalTags } from '@/lib/parsers/text-cleaner';
import {
  sanitizeAgencyViolations,
  lintAgencyViolations,
} from '@/app/api/chat/_helpers/agency-linter';

describe('Adversarial Gate R2 Stress Suite (Challenger R2)', () => {
  // =========================================================================
  // 1. parseIntoSections: Handout Termination & Whisper Separation
  // =========================================================================
  describe('1. parseIntoSections: Handout Termination & Whisper Separation', () => {
    it('separates [What do you do?] following an English newspaper handout', () => {
      const text = [
        '📰 THE BOSTON GLOBE',
        'Mysterious lights were reported over Innsmouth harbor.',
        '[What do you do?]',
      ].join('\n');

      const sections = parseIntoSections(text);
      expect(sections.length).toBeGreaterThanOrEqual(2);
      expect(sections[0].type).toBe('handout');
      expect(sections[0].content).toContain('Mysterious lights');
      expect(sections[0].content).not.toContain('What do you do?');

      const whisper = sections.find((s) => s.type === 'whisper');
      expect(whisper).toBeDefined();
      expect(whisper?.content).toBe('What do you do?');
    });

    it('separates [What do you all do?] following an English newspaper handout', () => {
      const text = [
        '📰 THE BOSTON GLOBE',
        'Mysterious lights were reported over Innsmouth harbor.',
        '[What do you all do?]',
      ].join('\n');

      const sections = parseIntoSections(text);
      const whisper = sections.find((s) => s.type === 'whisper');
      expect(whisper).toBeDefined();
      expect(whisper?.content).toBe('What do you all do?');
      expect(sections[0].content).not.toContain('What do you all do?');
    });

    it('handles case-insensitivity: [WHAT DO YOU DO?] and [what do you do?]', () => {
      const upperText = [
        '📰 ARKHAM ADVERTISER',
        'Strange sounds in the cellar.',
        '[WHAT DO YOU DO?]',
      ].join('\n');
      const upperSections = parseIntoSections(upperText);
      const upperWhisper = upperSections.find((s) => s.type === 'whisper');
      expect(upperWhisper).toBeDefined();
      expect(upperSections[0].content).not.toContain('WHAT DO YOU DO?');

      const lowerText = [
        '📰 ARKHAM ADVERTISER',
        'Strange sounds in the cellar.',
        '[what do you do?]',
      ].join('\n');
      const lowerSections = parseIntoSections(lowerText);
      const lowerWhisper = lowerSections.find((s) => s.type === 'whisper');
      expect(lowerWhisper).toBeDefined();
      expect(lowerSections[0].content).not.toContain('what do you do?');
    });

    it('handles whitespace around [What do you do?] on its line', () => {
      const text = [
        '📰 THE NEW YORK TIMES',
        'Expedition lost in Antarctica.',
        '   [What do you do?]   ',
      ].join('\n');

      const sections = parseIntoSections(text);
      const whisper = sections.find((s) => s.type === 'whisper');
      expect(whisper).toBeDefined();
      expect(whisper?.content).toBe('What do you do?');
    });

    it('does not terminate handout prematurely if "What do you do?" appears as unbracketed prose', () => {
      const text = [
        '📰 THE BOSTON GLOBE',
        'The article asks: What do you do when the dead return?',
        'More text in the article continues here.',
        '==============================',
        '[What do you do?]',
      ].join('\n');

      const sections = parseIntoSections(text);
      const handout = sections.find((s) => s.type === 'handout');
      expect(handout).toBeDefined();
      expect(handout?.content).toContain('What do you do when the dead return?');
      expect(handout?.content).toContain('More text in the article continues here.');

      const whisper = sections.find((s) => s.type === 'whisper');
      expect(whisper).toBeDefined();
      expect(whisper?.content).toBe('What do you do?');
    });

    it('handles telegram, document, and report headers terminated by English whisper', () => {
      const telegram = [
        'TELEGRAM STOP',
        'ARRIVING BY MIDNIGHT TRAIN STOP NEED ASSISTANCE STOP',
        '[What do you do?]',
      ].join('\n');

      const sections = parseIntoSections(telegram);
      const handout = sections.find((s) => s.type === 'handout');
      expect(handout).toBeDefined();
      expect(handout?.content).toContain('ARRIVING BY MIDNIGHT TRAIN');
      const whisper = sections.find((s) => s.type === 'whisper');
      expect(whisper?.content).toBe('What do you do?');
    });

    it('handles multiple handouts followed by whisper', () => {
      const multi = [
        '📰 THE BOSTON GLOBE',
        'First article text.',
        '------------------------------',
        '📜 DOKUMENT:',
        'Second document text.',
        '[What do you all do?]',
      ].join('\n');

      const sections = parseIntoSections(multi);
      const handouts = sections.filter((s) => s.type === 'handout');
      expect(handouts.length).toBe(2);
      const whisper = sections.find((s) => s.type === 'whisper');
      expect(whisper).toBeDefined();
      expect(whisper?.content).toBe('What do you all do?');
    });
  });

  // =========================================================================
  // 2. agency-linter: Non-Duplication of Questions & Tag Preservation
  // =========================================================================
  describe('2. agency-linter: Non-Duplication of Questions & Tag Preservation', () => {
    it('does NOT duplicate [What do you do?] when violation occurs after existing question', () => {
      const text =
        'You enter the dusty study and examine the desk.\n\n' +
        '[What do you do?]\n\n' +
        'Thomas pulls out his gun without warning.';

      const sanitized = sanitizeAgencyViolations(text, ['Thomas'], { isDuet: false, locale: 'en' });
      const matches = sanitized.match(/\[What do you do\?\]/g);
      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(1);
      expect(sanitized).not.toContain('[What do you all do?]');
    });

    it('does NOT duplicate [What do you all do?] in duet mode when violation occurs after existing question', () => {
      const text =
        'You both stand before the iron gate.\n\n' +
        '[What do you all do?]\n\n' +
        'Thomas enters the forbidden courtyard.';

      const sanitized = sanitizeAgencyViolations(text, ['Thomas', 'Beatrice'], { isDuet: true, locale: 'en' });
      const matches = sanitized.match(/\[What do you all do\?\]/g);
      expect(matches).not.toBeNull();
      expect(matches?.length).toBe(1);
      expect(sanitized).not.toContain('[What do you do?]');
    });

    it('does NOT add trailing period after closing bracket "]" before question', () => {
      const text =
        'On the dusty desk lies a strange brass key [ITEM: Brass Key]\n\n' +
        'Thomas steps inside without waiting.';

      const sanitized = sanitizeAgencyViolations(text, ['Thomas'], { isDuet: false, locale: 'en' });
      expect(sanitized).not.toContain('[ITEM: Brass Key].');
      expect(sanitized).toContain('[ITEM: Brass Key]\n\n[What do you do?]');
    });

    it('does NOT duplicate question when base text already has question with trailing spaces or newlines', () => {
      const text =
        'The hallway grows cold. [What do you do?]   \n\n' +
        'Thomas steps into the shadows.';

      const sanitized = sanitizeAgencyViolations(text, ['Thomas'], { isDuet: false, locale: 'en' });
      const matches = sanitized.match(/\[What do you do\?\]/g);
      expect(matches?.length).toBe(1);
    });

    it('preserves all canonical English single and paired tags from truncated region', () => {
      const text =
        'You step into the chamber.\n\n' +
        'Thomas approaches the altar recklessly.\n\n' +
        '[CURRENT TIME: 1920-10-15 22:30]\n' +
        '[LOCATION: Crypt of the Corbitt House | damp earth]\n' +
        '[PRESENT_NPCS: Janusz, Arthur]\n' +
        '[SCENE_CHANGE: Lower Vault]\n' +
        '[ITEM: Ancient Dagger]\n' +
        '[HAZARD: Falling stones]\n' +
        '[REFEREE_VETO: Cannot jump across the chasm]\n' +
        '[OBSERVATION: Claw marks on the doorframe]\n' +
        '[SPELL: Cloud Memory]\n' +
        '[OPPOSED_MAGIC: 50 vs 45]\n' +
        '[OPPOSED_MELEE: 60 vs 30]\n' +
        '[SPONTANEOUS_MAGIC: Minor illusion]\n' +
        '[JOURNAL:clue:Strange symbol]Carved on stone[/JOURNAL]\n' +
        '[What do you do?]';

      const sanitized = sanitizeAgencyViolations(text, ['Thomas'], { isDuet: false, locale: 'en' });

      // Verifying tag preservation
      expect(sanitized).toContain('[CURRENT TIME: 1920-10-15 22:30]');
      expect(sanitized).toContain('[LOCATION: Crypt of the Corbitt House | damp earth]');
      expect(sanitized).toContain('[PRESENT_NPCS: Janusz, Arthur]');
      expect(sanitized).toContain('[SCENE_CHANGE: Lower Vault]');
      expect(sanitized).toContain('[ITEM: Ancient Dagger]');
      expect(sanitized).toContain('[HAZARD: Falling stones]');
      expect(sanitized).toContain('[REFEREE_VETO: Cannot jump across the chasm]');
      expect(sanitized).toContain('[OBSERVATION: Claw marks on the doorframe]');
      expect(sanitized).toContain('[SPELL: Cloud Memory]');
      expect(sanitized).toContain('[OPPOSED_MAGIC: 50 vs 45]');
      expect(sanitized).toContain('[OPPOSED_MELEE: 60 vs 30]');
      expect(sanitized).toContain('[SPONTANEOUS_MAGIC: Minor illusion]');
      expect(sanitized).toContain('[JOURNAL:clue:Strange symbol]Carved on stone[/JOURNAL]');
      // And exactly one question
      const qMatches = sanitized.match(/\[What do you do\?\]/g);
      expect(qMatches?.length).toBe(1);
    });

    it('returns empty text fallback with correct locale and duet settings', () => {
      // If entire text is an agency violation from the first token
      const soloEn = sanitizeAgencyViolations('Thomas enters the forbidden chamber immediately.', ['Thomas'], { isDuet: false, locale: 'en' });
      expect(soloEn).toContain('You stand on the threshold, taking in your surroundings.');
      expect(soloEn).toContain('[What do you do?]');

      const duetEn = sanitizeAgencyViolations('Thomas enters the forbidden chamber immediately.', ['Thomas'], { isDuet: true, locale: 'en' });
      expect(duetEn).toContain('You stand on the threshold, taking in your surroundings.');
      expect(duetEn).toContain('[What do you all do?]');

      const soloPl = sanitizeAgencyViolations('Thomas wchodzi do zakazanej komnaty natychmiast.', ['Thomas'], { isDuet: false, locale: 'pl' });
      expect(soloPl).toContain('Stoisz na progu zdarzenia, obserwując otoczenie.');
      expect(soloPl).toContain('[Co robisz?]');

      const duetPl = sanitizeAgencyViolations('Thomas wchodzi do zakazanej komnaty natychmiast.', ['Thomas'], { isDuet: true, locale: 'pl' });
      expect(duetPl).toContain('Stoicie na progu zdarzenia, obserwując otoczenie.');
      expect(duetPl).toContain('[Co robicie?]');
    });
  });

  // =========================================================================
  // 3. cleanup.ts and text-cleaner.ts: CURRENT TIME and Mechanical Tags
  // =========================================================================
  describe('3. cleanup.ts & text-cleaner.ts: CURRENT TIME and Mechanical Tags', () => {
    it('cleanupContent strips [CURRENT TIME: ...] and [AKTUALNY CZAS: ...] completely', () => {
      const text =
        '[CURRENT TIME: 1920-10-15 14:00]\n' +
        'The grandfather clock strikes two in the afternoon.\n' +
        '[AKTUALNY CZAS: 1920-10-15 14:00]\n' +
        '[What do you do?]';

      const cleaned = cleanupContent(text);
      expect(cleaned).not.toContain('CURRENT TIME');
      expect(cleaned).not.toContain('AKTUALNY CZAS');
      expect(cleaned).toContain('The grandfather clock strikes two in the afternoon.');
      expect(cleaned).toContain('[What do you do?]');
    });

    it('cleanupContent strips inline [CURRENT TIME: ...]', () => {
      const text = 'The bell tolls. [CURRENT TIME: 1920-10-15 15:30] Silence returns.';
      const cleaned = cleanupContent(text);
      expect(cleaned).not.toContain('CURRENT TIME');
      expect(cleaned).toBe('The bell tolls.  Silence returns.');
    });

    it('cleanupContent preserves legitimate prose mentioning current time', () => {
      const text =
        'At the current time, the police inspector has no further leads.\n' +
        'The current time in London was unknown to the sailors.';
      const cleaned = cleanupContent(text);
      expect(cleaned).toBe(text);
    });

    it('sanitizeMechanicalTags in text-cleaner strips [CURRENT TIME: ...], [CURRENT_TIME: ...], [WEATHER: ...]', () => {
      const text =
        'Narration begins.\n' +
        '[CURRENT TIME: 1920-10-15 14:00]\n' +
        '[CURRENT_TIME: 1920-10-15 14:05]\n' +
        '[AKTUALNY CZAS: 1920-10-15 14:10]\n' +
        '[AKTUALNY_CZAS: 1920-10-15 14:15]\n' +
        '[TIME: 1920-10-15 14:20]\n' +
        '[WEATHER: Heavy thunderstorm over Arkham]\n' +
        '[END_SESSION: Save game]\n' +
        'Narration continues cleanly.';

      const cleaned = sanitizeMechanicalTags(text);
      expect(cleaned).not.toContain('CURRENT TIME');
      expect(cleaned).not.toContain('CURRENT_TIME');
      expect(cleaned).not.toContain('AKTUALNY CZAS');
      expect(cleaned).not.toContain('AKTUALNY_CZAS');
      expect(cleaned).not.toContain('Heavy thunderstorm');
      expect(cleaned).not.toContain('END_SESSION');
      expect(cleaned).toContain('Narration begins.');
      expect(cleaned).toContain('Narration continues cleanly.');
    });

    it('sanitizeMechanicalTags preserves regular brackets and ordinary prose', () => {
      const text = 'The suspect (wearing a hat) glanced at [his watch] and sighed.';
      const cleaned = sanitizeMechanicalTags(text);
      expect(cleaned).toContain('glanced at [his watch]');
    });
  });

  // =========================================================================
  // 4. Fuzz & Concurrency Stress Matrix
  // =========================================================================
  describe('4. Fuzz & Stress Matrix', () => {
    it('executes 100 random interleavings of tags, handouts, and agency violations without fatal errors', () => {
      const tagPool = [
        '[CURRENT TIME: 1920-10-15 12:00]',
        '[LOCATION: Arkham Graveyard | dreary mist]',
        '[ITEM: Silver Key]',
        '[HAZARD: Pitfall]',
        '[What do you do?]',
        '[What do you all do?]',
        '[Co robisz?]',
        '[Co robicie?]',
        '📰 THE BOSTON GLOBE\nFront page news.\n[What do you do?]',
        '📜 LIST:\nDrogi przyjacielu...\n[What do you all do?]',
      ];

      for (let i = 0; i < 100; i++) {
        const numTags = 1 + (i % 5);
        const tags: string[] = [];
        for (let j = 0; j < numTags; j++) {
          tags.push(tagPool[(i + j * 3) % tagPool.length]);
        }
        const sampleText = `Story begins at step ${i}.\n` + tags.join('\n') + `\nThomas enters the dark room without asking.`;

        // Run through agency linter
        const sanitized = sanitizeAgencyViolations(sampleText, ['Thomas'], {
          isDuet: i % 2 === 0,
          locale: i % 3 === 0 ? 'pl' : 'en',
        });
        expect(typeof sanitized).toBe('string');
        expect(sanitized.length).toBeGreaterThan(0);

        // Run through cleanupContent
        const cleaned = cleanupContent(sanitized);
        expect(typeof cleaned).toBe('string');

        // Run through parseIntoSections
        const sections = parseIntoSections(cleaned);
        expect(Array.isArray(sections)).toBe(true);
        expect(sections.length).toBeGreaterThan(0);

        // Run through sanitizeMechanicalTags
        const ttsReady = sanitizeMechanicalTags(cleaned);
        expect(typeof ttsReady).toBe('string');
      }
    });
  });
});
