export async function GET() {
    return Response.json({
      keyExists: !!process.env.OPENAI_API_KEY,
    });
  }