import eitherDiscriminant from "./either-discriminant.js";
import tagDiscriminant from "./tag-discriminant.js";

export const discriminantsRules = {
  "either-discriminant": eitherDiscriminant,
  "tag-discriminant": tagDiscriminant,
} as const;
