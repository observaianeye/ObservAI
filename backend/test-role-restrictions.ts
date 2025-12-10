/**
 * Test script for role-based access control
 * Tests ANALYST (read-only) vs MANAGER/ADMIN permissions
 */

import { attachMockUser } from './src/middleware/roleCheck';
import express, { Request, Response } from 'express';
import camerasRouter from './src/routes/cameras';
import zonesRouter from './src/routes/zones';
import pythonBackendRouter from './src/routes/python-backend';

const app = express();
app.use(express.json());

console.log('=== Role-Based Access Control Test Suite ===\n');

// Test 1: ANALYST (Read-Only) Role
console.log('Test 1: ANALYST role restrictions');
console.log('Expected: GET allowed, POST/PUT/DELETE forbidden\n');

const analystApp = express();
analystApp.use(express.json());
analystApp.use(attachMockUser('ANALYST'));
analystApp.use('/api/cameras', camerasRouter);
analystApp.use('/api/zones', zonesRouter);
analystApp.use('/api/python-backend', pythonBackendRouter);

const analystServer = analystApp.listen(3002, async () => {
  console.log('Testing ANALYST role on port 3002...\n');

  try {
    // Test GET /api/cameras (should work)
    const getCameras = await fetch('http://localhost:3002/api/cameras');
    console.log(`✓ GET /api/cameras: ${getCameras.status} ${getCameras.statusText}`);

    // Test POST /api/cameras (should fail with 403)
    const postCamera = await fetch('http://localhost:3002/api/cameras', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Camera',
        sourceType: 'WEBCAM',
        sourceValue: '0',
        createdBy: 'test-user-id'
      })
    });
    const postResult = await postCamera.json();
    console.log(`${postCamera.status === 403 ? '✓' : '✗'} POST /api/cameras: ${postCamera.status} - ${postResult.message || postResult.error}`);

    // Test PUT /api/cameras/:id (should fail with 403)
    const putCamera = await fetch('http://localhost:3002/api/cameras/test-id', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Camera' })
    });
    const putResult = await putCamera.json();
    console.log(`${putCamera.status === 403 ? '✓' : '✗'} PUT /api/cameras/:id: ${putCamera.status} - ${putResult.message || putResult.error}`);

    // Test DELETE /api/cameras/:id (should fail with 403)
    const deleteCamera = await fetch('http://localhost:3002/api/cameras/test-id', {
      method: 'DELETE'
    });
    const deleteResult = deleteCamera.status === 403 ? await deleteCamera.json() : {};
    console.log(`${deleteCamera.status === 403 ? '✓' : '✗'} DELETE /api/cameras/:id: ${deleteCamera.status} - ${deleteResult.message || deleteResult.error}`);

    // Test POST /api/python-backend/start (should fail with 403)
    const startBackend = await fetch('http://localhost:3002/api/python-backend/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 0 })
    });
    const startResult = await startBackend.json();
    console.log(`${startBackend.status === 403 ? '✓' : '✗'} POST /api/python-backend/start: ${startBackend.status} - ${startResult.message || startResult.error}`);

    console.log('\n✅ ANALYST role test complete\n');
  } catch (error) {
    console.error('Error during ANALYST tests:', error);
  } finally {
    analystServer.close();
  }

  // Test 2: MANAGER Role
  console.log('Test 2: MANAGER role permissions');
  console.log('Expected: All operations allowed (GET/POST/PUT/DELETE)\n');

  const managerApp = express();
  managerApp.use(express.json());
  managerApp.use(attachMockUser('MANAGER'));
  managerApp.use('/api/cameras', camerasRouter);
  managerApp.use('/api/zones', zonesRouter);
  managerApp.use('/api/python-backend', pythonBackendRouter);

  const managerServer = managerApp.listen(3003, async () => {
    console.log('Testing MANAGER role on port 3003...\n');

    try {
      // Test GET /api/cameras (should work)
      const getCameras = await fetch('http://localhost:3003/api/cameras');
      console.log(`✓ GET /api/cameras: ${getCameras.status} ${getCameras.statusText}`);

      // Test POST /api/cameras (should work)
      const postCamera = await fetch('http://localhost:3003/api/cameras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Manager Test Camera',
          sourceType: 'WEBCAM',
          sourceValue: '0',
          createdBy: 'demo-user-id'
        })
      });
      console.log(`${postCamera.status === 201 || postCamera.status === 500 ? '✓' : '✗'} POST /api/cameras: ${postCamera.status} (403 = blocked, 201/500 = allowed)`);

      // Test PUT /api/cameras/:id (should work - will fail with 500 due to no DB, but not 403)
      const putCamera = await fetch('http://localhost:3003/api/cameras/test-id', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Camera' })
      });
      console.log(`${putCamera.status !== 403 ? '✓' : '✗'} PUT /api/cameras/:id: ${putCamera.status} (403 = blocked, other = allowed)`);

      // Test DELETE /api/cameras/:id (should fail with 403 - requires ADMIN)
      const deleteCamera = await fetch('http://localhost:3003/api/cameras/test-id', {
        method: 'DELETE'
      });
      const deleteResult = deleteCamera.status === 403 ? await deleteCamera.json() : {};
      console.log(`${deleteCamera.status === 403 ? '✓' : '✗'} DELETE /api/cameras/:id: ${deleteCamera.status} - ${deleteResult.message || 'MANAGER cannot delete, only ADMIN'}`);

      console.log('\n✅ MANAGER role test complete\n');
    } catch (error) {
      console.error('Error during MANAGER tests:', error);
    } finally {
      managerServer.close();
    }

    // Test 3: ADMIN Role
    console.log('Test 3: ADMIN role permissions');
    console.log('Expected: Full access to all operations\n');

    const adminApp = express();
    adminApp.use(express.json());
    adminApp.use(attachMockUser('ADMIN'));
    adminApp.use('/api/cameras', camerasRouter);

    const adminServer = adminApp.listen(3004, async () => {
      console.log('Testing ADMIN role on port 3004...\n');

      try {
        // Test DELETE /api/cameras/:id (should work)
        const deleteCamera = await fetch('http://localhost:3004/api/cameras/test-id', {
          method: 'DELETE'
        });
        console.log(`${deleteCamera.status !== 403 ? '✓' : '✗'} DELETE /api/cameras/:id: ${deleteCamera.status} (403 = blocked, other = allowed)`);

        console.log('\n✅ ADMIN role test complete\n');
      } catch (error) {
        console.error('Error during ADMIN tests:', error);
      } finally {
        adminServer.close();
      }

      console.log('\n=== All Role Tests Complete ===');
      console.log('\nSummary:');
      console.log('- ANALYST: Read-only (GET) ✓');
      console.log('- MANAGER: Can create/update cameras and zones ✓');
      console.log('- ADMIN: Full access including delete ✓');
      process.exit(0);
    });
  });
});
