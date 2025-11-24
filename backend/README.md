# ObservAI Backend API

REST API server for ObservAI camera analytics platform. Handles database operations, user management, and data persistence.

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: PostgreSQL
- **ORM**: Prisma
- **Validation**: Zod
- **Authentication**: bcryptjs + JWT

## Setup

### 1. Install Dependencies

```bash
cd backend
npm install
```

### 2. Configure Environment

Create `.env` file from example:

```bash
cp .env.example .env
```

Edit `.env` and configure your database:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/observai?schema=public"
```

### 3. Set Up PostgreSQL Database

Install PostgreSQL (if not already installed):

```bash
# macOS
brew install postgresql@15
brew services start postgresql@15

# Create database
createdb observai
```

### 4. Run Database Migrations

```bash
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run migrations
```

### 5. Seed Database (Optional)

```bash
npm run db:seed
```

Creates test users:
- **Admin**: admin@observai.com / admin123
- **Manager**: manager@observai.com / manager123

### 6. Start Development Server

```bash
npm run dev
```

Server runs on `http://localhost:3001`

## Database Schema

### Tables

1. **users** - User accounts and authentication
2. **sessions** - User session management
3. **cameras** - Video source configurations
4. **zones** - Drawn zones on camera feeds
5. **analytics_logs** - Time-series analytics data
6. **zone_insights** - Zone occupancy alerts
7. **analytics_summaries** - Aggregated historical data

### Entity Relationships

```
User (1) ──> (N) Camera
User (1) ──> (N) Zone
Camera (1) ──> (N) Zone
Camera (1) ──> (N) AnalyticsLog
Zone (1) ──> (N) ZoneInsight
```

## API Endpoints

### Health Check
```
GET /health
```

### Users
```
GET    /api/users         - List all users
POST   /api/users         - Create new user
GET    /api/users/:id     - Get user by ID
```

### Cameras
```
GET    /api/cameras       - List all cameras
POST   /api/cameras       - Create new camera
GET    /api/cameras/:id   - Get camera by ID
PUT    /api/cameras/:id   - Update camera
DELETE /api/cameras/:id   - Delete camera
```

### Zones
```
GET    /api/zones/:cameraId     - Get zones for camera
POST   /api/zones               - Create new zone
PUT    /api/zones/:id           - Update zone
DELETE /api/zones/:id           - Delete zone
POST   /api/zones/batch         - Batch create/update zones
```

### Analytics
```
POST   /api/analytics                - Log analytics data
GET    /api/analytics/:cameraId      - Get analytics for camera
GET    /api/analytics/:cameraId/summary  - Get aggregated summary
POST   /api/analytics/insights       - Log zone insight
GET    /api/analytics/insights/:zoneId   - Get insights for zone
```

## API Usage Examples

### Create Camera
```bash
curl -X POST http://localhost:3001/api/cameras \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Main Entrance",
    "sourceType": "WEBCAM",
    "sourceValue": "0",
    "createdBy": "user-uuid"
  }'
```

### Create Zone
```bash
curl -X POST http://localhost:3001/api/zones \
  -H "Content-Type: application/json" \
  -d '{
    "cameraId": "camera-uuid",
    "name": "Entrance Zone",
    "type": "ENTRANCE",
    "coordinates": [
      {"x": 0.1, "y": 0.1},
      {"x": 0.4, "y": 0.1},
      {"x": 0.4, "y": 0.3},
      {"x": 0.1, "y": 0.3}
    ],
    "createdBy": "user-uuid"
  }'
```

### Log Analytics Data
```bash
curl -X POST http://localhost:3001/api/analytics \
  -H "Content-Type: application/json" \
  -d '{
    "cameraId": "camera-uuid",
    "peopleIn": 10,
    "peopleOut": 5,
    "currentCount": 5,
    "demographics": {
      "gender": {"male": 3, "female": 2},
      "ages": {"adult": 4, "young": 1}
    }
  }'
```

## Development Commands

```bash
npm run dev           # Start development server with hot reload
npm run build         # Build TypeScript to JavaScript
npm start             # Start production server

npm run db:generate   # Generate Prisma client
npm run db:migrate    # Run database migrations
npm run db:studio     # Open Prisma Studio (GUI for database)
npm run db:seed       # Seed database with sample data
npm run db:reset      # Reset database (WARNING: deletes all data)
```

## Database Migrations

### Create New Migration

After modifying `prisma/schema.prisma`:

```bash
npm run db:migrate
```

Enter migration name when prompted.

### View Migration Status

```bash
npx prisma migrate status
```

## Prisma Studio

Visual database editor:

```bash
npm run db:studio
```

Opens at `http://localhost:5555`

## Integration with Python Analytics

The Python camera analytics backend can send data to this API:

```python
import requests

# Log analytics data
requests.post('http://localhost:3001/api/analytics', json={
    'cameraId': camera_id,
    'peopleIn': metrics.people_in,
    'peopleOut': metrics.people_out,
    'currentCount': metrics.current,
    'demographics': {
        'gender': metrics.gender,
        'ages': metrics.age_buckets
    }
})
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Use secure `DATABASE_URL` with SSL
3. Set strong `JWT_SECRET`
4. Run migrations: `npm run db:migrate:prod`
5. Start server: `npm start`

## Troubleshooting

### Database Connection Failed

```bash
# Check PostgreSQL is running
brew services list

# Restart PostgreSQL
brew services restart postgresql@15

# Test connection
psql -d observai -c "SELECT 1"
```

### Migration Failed

```bash
# Reset and retry
npm run db:reset
npm run db:migrate
npm run db:seed
```

## License

Proprietary - ObservAI Platform
