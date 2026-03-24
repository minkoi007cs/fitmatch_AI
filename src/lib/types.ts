export const CLOTHING_CATEGORIES = [
  "shirt",
  "t-shirt",
  "hoodie",
  "jacket",
  "sweater",
  "blazer",
  "pants",
  "jeans",
  "shorts",
  "skirt",
  "dress",
  "shoes",
  "sneakers",
  "boots",
  "hat",
  "bag",
  "watch",
  "accessory",
  "other",
] as const;

export const STYLE_CATEGORIES = [
  "casual",
  "streetwear",
  "minimal",
  "formal",
  "sporty",
  "bohemian",
  "preppy",
  "vintage",
] as const;

export const PATTERN_TYPES = [
  "plain",
  "striped",
  "plaid",
  "graphic",
  "floral",
  "polka-dot",
  "abstract",
  "camo",
  "other",
] as const;

export type ClothingCategory = (typeof CLOTHING_CATEGORIES)[number];
export type StyleCategory = (typeof STYLE_CATEGORIES)[number];
export type PatternType = (typeof PATTERN_TYPES)[number];

export interface ClothingAnalysis {
  type: ClothingCategory;
  primaryColor: string;
  secondaryColor?: string;
  pattern: PatternType;
  style: StyleCategory;
  material?: string;
  description: string;
}

export interface OutfitPart {
  category: string;
  description: string;
  suggestedColor: string;
  notes?: string;
}

export interface OutfitSuggestion {
  id: string;
  name: string;
  styleCategory: StyleCategory;
  items: OutfitPart[];
  accessories: OutfitPart[];
  colorExplanation: string;
  styleExplanation: string;
  confidenceScore: number;
  occasion?: string;
}

export interface StyleProfile {
  primaryStyle: StyleCategory;
  secondaryStyle?: StyleCategory | null;
  favoriteColors: string[];
  fashionInspirations?: string[];
  ageRange?: string;
  genderExpression?: string;
  preferredOutfits?: string[];
}

export interface QuizAnswers {
  ageRange: string;
  genderExpression?: string;
  bodyShape?: string;
  heightRange?: string;
  fitPriorities?: string[];
  lifestyle?: string;
  shoppingGoal?: string;
  favoriteColors: string[];
  preferredOutfits: string[];
  fashionInspirations: string[];
}

export interface PersonalStyleRecommendation {
  headline: string;
  summary: string;
  flatteringFocus: string[];
  avoidNotes: string[];
  outfits: Array<{
    name: string;
    occasion: string;
    whyItFitsYou: string;
    pieces: string[];
  }>;
}

export interface WardrobeItemRecord {
  id: string;
  user_id: string;
  name: string;
  category: ClothingCategory;
  color: string;
  secondary_color?: string | null;
  style: StyleCategory;
  pattern?: PatternType | null;
  material?: string | null;
  description?: string | null;
  notes?: string | null;
  image_path?: string | null;
  image_url?: string | null;
  is_favorite?: boolean | null;
  created_at: string;
  updated_at?: string | null;
}

export interface WardrobeItem extends Omit<WardrobeItemRecord, "image_url"> {
  imageUrl?: string | null;
}

export interface SavedOutfitRecord {
  id: string;
  user_id: string;
  source_item_id?: string | null;
  data_json: OutfitSuggestion[];
  created_at: string;
}

export interface UserProfileRecord {
  id: string;
  email: string;
  style_profile?: StyleProfile | null;
  quiz_answers?: QuizAnswers | null;
  created_at?: string;
  updated_at?: string;
}

export interface AnalyzeImageRequest {
  imageBase64: string;
  persist?: boolean;
  storagePath?: string;
}

export interface AnalyzeImageResponse {
  success: boolean;
  analysis?: ClothingAnalysis;
  error?: string;
}

export interface GenerateOutfitRequest {
  analysis: ClothingAnalysis;
  styleProfile?: StyleProfile;
  vibeOverride?: StyleCategory;
  count?: number;
}

export interface GenerateOutfitResponse {
  success: boolean;
  outfits?: OutfitSuggestion[];
  error?: string;
}
