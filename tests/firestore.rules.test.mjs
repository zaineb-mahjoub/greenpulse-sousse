// Security-rules tests for GreenPulse, run against the local Firestore emulator.
// Run with: npm run test:rules
import { readFileSync } from 'node:fs';
import { before, after, beforeEach, describe, test } from 'node:test';
import {
  initializeTestEnvironment, assertSucceeds, assertFails
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, writeBatch, arrayUnion }
  from 'firebase/firestore';

let env;
const ALICE = 'alice';
const BOB = 'bob';
const MOD = 'moderator';
const NOW = '2026-10-23T10:00:00.000Z';
const SMALL_PHOTO = 'data:image/jpeg;base64,' + 'A'.repeat(1000);

const validReport = (uid) => ({
  latitude: 35.8245, longitude: 10.6346, userId: uid,
  timestamp: NOW, statut: 'en_attente', ville: 'Sousse', quartier: 'Médina', hasPhoto: true
});

const db = (uid) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore();

// Seed data with rules disabled.
async function seed(fn) {
  await env.withSecurityRulesDisabled(async (ctx) => fn(ctx.firestore()));
}

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-greenpulse',
    firestore: { rules: readFileSync('firestore.rules', 'utf8') }
  });
});

after(async () => { await env.cleanup(); });

beforeEach(async () => {
  await env.clearFirestore();
  await seed(async (fs) => {
    await setDoc(doc(fs, 'admins', MOD), { role: 'moderator' });
    await setDoc(doc(fs, 'users', ALICE), { prenom: 'Alice', nom: 'A', email: 'alice@example.com', createdAt: NOW });
    await setDoc(doc(fs, 'users', BOB), { prenom: 'Bob', nom: 'B', email: 'bob@example.com', createdAt: NOW });
    await setDoc(doc(fs, 'reports', 'r1'), validReport(ALICE));
    await setDoc(doc(fs, 'reportPhotos', 'r1'), { userId: ALICE, photo: SMALL_PHOTO, createdAt: NOW });
    await setDoc(doc(fs, 'campaigns', 'open'), { nom: 'Plage', statut: 'ouvert', participants: [], maxParticipants: 2 });
    await setDoc(doc(fs, 'campaigns', 'full'), { nom: 'Pleine', statut: 'ouvert', participants: ['x', 'y'], maxParticipants: 2 });
    await setDoc(doc(fs, 'campaigns', 'done'), { nom: 'Médina', statut: 'termine', participants: [], participantsHorsLigne: 25 });
  });
});

describe('user profiles (personal data)', () => {
  test('a user can read their own profile', async () => {
    await assertSucceeds(getDoc(doc(db(ALICE), 'users', ALICE)));
  });
  test("a user cannot read someone else's profile", async () => {
    await assertFails(getDoc(doc(db(ALICE), 'users', BOB)));
  });
  test('nobody can list all users', async () => {
    await assertFails(getDocs(collection(db(ALICE), 'users')));
  });
  test('visitors who are not signed in cannot read profiles', async () => {
    await assertFails(getDoc(doc(db(null), 'users', ALICE)));
  });
  test('a user cannot add unexpected fields to their profile', async () => {
    await assertFails(updateDoc(doc(db(ALICE), 'users', ALICE), { role: 'admin' }));
  });
    test("a user cannot rename someone else's profile", async () => {
    await assertFails(updateDoc(doc(db(BOB), 'users', ALICE), { prenom: 'Hacked' }));
  });
});

