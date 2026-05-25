import dotenv from "dotenv";
import bcrypt from "bcryptjs";
import { Pool } from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

dotenv.config({ path: "../.env" });
dotenv.config({ path: ".env" });

const nik = process.argv[2] || "9999999999999999";
const password = process.argv[3] || "admin12345";

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is not defined.");
}

const pool = new Pool({ connectionString });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

try {
  const passwordHash = await bcrypt.hash(password, 10);

  const penduduk = await prisma.penduduk.upsert({
    where: { nik },
    update: {
      namaLengkap: "Administrator",
      tanggalLahir: new Date("2000-01-01"),
      provinsi: "DKI Jakarta",
      kabKota: "Jakarta Pusat",
      kecamatan: "Gambir",
      kelurahan: "Gambir",
    },
    create: {
      nik,
      namaLengkap: "Administrator",
      tanggalLahir: new Date("2000-01-01"),
      provinsi: "DKI Jakarta",
      kabKota: "Jakarta Pusat",
      kecamatan: "Gambir",
      kelurahan: "Gambir",
    },
  });

  await prisma.user.upsert({
    where: { pendudukId: penduduk.id },
    update: {
      password: passwordHash,
      role: "ADMIN",
    },
    create: {
      pendudukId: penduduk.id,
      password: passwordHash,
      role: "ADMIN",
      walletAddress: "",
      encryptedPrivateKey: "",
    },
  });

  console.log("Admin dibuat / diperbarui");
  console.log(`NIK: ${nik}`);
  console.log(`Password: ${password}`);
} finally {
  await prisma.$disconnect();
  await pool.end();
}
