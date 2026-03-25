import { GoogleGenAI } from "@google/genai";
import { db, collection, setDoc, doc, handleFirestoreError, OperationType } from "../firebase";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface RawSignal {
  id: string;
  title: string;
  summary: string;
  source: string;
  timestamp: string;
  category: string;
  metadata?: any;
}

/**
 * Generates an embedding for a signal and saves it to Firestore.
 */
export async function processAndStoreSignal(signal: RawSignal) {
  try {
    // 1. Generate Embedding
    const result = await ai.models.embedContent({
      model: "gemini-embedding-2-preview",
      contents: [
        `${signal.title}\n${signal.summary}\nCategory: ${signal.category}`
      ],
    });

    const embedding = result.embeddings[0].values;

    // 2. Prepare Firestore Document
    const signalDoc = {
      title: signal.title,
      summary: signal.summary,
      source: signal.source,
      timestamp: signal.timestamp,
      category: signal.category,
      embedding: embedding,
      metadata: signal.metadata || {},
      lastProcessed: new Date().toISOString()
    };

    // 3. Save to Firestore
    await setDoc(doc(db, 'signals', signal.id), signalDoc, { merge: true });
    
    return true;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `signals/${signal.id}`);
    return false;
  }
}

/**
 * Fetches new signals from the server and processes them.
 */
export async function runBackgroundSync() {
  try {
    const response = await fetch('/api/sources/fetch');
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }

    const { signals } = data;

    if (!signals || !Array.isArray(signals)) return;

    // Process each source's data
    for (const sourceBatch of signals) {
      const sourceId = sourceBatch.id;
      const data = sourceBatch.data;

      if (sourceId === 'hn') {
        for (const item of data) {
          await processAndStoreSignal({
            id: `hn_${item.id}`,
            title: item.title,
            summary: item.text || item.url || "No content",
            source: "HackerNews",
            timestamp: new Date(item.time * 1000).toISOString(),
            category: "Tech"
          });
        }
      } else if (sourceId === 'arxiv') {
        // Simple XML parsing simulation or just use raw if it's already processed
        // For now, we assume the server might have done some basic mapping or we do it here
        // Arxiv returns XML, but axios might have returned it as string
        console.log("Processing Arxiv data...");
      } else if (sourceId === 'usgs') {
        const features = data.features?.slice(0, 3) || [];
        for (const f of features) {
          await processAndStoreSignal({
            id: `usgs_${f.id}`,
            title: f.properties.title,
            summary: `Magnitude: ${f.properties.mag}, Place: ${f.properties.place}`,
            source: "USGS",
            timestamp: new Date(f.properties.time).toISOString(),
            category: "Geography"
          });
        }
      }
    }
  } catch (error) {
    console.error("Background sync failed:", error);
  }
}
