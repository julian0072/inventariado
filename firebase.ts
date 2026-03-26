
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDbq6Y0RupXeNa85R-4Mane3RKSC-vGkI8",
  authDomain: "itinventario.firebaseapp.com",
  projectId: "itinventario",
  storageBucket: "itinventario.firebasestorage.app",
  messagingSenderId: "249039800998",
  appId: "1:249039800998:web:4a11d8eab5a2edcb120267",
  measurementId: "G-G6VD7EYB84"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const db = getFirestore(app);
const auth = getAuth(app);

export { app, analytics, db, auth };
