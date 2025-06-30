const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Initialize Firebase Admin SDK
 const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);
// 🔐 You will create this file later

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 🚀 Webhook endpoint
app.post('/flutterwave-webhook', async (req, res) => {
  const payload = req.body;

  // ✅ Validate status is successful
  if (payload.status === 'successful') {
    const amount = parseInt(payload.amount); // amount in Naira
    const txRef = payload.tx_ref;
    const uid = payload.meta?.uid; // We’ll send uid in the payment later

    if (!uid) return res.status(400).send('Missing user ID');

    const coins = Math.floor(amount / 15); // Example conversion rate (₦15 per coin)

    const userRef = db.collection('users').doc(uid);

    await userRef.update({
      'wallet.balance': admin.firestore.FieldValue.increment(coins),
      'wallet.totalReceived': admin.firestore.FieldValue.increment(coins),
    });

    console.log(`✅ Wallet credited for UID: ${uid}`);
    return res.status(200).send('Payment verified and wallet updated');
  }

  res.status(400).send('Payment not successful');
});

// ✅ Start server locally (for testing)
app.listen(5000, () => {
  console.log('Server running on http://localhost:5000');
});
