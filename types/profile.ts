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
export const LANGUAGE_OPTIONS = [
  "english",
  "spanish",
  "mandarin",
  "cantonese",
  "malay",
  "tamil",
  "french",
  "hindi"
] as const;

export const ONBOARDING_TAG_OPTIONS = {
  hobbies: ["travel", "hiking", "cooking", "gaming", "photography", "reading", "art"],
  education: ["high_school", "bachelors", "masters", "doctorate", "self_taught"],
  religion: ["christianity", "islam", "hinduism", "buddhism", "judaism", "agnostic", "atheist"],
  nationality: ["american", "canadian", "mexican", "indian", "filipino", "korean", "japanese"],
  sports: ["soccer", "basketball", "tennis", "swimming", "running", "gym", "yoga"],
  music: ["pop", "hip_hop", "r_and_b", "rock", "jazz", "k_pop", "classical"],
  zodiac_sign: ["aries", "taurus", "gemini", "cancer", "leo", "virgo", "libra", "scorpio", "sagittarius", "capricorn", "aquarius", "pisces"]
} as const;

export type Gender = (typeof GENDER_OPTIONS)[number];
export type SexualPreference = (typeof SEXUAL_PREFERENCE_OPTIONS)[number];
export type SkinTone = (typeof SKIN_TONE_OPTIONS)[number];
export type CommunicationLanguage = (typeof LANGUAGE_OPTIONS)[number];
export type OnboardingTagKey = keyof typeof ONBOARDING_TAG_OPTIONS;
