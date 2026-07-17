// Firebase初期化。apiKey等は非公開情報ではない（アクセス制御はFirestoreのセキュリティルール側で行う）ためハードコードで問題ない
import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: 'AIzaSyBEwK7hL25ed8sUHLJihE8m35LqyKUhYms',
  authDomain: 'stone-push-web.firebaseapp.com',
  projectId: 'stone-push-web',
  storageBucket: 'stone-push-web.firebasestorage.app',
  messagingSenderId: '320592322344',
  appId: '1:320592322344:web:5272dd89927cbeb5b53a1d',
}

const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
