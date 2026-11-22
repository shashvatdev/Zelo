import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { config } from "./config";

/**
 * File bytes. Local disk for now (one server); swap these three functions for S3/R2 to scale out.
 * Keys are random and never derived from user input, so paths can't be traversed.
 */
const root = () => path.resolve(process.cwd(), config.uploadDir);

export async function putObject(bytes: Buffer) {
  const key = `${new Date().toISOString().slice(0, 7)}/${randomUUID()}`;
  const file = path.join(root(), key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
  return key;
}

export async function getObject(key: string) {
  if (!/^\d{4}-\d{2}\/[0-9a-f-]{36}$/.test(key)) throw new Error("bad key");
  return readFile(path.join(root(), key));
}

export async function deleteObject(key: string) {
  if (!/^\d{4}-\d{2}\/[0-9a-f-]{36}$/.test(key)) return;
  await rm(path.join(root(), key), { force: true });
}

const ALLOWED = /^(image\/(png|jpe?g|gif|webp|avif|heic)|application\/(pdf|zip|json|vnd\.openxmlformats-officedocument\.[\w.]+|vnd\.ms-[\w.]+|msword)|text\/(plain|csv|markdown))$/;
export const allowedMime = (mime: string) => ALLOWED.test(mime);
