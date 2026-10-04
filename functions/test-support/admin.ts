// Riesporta firebase-admin dalla copia installata in functions/, quella usata dal codice delle Functions.
// Serve ai test (tests/functions): FieldValue e Timestamp devono venire dalla stessa copia del database.
// Non fa parte del codice pubblicato (vedi "ignore" in firebase.json).
export { getApps, initializeApp } from 'firebase-admin/app';
export { FieldValue, getFirestore, Timestamp, type Firestore } from 'firebase-admin/firestore';
export { HttpsError } from 'firebase-functions/v2/https';
