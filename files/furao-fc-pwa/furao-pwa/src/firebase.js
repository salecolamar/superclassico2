import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyBi7n2Dz8kBLQJTQCJ_yaEFOtvyVBqYecM',
  authDomain: 'app-futebol-f5bf7.firebaseapp.com',
  projectId: 'app-futebol-f5bf7',
  storageBucket: 'app-futebol-f5bf7.firebasestorage.app',
  messagingSenderId: '321966479159',
  appId: '1:321966479159:web:3cd44118adef11b3622cb2',
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
