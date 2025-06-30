const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const admin = require('firebase-admin');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Load Firebase service account from environment variable
const serviceAccount = JSON.parse(process.env.FIREBASE_KEY);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// 🔐 Flutterwave secret hash and secret key from environment
const FLW_SECRET = process.env.FLW_SECRET;

// ✅ Create Flutterwave payment link
app.post('/create-payment-link', async (req, res) => {
  const { amount, email, uid } = req.body;

  if (!amount || !email || !uid) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    const response = await axios.post(
      'https://api.flutterwave.com/v3/payments',
      {
        tx_ref: `QS-${Date.now()}`,
        amount,
        currency: 'NGN',
        redirect_url: 'https://google.com', // Change later
        customer: { email },
        meta: { uid },
        customizations: {
          title: 'QuoteSpark Wallet Top-up',
          description: `Buying coins worth ₦${amount}`,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${FLW_SECRET}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const paymentLink = response.data.data.link;
    return res.json({ link: paymentLink });
  } catch (error) {
    console.error('❌ Flutterwave error:', error.response?.data || error.message);
    return res.status(500).json({ error: 'Failed to create payment link' });
  }
});

// ✅ Flutterwave webhook to credit wallet
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

    if (!uid) return res.status(400).send('Missing user ID');

    const coins = Math.floor(amount / 15); // Conversion logic

    const userRef = db.collection('users').doc(uid);

    await userRef.update({
      'wallet.balance': admin.firestore.FieldValue.increment(coins),
      'wallet.totalReceived': admin.firestore.FieldValue.increment(coins),
    });

    console.log(`✅ Wallet credited: UID=${uid}, Coins=${coins}`);
    return res.status(200).send('Wallet updated');
  }

  res.status(400).send('Payment not completed');
});

// ✅ Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

