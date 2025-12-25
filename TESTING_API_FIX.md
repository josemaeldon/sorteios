# Testing the 405 API Error Fix

This document describes how to test the fix for the 405 "Method Not Allowed" error.

## Problem Description

The issue occurred when:
- Frontend tries to POST to `/api` endpoint
- Nginx returns 405 because it only serves static files
- Database configuration fails with "Failed to check database config"

## Solution Implemented

1. Added nginx proxy configuration for `/api` and `/health` endpoints
2. Fixed environment variable names (DB_* instead of POSTGRES_*)
3. Updated docker-compose configurations

## Testing the Fix

### Prerequisites

- Docker and Docker Compose installed
- At least 2GB RAM available
- Ports 80, 3001, and 5432 available

### Test 1: Docker Compose (Recommended)

1. **Start the stack:**
   ```bash
   cd deploy
   docker compose -f docker-compose.postgres-only.yml up --build
   ```

2. **Wait for services to be healthy:**
   ```bash
   docker compose -f docker-compose.postgres-only.yml ps
   ```
   All services should show "healthy" or "running"

3. **Access the application:**
   - Open browser to `http://localhost`
   - You should see the database configuration screen (not a 405 error)

4. **Configure the database:**
   - Type: PostgreSQL
   - Host: postgres
   - Port: 5432
   - Database: bingo
   - User: bingo
   - Password: bingo123

5. **Click "Test Connection":**
   - Should show "Connection successful" message
   - Should NOT show 405 error in browser console

6. **Complete setup:**
   - Click "Continue" to initialize database
   - Create admin user
   - Should redirect to login screen

7. **Clean up:**
   ```bash
   docker compose -f docker-compose.postgres-only.yml down -v
   ```

### Test 2: Direct API Test

With the stack running from Test 1:

```bash
# Test health endpoint (should return 200 OK)
curl -X GET http://localhost/health

# Test API endpoint (should return JSON, not 405)
curl -X POST http://localhost/api \
  -H "Content-Type: application/json" \
  -d '{"action":"checkDbConfig"}'
```

Expected responses:
- `/health` should return "OK"
- `/api` should return JSON like `{"configured":false}` or similar (not 405 error)

### Test 3: Browser Console Check

1. Open browser DevTools (F12)
2. Go to Network tab
3. Access `http://localhost`
4. Look for `/api` requests

**Before the fix:**
- Status: 405 Method Not Allowed
- Error: "Failed to load resource"

**After the fix:**
- Status: 200 OK
- Response: Valid JSON data

## Expected Results

✅ **Success Indicators:**
- No 405 errors in browser console
- API requests return 200 status
- Database configuration screen loads properly
- "Test Connection" button works
- Database initialization completes successfully

❌ **Failure Indicators:**
- 405 errors in console
- "Failed to check database config" errors
- API requests fail with CORS or proxy errors
- Cannot complete database setup

## Troubleshooting

### Backend not accessible

Check if backend is running:
```bash
docker compose logs backend
docker exec -it deploy-backend-1 curl http://localhost:3001/health
```

### Nginx not proxying

Check nginx config:
```bash
docker exec -it deploy-app-1 cat /etc/nginx/conf.d/default.conf
```

Should contain `location /api` block with `proxy_pass` directive.

### Database connection issues

Check database is running:
```bash
docker compose exec postgres pg_isready -U bingo
```

## Additional Notes

- The fix works for deployments where frontend and backend are in the same Docker network
- For production deployments with separate domains, use `VITE_API_BASE_URL` instead
- The nginx proxy uses Docker's internal DNS resolver (127.0.0.11)
