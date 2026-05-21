import { Router } from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import { env } from "../../config/env.js";
import { asyncHandler, HttpError } from "../../shared/http.js";
import { requireAdmin } from "../auth/middleware.js";

export const storageRouter = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

storageRouter.post("/candidate-photo", requireAdmin, upload.single("file"), asyncHandler(async (req, res) => {
  if (!req.file) throw new HttpError(400, "File is required");
  if (!env.supabaseUrl || !env.supabaseServiceKey) throw new HttpError(500, "Supabase storage is not configured");
  const supabase = createClient(env.supabaseUrl, env.supabaseServiceKey);
  const path = `candidate-photos/${Date.now()}-${req.file.originalname}`;
  const { error } = await supabase.storage.from("candidate-photos").upload(path, req.file.buffer, {
    contentType: req.file.mimetype,
    upsert: false,
  });
  if (error) throw new HttpError(500, error.message);
  const { data } = supabase.storage.from("candidate-photos").getPublicUrl(path);
  res.json({ success: true, url: data.publicUrl, data: { url: data.publicUrl } });
}));
