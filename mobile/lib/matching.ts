import { normalizeToken } from "@/types/profile";

export type MatchableProfile = {
  user_id: string;
  display_name: string;
  age_years: number;
  gender: string;
  sexual_preference: string;
  nationality: string | null;
  bio: string | null;
  is_published: boolean;
  avatar_url: string | null;
  public_id: string | null;
};

export type MatchablePreference = {
  user_id: string;
  min_age: number | null;
  max_age: number | null;
  preferred_languages: string[] | null;
  preferred_genders: string[] | null;
  preferred_nationalities: string[] | null;
  profile_tags: Record<string, unknown> | null;
};

export type MatchSuggestion = {
  profile: MatchableProfile;
  score: number;
  reasons: string[];
};

function ageBracketCompatible(a: number, b: number): boolean {
  if (a < 18) return b < 18;
  return b >= 18;
}

function inPreferenceRange(age: number, pref: MatchablePreference | undefined): boolean {
  if (!pref?.min_age || !pref?.max_age) return true;
  return age >= pref.min_age && age <= pref.max_age;
}

function tagsFromPreference(pref: MatchablePreference | undefined): Set<string> {
  const tags = new Set<string>();
  if (!pref?.profile_tags || typeof pref.profile_tags !== "object") return tags;
  Object.values(pref.profile_tags).forEach((value) => {
    if (!Array.isArray(value)) return;
    value.forEach((item) => {
      const token = normalizeToken(String(item));
      if (token) tags.add(token);
    });
  });
  return tags;
}

function languageOverlap(a: string[] | null | undefined, b: string[] | null | undefined): number {
  const left = new Set((a ?? []).map((v) => normalizeToken(v)).filter(Boolean));
  if (left.size === 0) return 0;
  const right = new Set((b ?? []).map((v) => normalizeToken(v)).filter(Boolean));
  let count = 0;
  left.forEach((token) => {
    if (right.has(token)) count += 1;
  });
  return count;
}

function setOverlapSize(a: Set<string>, b: Set<string>): number {
  let total = 0;
  a.forEach((value) => {
    if (b.has(value)) total += 1;
  });
  return total;
}

function completionScore(profile: MatchableProfile): number {
  let score = 0;
  if (profile.avatar_url) score += 8;
  if (profile.bio && profile.bio.trim().length >= 30) score += 10;
  if (profile.nationality) score += 4;
  return score;
}

function preferenceFitScore(
  mePref: MatchablePreference | undefined,
  other: MatchableProfile,
  reasons: string[]
): number {
  let score = 0;

  const preferredGenders = (mePref?.preferred_genders ?? []).map((value) => normalizeToken(value));
  if (preferredGenders.length > 0 && preferredGenders.includes(normalizeToken(other.gender))) {
    score += 12;
    reasons.push("Matches your preferred gender");
  }

  const preferredNationalities = (mePref?.preferred_nationalities ?? []).map((value) => normalizeToken(value));
  if (preferredNationalities.length > 0 && preferredNationalities.includes(normalizeToken(other.nationality ?? ""))) {
    score += 8;
    reasons.push("Matches your nationality preference");
  }

  return score;
}

export function buildSuggestions(args: {
  me: MatchableProfile;
  myPreference?: MatchablePreference;
  candidates: MatchableProfile[];
  preferencesByUserId: Map<string, MatchablePreference>;
  excludedUserIds?: Set<string>;
  limit?: number;
}): MatchSuggestion[] {
  const {
    me,
    myPreference,
    candidates,
    preferencesByUserId,
    excludedUserIds = new Set<string>(),
    limit = 20
  } = args;

  const myTags = tagsFromPreference(myPreference);

  const scored = candidates
    .filter((candidate) => candidate.is_published)
    .filter((candidate) => candidate.user_id !== me.user_id)
    .filter((candidate) => !excludedUserIds.has(candidate.user_id))
    .filter((candidate) => ageBracketCompatible(me.age_years, candidate.age_years))
    .filter((candidate) => inPreferenceRange(candidate.age_years, myPreference))
    .filter((candidate) => inPreferenceRange(me.age_years, preferencesByUserId.get(candidate.user_id)))
    .map((candidate) => {
      const reasons: string[] = [];
      let score = 45;

      const otherPreference = preferencesByUserId.get(candidate.user_id);
      const languageMatches = languageOverlap(myPreference?.preferred_languages, otherPreference?.preferred_languages);
      if (languageMatches > 0) {
        score += Math.min(20, languageMatches * 6);
        reasons.push(languageMatches > 1 ? "You share multiple languages" : "You share a language");
      }

      const otherTags = tagsFromPreference(otherPreference);
      const sharedTags = setOverlapSize(myTags, otherTags);
      if (sharedTags > 0) {
        score += Math.min(22, sharedTags * 7);
        reasons.push(sharedTags > 1 ? "Strong shared interests" : "Shared interests");
      }

      score += preferenceFitScore(myPreference, candidate, reasons);
      score += completionScore(candidate);

      if (reasons.length === 0) {
        reasons.push("Strong baseline compatibility");
      }

      return {
        profile: candidate,
        score,
        reasons
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return scored;
}
