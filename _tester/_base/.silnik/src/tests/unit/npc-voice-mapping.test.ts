import {
  inferGenderFromName,
  inferGenderFromNPC,
  buildNpcToneOfVoice,
  resolveDynamicNpcVoice,
  initializeAdventureNpcVoices,
} from '@/lib/npc-voice-mapping';
import { GEMINI_VOICES } from '@/lib/gemini-voices';
import type { NPC } from '@/lib/types';

describe('NPC Voice Mapping & Tone of Voice (Issue #170)', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.clear();
    }
  });

  describe('inferGenderFromName', () => {
    it('poprawnie rozpoznaje imiona żeńskie z polską końcówką -a', () => {
      expect(inferGenderFromName('Anna')).toBe('female');
      expect(inferGenderFromName('Maria')).toBe('female');
      expect(inferGenderFromName('Katarzyna')).toBe('female');
      expect(inferGenderFromName('Eleonora')).toBe('female');
      expect(inferGenderFromName('Zofia Kowalska')).toBe('female');
    });

    it('poprawnie ignoruje męskie imiona kończące się na -a (wyjątki)', () => {
      expect(inferGenderFromName('Kuba')).not.toBe('female');
      expect(inferGenderFromName('Barnaba')).not.toBe('female');
      expect(inferGenderFromName('Kosma')).not.toBe('female');
      expect(inferGenderFromName('Sasza')).not.toBe('female');
      expect(inferGenderFromName('Luca')).not.toBe('female');
    });

    it('poprawnie rozpoznaje płeć na podstawie tytułów żeńskich', () => {
      expect(inferGenderFromName('Pani Smith')).toBe('female');
      expect(inferGenderFromName('Panna Williams')).toBe('female');
      expect(inferGenderFromName('Miss Marple')).toBe('female');
      expect(inferGenderFromName('Siostra Beatrice')).toBe('female');
      expect(inferGenderFromName('Wdowa Blackwood')).toBe('female');
    });

    it('poprawnie rozpoznaje płeć na podstawie tytułów męskich', () => {
      expect(inferGenderFromName('Pan Nowak')).toBe('male');
      expect(inferGenderFromName('Ojciec Brown')).toBe('male');
      expect(inferGenderFromName('Profesor Armitage')).toBe('male');
      expect(inferGenderFromName('Inspektor Legrasse')).toBe('male');
      expect(inferGenderFromName('Dr Watson')).toBe('male');
    });

    it('poprawnie rozpoznaje imiona żeńskie bez końcówki -a (znane imiona epoki i anglosaskie)', () => {
      expect(inferGenderFromName('Abigail')).toBe('female');
      expect(inferGenderFromName('Abigail Vance')).toBe('female');
      expect(inferGenderFromName('Helen')).toBe('female');
      expect(inferGenderFromName('Ruth')).toBe('female');
      expect(inferGenderFromName('Alice')).toBe('female');
      expect(inferGenderFromName('Mary')).toBe('female');
      expect(inferGenderFromName('Agnes')).toBe('female');
    });

    it('zwraca null dla pustego lub nieznanego neutralnego ciągu', () => {
      expect(inferGenderFromName('')).toBeNull();
      expect(inferGenderFromName('xyz123')).toBeNull();
    });
  });

  describe('inferGenderFromNPC', () => {
    it('daje priorytet imieniu nad opisem', () => {
      const npc: Partial<NPC> = {
        name: 'Anna Kowalska',
        occupation: 'marynarz', // męskie słowo kluczowe
      };
      expect(inferGenderFromNPC(npc as NPC)).toBe('female');
    });

    it('rozpoznaje płeć z zawodu i opisu gdy imię jest neutralne', () => {
      const femaleNpc: Partial<NPC> = {
        name: 'Shadow',
        occupation: 'kelnerka w miejscowym barze',
      };
      expect(inferGenderFromNPC(femaleNpc as NPC)).toBe('female');

      const maleNpc: Partial<NPC> = {
        name: 'Shadow',
        occupation: 'kowal i żołnierz',
      };
      expect(inferGenderFromNPC(maleNpc as NPC)).toBe('male');
    });
  });

  describe('buildNpcToneOfVoice', () => {
    it('przypisuje kobiecy głos dla postaci żeńskiej', () => {
      const result = buildNpcToneOfVoice({
        name: 'Eleonora Vance',
        occupation: 'historyk sztuki',
      });
      expect(result.gender).toBe('female');
      const femaleVoices = GEMINI_VOICES.filter((v) => v.role === 'female').map((v) => v.voiceId);
      expect(femaleVoices).toContain(result.voiceId);
      expect(result.audioDirection).toContain('clear, natural Polish pronunciation');
      expect(result.audioDirection).toContain('female character voice');
      expect(result.audioDirection).toContain('steady, engaging pace');
      expect(result.audioDirection).not.toContain('slow');
    });

    it('dobiera styl naukowy dla zawodu profesora / badacza', () => {
      const result = buildNpcToneOfVoice({
        name: 'Henry Armitage',
        occupation: 'profesor bibliotekoznawstwa',
      });
      expect(result.gender).toBe('male');
      expect(result.audioDirection).toContain('scholarly');
    });

    it('dobiera przerażony ton głosu przy panice/strachu w nastroju', () => {
      const result = buildNpcToneOfVoice(
        {
          name: 'Thomas',
          occupation: 'student',
        },
        { mood: 'panika i groza w piwnicy' }
      );
      expect(result.audioDirection).toContain('terrified');
    });
  });

  describe('resolveDynamicNpcVoice', () => {
    it('keeps the same voice while recalculating the current emotion after a cached scene', () => {
      const voices = new Map<string, string>();
      const cache = new Map<string, { voiceId: string; audioDirection: string }>();
      const calm = resolveDynamicNpcVoice('Helena Krawczyk', voices, cache, { occupation: 'redaktorka', mood: 'spokój' });
      const afraid = resolveDynamicNpcVoice('Helena Krawczyk', voices, cache, { occupation: 'redaktorka', mood: 'panika i strach' });
      const recovered = resolveDynamicNpcVoice('Helena Krawczyk', voices, cache, { occupation: 'redaktorka', mood: 'spokój' });
      expect(afraid.voiceId).toBe(calm.voiceId);
      expect(recovered.voiceId).toBe(calm.voiceId);
      expect(afraid.audioDirection).toContain('terrified');
      expect(calm.audioDirection).not.toContain('terrified');
      expect(recovered.audioDirection).not.toContain('terrified');
    });
    it('przypisuje żeński głos Aoede i poprawną reżyserię dla nowo napotkanej kobiety', () => {
      const voiceMap = new Map<string, string>();
      const cache = new Map<string, { voiceId: string; audioDirection: string }>();

      const resolved = resolveDynamicNpcVoice('Panna Emily', voiceMap, cache);
      expect(resolved.voiceId).toBe('Aoede');
      expect(resolved.audioDirection).toContain('female');
      expect(voiceMap.get('panna emily')).toBe('Aoede');
      expect(cache.has('panna emily')).toBe(true);
    });

    it('naprawia błąd starych danych: zastępuje basowy głos Charon głosem Aoede dla kobiety', () => {
      const voiceMap = new Map<string, string>();
      voiceMap.set('helena', 'Charon'); // błąd z przeszłości

      const resolved = resolveDynamicNpcVoice('Helena', voiceMap);
      expect(resolved.voiceId).toBe('Aoede');
    });

    it('Issue #693: przypisuje kobiecy głos dla Abigail Vance z uwzględnieniem wieku i twardego bezpiecznika płci', () => {
      const voiceMap = new Map<string, string>();
      // Młoda archiwistka / badaczka
      const youngAbigail = resolveDynamicNpcVoice('Abigail Vance', voiceMap, undefined, {
        description: 'Młoda asystentka archiwum w Bostonie, dwudziestokilkuletnia dziewczyna',
      });
      expect(youngAbigail.voiceId).toBe('Leda');
      expect(youngAbigail.audioDirection).toContain('female');

      // Dojrzała kobieta bez wskazania młodego wieku
      const adultMap = new Map<string, string>();
      const adultAbigail = resolveDynamicNpcVoice('Abigail Vance', adultMap, undefined, {
        description: 'Archiwistka w Bostonie',
      });
      expect(adultAbigail.voiceId).toBe('Aoede');
      expect(adultAbigail.audioDirection).toContain('female');

      // Twardy bezpiecznik płci: próba przypisania męskiego głosu kobiecie zostaje skorygowana
      const corruptMap = new Map<string, string>();
      corruptMap.set('abigail vance', 'Puck');
      const fixed = resolveDynamicNpcVoice('Abigail Vance', corruptMap);
      expect(fixed.voiceId).not.toBe('Puck');
      expect(['Aoede', 'Leda', 'Gacrux']).toContain(fixed.voiceId);
    });

    it('Issue #735: rozpoznaje Rosalię i postacie w markdownie jako żeńskie i chroni przed męskim głosem lektora Algenib', () => {
      const voiceMap = new Map<string, string>();
      const resolved = resolveDynamicNpcVoice('Rosalia', voiceMap);
      expect(['Aoede', 'Leda', 'Gacrux']).toContain(resolved.voiceId);
      expect(resolved.audioDirection).toContain('female');

      // Obsługa markdownu **Rosalia**
      const mdMap = new Map<string, string>();
      const resolvedMd = resolveDynamicNpcVoice('**Rosalia**', mdMap);
      expect(['Aoede', 'Leda', 'Gacrux']).toContain(resolvedMd.voiceId);

      // Twardy bezpiecznik: stary lub domyślny męski głos narratora (Algenib) skojarzony z kobietą zostaje skorygowany
      const corruptMap = new Map<string, string>();
      corruptMap.set('rosalia', 'Algenib');
      const fixed = resolveDynamicNpcVoice('Rosalia', corruptMap);
      expect(fixed.voiceId).not.toBe('Algenib');
      expect(['Aoede', 'Leda', 'Gacrux']).toContain(fixed.voiceId);

      // Słowo kluczowe właścicielka nie koliduje z właściciel
      const ownerNpc = resolveDynamicNpcVoice('Pani Dubois', new Map(), undefined, {
        description: 'Właścicielka kamienicy przy zaułku',
      });
      expect(['Aoede', 'Leda', 'Gacrux']).toContain(ownerNpc.voiceId);
    });

    it('zwraca męski głos Puck dla nowo napotkanego mężczyzny', () => {
      const voiceMap = new Map<string, string>();
      const resolved = resolveDynamicNpcVoice('Arthur Pendelton', voiceMap);
      expect(resolved.voiceId).toBe('Puck');
      expect(resolved.audioDirection).toContain('male');
    });
  });

  describe('initializeAdventureNpcVoices', () => {
    it('parsuje postacie ze scenariusza i zapisuje je w localStorage gm_npcs z odpowiednimi głosami', () => {
      const adventure = {
        title: 'Nawiedzony Dom',
        era: '1920s Classic',
        graph: {
          npcs: [
            {
              name: 'Pani Corbitt',
              description: 'Wdowa po poprzednim właścicielu domu',
            },
            {
              name: 'Inspektor Henderson',
              description: 'Lokalny oficer policji w Bostonie',
            },
          ],
        },
      };

      const result = initializeAdventureNpcVoices(adventure);
      expect(result.length).toBe(2);

      const savedRaw = window.localStorage.getItem('gm_npcs');
      expect(savedRaw).toBeTruthy();
      const savedNpcs = JSON.parse(savedRaw!);

      const corbitt = savedNpcs.find((n: Partial<NPC>) => n.name === 'Pani Corbitt');
      const femaleVoices = GEMINI_VOICES.filter((v) => v.role === 'female').map((v) => v.voiceId);
      expect(corbitt).toBeDefined();
      expect(femaleVoices).toContain(corbitt.voiceConfig?.voiceId);
      expect(corbitt.voiceConfig?.rate).toBe(1.15);

      const maleVoices = GEMINI_VOICES.filter((v) => v.role === 'male').map((v) => v.voiceId);
      const henderson = savedNpcs.find((n: Partial<NPC>) => n.name === 'Inspektor Henderson');
      expect(henderson).toBeDefined();
      expect(maleVoices).toContain(henderson.voiceConfig?.voiceId);
    });
  });
});
