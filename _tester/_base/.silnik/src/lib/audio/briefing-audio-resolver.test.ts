import { describe, it, expect } from '@jest/globals';
import { resolveScenarioSlug, getBriefingAudio } from './briefing-audio-resolver';

describe('briefing-audio-resolver', () => {
  it('rozpoznaje starter Nawiedzony Dom po tytule i ID', () => {
    expect(resolveScenarioSlug({ id: 'the-haunting', title: 'Nawiedzony dom' })).toBe('the-haunting');
    expect(resolveScenarioSlug(null, 'The Haunting')).toBe('the-haunting');
    expect(resolveScenarioSlug({ id: 'case-s11-01', title: 'Starter' })).toBe('case-s11-01');
  });

  it('rozpoznaje polskie Quick po tytule', () => {
    expect(resolveScenarioSlug({ id: 'unknown', title: 'Cień nad Prabutami: Widzenie' })).toBe('cien-nad-prabutami');
    expect(resolveScenarioSlug(null, 'Tajemnica Dzieci z Traszyna')).toBe('tajemnica-dzieci-z-traszyna');
    expect(resolveScenarioSlug(null, 'Tajemnica Pędnika Łągiewki')).toBe('tajemnica-pendnika-lagiewki');
    expect(resolveScenarioSlug(null, 'Przybysz z Matriksa Głogów')).toBe('przybysz-z-matriksa-glogow');
  });

  it('rozpoznaje amerykańskie Cold Cases po tytule', () => {
    expect(resolveScenarioSlug(null, 'Englewood Murder Castle')).toBe('englewood-murder-castle-1893');
    expect(resolveScenarioSlug(null, 'The Almer Coe Spectacles')).toBe('almer-coe-spectacles-1924');
    expect(resolveScenarioSlug(null, 'Circleville Letters')).toBe('circleville-letters-1983');
    expect(resolveScenarioSlug(null, 'Ovidhall Lake Anomaly')).toBe('ovidhall-lake-anomaly-2005');
  });

  it('nie podstawia dawnych nagrań do przygotowanej teczki startera', () => {
    const plAudio = getBriefingAudio({ id: 'the-haunting', title: 'Nawiedzony Dom' }, { locale: 'pl' });
    expect(plAudio).toBeNull();

    const enAudio = getBriefingAudio({ id: 'the-haunting', title: 'The Haunting' }, { locale: 'en' });
    expect(enAudio).toBeNull();
  });

  it('zwraca null dla nieznanego scenariusza', () => {
    expect(getBriefingAudio({ id: 'custom-adventure-99', title: 'Tajemniczy dwór na wsi' })).toBeNull();
  });
});
