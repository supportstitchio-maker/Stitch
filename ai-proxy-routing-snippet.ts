// ---- Add this near the top of supabase/functions/ai-proxy/index.ts ----
//
// The client (see callClaude in study.js) now sends a `task` label
// alongside systemPrompt/userPrompt -- 'chat' for StudyBot conversation,
// 'materials' for bulk flashcard/quiz generation from an uploaded file.
// The actual model id is decided HERE, server-side, not by the client --
// that's the whole point: a modified/compromised frontend can send any
// `task` string it wants, but it can only ever pick from this map, never
// force an arbitrary (expensive) model directly.

const ROUTES: Record<string, string> = {
  // StudyBot tutoring chat: short, conversational, but needs to reason
  // well across any subject a student might ask about -- worth paying
  // slightly more per call since replies are short (2-5 sentences), so
  // the actual token cost stays low regardless of model choice.
  chat: "claude-sonnet-5",

  // Bulk flashcard/quiz generation from an uploaded PDF/DOCX/PPTX: large
  // input (up to ~12k chars of extracted text) and large structured JSON
  // output (6-10 flashcards + 5-8 questions). This is a mechanical
  // extraction-and-formatting task with a strict schema, not open-ended
  // reasoning -- Haiku handles it well and is dramatically cheaper at
  // this volume.
  materials: "claude-haiku-4-5-20251001",
};

const DEFAULT_MODEL = "claude-sonnet-5"; // fallback if `task` is missing/unrecognized

// ---- Inside the request handler, where you build the Anthropic API call ----
//
// Before (model probably hardcoded or a single constant):
//   const { systemPrompt, userPrompt } = await req.json();
//   ...
//   body: JSON.stringify({
//     model: "claude-sonnet-5",
//     max_tokens: 1024,
//     system: systemPrompt,
//     messages: [{ role: "user", content: userPrompt }],
//   })
//
// After:
//   const { systemPrompt, userPrompt, task } = await req.json();
//   const model = ROUTES[task] || DEFAULT_MODEL;
//   ...
//   body: JSON.stringify({
//     model,
//     max_tokens: task === "materials" ? 2048 : 1024, // materials needs more room for JSON output
//     system: systemPrompt,
//     messages: [{ role: "user", content: userPrompt }],
//   })
//
// Then redeploy:
//   supabase functions deploy ai-proxy
