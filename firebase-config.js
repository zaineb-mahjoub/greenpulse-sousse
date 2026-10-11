import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";

// REPLACE THESE WITH YOUR FIREBASE PROJECT CONFIG
// Go to: Firebase Console → Project Settings → Your apps → SDK setup
const firebaseConfig = {
  apiKey: "AIzaSyDWe0w-hu2wXrCvO-6ez70mbpRzi16Mwow",
  authDomain: "greenpulse-sousse.firebaseapp.com",
  projectId: "greenpulse-sousse",
  storageBucket: "greenpulse-sousse.firebasestorage.app",
  messagingSenderId: "932782232152",
  appId: "1:932782232152:web:e911fc8c40c9d7d220702d"
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
