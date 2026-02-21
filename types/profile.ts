export const GENDER_OPTIONS = [
  "female",
  "male",
  "non_binary",
  "trans_female",
  "trans_male",
  "other",
  "prefer_not_to_say"
] as const;

export const SEXUAL_PREFERENCE_OPTIONS = [
  "heterosexual",
  "homosexual",
  "bisexual",
  "pansexual",
  "asexual",
  "questioning",
  "other",
  "prefer_not_to_say"
] as const;

export const SKIN_TONE_OPTIONS = ["light", "medium", "tan", "deep", "prefer_not_to_say"] as const;

export type Gender = (typeof GENDER_OPTIONS)[number];
export type SexualPreference = (typeof SEXUAL_PREFERENCE_OPTIONS)[number];
export type SkinTone = (typeof SKIN_TONE_OPTIONS)[number];