describe('reports', () => {
  test('a signed-in user can create a valid report with its photo', async () => {
    const fs = db(BOB);
    const batch = writeBatch(fs);
    batch.set(doc(fs, 'reports', 'r2'), validReport(BOB));
    batch.set(doc(fs, 'reportPhotos', 'r2'), { userId: BOB, photo: SMALL_PHOTO, createdAt: NOW });
    await assertSucceeds(batch.commit());
  });
  test('a user cannot create a report in the name of someone else', async () => {
    await assertFails(setDoc(doc(db(BOB), 'reports', 'r3'), validReport(ALICE)));
  });
  test('a user cannot create a report that is already resolved', async () => {
    await assertFails(setDoc(doc(db(BOB), 'reports', 'r4'), { ...validReport(BOB), statut: 'résolu' }));
  });
  test('a report outside Tunisia is rejected', async () => {
    await assertFails(setDoc(doc(db(BOB), 'reports', 'r5'), { ...validReport(BOB), latitude: 48.85 }));
  });
  test('a citizen cannot change the status of a report', async () => {
    await assertFails(updateDoc(doc(db(ALICE), 'reports', 'r1'), { statut: 'résolu', updatedAt: NOW }));
  });
  test('a moderator can change the status of a report', async () => {
    await assertSucceeds(updateDoc(doc(db(MOD), 'reports', 'r1'), { statut: 'en_cours', updatedAt: NOW }));
  });
  test("a report cannot include the reporter's name (privacy)", async () => {
    await assertFails(setDoc(doc(db(BOB), 'reports', 'r7'), { ...validReport(BOB), userPrenom: 'Bob' }));
  });
  test('a moderator can link a report to the campaign created from it', async () => {
    await assertSucceeds(updateDoc(doc(db(MOD), 'reports', 'r1'),
      { statut: 'en_cours', campaignId: 'c123', updatedAt: NOW }));
  });
  test('a citizen cannot delete a report', async () => {
    await assertFails(deleteDoc(doc(db(ALICE), 'reports', 'r1')));
  });
  test('a moderator can delete a report and its photo', async () => {
    const fs = db(MOD);
    const batch = writeBatch(fs);
    batch.delete(doc(fs, 'reports', 'r1'));
    batch.delete(doc(fs, 'reportPhotos', 'r1'));
    await assertSucceeds(batch.commit());
  });
  test('a moderator cannot set an invalid status', async () => {
    await assertFails(updateDoc(doc(db(MOD), 'reports', 'r1'), { statut: 'supprimé', updatedAt: NOW }));
  });
});

describe('report photos', () => {
  test('even the author cannot read photos back (only moderators can)', async () => {
    await assertFails(getDoc(doc(db(ALICE), 'reportPhotos', 'r1')));
  });
  test("another citizen cannot read someone else's photo", async () => {
    await assertFails(getDoc(doc(db(BOB), 'reportPhotos', 'r1')));
  });
  test('a moderator can read any photo', async () => {
    await assertSucceeds(getDoc(doc(db(MOD), 'reportPhotos', 'r1')));
  });
  test('a photo that is not a JPEG data URL is rejected', async () => {
    await assertFails(setDoc(doc(db(BOB), 'reportPhotos', 'r6'),
      { userId: BOB, photo: 'https://evil.example/x.png', createdAt: NOW }));
  });
});

describe('campaigns', () => {
  test('a user can join an open campaign', async () => {
    await assertSucceeds(updateDoc(doc(db(ALICE), 'campaigns', 'open'), { participants: arrayUnion(ALICE) }));
  });
  test('a user cannot join a full campaign', async () => {
    await assertFails(updateDoc(doc(db(ALICE), 'campaigns', 'full'), { participants: arrayUnion(ALICE) }));
  });
  test('a user cannot join a finished campaign', async () => {
    await assertFails(updateDoc(doc(db(ALICE), 'campaigns', 'done'), { participants: arrayUnion(ALICE) }));
  });
  test('a user cannot add someone else to a campaign', async () => {
    await assertFails(updateDoc(doc(db(ALICE), 'campaigns', 'open'), { participants: arrayUnion(BOB) }));
  });
  test('a citizen cannot create a campaign', async () => {
    await assertFails(setDoc(doc(db(ALICE), 'campaigns', 'fake'), { nom: 'Fake', statut: 'ouvert', participants: [] }));
  });
  test('a moderator can create a campaign', async () => {
    await assertSucceeds(setDoc(doc(db(MOD), 'campaigns', 'new'), { nom: 'Nouvelle', statut: 'ouvert', participants: [] }));
  });
  test('a moderator can delete a campaign', async () => {
    await assertSucceeds(deleteDoc(doc(db(MOD), 'campaigns', 'open')));
  });
  test('a citizen cannot delete a campaign', async () => {
    await assertFails(deleteDoc(doc(db(ALICE), 'campaigns', 'open')));
  });
  test('a visitor who is not logged in cannot read campaigns', async () => {
    await assertFails(getDoc(doc(db(null), 'campaigns', 'open')));
  });
});

describe('moderators list', () => {
  test('a user can check only their own moderator status', async () => {
    await assertSucceeds(getDoc(doc(db(MOD), 'admins', MOD)));
    await assertFails(getDoc(doc(db(ALICE), 'admins', MOD)));
  });
  test('nobody can make themselves a moderator', async () => {
    await assertFails(setDoc(doc(db(ALICE), 'admins', ALICE), { role: 'moderator' }));
  });
});
