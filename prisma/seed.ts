import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import pg from 'pg';

const connectionString = `${process.env.DIRECT_URL || process.env.DATABASE_URL}`;
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting seeding...');

  // 1. Asegurar que exista al menos un perfil (System User o Admin)
  // En Supabase auth.users y public.profiles están vinculados.
  const firstUser = await prisma.users.findFirst({
    select: { id: true },
  });

  if (!firstUser) {
    console.log('⚠️ No users found in auth.users. Please create a user in Supabase first.');
    return;
  }

  const systemUserId = firstUser.id;

  // 2. Crear canal de #notificaciones si no existe
  const notifChannel = await prisma.conversations.upsert({
    where: { slug: 'notificaciones' },
    update: {},
    create: {
      type: 'channel',
      slug: 'notificaciones',
      name: 'Notificaciones',
      description: 'Todas las notificaciones del sistema: pedidos, alertas, mensajes importantes',
      created_by: systemUserId,
      is_private: false,
      settings: {
        allow_reactions: true,
        slow_mode: 0,
        allow_editing: false,
        allow_deleting: false,
      },
    },
  });

  console.log(`✅ Canal #notificaciones asegurado con ID: ${notifChannel.id}`);

  // 3. Suscribir al usuario creador al canal si no lo está
  await prisma.conversation_members.upsert({
    where: {
      conversation_id_user_id: {
        conversation_id: notifChannel.id,
        user_id: systemUserId,
      },
    },
    update: {},
    create: {
      conversation_id: notifChannel.id,
      user_id: systemUserId,
      role: 'owner',
      notifications: { all: true, mentions: true, replies: true },
    },
  });

  console.log('🌱 Seeding finished successfully.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
