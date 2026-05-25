import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Registrasi pemilih dinonaktifkan. Pemilih harus didaftarkan admin melalui CSV." },
    { status: 410 }
  );
}
