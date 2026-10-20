const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

// Match candidate sequences first, then count their digits. This leaves short
// quantities, prices, order numbers, and times unchanged.
const NUMBER_CANDIDATE_PATTERN =
  /\+?(?:\(\s*)?\d(?:[\d \t().-]*\d)?(?:[ \t]*\))?/g;

export function redactContactInfo(text: string | null): string | null {
  if (text === null) return null;

  return text
    .replace(EMAIL_PATTERN, "[email hidden]")
    .replace(NUMBER_CANDIDATE_PATTERN, (candidate) => {
      const digitCount = candidate.replace(/\D/g, "").length;
      return digitCount >= 10 ? "[number hidden]" : candidate;
    });
}