import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { GoogleGenAI } from "@google/genai";

admin.initializeApp();
const db = admin.firestore();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

/**
 * Triggered when a new file is uploaded to Firebase Storage.
 * Parses the file (Obsidian/Telegram) and extracts signals using Gemini.
 */
export const processUploadedFile = functions.storage.object().onFinalize(async (object) => {
  const filePath = object.name;
  if (!filePath || !filePath.startsWith('uploads/')) return;

  const bucket = admin.storage().bucket(object.bucket);
  const file = bucket.file(filePath);
  const [content] = await file.download();
  const text = content.toString('utf-8');

  // Extract metadata from path
  const pathParts = filePath.split('/');
  const userId = pathParts[1];
  const fileName = pathParts[2];

  console.log(`Processing file ${fileName} for user ${userId}`);

  try {
    // 1. Extract Signals using Gemini
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Extract key speculative signals, anomalies, or trends from the following text. 
      Return a JSON array of objects with fields: title, summary, source, tags (array), score (0-1).
      Text: ${text.substring(0, 10000)}`, // Limit for safety
      config: {
        responseMimeType: "application/json"
      }
    });

    const signals = JSON.parse(response.text || '[]');

    // 2. Update Knowledge Graph (Firestore)
    const batch = db.batch();
    
    for (const signal of signals) {
      const signalRef = db.collection('signals').doc();
      batch.set(signalRef, {
        ...signal,
        authorUid: userId,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        processedFrom: fileName,
        status: 'extracted'
      });
    }

    // 3. Update System State (Simulation of impact)
    const stateRef = db.collection('systemState').doc('global');
    batch.update(stateRef, {
      attentionSpike: admin.firestore.FieldValue.increment(0.01),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();
    console.log(`Successfully processed ${signals.length} signals from ${fileName}`);

    // 4. Cleanup (Optional: move to processed folder or delete)
    // await file.delete();

  } catch (error) {
    console.error(`Error processing ${fileName}:`, error);
  }
});
