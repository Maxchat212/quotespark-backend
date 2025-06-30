const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Load Firebase credentials from environment variable
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// ✅ Flutterwave secret hash (set in Render secrets)
const FLW_SECRET = process.env.FLW_SECRET;

// ✅ Flutterwave Webhook Endpoint
app.post('/flutterwave-webhook', async (req, res) => {
  const signature = req.headers['verif-hash'];

  if (!signature || signature !== FLW_SECRET) {
    console.log('❌ Invalid Flutterwave signature');
    return res.status(401).send('Invalid signature');
  }

  const payload = req.body;

  if (payload.event === 'charge.completed' && payload.data.status === 'successful') {
    const data = payload.data;
    const amount = parseInt(data.amount);
    const txRef = data.tx_ref;
    const uid = data.meta?.uid;

    if (!uid) {
      console.log('❌ UID missing in metadata');
      return res.status(400).send('Missing user ID');
    }

    const coins = Math.floor(amount / 15); // Example: ₦15 = 1 coin

    try {
      const userRef = db.collection('users').doc(uid);

      await userRef.update({
        'wallet.balance': admin.firestore.FieldValue.increment(coins),
        'wallet.totalReceived': admin.firestore.FieldValue.increment(coins),
      });

      console.log(`✅ Wallet updated for UID: ${uid}, +${coins} coins`);
      return res.status(200).send('Wallet credited');
    } catch (err) {
      console.error('🔥 Error updating wallet:', err);
      return res.status(500).send('Error updating wallet');
    }
  }

  res.status(400).send('Payment not successful');
});

// ✅ Test Route (Optional)
app.get('/', (req, res) => {
  res.send('QuoteSpark Flutterwave backend is live 🚀');
});

// ✅ Start server (Render will use this)
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`✅ Server running on http://localhost:${PORT}`);
});

