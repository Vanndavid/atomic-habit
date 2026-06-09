import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyB07_OmOSBY_WN2aVMEJ5sy2lyhKzBTbw0",
  authDomain: "aistudionew.firebaseapp.com",
  projectId: "aistudionew",
  storageBucket: "aistudionew.firebasestorage.app",
  messagingSenderId: "128903621857",
  appId: "1:128903621857:web:36b9198a6a37f3d2a5dba0"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const signInWithGoogle = async () => {
  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Error signing in with Google", error);
    throw error;
  }
};

export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
  } catch (error) {
    console.error("Error signing out", error);
    throw error;
  }
};
