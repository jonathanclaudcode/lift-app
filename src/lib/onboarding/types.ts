// All onboarding answers — stored as JSONB on clinics.onboarding_data
export interface OnboardingData {
  // Step 1: AI naming
  ai_name?: string

  // Step 2: Domain (triggers background scraping)
  website_domain?: string

  // Steps 3-9: The 7 questions
  q1_customer_communication?: ClickQuestionAnswer
  q2_social_media?: ClickQuestionAnswer
  q3_clinic_vision?: TextQuestionAnswer
  q4_customer_situation?: ClickQuestionAnswer
  q5_cancellations?: ClickQuestionAnswer
  q6_typical_day?: TextQuestionAnswer
  q7_ai_character?: CharacterQuestionAnswer
}

// For click-style questions with adaptive follow-ups (q1, q2, q4, q5)
// follow_ups is an ordered list of every follow-up answered, including
// the "always" question if present. There is NO separate always_answer field.
export interface ClickQuestionAnswer {
  main_choice: string         // Text of the chosen main option
  main_choice_index: number   // Index for follow-up lookup
  follow_ups: FollowUpAnswer[] // Ordered list, includes "always" as last item
}

export interface FollowUpAnswer {
  question: string  // Question text shown
  is_multi: boolean // Multi-select or single-select?
  answers: string[] // Selected option texts (single-select has length 1)
}

// For free-text questions (q3, q6)
export interface TextQuestionAnswer {
  main_text: string
  follow_up_text?: string
}

// For the character question (q7)
export interface CharacterQuestionAnswer {
  selected_character?: {
    name: string
    description: string
  }
  custom_character?: string
}

// Constants for the welcome screen
export const SUGGESTED_AI_NAMES = [
  'Emily', 'Nova', 'Stella', 'Alma', 'Saga', 'Mila', 'Luna', 'Ella',
  'Leo', 'Max', 'Hugo', 'Axel', 'Oliver', 'Theo'
] as const

// Character options for q7
export const AI_CHARACTERS: ReadonlyArray<{ name: string; description: string }> = [
  { name: 'Monica från Vänner', description: 'Organiserad, driven och alltid ett steg före' },
  { name: 'Donna från Suits', description: 'Självsäker, lojal och tar inget skitsnack' },
  { name: 'Leslie Knope från Parks and Rec', description: 'Energisk, bryr sig genuint och ger 110 %' },
  { name: 'Samantha Jones från Sex and the City', description: 'Rak, modig och rädd för ingenting' },
  { name: 'Alfred från Batman', description: 'Lugn, pålitlig och alltid redo i bakgrunden' },
] as const
