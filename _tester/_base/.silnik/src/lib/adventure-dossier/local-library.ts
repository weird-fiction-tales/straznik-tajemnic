import type { PreparedDossierPack } from './client-activation';

const DB_NAME = 'straznik-local-dossiers';
const STORE = 'editions';
const ASSETS = 'handout-images';

export interface LocalDossierImage { recordId: string; image: Blob; title: string; width: number; height: number }

async function openLibrary(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 2);
    request.onupgradeneeded = () => {
      for (const store of [STORE, ASSETS]) {
        if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('DOSSIER_LOCAL_STORAGE_UNAVAILABLE'));
    request.onblocked = () => reject(new Error('DOSSIER_LOCAL_STORAGE_BLOCKED'));
  });
}

function key(adventureId: string, fingerprint: string) { return `${adventureId}\0${fingerprint}`; }

/** Only the purchased PDF and ciphertext are persisted; no plaintext GM records in localStorage. */
export async function saveLocalDossier(prepared: PreparedDossierPack, images: LocalDossierImage[] = []): Promise<void> {
  const db = await openLibrary();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE, ASSETS], 'readwrite');
      tx.objectStore(STORE).put({ ...prepared, key: key(prepared.adventureId, prepared.expectedFingerprint) });
      for (const image of images) tx.objectStore(ASSETS).put({ ...image,
        key: `${key(prepared.adventureId, prepared.expectedFingerprint)}\0${image.recordId}` });
      tx.oncomplete = () => resolve();
      tx.onabort = tx.onerror = () => reject(new Error('DOSSIER_LOCAL_STORAGE_FAILED'));
    });
  } finally { db.close(); }
}

/** Called only by the local renderer; these bytes must never be put in messages or adventureContext. */
export async function loadLocalDossierImage(adventureId: string, fingerprint: string, recordId: string): Promise<LocalDossierImage | null> {
  const db = await openLibrary();
  try {
    return await new Promise((resolve, reject) => {
      const request = db.transaction(ASSETS, 'readonly').objectStore(ASSETS).get(`${key(adventureId, fingerprint)}\0${recordId}`);
      request.onsuccess = () => resolve(request.result?.image instanceof Blob ? request.result : null);
      request.onerror = () => reject(new Error('DOSSIER_LOCAL_STORAGE_FAILED'));
    });
  } finally { db.close(); }
}

export async function loadLocalDossier(adventureId: string, fingerprint: string): Promise<PreparedDossierPack | null> {
  const db = await openLibrary();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const request = tx.objectStore(STORE).get(key(adventureId, fingerprint));
      request.onsuccess = () => {
        const value = request.result;
        resolve(value?.adventureId === adventureId && value.expectedFingerprint === fingerprint &&
          value.sourcePdf instanceof Blob && value.encryptedPack instanceof Blob ? value : null);
      };
      request.onerror = () => reject(new Error('DOSSIER_LOCAL_STORAGE_FAILED'));
    });
  } finally { db.close(); }
}
