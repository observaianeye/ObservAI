/**
 * Database seed script
 * Populates initial data for development
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo user (admin account with demo credentials)
  const demoPassword = await bcrypt.hash('demo1234', 10);
  const demoUser = await prisma.user.upsert({
    where: { email: 'admin@observai.com' },
    update: {
      passwordHash: demoPassword,
      firstName: 'Demo',
      lastName: 'Manager',
      role: 'MANAGER'
    },
    create: {
      email: 'admin@observai.com',
      passwordHash: demoPassword,
      firstName: 'Demo',
      lastName: 'Manager',
      role: 'MANAGER'
    }
  });
  console.log('✅ Created demo user:', demoUser.email);

  // Create manager user
  const managerPassword = await bcrypt.hash('manager123', 10);
  const manager = await prisma.user.upsert({
    where: { email: 'manager@observai.com' },
    update: {},
    create: {
      email: 'manager@observai.com',
      passwordHash: managerPassword,
      firstName: 'Manager',
      lastName: 'User',
      role: 'MANAGER'
    }
  });
  console.log('✅ Created manager user:', manager.email);

  // Create sample camera
  const camera = await prisma.camera.upsert({
    where: { id: 'sample-camera-1' },
    update: {},
    create: {
      id: 'sample-camera-1',
      name: 'Main Entrance Camera',
      description: 'Front door monitoring',
      sourceType: 'WEBCAM',
      sourceValue: '0',
      createdBy: manager.id
    }
  });
  console.log('✅ Created sample camera:', camera.name);

  // Create sample zones
  const entranceZone = await prisma.zone.create({
    data: {
      cameraId: camera.id,
      name: 'Entrance Zone',
      type: 'ENTRANCE',
      coordinates: JSON.stringify([
        { x: 0.1, y: 0.1 },
        { x: 0.4, y: 0.1 },
        { x: 0.4, y: 0.3 },
        { x: 0.1, y: 0.3 }
      ]),
      color: '#10b981',
      createdBy: manager.id
    }
  });
  console.log('✅ Created entrance zone:', entranceZone.name);

  const queueZone = await prisma.zone.create({
    data: {
      cameraId: camera.id,
      name: 'Queue Area',
      type: 'QUEUE',
      coordinates: JSON.stringify([
        { x: 0.5, y: 0.4 },
        { x: 0.8, y: 0.4 },
        { x: 0.8, y: 0.7 },
        { x: 0.5, y: 0.7 }
      ]),
      color: '#f59e0b',
      createdBy: manager.id
    }
  });
  console.log('✅ Created queue zone:', queueZone.name);

  // Create sample analytics log
  const analyticsLog = await prisma.analyticsLog.create({
    data: {
      cameraId: camera.id,
      peopleIn: 10,
      peopleOut: 5,
      currentCount: 5,
      demographics: JSON.stringify({
        gender: { male: 3, female: 2, unknown: 0 },
        ages: { adult: 4, young: 1 }
      }),
      queueCount: 2,
      avgWaitTime: 45.5,
      longestWaitTime: 120.0,
      fps: 25.0
    }
  });
  console.log('✅ Created sample analytics log:', analyticsLog.id);

  console.log('🎉 Database seeded successfully!');
  console.log('\n📝 Test credentials:');
  console.log('   Demo Account: admin@observai.com / demo1234 (MANAGER role)');
  console.log('   Manager: manager@observai.com / manager123');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
