import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    type: {
      type: String,
      enum: ["file", "website"],
      required: true
    },
    status: {
      type: String,
      enum: ["queued", "running", "done", "failed"],
      default: "queued"
    },
    input: {
      // For file scans
      originalName: String,
      size: Number,
      mimeType: String,
      filePath: String,
      sha256: String,
      // For website scans
      url: String
    },
    summary: {
      type: String,
      default: null
    },
    findings: [
      {
        severity: {
          type: String,
          enum: ["info", "low", "medium", "high", "critical"]
        },
        title: String,
        detail: String
      }
    ],
    meta: {
      engine: String,
      sha256: String,
      finishedAt: Date,
      processingTime: Number
    },
    error: {
      code: String,
      message: String
    },
    userId: {
      type: String,
      default: "anonymous",
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Index for efficient querying
reportSchema.index({ createdAt: -1 });
reportSchema.index({ userId: 1, createdAt: -1 });
reportSchema.index({ status: 1 });

export const Report = mongoose.model("Report", reportSchema);
