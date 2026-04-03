import sqlite3
import os

DB_FILE = 'ocr_database.db'

def check_db():
    if not os.path.exists(DB_FILE):
        print(f"Database file '{DB_FILE}' not found.")
        return

    conn = sqlite3.connect(DB_FILE)
    cursor = conn.cursor()
    
    print("Checking tables...")
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
    tables = cursor.fetchall()
    print(f"Tables found: {tables}")
    
    if ('mapping_history',) in tables:
        print("\nContent of mapping_history:")
        cursor.execute("SELECT * FROM mapping_history")
        rows = cursor.fetchall()
        for r in rows:
            print(r)
    else:
        print("\nTable 'mapping_history' NOT FOUND.")
    
    conn.close()

if __name__ == "__main__":
    check_db()
