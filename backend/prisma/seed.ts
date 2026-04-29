import bcrypt from "bcryptjs";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@banking-sim.ug";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "Admin12345!";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { fullName: "Platform Admin", passwordHash, role: Role.admin },
    create: { fullName: "Platform Admin", email: adminEmail, passwordHash, role: Role.admin },
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
