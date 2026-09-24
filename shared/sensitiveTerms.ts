/**
 * Flags criterion text that appears to reference protected or sensitive characteristics.
 * Used to warn HR while building a job profile; the screening prompt independently refuses to
 * assess such criteria.
 */
const PATTERNS: [RegExp, string][] = [
  [/\b(age|aged|ages|years old|young|youthful|older|elderly|date of birth|dob|born in)\b/i, "age"],
  [/\b(gender|male|female|man|woman|men|women|sex)\b/i, "sex or gender"],
  [/\b(religion|religious|church|christian|muslim|jewish|hindu|buddhist|faith)\b/i, "religion"],
  [/\b(race|racial|ethnic|ethnicity|skin|caucasian|white|black|asian|hispanic|latino)\b/i, "race or ethnicity"],
  [/\b(nationality|national origin|native (?:\w+ )?speaker|mother tongue|accent)\b/i, "national origin"],
  [/\b(married|marital|spouse|children|kids|family status|pregnan\w*|maternity|paternity)\b/i, "family or marital status / pregnancy"],
  [/\b(disabilit\w*|disabled|handicap\w*|medical condition|medical history|health condition|mental health)\b/i, "disability or health"],
  [/\b(sexual orientation|gay|lesbian|bisexual|transgender|lgbt\w*)\b/i, "sexual orientation or gender identity"],
  [/\b(political|party member\w*|union member\w*|trade union)\b/i, "political or union affiliation"],
  [/\b(photo|photograph|appearance|attractive|height|weight)\b/i, "physical appearance"],
];

export function findSensitiveTerms(text: string): string[] {
  return [...new Set(PATTERNS.filter(([re]) => re.test(text)).map(([, label]) => label))];
}
