// ============================================================
// FitMatch AI - Type Definitions
// ============================================================

export type ClothingCategory =
  | "shirt"
  | "t-shirt"
  | "hoodie"
  | "jacket"
  | "sweater"
  | "blazer"
  | "pants"
  | "jeans"
  | "shorts"
  | "skirt"
  | "dress"
  | "shoes"
  | "sneakers"
  | "boots"
  | "hat"
  | "bag"
  | "watch"
  | "accessory"
  | "other";

export type StyleCategory =
  | "casual"
  | "streetwear"
  | "minimal"
  | "formal"
  | "sporty"
  | "bohemian"
  | "preppy"
  | "vintage";

export type PatternType =
  | "plain"
  | "striped"
  | "plaid"
  | "graphic"
  | "floral"
  | "polka-dot"
  | "abstract"
  | "camo"
  | "other";

// ---- Image Analysis ----
export interface ClothingAnalysis {
  type: ClothingCategory;
  primaryColor: string;
  secondaryColor?: string;
  pattern: PatternType;
  style: StyleCategory;
  material?: string;
  description: string;
}

// ---- Outfit Suggestions ----
export interface OutfitItem {
  category: ClothingCategory;
  description: string;
  suggestedColor: string;
  notes?: string;
}

export interface OutfitSuggestion {
  id: string;
  name: string;
  styleCategory: StyleCategory;
  items: OutfitItem[];
  accessories: OutfitItem[];
  colorExplanation: string;
  styleExplanation: string;
  confidenceScore: number;
  occasion?: string;
}

// ---- User / Profile ----
export interface StyleProfile {
  primaryStyle: StyleCategory;
  secondaryStyle?: StyleCategory;
  favoriteColors: string[];
  preferredBrands?: string[];
  bodyType?: string;
  fashionInspirations?: string[];
}

export interface QuizAnswers {
  age?: string;
  gender?: string;
  favoriteColors: string[];
  preferredStyles: StyleCategory[];
  fashionInspirations: string[];
  budgetRange?: string;
  lifestyle?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName?: string;
  avatarUrl?: string;
  styleProfile?: StyleProfile;
  quizAnswers?: QuizAnswers;
  quizCompleted: boolean;
  createdAt: string;
}

// ---- Wardrobe ----
export interface WardrobeItem {
  id: string;
  userId: string;
  name: string;
  category: ClothingCategory;
  color: string;
  secondaryColor?: string;
  style: StyleCategory;
  pattern?: PatternType;
  imageUrl?: string;
  notes?: string;
  isFavorite: boolean;
  createdAt: string;
}

// ---- Uploaded Items ----
export interface UploadedItem {
  id: string;
  userId: string;
  imageUrl: string;
  analysis: ClothingAnalysis;
  createdAt: string;
}

// ---- Saved Outfits ----
export interface SavedOutfit {
  id: string;
  userId: string;
  sourceItemId?: string;
  outfit: OutfitSuggestion;
  isSaved: boolean;
  createdAt: string;
}

// ---- API Types ----
export interface AnalyzeImageRequest {
  imageBase64: string;
  imageUrl?: string;
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
