import superjson from "superjson";
import { z } from "zod";
import { requireRole, HttpError } from "../../helpers/requireRole";
import { schema, type OutputType } from "./test_chat_POST.schema";

const sarvamResponseSchema = z.object({
  model: z.string(),
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string(),
      }),
    })
  ).min(1),
});

export async function handle(request: Request): Promise<Response> {
  try {
    await requireRole(request, ["admin"]);
    const { prompt } = schema.parse(superjson.parse(await request.text()));

    const key = process.env.SARVAM_API_KEY;
    if (!key) {
      throw new HttpError(500, "SARVAM_API_KEY is not set");
    }

    const response = await fetch("https://api.sarvam.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "api-subscription-key": key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "sarvam-105b-conversations",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Sarvam chat completion failed", response.status, errorText);
      throw new HttpError(response.status, errorText);
    }

    const result = sarvamResponseSchema.parse(await response.json());
    return requireRole.json({
      model: result.model,
      reply: result.choices[0].message.content,
    } satisfies OutputType);
  } catch (error) {
    return requireRole.errorResponse(error);
  }
}