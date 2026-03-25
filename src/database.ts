import { Surreal } from 'surrealdb';

// Configuration from environment variables
// In development (Vite), we use import.meta.env
// In production (Node), we use process.env
const SURREAL_URL = import.meta.env.VITE_SURREAL_URL || 'http://localhost:8000/rpc';
const SURREAL_USER = import.meta.env.VITE_SURREAL_USER || 'root';
const SURREAL_PASS = import.meta.env.VITE_SURREAL_PASS || 'root';
const SURREAL_NS = import.meta.env.VITE_SURREAL_NS || 'antilibrary';
const SURREAL_DB = import.meta.env.VITE_SURREAL_DB || 'antilibrary';

class DatabaseService {
  private db: Surreal;
  private isConnected: boolean = false;

  constructor() {
    this.db = new Surreal();
  }

  async connect() {
    if (this.isConnected) return;
    try {
      await this.db.connect(SURREAL_URL);
      await this.db.signin({
        username: SURREAL_USER,
        password: SURREAL_PASS,
      });
      await this.db.use({ namespace: SURREAL_NS, database: SURREAL_DB });
      this.isConnected = true;
      console.log('Connected to SurrealDB');
    } catch (err) {
      console.error('Failed to connect to SurrealDB:', err);
      throw err;
    }
  }

  async getTheories(limit: number = 50, status?: string[]) {
    await this.connect();
    let query = 'SELECT * FROM theories';
    if (status && status.length > 0) {
      const statusList = status.map(s => `'${s}'`).join(', ');
      query += ` WHERE status IN [${statusList}]`;
    }
    query += ` ORDER BY lastUpdated DESC LIMIT ${limit}`;
    
    const result = await this.db.query(query);
    return (result[0] as any) || [];
  }

  async saveTheory(theory: any) {
    await this.connect();
    // In SurrealDB, we use 'upsert' or 'create'
    // We use the theory ID as the record ID
    const id = `theories:${theory.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    return await this.db.upsert({
      id,
      ...theory,
      lastUpdated: Date.now()
    });
  }

  async saveSignal(signal: any) {
    await this.connect();
    const id = `signals:${signal.id.replace(/[^a-zA-Z0-9_]/g, '_')}`;
    return await this.db.upsert({
      id,
      ...signal,
      lastProcessed: new Date().toISOString()
    });
  }

  async getCount() {
    await this.connect();
    const result = await this.db.query('SELECT count() FROM theories GROUP ALL');
    const data = result[0] as any;
    return data?.[0]?.count || 0;
  }

  // Real-time subscription
  async subscribeTheories(callback: (theories: any[]) => void) {
    await this.connect();
    // SurrealDB Live Queries
    const query = 'LIVE SELECT * FROM theories';
    const res = await this.db.query(query);
    const queryId = res[0] as string;

    // This is a simplified version, real implementation might need more event handling
    // For now, we'll just return the initial data and then the user can poll or we use a more complex live setup
    const initial = await this.getTheories();
    callback(initial);

    // Note: SurrealDB JS SDK handles live updates via events
    // For this prototype, we'll implement a basic live listener if supported by the version
    return async () => {
      await this.db.query(`KILL '${queryId}'`);
    };
  }
}

export const database = new DatabaseService();
