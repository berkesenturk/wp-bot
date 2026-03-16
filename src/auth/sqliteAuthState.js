import { BufferJSON, initAuthCreds } from "@whiskeysockets/baileys";
import { getDb } from "../db/index.js";

export async function useSQLiteAuthState() {
  const db = getDb();

  // Create table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS auth_state (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const writeData = (data, key) => {
    db.prepare("INSERT OR REPLACE INTO auth_state (key, value) VALUES (?, ?)")
      .run(key, JSON.stringify(data, BufferJSON.replacer));
  };

  const readData = (key) => {
    const row = db.prepare("SELECT value FROM auth_state WHERE key = ?").get(key);
    if (!row) return null;
    return JSON.parse(row.value, BufferJSON.reviver);
  };

  const removeData = (key) => {
    db.prepare("DELETE FROM auth_state WHERE key = ?").run(key);
  };

  // Load or create credentials
  const creds = readData("creds") ?? initAuthCreds();

  return {
    state: {
      creds,
      keys: {
        get: (type, ids) => {
          const data = {};
          for (const id of ids) {
            const val = readData(type + "-" + id);
            if (val) data[id] = val;
          }
          return data;
        },
        set: (data) => {
          for (const [type, ids] of Object.entries(data)) {
            for (const [id, value] of Object.entries(ids)) {
              if (value) {
                writeData(value, type + "-" + id);
              } else {
                removeData(type + "-" + id);
              }
            }
          }
        },
      },
    },
    saveCreds: () => writeData(creds, "creds"),
  };
}