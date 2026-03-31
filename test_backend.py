"""
Quick backend smoke test — runs against http://localhost:8010 directly.
Usage:
    python test_backend.py
    python test_backend.py path/to/image.jpg
"""

import sys
import json
import urllib.request
import urllib.error

BASE = "http://localhost:8010"


def get(path):
    url = BASE + path
    print(f"\nGET {url}")
    try:
        with urllib.request.urlopen(url, timeout=10) as r:
            body = r.read().decode()
            print(f"  OK {r.status}")
            return json.loads(body)
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  FAIL HTTP {e.code}: {body[:500]}")
        return None
    except Exception as e:
        print(f"  FAIL Connection error: {e}")
        return None


def post_file(path, file_path, bank_type=None):
    import mimetypes, uuid, os

    url = BASE + path
    if bank_type:
        url += f"?bank_type={bank_type}"
    print(f"\nPOST {url}  (file={file_path})")

    boundary = uuid.uuid4().hex
    filename = os.path.basename(file_path)
    mime = mimetypes.guess_type(filename)[0] or "application/octet-stream"

    with open(file_path, "rb") as f:
        file_data = f.read()

    body = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="files"; filename="{filename}"\r\n'
        f"Content-Type: {mime}\r\n\r\n"
    ).encode() + file_data + f"\r\n--{boundary}--\r\n".encode()

    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": f"multipart/form-data; boundary={boundary}"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            resp = json.loads(r.read().decode())
            print(f"  OK {r.status}: {resp}")
            return resp
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        print(f"  FAIL HTTP {e.code}: {body[:1000]}")
        return None
    except Exception as e:
        print(f"  FAIL {e}")
        return None


# -- 1. Health check --
print("=" * 60)
print("1. Health check")
health = get("/api/v1/ocr/health")
if health is None:
    print("\nBackend is not reachable at", BASE)
    print("Make sure uvicorn is running on port 8010.")
    sys.exit(1)
print("  ", health)

# -- 2. Upload test file --
image_path = sys.argv[1] if len(sys.argv) > 1 else None

if image_path is None:
    print("\n" + "=" * 60)
    print("2. No file provided -- skipping upload test")
    print("   Run:  python test_backend.py path/to/receipt.jpg")
else:
    print("\n" + "=" * 60)
    print("2. Upload file:", image_path)
    upload = post_file("/api/v1/ocr/extract", image_path, bank_type="BBL")

    if upload and upload.get("task_ids"):
        task_id = upload["task_ids"][0]

        print("\n" + "=" * 60)
        print(f"3. GET /tasks/{task_id}")
        task = get(f"/api/v1/ocr/tasks/{task_id}")
        if task:
            print(json.dumps(task, indent=2, ensure_ascii=False)[:2000])
