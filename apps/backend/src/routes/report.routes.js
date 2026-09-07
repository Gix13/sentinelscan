import express from "express";
import { getHistory, getReport } from "../store/dbStore.js";

const router = express.Router();

router.get("/history", async (req, res, next) => {
  try {
    const limit = Number(req.query.limit || 50);
    const userId = req.query.userId || "anonymous";

    const items = await getHistory(limit, userId);

    return res.json({
      ok: true,
      data: { items }
    });
  } catch (err) {
    return next(err);
  }
});

router.get("/report/:id", async (req, res, next) => {
  try {
    const report = await getReport(req.params.id);

    if (!report) {
      return res.status(404).json({
        ok: false,
        error: { code: "NOT_FOUND", message: "Report not found" }
      });
    }

    return res.json({ ok: true, data: report });
  } catch (err) {
    return next(err);
  }
});

export default router;
