import fs from "fs";
import path from "path";

export async function POST() {
  const memoryPath = path.join(
    process.cwd(),
    "data",
    "jimmy-memory.json"
  );

  fs.writeFileSync(memoryPath, "[]");

  return Response.json({
    success: true,
    message: "Jimmy memory cleared",
  });
}