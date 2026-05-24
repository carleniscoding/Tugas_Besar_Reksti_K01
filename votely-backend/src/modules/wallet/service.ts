import crypto from "node:crypto";
import { ethers } from "ethers";
import { env } from "../../config/env.js";
import { HttpError } from "../../shared/http.js";

const ALGORITHM = "aes-256-cbc";
const IV_LENGTH = 16;

function encryptKey(text: string) {
  if (env.encryptionKey.length !== 32) {
    throw new HttpError(500, "ENCRYPTION_KEY harus tepat 32 karakter.");
  }
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, Buffer.from(env.encryptionKey), iv);
  const encrypted = Buffer.concat([cipher.update(text), cipher.final()]);
  return `${iv.toString("hex")}:${encrypted.toString("hex")}`;
}

export function generateWallet() {
  const wallet = ethers.Wallet.createRandom();
  return {
    walletAddress: wallet.address,
    encryptedPrivateKey: encryptKey(wallet.privateKey),
  };
}
