// Shared helpers for GreenPulse pages.
import { db } from '../firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Escape any user-controlled text before inserting it into HTML (prevents XSS).
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// A user is a moderator if a document admins/{uid} exists (created by hand in the Firebase Console).
export async function isAdmin(uid) {
  try {
    const snap = await getDoc(doc(db, 'admins', uid));
    return snap.exists();
  } catch {
    return false;
  }
}

// Resize and compress a photo in the browser so it fits comfortably inside a
// Firestore document (hard limit: 1 MiB). Returns a JPEG data URL.
export async function compressImage(file, maxSide = 1024, maxChars = 700000) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();

  let quality = 0.75;
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  while (dataUrl.length > maxChars && quality > 0.35) {
    quality -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', quality);
  }
  if (dataUrl.length > maxChars) throw new Error('IMAGE_TOO_LARGE');
  return dataUrl;
}

// Best-effort neighbourhood name from coordinates (OpenStreetMap Nominatim).
// Returns null on any failure: the report is still saved without it.
export async function getQuartier(lat, lng) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4000);
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=16&accept-language=fr`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const a = (await res.json()).address || {};
    const name = a.suburb || a.neighbourhood || a.quarter || a.city_district || a.village || a.town || a.city;
    return name ? String(name).slice(0, 60) : null;
  } catch {
    return null;
  }
}

export const STATUS_LABELS = {
  en_attente: 'En attente',
  en_cours: 'En cours',
  'résolu': 'Résolu'
};

export function formatDateTime(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('fr-FR', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
}
