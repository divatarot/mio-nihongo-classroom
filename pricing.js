import { firebaseConfig } from './student-config.js';

// Keep the published HTML as the fallback if Firebase is unavailable.
try {
  const [{ initializeApp }, { getFirestore, getDoc, doc }] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js')
  ]);
  const db = getFirestore(initializeApp(firebaseConfig));
  const snapshot = await getDoc(doc(db, 'publicPlans', 'pricing'));
  if (snapshot.exists() && Array.isArray(snapshot.data().cards)) {
    snapshot.data().cards.slice(0, 6).forEach((card, index) => {
      const root = document.querySelector(`[data-plan-card="${index}"]`);
      if (!root || !card) return;
      for (const [selector, field] of [['h3', 'title'], ['small', 'subtitle'], ['.price', 'price'], ['.package', 'description']]) {
        if (typeof card[field] === 'string') root.querySelector(selector).textContent = card[field];
      }
    });
  }
} catch { /* The static published price cards stay visible. */ }
