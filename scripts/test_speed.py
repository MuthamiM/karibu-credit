import asyncio
import time
import httpx

async def test():
    # Login to get token
    async with httpx.AsyncClient() as client:
        # Get token
        login_resp = await client.post(
            "http://127.0.0.1:8000/api/v1/auth/login",
            data={"username": "admin@karibucredit.co.ke", "password": "SuperSecret123!"}
        )
        token = login_resp.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        
        start = time.time()
        loans_resp = await client.get("http://127.0.0.1:8000/api/v1/loans/", headers=headers, timeout=60.0)
        end = time.time()
        
        loans = loans_resp.json()
        print(f"Loaded {len(loans)} loans in {end - start:.4f} seconds!")

if __name__ == "__main__":
    asyncio.run(test())
