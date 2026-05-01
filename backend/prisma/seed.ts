import { PrismaClient, Role } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@banking-sim.ug";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin12345!";
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for seeding.");
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data: listedUsers, error: listError } = await supabaseAdmin.auth.admin.listUsers();
  if (listError) throw listError;

  const existingAuthUser = listedUsers.users.find((user) => user.email === adminEmail);
  const authUser = existingAuthUser
    ? existingAuthUser
    : (
        await supabaseAdmin.auth.admin.createUser({
          email: adminEmail,
          password: adminPassword,
          email_confirm: true,
          user_metadata: {
            fullName: "Platform Admin",
            role: Role.admin,
          },
        })
      ).data.user;

  if (!authUser) {
    throw new Error("Unable to create Supabase admin user.");
  }

  const admin = await prisma.user.upsert({
    where: { id: authUser.id },
    update: { fullName: "Platform Admin", email: adminEmail, role: Role.admin },
    create: { id: authUser.id, fullName: "Platform Admin", email: adminEmail, role: Role.admin },
  });

  await prisma.lesson.upsert({
    where: { id: "seed-lesson-1" },
    update: {},
    create: {
      id: "seed-lesson-1",
      title: "What Is Saving?",
      content: "Saving means keeping some money for future needs and goals.",
      isPublished: true,
      createdById: admin.id,
    },
  });

  await prisma.quiz.upsert({
    where: { id: "seed-quiz-1" },
    update: {},
    create: {
      id: "seed-quiz-1",
      title: "Saving Basics Quiz",
      isPublished: true,
      createdById: admin.id,
    },
  });

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
