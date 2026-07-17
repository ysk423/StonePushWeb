import { initializeApp } from 'firebase/app'
import { getFirestore, collection, getDocs } from 'firebase/firestore'

const app = initializeApp({
  apiKey: 'AIzaSyBEwK7hL25ed8sUHLJihE8m35LqyKUhYms',
  authDomain: 'stone-push-web.firebaseapp.com',
  projectId: 'stone-push-web',
  storageBucket: 'stone-push-web.firebasestorage.app',
  messagingSenderId: '320592322344',
  appId: '1:320592322344:web:5272dd89927cbeb5b53a1d',
})
const db = getFirestore(app)

const snapshot = await getDocs(collection(db, 'records'))
console.log(`total records: ${snapshot.size}`)
snapshot.forEach((doc) => {
  console.log(doc.id, JSON.stringify(doc.data()))
})
process.exit(0)
